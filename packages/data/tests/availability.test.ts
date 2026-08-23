import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type AppDatabase } from "../src/db";
import { createPerson } from "../src/repositories/people";
import {
  createAvailability,
  listAvailabilitiesByPerson,
  removeAvailability
} from "../src/repositories/availabilities";
import {
  createUnavailability,
  listUnavailabilitiesByPerson,
  removeUnavailability
} from "../src/repositories/unavailabilities";

let dir: string;
let db: AppDatabase;
let personId: number;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "escala-avail-"));
  db = await openDatabase(join(dir, "escala-liturgica.db"));
  personId = createPerson(db, { fullName: "Maria", roleIds: [] }).id;
});

afterEach(() => {
  db?.close();
  if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

describe("availabilitiesRepository", () => {
  it("cria e lista regras semanais ordenadas por dia/horario", () => {
    createAvailability(db, { personId, weekday: 0, time: "19:30", status: "unavailable" });
    createAvailability(db, { personId, weekday: 0, time: "08:00", status: "available" });

    const list = listAvailabilitiesByPerson(db, personId);
    expect(list.map((a) => a.time)).toEqual(["08:00", "19:30"]);
    expect(list[1].status).toBe("unavailable");
  });

  it("remove uma regra", () => {
    const rule = createAvailability(db, { personId, weekday: 0, time: "19:30", status: "unavailable" });
    removeAvailability(db, rule.id);
    expect(listAvailabilitiesByPerson(db, personId)).toHaveLength(0);
  });
});

describe("unavailabilitiesRepository", () => {
  it("cria e lista periodos de indisponibilidade", () => {
    createUnavailability(db, {
      personId,
      startDate: "2026-09-01",
      endDate: "2026-09-15",
      reason: "Férias"
    });

    const list = listUnavailabilitiesByPerson(db, personId);
    expect(list).toHaveLength(1);
    expect(list[0].reason).toBe("Férias");
  });

  it("rejeita periodo com data final antes da inicial", () => {
    expect(() =>
      createUnavailability(db, { personId, startDate: "2026-09-15", endDate: "2026-09-01" })
    ).toThrow();
  });

  it("remove um periodo", () => {
    const period = createUnavailability(db, { personId, startDate: "2026-09-01", endDate: "2026-09-15" });
    removeUnavailability(db, period.id);
    expect(listUnavailabilitiesByPerson(db, personId)).toHaveLength(0);
  });
});
