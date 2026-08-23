import type { Celebration } from "@escala/core";
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
