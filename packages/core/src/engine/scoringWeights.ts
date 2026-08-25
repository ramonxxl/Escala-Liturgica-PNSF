// Pesos default do motor de pontuacao (item 11).
// Em runtime, os valores efetivos vem da tabela `settings` (packages/data) —
// isto aqui e apenas a semente usada na primeira inicializacao do banco.
// Nenhum peso deve ser escrito diretamente no motor de geracao (packages/core/src/engine/generator.ts).

export interface ScoringWeights {
  available: number;
  fewRecentAssignments: number;
  timeSlotPreference: number;
  spouseTogetherBonus: number;
  notInLastCelebrationBonus: number;
  notInLastCommunityCelebrationBonus: number;
  recentlyAssignedPenalty: number;
  overloadPenalty: number;
  nearMonthlyLimitPenalty: number;
  minIntervalPenalty: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  available: 10,
  fewRecentAssignments: 8,
  timeSlotPreference: 5,
  spouseTogetherBonus: 6,
  notInLastCelebrationBonus: 4,
  notInLastCommunityCelebrationBonus: 4,
  recentlyAssignedPenalty: -10,
  overloadPenalty: -20,
  nearMonthlyLimitPenalty: -60,
  minIntervalPenalty: -60
};
