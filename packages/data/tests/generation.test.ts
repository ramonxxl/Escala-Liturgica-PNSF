import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type AppDatabase } from "../src/db";
import { createCommunity } from "../src/repositories/communities";
import { createRole } from "../src/repositories/roles";
import { createPerson } from "../src/repositories/people";
import { createCelebration } from "../src/repositories/celebrations";
import { createAvailability } from "../src/repositories/availabilities";
import { generateAndSaveSchedule, buildGenerationInput } from "../src/repositories/generation";

let dir: string;
let db: AppDatabase;
let communityId: number;
let leitorId: number;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "escala-gen-"));
  db = await openDatabase(join(dir, "escala-liturgica.db"));
  communityId = createCommunity(db, { name: "Matriz" }).id;
  leitorId = createRole(db, { name: "Leitor" }).id;
});

afterEach(() => {
  db?.close();
  if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

describe("buildGenerationInput", () => {
  it("monta o input com pessoas, disponibilidade e pesos padrao", () => {
    const person = createPerson(db, { fullName: "Maria", communityId, roleIds: [leitorId] });
    createAvailability(db, { personId: person.id, weekday: 0, time: "19:30", status: "unavailable" });
    const celebration = createCelebration(db, {
      date: "2026-08-30",
      time: "19:30",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: [{ roleId: leitorId, quantityNeeded: 1 }]
    });

    const input = buildGenerationInput(db, [celebration.id]);

    expect(input.people).toHaveLength(1);
    expect(input.people[0].roles).toEqual([{ roleId: leitorId, preferenceWeight: 0 }]);
    expect(input.availabilityRules).toHaveLength(1);
    expect(input.weights.unavailablePenalty).toBe(-1000);
  });
});

describe("generateAndSaveSchedule", () => {
  it("gera e persiste a escala com as atribuicoes", () => {
    const person = createPerson(db, { fullName: "Maria", communityId, roleIds: [leitorId] });
    const celebration = createCelebration(db, {
      date: "2026-08-30",
      time: "19:30",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: [{ roleId: leitorId, quantityNeeded: 1 }]
    });

    const { schedule, unfilled } = generateAndSaveSchedule(db, celebration.id);

    expect(schedule.status).toBe("draft");
    expect(schedule.assignments).toHaveLength(1);
    expect(schedule.assignments[0].personId).toBe(person.id);
    expect(schedule.assignments[0].roleName).toBe("Leitor");
    expect(unfilled).toHaveLength(0);

    const updated = db.prepare("SELECT status FROM celebrations WHERE id = ?").get(celebration.id) as {
      status: string;
    };
    expect(updated.status).toBe("generated");
  });

  it("reporta necessidades nao preenchidas quando faltam candidatos", () => {
    const celebration = createCelebration(db, {
      date: "2026-08-30",
      time: "19:30",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: [{ roleId: leitorId, quantityNeeded: 2 }]
    });

    const { schedule, unfilled } = generateAndSaveSchedule(db, celebration.id);

    expect(schedule.assignments).toHaveLength(0);
    expect(unfilled).toEqual([{ celebrationId: celebration.id, roleId: leitorId, missing: 2 }]);
  });

  it("permite regenerar uma escala ainda em rascunho, substituindo as atribuicoes antigas", () => {
    createPerson(db, { fullName: "Maria", communityId, roleIds: [leitorId] });
    const celebration = createCelebration(db, {
      date: "2026-08-30",
      time: "19:30",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: [{ roleId: leitorId, quantityNeeded: 1 }]
    });

    const first = generateAndSaveSchedule(db, celebration.id);
    const second = generateAndSaveSchedule(db, celebration.id);

    expect(second.schedule.id).not.toBe(first.schedule.id);
    expect(second.schedule.assignments).toHaveLength(1);
  });

  it("nao sobrescreve uma escala ja publicada", () => {
    createPerson(db, { fullName: "Maria", communityId, roleIds: [leitorId] });
    const celebration = createCelebration(db, {
      date: "2026-08-30",
      time: "19:30",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: [{ roleId: leitorId, quantityNeeded: 1 }]
    });

    const { schedule } = generateAndSaveSchedule(db, celebration.id);
    db.prepare("UPDATE schedules SET status = 'published' WHERE id = ?").run(schedule.id);

    expect(() => generateAndSaveSchedule(db, celebration.id)).toThrow();
  });
});
