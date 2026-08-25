import type { Person, Role } from "@escala/core";
import type { AppDatabase } from "../sqlAdapter";

export interface PersonWithRoles extends Person {
  communityName: string | null;
  spouseName: string | null;
  roles: Role[];
}

interface PersonRow {
  id: number;
  full_name: string;
  phone: string | null;
  email: string | null;
  community_id: number | null;
  active: number;
  notes: string | null;
  spouse_person_id: number | null;
  community_name: string | null;
  spouse_name: string | null;
}

interface RoleRow {
  person_id: number;
  id: number;
  name: string;
  description: string | null;
  active: number;
}

function mapRow(row: PersonRow, roles: Role[]): PersonWithRoles {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    communityId: row.community_id,
    active: row.active === 1,
    notes: row.notes,
    spousePersonId: row.spouse_person_id,
    communityName: row.community_name,
    spouseName: row.spouse_name,
    roles
  };
}

export interface PersonInput {
  fullName: string;
  phone?: string | null;
  email?: string | null;
  communityId?: number | null;
  notes?: string | null;
  spousePersonId?: number | null;
  roleIds: number[];
}

const PERSON_SELECT = `
  SELECT p.*, co.name as community_name, sp.full_name as spouse_name
  FROM people p
  LEFT JOIN communities co ON co.id = p.community_id
  LEFT JOIN people sp ON sp.id = p.spouse_person_id
`;

function fetchRolesForPeople(db: AppDatabase, personIds: number[]): Map<number, Role[]> {
  const map = new Map<number, Role[]>();
  if (personIds.length === 0) return map;

  const placeholders = personIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT pr.person_id as person_id, r.id as id, r.name as name, r.description as description, r.active as active
       FROM person_roles pr
       JOIN roles r ON r.id = pr.role_id
       WHERE pr.person_id IN (${placeholders})
       ORDER BY r.name`
    )
    .all(...personIds) as RoleRow[];

  for (const row of rows) {
    const role: Role = { id: row.id, name: row.name, description: row.description, active: row.active === 1 };
    const list = map.get(row.person_id) ?? [];
    list.push(role);
    map.set(row.person_id, list);
  }
  return map;
}

export function listPeople(db: AppDatabase): PersonWithRoles[] {
  const rows = db.prepare(`${PERSON_SELECT} ORDER BY p.full_name`).all() as PersonRow[];

  const rolesByPerson = fetchRolesForPeople(
    db,
    rows.map((row) => row.id)
  );
  return rows.map((row) => mapRow(row, rolesByPerson.get(row.id) ?? []));
}

export function getPerson(db: AppDatabase, id: number): PersonWithRoles | undefined {
  const row = db.prepare(`${PERSON_SELECT} WHERE p.id = ?`).get(id) as PersonRow | undefined;
  if (!row) return undefined;

  const rolesByPerson = fetchRolesForPeople(db, [id]);
  return mapRow(row, rolesByPerson.get(id) ?? []);
}

function syncPersonRoles(db: AppDatabase, personId: number, roleIds: number[]): void {
  db.prepare("DELETE FROM person_roles WHERE person_id = ?").run(personId);
  const insert = db.prepare("INSERT INTO person_roles (person_id, role_id) VALUES (@personId, @roleId)");
  for (const roleId of roleIds) {
    insert.run({ personId, roleId });
  }
}

/**
 * Mantem o vinculo de conjuge simetrico: se A passa a ter B como conjuge,
 * B tambem passa a ter A. Desfaz automaticamente qualquer vinculo anterior
 * dos dois lados (ninguem fica com dois "conjuges" ao mesmo tempo).
 */
function syncSpouseLink(db: AppDatabase, personId: number, newSpouseId: number | null): void {
  const row = db.prepare("SELECT spouse_person_id FROM people WHERE id = ?").get(personId) as
    | { spouse_person_id: number | null }
    | undefined;
  const oldSpouseId = row?.spouse_person_id ?? null;

  if (oldSpouseId === newSpouseId) return;

  if (oldSpouseId) {
    db.prepare("UPDATE people SET spouse_person_id = NULL WHERE id = ?").run(oldSpouseId);
  }

  if (newSpouseId) {
    const otherRow = db.prepare("SELECT spouse_person_id FROM people WHERE id = ?").get(newSpouseId) as
      | { spouse_person_id: number | null }
      | undefined;
    if (otherRow?.spouse_person_id && otherRow.spouse_person_id !== personId) {
      db.prepare("UPDATE people SET spouse_person_id = NULL WHERE id = ?").run(otherRow.spouse_person_id);
    }
    db.prepare("UPDATE people SET spouse_person_id = ? WHERE id = ?").run(personId, newSpouseId);
  }

  db.prepare("UPDATE people SET spouse_person_id = ? WHERE id = ?").run(newSpouseId, personId);
}

export function createPerson(db: AppDatabase, input: PersonInput): PersonWithRoles {
  const create = db.transaction((data: PersonInput) => {
    const result = db
      .prepare(
        `INSERT INTO people (full_name, phone, email, community_id, notes)
         VALUES (@fullName, @phone, @email, @communityId, @notes)`
      )
      .run({
        fullName: data.fullName,
        phone: data.phone ?? null,
        email: data.email ?? null,
        communityId: data.communityId ?? null,
        notes: data.notes ?? null
      });
    syncPersonRoles(db, result.lastInsertRowid, data.roleIds);
    if (data.spousePersonId !== undefined) {
      syncSpouseLink(db, result.lastInsertRowid, data.spousePersonId);
    }
    return result.lastInsertRowid;
  });

  const id = create(input);
  return getPerson(db, id) as PersonWithRoles;
}

export function updatePerson(db: AppDatabase, id: number, input: PersonInput): PersonWithRoles {
  const update = db.transaction((data: PersonInput) => {
    db.prepare(
      `UPDATE people SET full_name = @fullName, phone = @phone, email = @email,
         community_id = @communityId, notes = @notes, updated_at = datetime('now')
       WHERE id = @id`
    ).run({
      id,
      fullName: data.fullName,
      phone: data.phone ?? null,
      email: data.email ?? null,
      communityId: data.communityId ?? null,
      notes: data.notes ?? null
    });
    syncPersonRoles(db, id, data.roleIds);
    if (data.spousePersonId !== undefined) {
      syncSpouseLink(db, id, data.spousePersonId);
    }
  });

  update(input);
  return getPerson(db, id) as PersonWithRoles;
}

export function setPersonActive(db: AppDatabase, id: number, active: boolean): void {
  db.prepare("UPDATE people SET active = @active WHERE id = @id").run({ id, active: active ? 1 : 0 });
}

/** Lanca erro se o integrante estiver em uso (escalado em alguma missa). */
export function removePerson(db: AppDatabase, id: number): void {
  db.prepare("DELETE FROM people WHERE id = ?").run(id);
}
