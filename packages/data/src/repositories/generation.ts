import {
  DEFAULT_SCORING_WEIGHTS,
  generateSchedule,
  type GenerationAvailabilityRule,
  type GenerationCelebration,
  type GenerationInput,
  type GenerationPerson,
  type GenerationUnavailabilityPeriod,
  type ScoringWeights,
  type UnfilledSlot
} from "@escala/core";
import type { AppDatabase } from "../sqlAdapter";

interface PersonRow {
  id: number;
  full_name: string;
  active: number;
}

interface PersonRoleRow {
  person_id: number;
  role_id: number;
  preference_weight: number;
}

interface CelebrationRow {
  id: number;
  date: string;
  time: string;
}

interface RequirementRow {
  celebration_id: number;
  role_id: number;
  quantity_needed: number;
}

interface AvailabilityRow {
  person_id: number;
  weekday: number;
  time: string;
  status: "available" | "unavailable";
}

interface UnavailabilityRow {
  person_id: number;
  start_date: string;
  end_date: string;
}

interface HistoryRow {
  person_id: number;
  celebration_date: string;
}

function getScoringWeights(db: AppDatabase): ScoringWeights {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'scoring_weights'").get() as
    | { value: string }
    | undefined;
  if (!row) return DEFAULT_SCORING_WEIGHTS;
  return { ...DEFAULT_SCORING_WEIGHTS, ...JSON.parse(row.value) };
}

/** Monta o input do motor de geracao (packages/core) a partir do estado atual do banco. */
export function buildGenerationInput(db: AppDatabase, celebrationIds: number[]): GenerationInput {
  const placeholders = celebrationIds.map(() => "?").join(",");

  const celebrationRows = db
    .prepare(`SELECT id, date, time FROM celebrations WHERE id IN (${placeholders})`)
    .all(...celebrationIds) as CelebrationRow[];

  const requirementRows = db
    .prepare(
      `SELECT celebration_id, role_id, quantity_needed FROM celebration_requirements WHERE celebration_id IN (${placeholders})`
    )
    .all(...celebrationIds) as RequirementRow[];

  const requirementsByCelebration = new Map<number, { roleId: number; quantityNeeded: number }[]>();
  for (const row of requirementRows) {
    const list = requirementsByCelebration.get(row.celebration_id) ?? [];
    list.push({ roleId: row.role_id, quantityNeeded: row.quantity_needed });
    requirementsByCelebration.set(row.celebration_id, list);
  }

  const celebrations: GenerationCelebration[] = celebrationRows.map((row) => ({
    id: row.id,
    date: row.date,
    time: row.time,
    requirements: requirementsByCelebration.get(row.id) ?? []
  }));

  const personRows = db.prepare("SELECT id, full_name, active FROM people WHERE active = 1").all() as PersonRow[];
  const roleRows = db
    .prepare("SELECT person_id, role_id, preference_weight FROM person_roles")
    .all() as PersonRoleRow[];

  const rolesByPerson = new Map<number, { roleId: number; preferenceWeight: number }[]>();
  for (const row of roleRows) {
    const list = rolesByPerson.get(row.person_id) ?? [];
    list.push({ roleId: row.role_id, preferenceWeight: row.preference_weight });
    rolesByPerson.set(row.person_id, list);
  }

  const people: GenerationPerson[] = personRows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    active: row.active === 1,
    roles: rolesByPerson.get(row.id) ?? []
  }));

  const availabilityRules: GenerationAvailabilityRule[] = (
    db
      .prepare("SELECT person_id, weekday, time, status FROM availabilities WHERE recurring = 1")
      .all() as AvailabilityRow[]
  ).map((row) => ({ personId: row.person_id, weekday: row.weekday, time: row.time, status: row.status }));

  const unavailabilityPeriods: GenerationUnavailabilityPeriod[] = (
    db.prepare("SELECT person_id, start_date, end_date FROM unavailabilities").all() as UnavailabilityRow[]
  ).map((row) => ({ personId: row.person_id, startDate: row.start_date, endDate: row.end_date }));

  const historyRows = db
    .prepare(
      `SELECT sa.person_id as person_id, c.date as celebration_date
       FROM schedule_assignments sa
       JOIN schedules s ON s.id = sa.schedule_id
       JOIN celebrations c ON c.id = s.celebration_id
       WHERE sa.status != 'declined'`
    )
    .all() as HistoryRow[];

  const assignmentCountByPerson: Record<number, number> = {};
  const lastAssignmentDateByPerson: Record<number, string> = {};
  for (const row of historyRows) {
    assignmentCountByPerson[row.person_id] = (assignmentCountByPerson[row.person_id] ?? 0) + 1;
    const current = lastAssignmentDateByPerson[row.person_id];
    if (!current || row.celebration_date > current) {
      lastAssignmentDateByPerson[row.person_id] = row.celebration_date;
    }
  }

  return {
    celebrations,
    people,
    availabilityRules,
    unavailabilityPeriods,
    history: { assignmentCountByPerson, lastAssignmentDateByPerson },
    weights: getScoringWeights(db)
  };
}

export interface PersistedAssignment {
  id: number;
  roleId: number;
  roleName: string;
  personId: number;
  personName: string;
  score: number;
  source: "auto" | "manual";
  status: "proposed" | "confirmed" | "declined";
}

export interface ScheduleWithAssignments {
  id: number;
  celebrationId: number;
  status: "draft" | "published" | "archived";
  assignments: PersistedAssignment[];
}

interface AssignmentRow {
  id: number;
  role_id: number;
  role_name: string;
  person_id: number;
  person_name: string;
  score: number;
  source: "auto" | "manual";
  status: "proposed" | "confirmed" | "declined";
}

function mapAssignmentRow(row: AssignmentRow): PersistedAssignment {
  return {
    id: row.id,
    roleId: row.role_id,
    roleName: row.role_name,
    personId: row.person_id,
    personName: row.person_name,
    score: row.score,
    source: row.source,
    status: row.status
  };
}

export function getScheduleForCelebration(db: AppDatabase, celebrationId: number): ScheduleWithAssignments | undefined {
  const schedule = db
    .prepare("SELECT id, celebration_id, status FROM schedules WHERE celebration_id = ?")
    .get(celebrationId) as { id: number; celebration_id: number; status: ScheduleWithAssignments["status"] } | undefined;
  if (!schedule) return undefined;

  const rows = db
    .prepare(
      `SELECT sa.id as id, sa.role_id as role_id, r.name as role_name, sa.person_id as person_id,
              p.full_name as person_name, sa.score as score, sa.source as source, sa.status as status
       FROM schedule_assignments sa
       JOIN roles r ON r.id = sa.role_id
       JOIN people p ON p.id = sa.person_id
       WHERE sa.schedule_id = ?
       ORDER BY r.name, p.full_name`
    )
    .all(schedule.id) as AssignmentRow[];

  return {
    id: schedule.id,
    celebrationId: schedule.celebration_id,
    status: schedule.status,
    assignments: rows.map(mapAssignmentRow)
  };
}

export interface GenerateScheduleResult {
  schedule: ScheduleWithAssignments;
  unfilled: UnfilledSlot[];
}

/**
 * Roda o motor de geracao para uma unica missa e persiste o resultado como
 * escala rascunho (draft). Se ja existir uma escala rascunho para a missa,
 * ela e substituida (permite regenerar enquanto ainda nao foi publicada).
 * Escalas ja publicadas nao sao sobrescritas automaticamente.
 */
export function generateAndSaveSchedule(db: AppDatabase, celebrationId: number): GenerateScheduleResult {
  const input = buildGenerationInput(db, [celebrationId]);
  const result = generateSchedule(input);

  const save = db.transaction(() => {
    const existing = db.prepare("SELECT id, status FROM schedules WHERE celebration_id = ?").get(celebrationId) as
      | { id: number; status: string }
      | undefined;

    if (existing) {
      if (existing.status !== "draft") {
        throw new Error(
          "Essa missa já tem uma escala publicada. A regeração automática não está disponível para escalas já publicadas."
        );
      }
      db.prepare("DELETE FROM schedules WHERE id = ?").run(existing.id);
    }

    const scheduleResult = db
      .prepare("INSERT INTO schedules (celebration_id, status, algorithm_version) VALUES (?, 'draft', 'v1')")
      .run(celebrationId);

    const insertAssignment = db.prepare(
      `INSERT INTO schedule_assignments (schedule_id, role_id, person_id, score, source, status)
       VALUES (@scheduleId, @roleId, @personId, @score, 'auto', 'proposed')`
    );
    for (const assignment of result.assignments) {
      insertAssignment.run({
        scheduleId: scheduleResult.lastInsertRowid,
        roleId: assignment.roleId,
        personId: assignment.personId,
        score: assignment.score
      });
    }

    db.prepare("UPDATE celebrations SET status = 'generated' WHERE id = ?").run(celebrationId);
  });

  save();

  return {
    schedule: getScheduleForCelebration(db, celebrationId) as ScheduleWithAssignments,
    unfilled: result.unfilled
  };
}
