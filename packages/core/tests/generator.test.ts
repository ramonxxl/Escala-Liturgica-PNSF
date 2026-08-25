import { describe, expect, it } from "vitest";
import { generateSchedule } from "../src/engine/generator";
import { DEFAULT_SCHEDULING_RULES } from "../src/engine/schedulingRules";
import { DEFAULT_SCORING_WEIGHTS } from "../src/engine/scoringWeights";
import type { GenerationHistory, GenerationInput, GenerationPerson } from "../src/engine/types";

const LEITOR = 1;
const MINISTRO = 2;
const COMUNIDADE = 1;

function person(id: number, roleIds: number[], active = true): GenerationPerson {
  return {
    id,
    fullName: `Pessoa ${id}`,
    active,
    roles: roleIds.map((roleId) => ({ roleId, preferenceWeight: 0 })),
    spousePersonId: null
  };
}

function history(overrides: Partial<GenerationHistory> = {}): GenerationHistory {
  return {
    assignmentCountByPerson: {},
    lastAssignmentDateByPerson: {},
    lastAssignmentDateByPersonAndCommunity: {},
    monthlyAssignmentCountByPerson: {},
    busyDatesByPerson: {},
    ...overrides
  };
}

function baseInput(overrides: Partial<GenerationInput> = {}): GenerationInput {
  return {
    celebrations: [],
    people: [],
    availabilityRules: [],
    unavailabilityPeriods: [],
    history: history(),
    weights: DEFAULT_SCORING_WEIGHTS,
    rules: DEFAULT_SCHEDULING_RULES,
    ...overrides
  };
}

describe("generateSchedule — regras obrigatorias", () => {
  it("nunca escala pessoa inativa", () => {
    const result = generateSchedule(
      baseInput({
        celebrations: [
          { id: 1, date: "2026-08-30", time: "19:30", communityId: COMUNIDADE, requirements: [{ roleId: LEITOR, quantityNeeded: 1 }] }
        ],
        people: [person(1, [LEITOR], false)]
      })
    );
    expect(result.assignments).toHaveLength(0);
    expect(result.unfilled).toEqual([{ celebrationId: 1, roleId: LEITOR, missing: 1 }]);
  });

  it("nunca escala pessoa sem a funcao necessaria", () => {
    const result = generateSchedule(
      baseInput({
        celebrations: [
          { id: 1, date: "2026-08-30", time: "19:30", communityId: COMUNIDADE, requirements: [{ roleId: LEITOR, quantityNeeded: 1 }] }
        ],
        people: [person(1, [MINISTRO])]
      })
    );
    expect(result.assignments).toHaveLength(0);
  });

  it("nunca escala pessoa marcada indisponivel naquele dia/horario", () => {
    // 2026-08-30 e um domingo (weekday 0)
    const result = generateSchedule(
      baseInput({
        celebrations: [
          { id: 1, date: "2026-08-30", time: "19:30", communityId: COMUNIDADE, requirements: [{ roleId: LEITOR, quantityNeeded: 1 }] }
        ],
        people: [person(1, [LEITOR])],
        availabilityRules: [{ personId: 1, weekday: 0, time: "19:30", status: "unavailable" }]
      })
    );
    expect(result.assignments).toHaveLength(0);
  });

  it("nunca escala pessoa de ferias na data da missa", () => {
    const result = generateSchedule(
      baseInput({
        celebrations: [
          { id: 1, date: "2026-09-05", time: "19:30", communityId: COMUNIDADE, requirements: [{ roleId: LEITOR, quantityNeeded: 1 }] }
        ],
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
            communityId: COMUNIDADE,
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

  it("nunca escala a mesma pessoa duas vezes no mesmo dia, mesmo em missas/horarios diferentes", () => {
    const result = generateSchedule(
      baseInput({
        celebrations: [
          { id: 1, date: "2026-08-30", time: "07:00", communityId: COMUNIDADE, requirements: [{ roleId: LEITOR, quantityNeeded: 1 }] },
          { id: 2, date: "2026-08-30", time: "19:30", communityId: COMUNIDADE, requirements: [{ roleId: LEITOR, quantityNeeded: 1 }] }
        ],
        people: [person(1, [LEITOR])]
      })
    );
    // pessoa 1 e escalada na primeira missa do dia; a segunda fica sem preencher
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].celebrationId).toBe(1);
    expect(result.unfilled).toEqual([{ celebrationId: 2, roleId: LEITOR, missing: 1 }]);
  });

  it("nunca escala alguem ja ocupado no dia por uma escala publicada fora deste lote", () => {
    const result = generateSchedule(
      baseInput({
        celebrations: [
          { id: 1, date: "2026-08-30", time: "19:30", communityId: COMUNIDADE, requirements: [{ roleId: LEITOR, quantityNeeded: 1 }] }
        ],
        people: [person(1, [LEITOR]), person(2, [LEITOR])],
        history: history({ busyDatesByPerson: { 1: ["2026-08-30"] } }) // pessoa 1 ja escalada nesse dia em outra missa (fora deste lote)
      })
    );
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].personId).toBe(2);
  });

  it("reporta necessidade parcialmente preenchida quando faltam candidatos", () => {
    const result = generateSchedule(
      baseInput({
        celebrations: [
          { id: 1, date: "2026-08-30", time: "19:30", communityId: COMUNIDADE, requirements: [{ roleId: MINISTRO, quantityNeeded: 4 }] }
        ],
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
          { id: 1, date: "2026-08-30", time: "19:30", communityId: COMUNIDADE, requirements: [{ roleId: LEITOR, quantityNeeded: 1 }] },
          { id: 2, date: "2026-09-06", time: "19:30", communityId: COMUNIDADE, requirements: [{ roleId: LEITOR, quantityNeeded: 1 }] }
        ],
        people: [person(1, [LEITOR]), person(2, [LEITOR])]
      })
    );

    const byCelebration = new Map(result.assignments.map((a) => [a.celebrationId, a.personId]));
    expect(byCelebration.get(1)).toBe(1); // empate -> desempate por id, pessoa 1 primeiro
    expect(byCelebration.get(2)).toBe(2); // pessoa 1 ja foi escalada -> pessoa 2 tem prioridade agora
  });

  it("prioriza quem tem historico de poucas escalas, e explica o motivo", () => {
    const result = generateSchedule(
      baseInput({
        celebrations: [
          { id: 1, date: "2026-08-30", time: "19:30", communityId: COMUNIDADE, requirements: [{ roleId: LEITOR, quantityNeeded: 1 }] }
        ],
        people: [person(1, [LEITOR]), person(2, [LEITOR])],
        history: history({ assignmentCountByPerson: { 1: 10 } })
      })
    );
    expect(result.assignments[0].personId).toBe(2);
    expect(result.assignments[0].reasons.map((r) => r.label)).toContain("Poucas escalas recentes");
  });

  it("penaliza quem foi escalado ha pouco tempo", () => {
    const result = generateSchedule(
      baseInput({
        celebrations: [
          { id: 1, date: "2026-08-30", time: "19:30", communityId: COMUNIDADE, requirements: [{ roleId: LEITOR, quantityNeeded: 1 }] }
        ],
        people: [person(1, [LEITOR]), person(2, [LEITOR])],
        history: history({
          assignmentCountByPerson: { 1: 1, 2: 1 },
          lastAssignmentDateByPerson: { 1: "2026-08-25" } // 5 dias antes, dentro da janela de penalidade
        })
      })
    );
    expect(result.assignments[0].personId).toBe(2);
  });

  it("bonifica quem nao participou da ultima missa naquela comunidade", () => {
    const result = generateSchedule(
      baseInput({
        celebrations: [
          {
            id: 1,
            date: "2026-08-30",
            time: "19:30",
            communityId: COMUNIDADE,
            requirements: [
              { roleId: LEITOR, quantityNeeded: 1 }, // so a pessoa 1 e elegivel -> escalada primeiro, sem impacto no desempate
              { roleId: MINISTRO, quantityNeeded: 1 } // pessoa 2 e pessoa 3 empatadas, exceto o historico por comunidade
            ]
          }
        ],
        people: [person(1, [LEITOR]), person(2, [MINISTRO]), person(3, [MINISTRO])],
        history: history({
          lastAssignmentDateByPersonAndCommunity: {
            "2|1": "2026-06-01", // mais de 21 dias antes -> ganha o bonus
            "3|1": "2026-08-20" // so 10 dias antes -> dentro da janela, sem bonus
          }
        })
      })
    );
    const ministro = result.assignments.find((a) => a.roleId === MINISTRO);
    expect(ministro?.personId).toBe(2);
  });

  it("respeita a preferencia configurada por funcao (person_roles.preferenceWeight)", () => {
    const result = generateSchedule(
      baseInput({
        celebrations: [
          { id: 1, date: "2026-08-30", time: "19:30", communityId: COMUNIDADE, requirements: [{ roleId: LEITOR, quantityNeeded: 1 }] }
        ],
        people: [
          { id: 1, fullName: "Pessoa 1", active: true, roles: [{ roleId: LEITOR, preferenceWeight: 0 }], spousePersonId: null },
          { id: 2, fullName: "Pessoa 2", active: true, roles: [{ roleId: LEITOR, preferenceWeight: 5 }], spousePersonId: null }
        ]
      })
    );
    expect(result.assignments[0].personId).toBe(2);
  });

  it("prefere escalar o conjuge junto quando ele ja esta na mesma missa (regra padrao: priorizar)", () => {
    // Leitor so tem a pessoa 1 elegivel (mais escasso, processado primeiro).
    // Ministro tem pessoa 2 e pessoa 3 empatados em tudo, exceto que a
    // pessoa 3 e casada com a pessoa 1 — que ja foi escalada como Leitora
    // nesse mesmo horario. Sem o bonus, o desempate seria por id (pessoa 2).
    const result = generateSchedule(
      baseInput({
        celebrations: [
          {
            id: 1,
            date: "2026-08-30",
            time: "19:30",
            communityId: COMUNIDADE,
            requirements: [
              { roleId: LEITOR, quantityNeeded: 1 },
              { roleId: MINISTRO, quantityNeeded: 1 }
            ]
          }
        ],
        people: [
          { id: 1, fullName: "Pessoa 1", active: true, roles: [{ roleId: LEITOR, preferenceWeight: 0 }], spousePersonId: 3 },
          { id: 2, fullName: "Pessoa 2", active: true, roles: [{ roleId: MINISTRO, preferenceWeight: 0 }], spousePersonId: null },
          { id: 3, fullName: "Pessoa 3", active: true, roles: [{ roleId: MINISTRO, preferenceWeight: 0 }], spousePersonId: 1 }
        ]
      })
    );

    const ministro = result.assignments.find((a) => a.roleId === MINISTRO);
    expect(ministro?.personId).toBe(3);
  });

  it("regra de conjuge 'evitar' inverte a preferencia", () => {
    // Mesmo cenario do teste acima, mas a pessoa 3 tem uma pequena vantagem
    // de preferencia (3) que venceria sob "priorizar"/"nenhuma" — a regra
    // "evitar" precisa ser forte o bastante pra reverter esse resultado.
    const result = generateSchedule(
      baseInput({
        celebrations: [
          {
            id: 1,
            date: "2026-08-30",
            time: "19:30",
            communityId: COMUNIDADE,
            requirements: [
              { roleId: LEITOR, quantityNeeded: 1 },
              { roleId: MINISTRO, quantityNeeded: 1 }
            ]
          }
        ],
        people: [
          { id: 1, fullName: "Pessoa 1", active: true, roles: [{ roleId: LEITOR, preferenceWeight: 0 }], spousePersonId: 3 },
          { id: 2, fullName: "Pessoa 2", active: true, roles: [{ roleId: MINISTRO, preferenceWeight: 0 }], spousePersonId: null },
          { id: 3, fullName: "Pessoa 3", active: true, roles: [{ roleId: MINISTRO, preferenceWeight: 3 }], spousePersonId: 1 }
        ],
        rules: { ...DEFAULT_SCHEDULING_RULES, spouseRule: "evitar" }
      })
    );

    const ministro = result.assignments.find((a) => a.roleId === MINISTRO);
    expect(ministro?.personId).toBe(2);
  });

  it("limite mensal configurado e reforco (soft): ainda escala se for o unico elegivel", () => {
    const result = generateSchedule(
      baseInput({
        celebrations: [
          { id: 1, date: "2026-08-30", time: "19:30", communityId: COMUNIDADE, requirements: [{ roleId: LEITOR, quantityNeeded: 1 }] }
        ],
        people: [person(1, [LEITOR])],
        history: history({ monthlyAssignmentCountByPerson: { "2026-08": { 1: 2 } } }),
        rules: { ...DEFAULT_SCHEDULING_RULES, maxPerMonth: 2 }
      })
    );
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].personId).toBe(1);
  });

  it("limite mensal configurado prioriza quem ainda tem folga quando ha escolha", () => {
    const result = generateSchedule(
      baseInput({
        celebrations: [
          { id: 1, date: "2026-08-30", time: "19:30", communityId: COMUNIDADE, requirements: [{ roleId: LEITOR, quantityNeeded: 1 }] }
        ],
        people: [person(1, [LEITOR]), person(2, [LEITOR])],
        history: history({ monthlyAssignmentCountByPerson: { "2026-08": { 1: 2 } } }),
        rules: { ...DEFAULT_SCHEDULING_RULES, maxPerMonth: 2 }
      })
    );
    expect(result.assignments[0].personId).toBe(2);
  });

  it("intervalo minimo configurado e reforco (soft): ainda escala se for o unico elegivel", () => {
    const result = generateSchedule(
      baseInput({
        celebrations: [
          { id: 1, date: "2026-08-30", time: "19:30", communityId: COMUNIDADE, requirements: [{ roleId: LEITOR, quantityNeeded: 1 }] }
        ],
        people: [person(1, [LEITOR])],
        history: history({ lastAssignmentDateByPerson: { 1: "2026-08-25" } }), // 5 dias antes
        rules: { ...DEFAULT_SCHEDULING_RULES, minIntervalDays: 7 }
      })
    );
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].personId).toBe(1);
  });

  it("intervalo minimo configurado prioriza quem respeita o intervalo quando ha escolha", () => {
    const result = generateSchedule(
      baseInput({
        celebrations: [
          { id: 1, date: "2026-08-30", time: "19:30", communityId: COMUNIDADE, requirements: [{ roleId: LEITOR, quantityNeeded: 1 }] }
        ],
        people: [person(1, [LEITOR]), person(2, [LEITOR])],
        history: history({ lastAssignmentDateByPerson: { 1: "2026-08-25" } }), // 5 dias antes
        rules: { ...DEFAULT_SCHEDULING_RULES, minIntervalDays: 7 }
      })
    );
    expect(result.assignments[0].personId).toBe(2);
  });
});
