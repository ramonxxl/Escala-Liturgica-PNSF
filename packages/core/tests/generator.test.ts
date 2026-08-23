import { describe, expect, it } from "vitest";
import { generateSchedule } from "../src/engine/generator";
import { DEFAULT_SCORING_WEIGHTS } from "../src/engine/scoringWeights";
import type { GenerationInput, GenerationPerson } from "../src/engine/types";

const LEITOR = 1;
const MINISTRO = 2;

function person(id: number, roleIds: number[], active = true): GenerationPerson {
  return { id, fullName: `Pessoa ${id}`, active, roles: roleIds.map((roleId) => ({ roleId, preferenceWeight: 0 })) };
}

function baseInput(overrides: Partial<GenerationInput> = {}): GenerationInput {
  return {
    celebrations: [],
    people: [],
    availabilityRules: [],
    unavailabilityPeriods: [],
    history: { assignmentCountByPerson: {}, lastAssignmentDateByPerson: {} },
    weights: DEFAULT_SCORING_WEIGHTS,
    ...overrides
  };
}

describe("generateSchedule — regras obrigatorias", () => {
  it("nunca escala pessoa inativa", () => {
    const result = generateSchedule(
      baseInput({
        celebrations: [{ id: 1, date: "2026-08-30", time: "19:30", requirements: [{ roleId: LEITOR, quantityNeeded: 1 }] }],
        people: [person(1, [LEITOR], false)]
      })
    );
    expect(result.assignments).toHaveLength(0);
    expect(result.unfilled).toEqual([{ celebrationId: 1, roleId: LEITOR, missing: 1 }]);
  });

  it("nunca escala pessoa sem a funcao necessaria", () => {
    const result = generateSchedule(
      baseInput({
        celebrations: [{ id: 1, date: "2026-08-30", time: "19:30", requirements: [{ roleId: LEITOR, quantityNeeded: 1 }] }],
        people: [person(1, [MINISTRO])]
      })
    );
    expect(result.assignments).toHaveLength(0);
  });

  it("nunca escala pessoa marcada indisponivel naquele dia/horario", () => {
    // 2026-08-30 e um domingo (weekday 0)
    const result = generateSchedule(
      baseInput({
        celebrations: [{ id: 1, date: "2026-08-30", time: "19:30", requirements: [{ roleId: LEITOR, quantityNeeded: 1 }] }],
        people: [person(1, [LEITOR])],
        availabilityRules: [{ personId: 1, weekday: 0, time: "19:30", status: "unavailable" }]
      })
    );
    expect(result.assignments).toHaveLength(0);
  });

  it("nunca escala pessoa de ferias na data da missa", () => {
    const result = generateSchedule(
      baseInput({
        celebrations: [{ id: 1, date: "2026-09-05", time: "19:30", requirements: [{ roleId: LEITOR, quantityNeeded: 1 }] }],
        people: [person(1, [LEITOR])],
        unavailabilityPeriods: [{ personId: 1, startDate: "2026-09-01", endDate: "2026-09-15" }]
      })
    );
    expect(result.assignments).toHaveLength(0);
  });

  it("nunca escala a mesma pessoa duas vezes no mesmo horario", () => {
    const result = generateSchedule(
      baseInput({
        celebrations: [
          {
            id: 1,
            date: "2026-08-30",
            time: "19:30",
            requirements: [
              { roleId: LEITOR, quantityNeeded: 1 },
              { roleId: MINISTRO, quantityNeeded: 1 }
            ]
          }
        ],
        people: [person(1, [LEITOR, MINISTRO])]
      })
    );
    // so ha 1 pessoa elegivel para as duas funcoes no mesmo horario — uma fica sem preencher
    expect(result.assignments).toHaveLength(1);
    expect(result.unfilled).toHaveLength(1);
  });

  it("reporta necessidade parcialmente preenchida quando faltam candidatos", () => {
    const result = generateSchedule(
      baseInput({
        celebrations: [{ id: 1, date: "2026-08-30", time: "19:30", requirements: [{ roleId: MINISTRO, quantityNeeded: 4 }] }],
        people: [person(1, [MINISTRO]), person(2, [MINISTRO])]
      })
    );
    expect(result.assignments).toHaveLength(2);
    expect(result.unfilled).toEqual([{ celebrationId: 1, roleId: MINISTRO, missing: 2 }]);
  });
});

describe("generateSchedule — equilibrio e pontuacao", () => {
  it("se autoequilibra dentro do mesmo lote (quem acabou de ser escalado perde prioridade)", () => {
    const result = generateSchedule(
      baseInput({
        celebrations: [
          { id: 1, date: "2026-08-30", time: "19:30", requirements: [{ roleId: LEITOR, quantityNeeded: 1 }] },
          { id: 2, date: "2026-09-06", time: "19:30", requirements: [{ roleId: LEITOR, quantityNeeded: 1 }] }
        ],
        people: [person(1, [LEITOR]), person(2, [LEITOR])]
      })
    );

    const byCelebration = new Map(result.assignments.map((a) => [a.celebrationId, a.personId]));
    expect(byCelebration.get(1)).toBe(1); // empate -> desempate por id, pessoa 1 primeiro
    expect(byCelebration.get(2)).toBe(2); // pessoa 1 ja foi escalada -> pessoa 2 tem prioridade agora
  });

  it("prioriza quem tem historico de poucas escalas", () => {
    const result = generateSchedule(
      baseInput({
        celebrations: [{ id: 1, date: "2026-08-30", time: "19:30", requirements: [{ roleId: LEITOR, quantityNeeded: 1 }] }],
        people: [person(1, [LEITOR]), person(2, [LEITOR])],
        history: { assignmentCountByPerson: { 1: 10 }, lastAssignmentDateByPerson: {} }
      })
    );
    expect(result.assignments[0].personId).toBe(2);
  });

  it("penaliza quem foi escalado ha pouco tempo", () => {
    const result = generateSchedule(
      baseInput({
        celebrations: [{ id: 1, date: "2026-08-30", time: "19:30", requirements: [{ roleId: LEITOR, quantityNeeded: 1 }] }],
        people: [person(1, [LEITOR]), person(2, [LEITOR])],
        history: {
          assignmentCountByPerson: { 1: 1, 2: 1 },
          lastAssignmentDateByPerson: { 1: "2026-08-25" } // 5 dias antes, dentro da janela de penalidade
        }
      })
    );
    expect(result.assignments[0].personId).toBe(2);
  });

  it("respeita a preferencia configurada por funcao (person_roles.preferenceWeight)", () => {
    const result = generateSchedule(
      baseInput({
        celebrations: [{ id: 1, date: "2026-08-30", time: "19:30", requirements: [{ roleId: LEITOR, quantityNeeded: 1 }] }],
        people: [
          { id: 1, fullName: "Pessoa 1", active: true, roles: [{ roleId: LEITOR, preferenceWeight: 0 }] },
          { id: 2, fullName: "Pessoa 2", active: true, roles: [{ roleId: LEITOR, preferenceWeight: 5 }] }
        ]
      })
    );
    expect(result.assignments[0].personId).toBe(2);
  });
});
