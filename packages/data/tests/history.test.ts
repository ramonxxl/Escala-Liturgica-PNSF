import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type AppDatabase } from "../src/db";
import { createCommunity } from "../src/repositories/communities";
import { createRole } from "../src/repositories/roles";
import { createPerson } from "../src/repositories/people";
import { createCelebration } from "../src/repositories/celebrations";
import { generateAndSaveSchedule, setAssignmentStatus } from "../src/repositories/generation";
import { getAssignmentHistory } from "../src/repositories/history";

let dir: string;
let db: AppDatabase;
let communityId: number;
let leitorId: number;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "escala-hist-"));
  db = await openDatabase(join(dir, "escala-liturgica.db"));
  communityId = createCommunity(db, { name: "Matriz" }).id;
  leitorId = createRole(db, { name: "Leitor" }).id;
});

afterEach(() => {
  db?.close();
  if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

describe("getAssignmentHistory", () => {
  it("agrupa escalas por pessoa e por mes", () => {
    const maria = createPerson(db, { fullName: "Maria", communityId, roleIds: [leitorId] });

    const c1 = createCelebration(db, {
      date: "2026-06-07",
      time: "19:30",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: [{ roleId: leitorId, quantityNeeded: 1 }]
    });
    const c2 = createCelebration(db, {
      date: "2026-07-05",
      time: "19:30",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: [{ roleId: leitorId, quantityNeeded: 1 }]
    });
    generateAndSaveSchedule(db, c1.id);
    generateAndSaveSchedule(db, c2.id);

    const history = getAssignmentHistory(db);

    expect(history.months).toEqual(["2026-06", "2026-07"]);
    expect(history.people).toHaveLength(1);
    expect(history.people[0].personId).toBe(maria.id);
    expect(history.people[0].countsByMonth).toEqual({ "2026-06": 1, "2026-07": 1 });
    expect(history.people[0].total).toBe(2);
  });

  it("ignora atribuicoes recusadas", () => {
    createPerson(db, { fullName: "Maria", communityId, roleIds: [leitorId] });
    const celebration = createCelebration(db, {
      date: "2026-06-07",
      time: "19:30",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: [{ roleId: leitorId, quantityNeeded: 1 }]
    });
    const schedule = generateAndSaveSchedule(db, celebration.id);
    setAssignmentStatus(db, schedule.assignments[0].id, "declined");

    const history = getAssignmentHistory(db);
    expect(history.people).toHaveLength(0);
  });
});
