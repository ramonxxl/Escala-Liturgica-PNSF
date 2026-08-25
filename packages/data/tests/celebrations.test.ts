import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type AppDatabase } from "../src/db";
import { createCommunity } from "../src/repositories/communities";
import { createRole } from "../src/repositories/roles";
import {
  createCelebration,
  createRecurrence,
  getCelebration,
  listCelebrations,
  listDistinctMassSlots,
  previewRecurrence,
  removeCelebration,
  updateCelebration,
  type RecurrenceInput
} from "../src/repositories/celebrations";

let dir: string;
let db: AppDatabase;
let communityId: number;
let leitorId: number;
let ministroId: number;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "escala-celeb-"));
  db = await openDatabase(join(dir, "escala-liturgica.db"));
  communityId = createCommunity(db, { name: "Matriz" }).id;
  leitorId = createRole(db, { name: "Leitor" }).id;
  ministroId = createRole(db, { name: "Ministro" }).id;
});

afterEach(() => {
  db?.close();
  if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

describe("celebrationsRepository", () => {
  it("cria missa com necessidades por funcao", () => {
    const celebration = createCelebration(db, {
      date: "2026-08-30",
      time: "19:30",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: [
        { roleId: leitorId, quantityNeeded: 2 },
        { roleId: ministroId, quantityNeeded: 4 }
      ]
    });

    expect(celebration.communityName).toBe("Matriz");
    expect(celebration.status).toBe("draft");
    expect(celebration.requirements).toHaveLength(2);
    expect(celebration.requirements.find((r) => r.roleId === ministroId)?.quantityNeeded).toBe(4);
  });

  it("lista missas ordenadas por data e horario", () => {
    createCelebration(db, {
      date: "2026-09-06",
      time: "10:00",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: []
    });
    createCelebration(db, {
      date: "2026-08-30",
      time: "19:30",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: []
    });

    const list = listCelebrations(db);
    expect(list.map((c) => c.date)).toEqual(["2026-08-30", "2026-09-06"]);
  });

  it("atualiza missa trocando as necessidades", () => {
    const celebration = createCelebration(db, {
      date: "2026-08-30",
      time: "19:30",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: [{ roleId: leitorId, quantityNeeded: 2 }]
    });

    const updated = updateCelebration(db, celebration.id, {
      date: celebration.date,
      time: celebration.time,
      communityId,
      celebrationType: "Missa de Natal",
      requirements: [{ roleId: ministroId, quantityNeeded: 5 }]
    });

    expect(updated.celebrationType).toBe("Missa de Natal");
    expect(updated.requirements).toEqual([{ roleId: ministroId, roleName: "Ministro", quantityNeeded: 5 }]);
  });

  it("remove missa e suas necessidades em cascata", () => {
    const celebration = createCelebration(db, {
      date: "2026-08-30",
      time: "19:30",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: [{ roleId: leitorId, quantityNeeded: 2 }]
    });

    removeCelebration(db, celebration.id);

    expect(getCelebration(db, celebration.id)).toBeUndefined();
    expect(listCelebrations(db)).toHaveLength(0);
  });

  it("lista dias da semana e horarios distintos usados nas missas cadastradas", () => {
    createCelebration(db, {
      date: "2026-08-30", // domingo
      time: "19:30",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: []
    });
    createCelebration(db, {
      date: "2026-09-06", // domingo tambem -> nao duplica no weekday
      time: "07:00",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: []
    });
    createCelebration(db, {
      date: "2026-09-02", // quarta-feira
      time: "19:30", // mesmo horario de outra missa -> nao duplica no time
      communityId,
      celebrationType: "Missa Semanal",
      requirements: []
    });

    const slots = listDistinctMassSlots(db);
    expect(slots.weekdays).toEqual([0, 3]); // domingo e quarta, ordenados
    expect(slots.times).toEqual(["07:00", "19:30"]);
  });
});

describe("recorrencia de missas", () => {
  function baseRecurrence(overrides: Partial<RecurrenceInput> = {}): RecurrenceInput {
    return {
      communityId,
      celebrationType: "Missa Dominical",
      time: "10:00",
      weekdays: [0], // domingo
      startDate: "2026-08-30",
      endDate: "2026-09-27",
      requirements: [{ roleId: leitorId, quantityNeeded: 2 }],
      ...overrides
    };
  }

  it("previewRecurrence calcula as datas e identifica conflito com missa existente", () => {
    createCelebration(db, {
      date: "2026-09-13",
      time: "10:00",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: []
    });

    const preview = previewRecurrence(db, baseRecurrence());

    expect(preview.dates).toEqual(["2026-08-30", "2026-09-06", "2026-09-13", "2026-09-20", "2026-09-27"]);
    expect(preview.conflicts).toEqual(["2026-09-13"]);
  });

  it("createRecurrence cria uma missa por data, todas com as mesmas necessidades", () => {
    const result = createRecurrence(db, baseRecurrence(), { skipConflicts: false });

    expect(result.createdCount).toBe(5);
    expect(result.skippedCount).toBe(0);

    const list = listCelebrations(db);
    expect(list).toHaveLength(5);
    expect(list.map((c) => c.date)).toEqual(["2026-08-30", "2026-09-06", "2026-09-13", "2026-09-20", "2026-09-27"]);
    for (const celebration of list) {
      expect(celebration.requirements).toEqual([{ roleId: leitorId, roleName: "Leitor", quantityNeeded: 2 }]);
    }

    const recurrenceRow = db.prepare("SELECT recurrence_id FROM celebrations WHERE date = ?").get("2026-08-30") as {
      recurrence_id: number;
    };
    expect(recurrenceRow.recurrence_id).toBe(result.recurrenceId);
  });

  it("nao escreve nada quando ha conflito e skipConflicts e false (transacao abortada)", () => {
    createCelebration(db, {
      date: "2026-09-13",
      time: "10:00",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: []
    });

    expect(() => createRecurrence(db, baseRecurrence(), { skipConflicts: false })).toThrow();

    // so a missa original (o conflito) continua no banco — nada da recorrencia foi criado
    expect(listCelebrations(db)).toHaveLength(1);
    const recurrenceCount = db.prepare("SELECT COUNT(*) as c FROM celebration_recurrences").get() as { c: number };
    expect(recurrenceCount.c).toBe(0);
  });

  it("com skipConflicts true, cria as demais e pula so a que ja existe", () => {
    createCelebration(db, {
      date: "2026-09-13",
      time: "10:00",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: []
    });

    const result = createRecurrence(db, baseRecurrence(), { skipConflicts: true });

    expect(result.createdCount).toBe(4);
    expect(result.skippedCount).toBe(1);
    // 4 criadas pela recorrencia + 1 que ja existia antes
    expect(listCelebrations(db)).toHaveLength(5);
  });
});
