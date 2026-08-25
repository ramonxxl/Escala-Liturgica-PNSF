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
import { getDashboardSummary } from "../src/repositories/dashboard";

let dir: string;
let db: AppDatabase;
let communityId: number;
let leitorId: number;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "escala-dash-"));
  db = await openDatabase(join(dir, "escala-liturgica.db"));
  communityId = createCommunity(db, { name: "Matriz" }).id;
  leitorId = createRole(db, { name: "Leitor" }).id;
});

afterEach(() => {
  db?.close();
  if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

function futureDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("getDashboardSummary", () => {
  it("lista proximas missas e o status da mais proxima", () => {
    createPerson(db, { fullName: "Maria", communityId, roleIds: [leitorId] });
    const soon = createCelebration(db, {
      date: futureDate(2),
      time: "19:30",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: [{ roleId: leitorId, quantityNeeded: 2 }]
    });
    createCelebration(db, {
      date: futureDate(9),
      time: "19:30",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: []
    });

    generateAndSaveSchedule(db, soon.id);

    const summary = getDashboardSummary(db);

    expect(summary.upcomingCelebrations).toHaveLength(2);
    expect(summary.nextCelebration).toEqual({
      id: soon.id,
      date: soon.date,
      time: "19:30",
      communityName: "Matriz",
      filled: 1,
      needed: 2
    });
  });

  it("conta confirmacoes, pendencias e conflitos entre as missas futuras", () => {
    createPerson(db, { fullName: "Maria", communityId, roleIds: [leitorId] });
    createPerson(db, { fullName: "Ana", communityId, roleIds: [leitorId] });
    const celebration = createCelebration(db, {
      date: futureDate(3),
      time: "19:30",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: [{ roleId: leitorId, quantityNeeded: 2 }]
    });

    const schedule = generateAndSaveSchedule(db, celebration.id);
    setAssignmentStatus(db, schedule.assignments[0].id, "confirmed");

    const summary = getDashboardSummary(db);

    expect(summary.confirmedCount).toBe(1);
    expect(summary.pendingCount).toBe(1);
    expect(summary.conflictCount).toBe(0);
  });

  it("nao conta missas passadas", () => {
    createCelebration(db, {
      date: "2020-01-01",
      time: "19:30",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: []
    });

    const summary = getDashboardSummary(db);
    expect(summary.upcomingCelebrations).toHaveLength(0);
    expect(summary.nextCelebration).toBeNull();
  });
});
