import { daysBetween, getWeekday } from "../domain/dateUtils";
import { slotKey } from "./eligibility";
import type { ScoringWeights } from "./scoringWeights";
import type { SchedulingRules } from "./schedulingRules";
import type { GenerationAvailabilityRule, GenerationHistory, GenerationPerson, ScoreReason } from "./types";

// Quantos dias contam como "escalado recentemente" para fins de penalidade/bonus
// (evita escalar a mesma pessoa duas semanas seguidas sem necessidade, e da
// o bonus de "nao participou da ultima missa" quando esse nao e o caso).
const RECENTLY_ASSIGNED_WINDOW_DAYS = 21;

// Quantas escalas acima da media contam como sobrecarga.
const OVERLOAD_THRESHOLD = 2;

/** Media e maximo de escalas por pessoa no historico — usado para o criterio de equilibrio. */
export function computeHistoryStats(assignmentCountByPerson: Record<number, number>): {
  average: number;
  max: number;
} {
  const counts = Object.values(assignmentCountByPerson);
  return {
    average: counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0,
    max: counts.length ? Math.max(...counts) : 0
  };
}

export interface ScoringContext {
  date: string;
  time: string;
  communityId: number;
  availabilityRules: GenerationAvailabilityRule[];
  history: GenerationHistory;
  averageAssignmentCount: number;
  maxAssignmentCount: number;
  /** Quem ja foi escalado em qual horario nesta rodada (chave via slotKey) — usado para o bonus/penalidade de conjuge. */
  usedSlots: ReadonlySet<string>;
  rules: SchedulingRules;
}

export interface ScoredCandidate {
  score: number;
  reasons: ScoreReason[];
}

/**
 * Calcula a pontuacao de um candidato para uma funcao/missa especifica, junto
 * com os motivos que compuseram essa pontuacao (usado para explicar "por que
 * essa pessoa foi escolhida" na tela de Escalas). Todos os pesos vem de fora
 * (settings, ver scoringWeights.ts) — nenhum valor magico deve ser adicionado
 * aqui sem passar por um peso nomeado.
 */
export function scoreCandidate(person: GenerationPerson, roleId: number, ctx: ScoringContext, weights: ScoringWeights): ScoredCandidate {
  let score = 0;
  const reasons: ScoreReason[] = [];
  const add = (delta: number, label: string): void => {
    score += delta;
    reasons.push({ label, delta });
  };

  const weekday = getWeekday(ctx.date);
  const availableRules = ctx.availabilityRules.filter((r) => r.personId === person.id && r.status === "available");

  if (availableRules.some((r) => r.weekday === weekday && r.time === ctx.time)) {
    // confirmou disponibilidade exatamente para este dia e horario
    add(weights.available, "Confirmou disponibilidade nesse dia e horário");
  } else if (availableRules.some((r) => r.weekday === weekday)) {
    // confirmou disponibilidade nesse dia da semana, em outro horario
    add(weights.timeSlotPreference, "Confirmou disponibilidade nesse dia da semana");
  }

  const assignmentCount = ctx.history.assignmentCountByPerson[person.id] ?? 0;
  const fewnessRatio = 1 - assignmentCount / (ctx.maxAssignmentCount + 1);
  const fewnessDelta = Math.round(weights.fewRecentAssignments * fewnessRatio);
  if (fewnessDelta !== 0) add(fewnessDelta, "Poucas escalas recentes");

  const preference = person.roles.find((r) => r.roleId === roleId)?.preferenceWeight ?? 0;
  if (preference !== 0) add(preference, "Preferência configurada para essa função");

  if (person.spousePersonId && ctx.usedSlots.has(slotKey(person.spousePersonId, ctx.date, ctx.time))) {
    if (ctx.rules.spouseRule === "priorizar") {
      add(weights.spouseTogetherBonus, "Cônjuge já escalado nessa missa");
    } else if (ctx.rules.spouseRule === "evitar") {
      add(-weights.spouseTogetherBonus, "Cônjuge já escalado nessa missa (evitado)");
    }
  }

  const lastDate = ctx.history.lastAssignmentDateByPerson[person.id];
  if (lastDate && Math.abs(daysBetween(lastDate, ctx.date)) <= RECENTLY_ASSIGNED_WINDOW_DAYS) {
    add(weights.recentlyAssignedPenalty, "Escalado recentemente");
  } else if (lastDate) {
    add(weights.notInLastCelebrationBonus, "Não participou da última missa");
  }

  const lastCommunityDate = ctx.history.lastAssignmentDateByPersonAndCommunity[`${person.id}|${ctx.communityId}`];
  if (lastCommunityDate && Math.abs(daysBetween(lastCommunityDate, ctx.date)) > RECENTLY_ASSIGNED_WINDOW_DAYS) {
    add(weights.notInLastCommunityCelebrationBonus, "Não participou da última missa nessa comunidade");
  }

  if (assignmentCount > ctx.averageAssignmentCount + OVERLOAD_THRESHOLD) {
    add(weights.overloadPenalty, "Sobrecarregado em relação à média");
  }

  if (ctx.rules.maxPerMonth != null) {
    const monthKey = ctx.date.slice(0, 7);
    const countThisMonth = ctx.history.monthlyAssignmentCountByPerson[monthKey]?.[person.id] ?? 0;
    if (countThisMonth + 1 > ctx.rules.maxPerMonth) {
      add(weights.nearMonthlyLimitPenalty, "No limite mensal configurado");
    }
  }

  if (ctx.rules.minIntervalDays != null && lastDate && Math.abs(daysBetween(lastDate, ctx.date)) < ctx.rules.minIntervalDays) {
    add(weights.minIntervalPenalty, "Escalado há menos dias que o intervalo mínimo configurado");
  }

  return { score, reasons };
}
