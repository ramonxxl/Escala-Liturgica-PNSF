import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type AppDatabase } from "../src/db";
import { createCommunity } from "../src/repositories/communities";
import { createRole } from "../src/repositories/roles";
import {
  createCelebration,
  getCelebration,
  listCelebrations,
  removeCelebration,
  updateCelebration
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
});
