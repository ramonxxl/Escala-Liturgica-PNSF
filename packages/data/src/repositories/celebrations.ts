import { computeRecurrenceDates, getWeekday, type Celebration } from "@escala/core";
import type { AppDatabase } from "../sqlAdapter";

export interface RequirementWithRole {
  roleId: number;
  roleName: string;
  quantityNeeded: number;
}

export interface CelebrationWithRequirements extends Celebration {
  communityName: string;
  requirements: RequirementWithRole[];
}

interface CelebrationRow {
  id: number;
  date: string;
  time: string;
  community_id: number;
  celebration_type: string;
  notes: string | null;
  status: Celebration["status"];
  community_name: string;
}

interface RequirementRow {
  celebration_id: number;
  role_id: number;
  role_name: string;
  quantity_needed: number;
}

function mapRow(row: CelebrationRow, requirements: RequirementWithRole[]): CelebrationWithRequirements {
  return {
    id: row.id,
    date: row.date,
    time: row.time,
    communityId: row.community_id,
    celebrationType: row.celebration_type,
    notes: row.notes,
    status: row.status,
    communityName: row.community_name,
    requirements
  };
}

export interface CelebrationRequirementInput {
  roleId: number;
  quantityNeeded: number;
}

export interface CelebrationInput {
  date: string;
  time: string;
  communityId: number;
  celebrationType: string;
  notes?: string | null;
  requirements: CelebrationRequirementInput[];
}

function fetchRequirementsForCelebrations(db: AppDatabase, celebrationIds: number[]): Map<number, RequirementWithRole[]> {
  const map = new Map<number, RequirementWithRole[]>();
  if (celebrationIds.length === 0) return map;

  const placeholders = celebrationIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT cr.celebration_id as celebration_id, cr.role_id as role_id, r.name as role_name,
              cr.quantity_needed as quantity_needed
       FROM celebration_requirements cr
       JOIN roles r ON r.id = cr.role_id
       WHERE cr.celebration_id IN (${placeholders})
       ORDER BY r.name`
    )
    .all(...celebrationIds) as RequirementRow[];

  for (const row of rows) {
    const list = map.get(row.celebration_id) ?? [];
    list.push({ roleId: row.role_id, roleName: row.role_name, quantityNeeded: row.quantity_needed });
    map.set(row.celebration_id, list);
  }
  return map;
}

export function listCelebrations(db: AppDatabase): CelebrationWithRequirements[] {
  const rows = db
    .prepare(
      `SELECT c.*, co.name as community_name
       FROM celebrations c
       JOIN communities co ON co.id = c.community_id
       ORDER BY c.date, c.time`
    )
    .all() as CelebrationRow[];

  const requirementsByCelebration = fetchRequirementsForCelebrations(
    db,
    rows.map((row) => row.id)
  );
  return rows.map((row) => mapRow(row, requirementsByCelebration.get(row.id) ?? []));
}

export function getCelebration(db: AppDatabase, id: number): CelebrationWithRequirements | undefined {
  const row = db
    .prepare(
      `SELECT c.*, co.name as community_name
       FROM celebrations c
       JOIN communities co ON co.id = c.community_id
       WHERE c.id = ?`
    )
    .get(id) as CelebrationRow | undefined;
  if (!row) return undefined;

  const requirementsByCelebration = fetchRequirementsForCelebrations(db, [id]);
  return mapRow(row, requirementsByCelebration.get(id) ?? []);
}

function syncRequirements(db: AppDatabase, celebrationId: number, requirements: CelebrationRequirementInput[]): void {
  db.prepare("DELETE FROM celebration_requirements WHERE celebration_id = ?").run(celebrationId);
  const insert = db.prepare(
    "INSERT INTO celebration_requirements (celebration_id, role_id, quantity_needed) VALUES (@celebrationId, @roleId, @quantityNeeded)"
  );
  for (const requirement of requirements) {
    insert.run({ celebrationId, roleId: requirement.roleId, quantityNeeded: requirement.quantityNeeded });
  }
}

export function createCelebration(db: AppDatabase, input: CelebrationInput): CelebrationWithRequirements {
  const create = db.transaction((data: CelebrationInput) => {
    const result = db
      .prepare(
        `INSERT INTO celebrations (date, time, community_id, celebration_type, notes)
         VALUES (@date, @time, @communityId, @celebrationType, @notes)`
      )
      .run({
        date: data.date,
        time: data.time,
        communityId: data.communityId,
        celebrationType: data.celebrationType,
        notes: data.notes ?? null
      });
    syncRequirements(db, result.lastInsertRowid, data.requirements);
    return result.lastInsertRowid;
  });

  const id = create(input);
  return getCelebration(db, id) as CelebrationWithRequirements;
}

export function updateCelebration(
  db: AppDatabase,
  id: number,
  input: CelebrationInput
): CelebrationWithRequirements {
  const update = db.transaction((data: CelebrationInput) => {
    db.prepare(
      `UPDATE celebrations SET date = @date, time = @time, community_id = @communityId,
         celebration_type = @celebrationType, notes = @notes
       WHERE id = @id`
    ).run({
      id,
      date: data.date,
      time: data.time,
      communityId: data.communityId,
      celebrationType: data.celebrationType,
      notes: data.notes ?? null
    });
    syncRequirements(db, id, data.requirements);
  });

  update(input);
  return getCelebration(db, id) as CelebrationWithRequirements;
}

/** Remove a missa. Se ja existir uma escala gerada para ela, a escala e suas atribuicoes sao removidas em cascata. */
export function removeCelebration(db: AppDatabase, id: number): void {
  db.prepare("DELETE FROM celebrations WHERE id = ?").run(id);
}

export interface MassSlots {
  /** Dias da semana (0=domingo..6=sabado) com pelo menos uma missa cadastrada, ordenados. */
  weekdays: number[];
  /** Horarios distintos usados nas missas cadastradas, ordenados. */
  times: string[];
}

/** Usado para montar a grade de disponibilidade — so mostra dias/horarios que realmente tem missa. */
export function listDistinctMassSlots(db: AppDatabase): MassSlots {
  const dateRows = db.prepare("SELECT DISTINCT date FROM celebrations").all() as { date: string }[];
  const weekdaySet = new Set<number>();
  for (const row of dateRows) weekdaySet.add(getWeekday(row.date));

  const timeRows = db.prepare("SELECT DISTINCT time FROM celebrations ORDER BY time").all() as { time: string }[];

  return {
    weekdays: [...weekdaySet].sort((a, b) => a - b),
    times: timeRows.map((row) => row.time)
  };
}

export interface RecurrenceInput {
  communityId: number;
  celebrationType: string;
  time: string;
  /** Dias da semana (0=domingo..6=sabado), um ou mais. */
  weekdays: number[];
  startDate: string;
  endDate: string;
  notes?: string | null;
  /** Aplicadas em cada missa gerada pela recorrencia. */
  requirements: CelebrationRequirementInput[];
}

export interface RecurrencePreview {
  /** Todas as datas que a regra gera, em ordem. */
  dates: string[];
  /** Subconjunto de `dates` que ja tem uma missa cadastrada (mesma comunidade e horario). */
  conflicts: string[];
}

function findConflictingDates(db: AppDatabase, communityId: number, time: string, dates: string[]): string[] {
  if (dates.length === 0) return [];
  const placeholders = dates.map(() => "?").join(",");
  return (
    db
      .prepare(`SELECT date FROM celebrations WHERE community_id = ? AND time = ? AND date IN (${placeholders})`)
      .all(communityId, time, ...dates) as { date: string }[]
  ).map((row) => row.date);
}

/** Calcula as datas que uma recorrencia geraria e quais delas ja colidem com missas existentes — sem escrever nada. */
export function previewRecurrence(db: AppDatabase, input: RecurrenceInput): RecurrencePreview {
  const dates = computeRecurrenceDates(input.startDate, input.endDate, input.weekdays);
  const conflicts = findConflictingDates(db, input.communityId, input.time, dates);
  return { dates, conflicts };
}

export interface CreateRecurrenceResult {
  recurrenceId: number;
  createdCount: number;
  skippedCount: number;
}

/**
 * Cria a regra de recorrencia e todas as missas correspondentes (cada uma com
 * as mesmas necessidades) numa unica transacao — se algo falhar, nada fica
 * salvo. Se houver datas que ja colidem com missas existentes (mesma
 * comunidade+horario), `skipConflicts: false` aborta sem escrever nada;
 * `skipConflicts: true` cria as demais e pula so as conflitantes.
 */
export function createRecurrence(
  db: AppDatabase,
  input: RecurrenceInput,
  options: { skipConflicts: boolean }
): CreateRecurrenceResult {
  const create = db.transaction((data: RecurrenceInput) => {
    const dates = computeRecurrenceDates(data.startDate, data.endDate, data.weekdays);
    if (dates.length === 0) {
      throw new Error("Nenhuma data no período bate com os dias da semana selecionados.");
    }

    const conflicts = new Set(findConflictingDates(db, data.communityId, data.time, dates));
    if (conflicts.size > 0 && !options.skipConflicts) {
      throw new Error(
        `Já existe${conflicts.size > 1 ? "m" : ""} ${conflicts.size} missa(s) cadastrada(s) nessa comunidade e horário em datas do período.`
      );
    }

    const recurrenceResult = db
      .prepare(
        `INSERT INTO celebration_recurrences (community_id, celebration_type, time, weekdays, start_date, end_date, notes)
         VALUES (@communityId, @celebrationType, @time, @weekdays, @startDate, @endDate, @notes)`
      )
      .run({
        communityId: data.communityId,
        celebrationType: data.celebrationType,
        time: data.time,
        weekdays: JSON.stringify(data.weekdays),
        startDate: data.startDate,
        endDate: data.endDate,
        notes: data.notes ?? null
      });
    const recurrenceId = recurrenceResult.lastInsertRowid;

    let createdCount = 0;
    for (const date of dates) {
      if (conflicts.has(date)) continue;
      const celebrationResult = db
        .prepare(
          `INSERT INTO celebrations (date, time, community_id, celebration_type, notes, recurrence_id)
           VALUES (@date, @time, @communityId, @celebrationType, @notes, @recurrenceId)`
        )
        .run({
          date,
          time: data.time,
          communityId: data.communityId,
          celebrationType: data.celebrationType,
          notes: data.notes ?? null,
          recurrenceId
        });
      syncRequirements(db, celebrationResult.lastInsertRowid, data.requirements);
      createdCount++;
    }

    return { recurrenceId, createdCount, skippedCount: conflicts.size };
  });

  return create(input);
}
