import type { Availability } from "@escala/core";
import type { AppDatabase } from "../sqlAdapter";

interface AvailabilityRow {
  id: number;
  person_id: number;
  weekday: number | null;
  specific_date: string | null;
  time: string | null;
  status: Availability["status"];
  recurring: number;
}

function mapRow(row: AvailabilityRow): Availability {
  return {
    id: row.id,
    personId: row.person_id,
    weekday: row.weekday,
    specificDate: row.specific_date,
    time: row.time,
    status: row.status,
    recurring: row.recurring === 1
  };
}

export interface AvailabilityInput {
  personId: number;
  weekday: number;
  time: string;
  status: Availability["status"];
}

export function listAvailabilitiesByPerson(db: AppDatabase, personId: number): Availability[] {
  return (
    db
      .prepare("SELECT * FROM availabilities WHERE person_id = ? ORDER BY weekday, time")
      .all(personId) as AvailabilityRow[]
  ).map(mapRow);
}

export function createAvailability(db: AppDatabase, input: AvailabilityInput): Availability {
  const result = db
    .prepare(
      `INSERT INTO availabilities (person_id, weekday, time, status, recurring)
       VALUES (@personId, @weekday, @time, @status, 1)`
    )
    .run({ personId: input.personId, weekday: input.weekday, time: input.time, status: input.status });
  const row = db.prepare("SELECT * FROM availabilities WHERE id = ?").get(result.lastInsertRowid) as AvailabilityRow;
  return mapRow(row);
}

export function removeAvailability(db: AppDatabase, id: number): void {
  db.prepare("DELETE FROM availabilities WHERE id = ?").run(id);
}
