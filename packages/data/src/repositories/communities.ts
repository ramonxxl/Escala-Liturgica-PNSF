import type { Community } from "@escala/core";
import type { AppDatabase } from "../sqlAdapter";

interface CommunityRow {
  id: number;
  name: string;
  address: string | null;
  notes: string | null;
  active: number;
}

function mapRow(row: CommunityRow): Community {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    notes: row.notes,
    active: row.active === 1
  };
}

export interface CommunityInput {
  name: string;
  address?: string | null;
  notes?: string | null;
}

export function listCommunities(db: AppDatabase): Community[] {
  return (db.prepare("SELECT * FROM communities ORDER BY name").all() as CommunityRow[]).map(mapRow);
}

export function getCommunity(db: AppDatabase, id: number): Community | undefined {
  const row = db.prepare("SELECT * FROM communities WHERE id = ?").get(id) as CommunityRow | undefined;
  return row ? mapRow(row) : undefined;
}

export function createCommunity(db: AppDatabase, input: CommunityInput): Community {
  const result = db
    .prepare("INSERT INTO communities (name, address, notes) VALUES (@name, @address, @notes)")
    .run({ name: input.name, address: input.address ?? null, notes: input.notes ?? null });
  return getCommunity(db, result.lastInsertRowid) as Community;
}

export function updateCommunity(db: AppDatabase, id: number, input: CommunityInput): Community {
  db.prepare("UPDATE communities SET name = @name, address = @address, notes = @notes WHERE id = @id").run({
    id,
    name: input.name,
    address: input.address ?? null,
    notes: input.notes ?? null
  });
  return getCommunity(db, id) as Community;
}

export function setCommunityActive(db: AppDatabase, id: number, active: boolean): void {
  db.prepare("UPDATE communities SET active = @active WHERE id = @id").run({ id, active: active ? 1 : 0 });
}

/** Lanca erro se a comunidade estiver em uso (missas ou integrantes vinculados). */
export function removeCommunity(db: AppDatabase, id: number): void {
  db.prepare("DELETE FROM communities WHERE id = ?").run(id);
}
