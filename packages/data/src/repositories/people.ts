import type { Person, Role } from "@escala/core";
import type { AppDatabase } from "../sqlAdapter";

export interface PersonWithRoles extends Person {
  communityName: string | null;
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
  community_name: string | null;
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
    communityName: row.community_name,
    roles
  };
}

export interface PersonInput {
  fullName: string;
  phone?: string | null;
  email?: string | null;
  communityId?: number | null;
  notes?: string | null;
  roleIds: number[];
}

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
  const rows = db
    .prepare(
      `SELECT p.*, c.name as community_name
       FROM people p
       LEFT JOIN communities c ON c.id = p.community_id
       ORDER BY p.full_name`
    )
    .all() as PersonRow[];

  const rolesByPerson = fetchRolesForPeople(
    db,
    rows.map((row) => row.id)
  );
  return rows.map((row) => mapRow(row, rolesByPerson.get(row.id) ?? []));
}

export function getPerson(db: AppDatabase, id: number): PersonWithRoles | undefined {
  const row = db
    .prepare(
      `SELECT p.*, c.name as community_name
       FROM people p
       LEFT JOIN communities c ON c.id = p.community_id
       WHERE p.id = ?`
    )
    .get(id) as PersonRow | undefined;
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
