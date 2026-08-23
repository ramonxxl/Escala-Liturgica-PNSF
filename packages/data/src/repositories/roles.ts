import type { Role } from "@escala/core";
import type { AppDatabase } from "../sqlAdapter";

interface RoleRow {
  id: number;
  name: string;
  description: string | null;
  active: number;
}

function mapRow(row: RoleRow): Role {
  return { id: row.id, name: row.name, description: row.description, active: row.active === 1 };
}

export interface RoleInput {
  name: string;
  description?: string | null;
}

export function listRoles(db: AppDatabase): Role[] {
  return (db.prepare("SELECT * FROM roles ORDER BY name").all() as RoleRow[]).map(mapRow);
}

export function getRole(db: AppDatabase, id: number): Role | undefined {
  const row = db.prepare("SELECT * FROM roles WHERE id = ?").get(id) as RoleRow | undefined;
  return row ? mapRow(row) : undefined;
}

export function createRole(db: AppDatabase, input: RoleInput): Role {
  const result = db
    .prepare("INSERT INTO roles (name, description) VALUES (@name, @description)")
    .run({ name: input.name, description: input.description ?? null });
  return getRole(db, result.lastInsertRowid) as Role;
}

export function updateRole(db: AppDatabase, id: number, input: RoleInput): Role {
  db.prepare("UPDATE roles SET name = @name, description = @description WHERE id = @id").run({
    id,
    name: input.name,
    description: input.description ?? null
  });
  return getRole(db, id) as Role;
}

export function setRoleActive(db: AppDatabase, id: number, active: boolean): void {
  db.prepare("UPDATE roles SET active = @active WHERE id = @id").run({ id, active: active ? 1 : 0 });
}

/** Lanca erro se a funcao estiver em uso (integrantes ou necessidades de missa vinculados). */
export function removeRole(db: AppDatabase, id: number): void {
  db.prepare("DELETE FROM roles WHERE id = ?").run(id);
}
