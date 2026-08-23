import type { Unavailability } from "@escala/core";
import type { AppDatabase } from "../sqlAdapter";

interface UnavailabilityRow {
  id: number;
  person_id: number;
  start_date: string;
  end_date: string;
  reason: string | null;
}

function mapRow(row: UnavailabilityRow): Unavailability {
  return {
    id: row.id,
    personId: row.person_id,
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason
  };
}

export interface UnavailabilityInput {
  personId: number;
  startDate: string;
  endDate: string;
  reason?: string | null;
}

export function listUnavailabilitiesByPerson(db: AppDatabase, personId: number): Unavailability[] {
  return (
    db
      .prepare("SELECT * FROM unavailabilities WHERE person_id = ? ORDER BY start_date")
      .all(personId) as UnavailabilityRow[]
  ).map(mapRow);
}

export function createUnavailability(db: AppDatabase, input: UnavailabilityInput): Unavailability {
  if (input.endDate < input.startDate) {
    throw new Error("A data final não pode ser anterior à data inicial.");
  }

  const result = db
    .prepare(
      `INSERT INTO unavailabilities (person_id, start_date, end_date, reason)
       VALUES (@personId, @startDate, @endDate, @reason)`
    )
    .run({
      personId: input.personId,
      startDate: input.startDate,
      endDate: input.endDate,
      reason: input.reason ?? null
    });
  const row = db
    .prepare("SELECT * FROM unavailabilities WHERE id = ?")
    .get(result.lastInsertRowid) as UnavailabilityRow;
  return mapRow(row);
}

export function removeUnavailability(db: AppDatabase, id: number): void {
  db.prepare("DELETE FROM unavailabilities WHERE id = ?").run(id);
}
