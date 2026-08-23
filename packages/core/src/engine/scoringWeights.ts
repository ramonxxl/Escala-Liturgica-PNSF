// Pesos default do motor de pontuacao (item 11).
// Em runtime, os valores efetivos vem da tabela `settings` (packages/data) —
// isto aqui e apenas a semente usada na primeira inicializacao do banco.
// Nenhum peso deve ser escrito diretamente no motor de geracao (packages/core/src/engine/generator.ts).

export interface ScoringWeights {
  available: number;
  fewRecentAssignments: number;
  timeSlotPreference: number;
  recentlyAssignedPenalty: number;
  overloadPenalty: number;
  conflictPenalty: number;
  unavailablePenalty: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  available: 10,
  fewRecentAssignments: 8,
  timeSlotPreference: 5,
  recentlyAssignedPenalty: -10,
  overloadPenalty: -20,
  conflictPenalty: -100,
  unavailablePenalty: -1000
};
