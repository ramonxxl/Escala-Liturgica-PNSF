// Regras de escala configuraveis pelo coordenador (tela de Configuracoes).
// Diferente dos pesos em scoringWeights.ts, estas nao sao "quanto vale cada
// criterio" e sim politicas com efeito estrutural na pontuacao — mas nunca
// bloqueiam uma vaga (ver eligibility.ts para as regras obrigatorias de
// verdade): mesmo violando o limite mensal ou o intervalo minimo, uma pessoa
// continua elegivel, so perde pontos, porque o motor prefere preencher a
// vaga com alguem "fora da regra" a deixa-la vazia.

export type SpouseSchedulingRule = "priorizar" | "evitar" | "nenhuma";

export interface SchedulingRules {
  spouseRule: SpouseSchedulingRule;
  /** null = sem limite configurado. */
  maxPerMonth: number | null;
  /** null = sem intervalo minimo configurado. */
  minIntervalDays: number | null;
}

export const DEFAULT_SCHEDULING_RULES: SchedulingRules = {
  spouseRule: "priorizar",
  maxPerMonth: null,
  minIntervalDays: null
};
