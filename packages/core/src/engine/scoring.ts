import { daysBetween, getWeekday } from "../domain/dateUtils";
import type { ScoringWeights } from "./scoringWeights";
import type { GenerationAvailabilityRule, GenerationHistory, GenerationPerson } from "./types";

// Quantos dias contam como "escalado recentemente" para fins de penalidade
// (evita escalar a mesma pessoa duas semanas seguidas sem necessidade).
const RECENTLY_ASSIGNED_WINDOW_DAYS = 21;

// Quantas escalas acima da media contam como sobrecarga.
const OVERLOAD_THRESHOLD = 2;

export interface ScoringContext {
  date: string;
  time: string;
  availabilityRules: GenerationAvailabilityRule[];
  history: GenerationHistory;
  averageAssignmentCount: number;
  maxAssignmentCount: number;
}

/**
 * Calcula a pontuacao de um candidato para uma funcao/missa especifica.
 * Todos os pesos vem de fora (settings, ver scoringWeights.ts) — nenhum
 * valor magico deve ser adicionado aqui sem passar por um peso nomeado.
 */
export function scoreCandidate(
  person: GenerationPerson,
  roleId: number,
  ctx: ScoringContext,
  weights: ScoringWeights
): number {
  let score = 0;
  const weekday = getWeekday(ctx.date);
  const availableRules = ctx.availabilityRules.filter((r) => r.personId === person.id && r.status === "available");

  if (availableRules.some((r) => r.weekday === weekday && r.time === ctx.time)) {
    // confirmou disponibilidade exatamente para este dia e horario
    score += weights.available;
  } else if (availableRules.some((r) => r.weekday === weekday)) {
    // confirmou disponibilidade nesse dia da semana, em outro horario
    score += weights.timeSlotPreference;
  }

  const assignmentCount = ctx.history.assignmentCountByPerson[person.id] ?? 0;
  const fewnessRatio = 1 - assignmentCount / (ctx.maxAssignmentCount + 1);
  score += Math.round(weights.fewRecentAssignments * fewnessRatio);

  const preference = person.roles.find((r) => r.roleId === roleId)?.preferenceWeight ?? 0;
  score += preference;

  const lastDate = ctx.history.lastAssignmentDateByPerson[person.id];
  if (lastDate && Math.abs(daysBetween(lastDate, ctx.date)) <= RECENTLY_ASSIGNED_WINDOW_DAYS) {
    score += weights.recentlyAssignedPenalty;
  }

  if (assignmentCount > ctx.averageAssignmentCount + OVERLOAD_THRESHOLD) {
    score += weights.overloadPenalty;
  }

  return score;
}
