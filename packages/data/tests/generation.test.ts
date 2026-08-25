import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type AppDatabase } from "../src/db";
import { createCommunity } from "../src/repositories/communities";
import { createRole } from "../src/repositories/roles";
import { createPerson, updatePerson } from "../src/repositories/people";
import { createCelebration } from "../src/repositories/celebrations";
import { createAvailability } from "../src/repositories/availabilities";
import { createUnavailability } from "../src/repositories/unavailabilities";
import {
  addAssignment,
  buildGenerationInput,
  generateAndSaveSchedule,
  generateAndSaveScheduleForRange,
  rankSubstitutes,
  removeAssignment,
  substituteAssignment
} from "../src/repositories/generation";

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

    const schedule = generateAndSaveSchedule(db, celebration.id);

    expect(schedule.status).toBe("draft");
    expect(schedule.assignments).toHaveLength(1);
    expect(schedule.assignments[0].personId).toBe(person.id);
    expect(schedule.assignments[0].roleName).toBe("Leitor");
    expect(schedule.unfilled).toHaveLength(0);

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

    const schedule = generateAndSaveSchedule(db, celebration.id);

    expect(schedule.assignments).toHaveLength(0);
    expect(schedule.unfilled).toEqual([{ celebrationId: celebration.id, roleId: leitorId, missing: 2 }]);
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

    expect(second.id).toBe(first.id); // reaproveita a mesma escala rascunho, so troca as atribuicoes
    expect(second.assignments).toHaveLength(1);
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

    const schedule = generateAndSaveSchedule(db, celebration.id);
    db.prepare("UPDATE schedules SET status = 'published' WHERE id = ?").run(schedule.id);

    expect(() => generateAndSaveSchedule(db, celebration.id)).toThrow();
  });
});

describe("edicao manual da escala", () => {
  it("adiciona uma pessoa a uma vaga pendente", () => {
    createPerson(db, { fullName: "Maria", communityId, roleIds: [leitorId] });
    const celebration = createCelebration(db, {
      date: "2026-08-30",
      time: "19:30",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: [{ roleId: leitorId, quantityNeeded: 2 }]
    });
    const schedule = generateAndSaveSchedule(db, celebration.id);
    expect(schedule.assignments).toHaveLength(1); // so a Maria elegivel
    expect(schedule.unfilled).toEqual([{ celebrationId: celebration.id, roleId: leitorId, missing: 1 }]);

    const other = createPerson(db, { fullName: "Ana", communityId, roleIds: [leitorId] });
    const added = addAssignment(db, schedule.id, leitorId, other.id);
    expect(added.personName).toBe("Ana");
    expect(added.source).toBe("manual");
    expect(added.conflictFlag).toBe(false);
  });

  it("remove uma atribuicao", () => {
    createPerson(db, { fullName: "Maria", communityId, roleIds: [leitorId] });
    const celebration = createCelebration(db, {
      date: "2026-08-30",
      time: "19:30",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: [{ roleId: leitorId, quantityNeeded: 1 }]
    });
    const schedule = generateAndSaveSchedule(db, celebration.id);

    removeAssignment(db, schedule.assignments[0].id);

    const reloaded = db
      .prepare("SELECT COUNT(*) as c FROM schedule_assignments WHERE schedule_id = ?")
      .get(schedule.id) as { c: number };
    expect(reloaded.c).toBe(0);
  });

  it("substitui a pessoa de uma atribuicao e marca conflito quando ela ja esta ocupada nesse horario", () => {
    const maria = createPerson(db, { fullName: "Maria", communityId, roleIds: [leitorId] });
    const ministroId = createRole(db, { name: "Ministro" }).id;
    const joao = createPerson(db, { fullName: "João", communityId, roleIds: [leitorId, ministroId] });

    const celebration = createCelebration(db, {
      date: "2026-08-30",
      time: "19:30",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: [
        { roleId: leitorId, quantityNeeded: 1 },
        { roleId: ministroId, quantityNeeded: 1 }
      ]
    });
    const schedule = generateAndSaveSchedule(db, celebration.id);

    const leitorAssignment = schedule.assignments.find((a) => a.roleName === "Leitor")!;
    const ministroAssignment = schedule.assignments.find((a) => a.roleName === "Ministro")!;

    // troca o leitor para ser o Joao, que ja esta escalado como Ministro nesse mesmo horario -> conflito
    const shouldConflict = ministroAssignment.personId === joao.id;
    const substituted = substituteAssignment(db, leitorAssignment.id, joao.id);

    expect(substituted.personId).toBe(joao.id);
    expect(substituted.source).toBe("manual");
    expect(substituted.conflictFlag).toBe(shouldConflict);
  });
});

describe("rankSubstitutes", () => {
  it("ordena candidatos elegiveis, priorizando a mesma comunidade", () => {
    const otherCommunity = createCommunity(db, { name: "São José" }).id;
    const maria = createPerson(db, { fullName: "Maria", communityId, roleIds: [leitorId] });
    createPerson(db, { fullName: "Ana (mesma comunidade)", communityId, roleIds: [leitorId] });
    createPerson(db, { fullName: "Carlos (outra comunidade)", communityId: otherCommunity, roleIds: [leitorId] });

    const celebration = createCelebration(db, {
      date: "2026-08-30",
      time: "19:30",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: [{ roleId: leitorId, quantityNeeded: 1 }]
    });
    const schedule = generateAndSaveSchedule(db, celebration.id);
    expect(schedule.assignments[0].personId).toBe(maria.id);

    const ranked = rankSubstitutes(db, schedule.assignments[0].id);

    expect(ranked.map((c) => c.personName)).toEqual(["Ana (mesma comunidade)", "Carlos (outra comunidade)"]);
    expect(ranked[0].sameCommunity).toBe(true);
    expect(ranked[1].sameCommunity).toBe(false);
  });

  it("exclui candidatos indisponiveis ou de ferias do ranking", () => {
    createPerson(db, { fullName: "Maria", communityId, roleIds: [leitorId] });
    const ana = createPerson(db, { fullName: "Ana", communityId, roleIds: [leitorId] });
    const carlos = createPerson(db, { fullName: "Carlos", communityId, roleIds: [leitorId] });

    createAvailability(db, { personId: ana.id, weekday: 0, time: "19:30", status: "unavailable" });
    createUnavailability(db, { personId: carlos.id, startDate: "2026-08-01", endDate: "2026-08-31" });

    const celebration = createCelebration(db, {
      date: "2026-08-30",
      time: "19:30",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: [{ roleId: leitorId, quantityNeeded: 1 }]
    });
    const schedule = generateAndSaveSchedule(db, celebration.id);

    const ranked = rankSubstitutes(db, schedule.assignments[0].id);
    expect(ranked).toHaveLength(0);
  });

  it("exclui do ranking quem ja esta escalado no mesmo dia em outra missa/horario", () => {
    createPerson(db, { fullName: "Maria", communityId, roleIds: [leitorId] });
    const ana = createPerson(db, { fullName: "Ana", communityId, roleIds: [leitorId] });

    const manha = createCelebration(db, {
      date: "2026-08-30",
      time: "07:00",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: [{ roleId: leitorId, quantityNeeded: 1 }]
    });
    const noite = createCelebration(db, {
      date: "2026-08-30",
      time: "19:30",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: [{ roleId: leitorId, quantityNeeded: 1 }]
    });

    const manhaSchedule = generateAndSaveSchedule(db, manha.id);
    substituteAssignment(db, manhaSchedule.assignments[0].id, ana.id); // forca a Ana a ficar ocupada de manha

    const noiteSchedule = generateAndSaveSchedule(db, noite.id); // so sobra a Maria elegivel

    const ranked = rankSubstitutes(db, noiteSchedule.assignments[0].id);
    expect(ranked).toHaveLength(0); // a unica outra pessoa (Ana) ja esta ocupada nesse dia
  });
});

describe("generateAndSaveScheduleForRange", () => {
  it("gera todas as missas do periodo de uma vez, equilibrando entre elas", () => {
    createPerson(db, { fullName: "Maria", communityId, roleIds: [leitorId] });
    createPerson(db, { fullName: "Ana", communityId, roleIds: [leitorId] });

    const c1 = createCelebration(db, {
      date: "2026-08-02",
      time: "19:30",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: [{ roleId: leitorId, quantityNeeded: 1 }]
    });
    const c2 = createCelebration(db, {
      date: "2026-08-09",
      time: "19:30",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: [{ roleId: leitorId, quantityNeeded: 1 }]
    });

    const result = generateAndSaveScheduleForRange(db, "2026-08-01", "2026-08-31");

    expect(result.skipped).toHaveLength(0);
    expect(result.schedules).toHaveLength(2);

    const byCelebration = new Map(
      result.schedules.map((s) => [s.celebrationId, s.assignments[0]?.personId])
    );
    // com o lote inteiro, as duas missas devem ir para pessoas diferentes (autoequilibrio)
    expect(byCelebration.get(c1.id)).not.toBe(byCelebration.get(c2.id));
  });

  it("nunca escala a mesma pessoa em duas missas do mesmo dia, mesmo em horarios diferentes", () => {
    const maria = createPerson(db, { fullName: "Maria", communityId, roleIds: [leitorId] });

    const manha = createCelebration(db, {
      date: "2026-08-30",
      time: "07:00",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: [{ roleId: leitorId, quantityNeeded: 1 }]
    });
    const noite = createCelebration(db, {
      date: "2026-08-30",
      time: "19:30",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: [{ roleId: leitorId, quantityNeeded: 1 }]
    });

    const result = generateAndSaveScheduleForRange(db, "2026-08-01", "2026-08-31");

    const byCelebration = new Map(result.schedules.map((s) => [s.celebrationId, s.assignments[0]?.personId]));
    // so a Maria e elegivel -> escalada numa das duas missas, a outra fica sem preencher
    const filledCount = [byCelebration.get(manha.id), byCelebration.get(noite.id)].filter((id) => id === maria.id).length;
    expect(filledCount).toBe(1);
  });

  it("ignora missas fora do periodo informado", () => {
    createPerson(db, { fullName: "Maria", communityId, roleIds: [leitorId] });
    createCelebration(db, {
      date: "2026-09-06",
      time: "19:30",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: [{ roleId: leitorId, quantityNeeded: 1 }]
    });

    const result = generateAndSaveScheduleForRange(db, "2026-08-01", "2026-08-31");
    expect(result.schedules).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });

  it("pula missas com escala ja publicada e reporta em skipped", () => {
    createPerson(db, { fullName: "Maria", communityId, roleIds: [leitorId] });
    const celebration = createCelebration(db, {
      date: "2026-08-30",
      time: "19:30",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: [{ roleId: leitorId, quantityNeeded: 1 }]
    });
    const schedule = generateAndSaveSchedule(db, celebration.id);
    db.prepare("UPDATE schedules SET status = 'published' WHERE id = ?").run(schedule.id);

    const result = generateAndSaveScheduleForRange(db, "2026-08-01", "2026-08-31");

    expect(result.schedules).toHaveLength(0);
    expect(result.skipped).toEqual([{ celebrationId: celebration.id, reason: "Escala já publicada" }]);
  });
});

describe("geracao filtrada por funcao", () => {
  it("gera so a funcao pedida, preservando atribuicoes ja feitas de outras funcoes", () => {
    const ministroId = createRole(db, { name: "Ministro" }).id;
    createPerson(db, { fullName: "Maria", communityId, roleIds: [leitorId] });
    createPerson(db, { fullName: "João", communityId, roleIds: [ministroId] });

    const celebration = createCelebration(db, {
      date: "2026-08-30",
      time: "19:30",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: [
        { roleId: leitorId, quantityNeeded: 1 },
        { roleId: ministroId, quantityNeeded: 1 }
      ]
    });

    const leitorOnly = generateAndSaveSchedule(db, celebration.id, [leitorId]);
    expect(leitorOnly.assignments).toHaveLength(1);
    expect(leitorOnly.assignments[0].roleName).toBe("Leitor");
    expect(leitorOnly.unfilled).toEqual([{ celebrationId: celebration.id, roleId: ministroId, missing: 1 }]);

    const both = generateAndSaveSchedule(db, celebration.id, [ministroId]);
    expect(both.assignments).toHaveLength(2);
    expect(both.assignments.find((a) => a.roleName === "Leitor")?.personName).toBe("Maria");
    expect(both.assignments.find((a) => a.roleName === "Ministro")?.personName).toBe("João");
    expect(both.unfilled).toHaveLength(0);
  });

  it("filtra por funcao tambem na geracao em lote do periodo", () => {
    const ministroId = createRole(db, { name: "Ministro" }).id;
    createPerson(db, { fullName: "Maria", communityId, roleIds: [leitorId, ministroId] });

    const celebration = createCelebration(db, {
      date: "2026-08-30",
      time: "19:30",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: [
        { roleId: leitorId, quantityNeeded: 1 },
        { roleId: ministroId, quantityNeeded: 1 }
      ]
    });

    const result = generateAndSaveScheduleForRange(db, "2026-08-01", "2026-08-31", [ministroId]);

    expect(result.schedules).toHaveLength(1);
    expect(result.schedules[0].assignments).toHaveLength(1);
    expect(result.schedules[0].assignments[0].roleName).toBe("Ministro");
  });
});

describe("conjuge junto na geracao", () => {
  it("prioriza escalar o conjuge quando ele ja foi escalado na mesma missa", () => {
    const ministroId = createRole(db, { name: "Ministro" }).id;
    const maria = createPerson(db, { fullName: "Maria", communityId, roleIds: [leitorId] });
    const joao = createPerson(db, { fullName: "João", communityId, roleIds: [ministroId] });
    const ana = createPerson(db, { fullName: "Ana", communityId, roleIds: [ministroId] });

    updatePerson(db, maria.id, {
      fullName: "Maria",
      communityId,
      roleIds: [leitorId],
      spousePersonId: joao.id
    });

    const celebration = createCelebration(db, {
      date: "2026-08-30",
      time: "19:30",
      communityId,
      celebrationType: "Missa Dominical",
      requirements: [
        { roleId: leitorId, quantityNeeded: 1 }, // so a Maria e elegivel -> escalada primeiro
        { roleId: ministroId, quantityNeeded: 1 } // João e Ana empatados, exceto o conjuge
      ]
    });

    const schedule = generateAndSaveSchedule(db, celebration.id);

    const ministro = schedule.assignments.find((a) => a.roleName === "Ministro");
    expect(ministro?.personName).toBe("João");
  });
});
