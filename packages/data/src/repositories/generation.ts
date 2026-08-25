import {
  DEFAULT_SCORING_WEIGHTS,
  computeHistoryStats,
  generateSchedule,
  getWeekday,
  hasRole,
  isMarkedUnavailable,
  isOnVacation,
  scoreCandidate,
  slotKey,
  type GenerationAvailabilityRule,
  type GenerationCelebration,
  type GenerationInput,
  type GenerationPerson,
  type GenerationUnavailabilityPeriod,
  type ProposedAssignment,
  type ScoringWeights,
  type UnfilledSlot
} from "@escala/core";
import type { AppDatabase } from "../sqlAdapter";

interface PersonRow {
  id: number;
  full_name: string;
  active: number;
  spouse_person_id: number | null;
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

/**
 * Monta o input do motor de geracao (packages/core) a partir do estado atual
 * do banco. Quando `roleIds` e informado, so as necessidades dessas funcoes
 * entram nas missas (permite gerar "so os Ministros", por exemplo, deixando
 * as outras funcoes intocadas).
 */
export function buildGenerationInput(db: AppDatabase, celebrationIds: number[], roleIds?: number[]): GenerationInput {
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
    if (roleIds && !roleIds.includes(row.role_id)) continue;
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

  const personRows = db
    .prepare("SELECT id, full_name, active, spouse_person_id FROM people WHERE active = 1")
    .all() as PersonRow[];
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
    roles: rolesByPerson.get(row.id) ?? [],
    spousePersonId: row.spouse_person_id
  }));

  const availabilityRules: GenerationAvailabilityRule[] = (
    db
      .prepare("SELECT person_id, weekday, time, status FROM availabilities WHERE recurring = 1")
      .all() as AvailabilityRow[]
  ).map((row) => ({ personId: row.person_id, weekday: row.weekday, time: row.time, status: row.status }));

  const unavailabilityPeriods: GenerationUnavailabilityPeriod[] = (
    db.prepare("SELECT person_id, start_date, end_date FROM unavailabilities").all() as UnavailabilityRow[]
  ).map((row) => ({ personId: row.person_id, startDate: row.start_date, endDate: row.end_date }));

  // exclui as proprias missas sendo (re)geradas: suas atribuicoes atuais serao
  // substituidas por esta chamada, entao nao devem contar como "ja ocupado" nem
  // pesar no equilibrio/penalidade de quem esta prestes a ser reescalado nelas.
  const historyRows = db
    .prepare(
      `SELECT sa.person_id as person_id, c.date as celebration_date
       FROM schedule_assignments sa
       JOIN schedules s ON s.id = sa.schedule_id
       JOIN celebrations c ON c.id = s.celebration_id
       WHERE sa.status != 'declined' AND c.id NOT IN (${placeholders})`
    )
    .all(...celebrationIds) as HistoryRow[];

  const assignmentCountByPerson: Record<number, number> = {};
  const lastAssignmentDateByPerson: Record<number, string> = {};
  const busyDatesByPerson: Record<number, string[]> = {};
  for (const row of historyRows) {
    assignmentCountByPerson[row.person_id] = (assignmentCountByPerson[row.person_id] ?? 0) + 1;
    const current = lastAssignmentDateByPerson[row.person_id];
    if (!current || row.celebration_date > current) {
      lastAssignmentDateByPerson[row.person_id] = row.celebration_date;
    }
    const dates = busyDatesByPerson[row.person_id] ?? (busyDatesByPerson[row.person_id] = []);
    if (!dates.includes(row.celebration_date)) dates.push(row.celebration_date);
  }

  return {
    celebrations,
    people,
    availabilityRules,
    unavailabilityPeriods,
    history: { assignmentCountByPerson, lastAssignmentDateByPerson, busyDatesByPerson },
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
  conflictFlag: boolean;
}

export interface ScheduleWithAssignments {
  id: number;
  celebrationId: number;
  status: "draft" | "published" | "archived";
  assignments: PersistedAssignment[];
  unfilled: UnfilledSlot[];
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
  conflict_flag: number;
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
    status: row.status,
    conflictFlag: row.conflict_flag === 1
  };
}

const ASSIGNMENT_SELECT = `
  SELECT sa.id as id, sa.role_id as role_id, r.name as role_name, sa.person_id as person_id,
         p.full_name as person_name, sa.score as score, sa.source as source, sa.status as status,
         sa.conflict_flag as conflict_flag
  FROM schedule_assignments sa
  JOIN roles r ON r.id = sa.role_id
  JOIN people p ON p.id = sa.person_id
`;

function getAssignmentById(db: AppDatabase, id: number): PersistedAssignment {
  const row = db.prepare(`${ASSIGNMENT_SELECT} WHERE sa.id = ?`).get(id) as AssignmentRow;
  return mapAssignmentRow(row);
}

function computeUnfilled(db: AppDatabase, celebrationId: number, filledByRole: Map<number, number>): UnfilledSlot[] {
  const requirements = db
    .prepare("SELECT role_id, quantity_needed FROM celebration_requirements WHERE celebration_id = ?")
    .all(celebrationId) as { role_id: number; quantity_needed: number }[];

  const unfilled: UnfilledSlot[] = [];
  for (const req of requirements) {
    const filled = filledByRole.get(req.role_id) ?? 0;
    if (filled < req.quantity_needed) {
      unfilled.push({ celebrationId, roleId: req.role_id, missing: req.quantity_needed - filled });
    }
  }
  return unfilled;
}

export function getScheduleForCelebration(db: AppDatabase, celebrationId: number): ScheduleWithAssignments | undefined {
  const schedule = db
    .prepare("SELECT id, celebration_id, status FROM schedules WHERE celebration_id = ?")
    .get(celebrationId) as { id: number; celebration_id: number; status: ScheduleWithAssignments["status"] } | undefined;
  if (!schedule) return undefined;

  const rows = db
    .prepare(`${ASSIGNMENT_SELECT} WHERE sa.schedule_id = ? ORDER BY r.name, p.full_name`)
    .all(schedule.id) as AssignmentRow[];

  const filledByRole = new Map<number, number>();
  for (const row of rows) {
    filledByRole.set(row.role_id, (filledByRole.get(row.role_id) ?? 0) + 1);
  }

  return {
    id: schedule.id,
    celebrationId: schedule.celebration_id,
    status: schedule.status,
    assignments: rows.map(mapAssignmentRow),
    unfilled: computeUnfilled(db, celebrationId, filledByRole)
  };
}

/**
 * Persiste as atribuicoes geradas para UMA missa como escala rascunho
 * (draft). Se `roleIds` for informado, so as atribuicoes anteriores dessas
 * funcoes sao substituidas (as demais funcoes ficam intocadas) — permite
 * regenerar "so os Ministros" sem mexer nos Leitores ja escalados, por
 * exemplo. Sem `roleIds`, a escala inteira e substituida. Lanca erro se a
 * missa ja tiver uma escala publicada. Deve ser chamada dentro de uma
 * transacao pelo chamador.
 */
function persistGeneratedSchedule(
  db: AppDatabase,
  celebrationId: number,
  roleIds: number[] | undefined,
  assignments: ProposedAssignment[]
): void {
  const existing = db.prepare("SELECT id, status FROM schedules WHERE celebration_id = ?").get(celebrationId) as
    | { id: number; status: string }
    | undefined;

  if (existing && existing.status !== "draft") {
    throw new Error(
      "Essa missa já tem uma escala publicada. A regeração automática não está disponível para escalas já publicadas."
    );
  }

  let scheduleId: number;
  if (existing) {
    scheduleId = existing.id;
    if (roleIds && roleIds.length > 0) {
      const placeholders = roleIds.map(() => "?").join(",");
      db.prepare(`DELETE FROM schedule_assignments WHERE schedule_id = ? AND role_id IN (${placeholders})`).run(
        scheduleId,
        ...roleIds
      );
    } else {
      db.prepare("DELETE FROM schedule_assignments WHERE schedule_id = ?").run(scheduleId);
    }
  } else {
    scheduleId = db
      .prepare("INSERT INTO schedules (celebration_id, status, algorithm_version) VALUES (?, 'draft', 'v1')")
      .run(celebrationId).lastInsertRowid;
  }

  const insertAssignment = db.prepare(
    `INSERT INTO schedule_assignments (schedule_id, role_id, person_id, score, source, status)
     VALUES (@scheduleId, @roleId, @personId, @score, 'auto', 'proposed')`
  );
  for (const assignment of assignments) {
    insertAssignment.run({
      scheduleId,
      roleId: assignment.roleId,
      personId: assignment.personId,
      score: assignment.score
    });
  }

  db.prepare("UPDATE celebrations SET status = 'generated' WHERE id = ?").run(celebrationId);
}

/**
 * Roda o motor de geracao para uma unica missa e persiste o resultado como
 * escala rascunho (draft). Se ja existir uma escala rascunho para a missa,
 * ela e substituida (permite regenerar enquanto ainda nao foi publicada).
 * Escalas ja publicadas nao sao sobrescritas automaticamente. Se `roleIds`
 * for informado, gera so essas funcoes, preservando as demais ja escaladas.
 */
export function generateAndSaveSchedule(
  db: AppDatabase,
  celebrationId: number,
  roleIds?: number[]
): ScheduleWithAssignments {
  const input = buildGenerationInput(db, [celebrationId], roleIds);
  const result = generateSchedule(input);

  db.transaction(() => persistGeneratedSchedule(db, celebrationId, roleIds, result.assignments))();

  return getScheduleForCelebration(db, celebrationId) as ScheduleWithAssignments;
}

export interface BatchGenerationSkip {
  celebrationId: number;
  reason: string;
}

export interface BatchGenerationResult {
  schedules: ScheduleWithAssignments[];
  skipped: BatchGenerationSkip[];
}

/**
 * Roda o motor de geracao para TODAS as missas de um periodo de uma so vez,
 * o que permite o autoequilibrio real entre elas (quem foi escalado numa
 * missa do inicio do mes perde prioridade nas seguintes) — diferente de
 * gerar missa por missa, onde o equilibrio so enxerga o historico ja salvo.
 * Missas com escala ja publicada sao puladas (ver `skipped`). Se `roleIds`
 * for informado, gera so essas funcoes em todas as missas do periodo,
 * preservando as demais funcoes ja escaladas (ex: gerar so os Coroinhas do
 * mes, sem mexer nos Ministros que ja foram definidos).
 */
export function generateAndSaveScheduleForRange(
  db: AppDatabase,
  startDate: string,
  endDate: string,
  roleIds?: number[]
): BatchGenerationResult {
  const celebrationRows = db
    .prepare("SELECT id FROM celebrations WHERE date >= ? AND date <= ? ORDER BY date, time")
    .all(startDate, endDate) as { id: number }[];

  const skipped: BatchGenerationSkip[] = [];
  const eligibleIds: number[] = [];
  for (const row of celebrationRows) {
    const existing = db.prepare("SELECT status FROM schedules WHERE celebration_id = ?").get(row.id) as
      | { status: string }
      | undefined;
    if (existing && existing.status !== "draft") {
      skipped.push({ celebrationId: row.id, reason: "Escala já publicada" });
    } else {
      eligibleIds.push(row.id);
    }
  }

  if (eligibleIds.length === 0) {
    return { schedules: [], skipped };
  }

  const input = buildGenerationInput(db, eligibleIds, roleIds);
  const result = generateSchedule(input);

  const assignmentsByCelebration = new Map<number, ProposedAssignment[]>();
  for (const assignment of result.assignments) {
    const list = assignmentsByCelebration.get(assignment.celebrationId) ?? [];
    list.push(assignment);
    assignmentsByCelebration.set(assignment.celebrationId, list);
  }

  db.transaction(() => {
    for (const celebrationId of eligibleIds) {
      persistGeneratedSchedule(db, celebrationId, roleIds, assignmentsByCelebration.get(celebrationId) ?? []);
    }
  })();

  const schedules = eligibleIds.map((id) => getScheduleForCelebration(db, id) as ScheduleWithAssignments);
  return { schedules, skipped };
}

/** Verdadeiro se colocar `personId` nessa missa geraria um conflito (dupla escala no mesmo horario, indisponibilidade ou ferias). */
function computeConflictFlag(
  db: AppDatabase,
  personId: number,
  celebrationId: number,
  excludeAssignmentId?: number
): boolean {
  const celebration = db.prepare("SELECT date, time FROM celebrations WHERE id = ?").get(celebrationId) as {
    date: string;
    time: string;
  };

  const doubleBooked = db
    .prepare(
      `SELECT COUNT(*) as c
       FROM schedule_assignments sa
       JOIN schedules s ON s.id = sa.schedule_id
       JOIN celebrations c ON c.id = s.celebration_id
       WHERE sa.person_id = ? AND c.date = ? AND sa.id != ?`
    )
    .get(personId, celebration.date, excludeAssignmentId ?? -1) as { c: number };
  if (doubleBooked.c > 0) return true;

  const weekday = getWeekday(celebration.date);
  const unavailable = db
    .prepare(
      `SELECT COUNT(*) as c FROM availabilities
       WHERE person_id = ? AND recurring = 1 AND weekday = ? AND time = ? AND status = 'unavailable'`
    )
    .get(personId, weekday, celebration.time) as { c: number };
  if (unavailable.c > 0) return true;

  const onVacation = db
    .prepare(`SELECT COUNT(*) as c FROM unavailabilities WHERE person_id = ? AND ? BETWEEN start_date AND end_date`)
    .get(personId, celebration.date) as { c: number };
  if (onVacation.c > 0) return true;

  return false;
}

/** Adiciona manualmente uma pessoa a uma funcao da escala (ex: preencher uma vaga que ficou pendente). */
export function addAssignment(db: AppDatabase, scheduleId: number, roleId: number, personId: number): PersistedAssignment {
  const scheduleRow = db.prepare("SELECT celebration_id FROM schedules WHERE id = ?").get(scheduleId) as
    | { celebration_id: number }
    | undefined;
  if (!scheduleRow) throw new Error("Escala não encontrada.");

  const conflictFlag = computeConflictFlag(db, personId, scheduleRow.celebration_id);

  const result = db
    .prepare(
      `INSERT INTO schedule_assignments (schedule_id, role_id, person_id, score, source, status, conflict_flag)
       VALUES (@scheduleId, @roleId, @personId, 0, 'manual', 'proposed', @conflictFlag)`
    )
    .run({ scheduleId, roleId, personId, conflictFlag: conflictFlag ? 1 : 0 });

  return getAssignmentById(db, result.lastInsertRowid);
}

/** Remove uma atribuicao da escala (a vaga volta a ficar pendente). */
export function removeAssignment(db: AppDatabase, assignmentId: number): void {
  db.prepare("DELETE FROM schedule_assignments WHERE id = ?").run(assignmentId);
}

/** Marca a confirmacao de participacao do integrante nessa atribuicao (ou volta para pendente). */
export function setAssignmentStatus(
  db: AppDatabase,
  assignmentId: number,
  status: "proposed" | "confirmed" | "declined"
): PersistedAssignment {
  db.prepare("UPDATE schedule_assignments SET status = @status, updated_at = datetime('now') WHERE id = @id").run({
    id: assignmentId,
    status
  });
  return getAssignmentById(db, assignmentId);
}

/** Troca a pessoa escalada numa atribuicao existente, mantendo a mesma funcao/vaga. */
export function substituteAssignment(db: AppDatabase, assignmentId: number, newPersonId: number): PersistedAssignment {
  const row = db.prepare("SELECT schedule_id FROM schedule_assignments WHERE id = ?").get(assignmentId) as
    | { schedule_id: number }
    | undefined;
  if (!row) throw new Error("Atribuição não encontrada.");

  const scheduleRow = db.prepare("SELECT celebration_id FROM schedules WHERE id = ?").get(row.schedule_id) as {
    celebration_id: number;
  };
  const conflictFlag = computeConflictFlag(db, newPersonId, scheduleRow.celebration_id, assignmentId);

  db.prepare(
    `UPDATE schedule_assignments
     SET person_id = @personId, source = 'manual', conflict_flag = @conflictFlag, updated_at = datetime('now')
     WHERE id = @id`
  ).run({ id: assignmentId, personId: newPersonId, conflictFlag: conflictFlag ? 1 : 0 });

  return getAssignmentById(db, assignmentId);
}

export interface SubstituteCandidate {
  personId: number;
  personName: string;
  score: number;
  sameCommunity: boolean;
  spouseTogether: boolean;
}

/**
 * Ranking de possiveis substitutos para uma atribuicao: pessoas com a mesma
 * funcao, elegiveis (nao indisponiveis, nao de ferias, nao ja escaladas
 * nesse mesmo dia em qualquer outra missa/funcao), ordenadas pela mesma
 * pontuacao do motor de geracao — com um bonus para quem e da mesma
 * comunidade da missa.
 */
export function rankSubstitutes(db: AppDatabase, assignmentId: number): SubstituteCandidate[] {
  const assignment = db
    .prepare(
      `SELECT sa.role_id as role_id, sa.person_id as person_id, s.celebration_id as celebration_id
       FROM schedule_assignments sa
       JOIN schedules s ON s.id = sa.schedule_id
       WHERE sa.id = ?`
    )
    .get(assignmentId) as { role_id: number; person_id: number; celebration_id: number } | undefined;
  if (!assignment) throw new Error("Atribuição não encontrada.");

  const celebration = db
    .prepare("SELECT date, time, community_id FROM celebrations WHERE id = ?")
    .get(assignment.celebration_id) as { date: string; time: string; community_id: number };

  const input = buildGenerationInput(db, [assignment.celebration_id]);

  // qualquer pessoa ja escalada nesse dia (em qualquer missa/horario) fica de fora — cada um so serve uma vez por dia
  const busyPersonIds = new Set(
    (
      db
        .prepare(
          `SELECT sa2.person_id as person_id
           FROM schedule_assignments sa2
           JOIN schedules s2 ON s2.id = sa2.schedule_id
           JOIN celebrations c2 ON c2.id = s2.celebration_id
           WHERE c2.date = ? AND sa2.id != ?`
        )
        .all(celebration.date, assignmentId) as { person_id: number }[]
    ).map((r) => r.person_id)
  );

  // subconjunto escalado nesse horario exato — usado so pro bonus de conjuge junto (scoreCandidate)
  const busyAtSameTimeIds = new Set(
    (
      db
        .prepare(
          `SELECT sa2.person_id as person_id
           FROM schedule_assignments sa2
           JOIN schedules s2 ON s2.id = sa2.schedule_id
           JOIN celebrations c2 ON c2.id = s2.celebration_id
           WHERE c2.date = ? AND c2.time = ? AND sa2.id != ?`
        )
        .all(celebration.date, celebration.time, assignmentId) as { person_id: number }[]
    ).map((r) => r.person_id)
  );

  const communityByPerson = new Map(
    (db.prepare("SELECT id, community_id FROM people").all() as { id: number; community_id: number | null }[]).map(
      (r) => [r.id, r.community_id]
    )
  );

  const { average, max } = computeHistoryStats(input.history.assignmentCountByPerson);

  // simula o mesmo "usedSlots" que o motor de geracao usaria nessa rodada,
  // pra reaproveitar o bonus de conjuge junto (scoreCandidate) aqui tambem
  const usedSlots = new Set(
    [...busyAtSameTimeIds].map((personId) => slotKey(personId, celebration.date, celebration.time))
  );

  const candidates = input.people.filter(
    (person) =>
      person.id !== assignment.person_id &&
      hasRole(person, assignment.role_id) &&
      !busyPersonIds.has(person.id) &&
      !isOnVacation(person.id, celebration.date, input.unavailabilityPeriods) &&
      !isMarkedUnavailable(person.id, celebration.date, celebration.time, input.availabilityRules)
  );

  return candidates
    .map((person) => {
      const sameCommunity = communityByPerson.get(person.id) === celebration.community_id;
      const spouseTogether = person.spousePersonId != null && busyAtSameTimeIds.has(person.spousePersonId);
      let score = scoreCandidate(
        person,
        assignment.role_id,
        {
          date: celebration.date,
          time: celebration.time,
          availabilityRules: input.availabilityRules,
          history: input.history,
          averageAssignmentCount: average,
          maxAssignmentCount: max,
          usedSlots
        },
        input.weights
      );
      if (sameCommunity) score += 3;
      return { personId: person.id, personName: person.fullName, score, sameCommunity, spouseTogether };
    })
    .sort((a, b) => b.score - a.score);
}
