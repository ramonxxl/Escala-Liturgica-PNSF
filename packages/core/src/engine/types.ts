import type { SchedulingRules } from "./schedulingRules";
import type { ScoringWeights } from "./scoringWeights";

export interface GenerationPersonRole {
  roleId: number;
  preferenceWeight: number;
}

export interface GenerationPerson {
  id: number;
  fullName: string;
  active: boolean;
  roles: GenerationPersonRole[];
  /** Conjuge (outro integrante) — o motor da prioridade a escalar os dois na mesma missa. */
  spousePersonId: number | null;
}

export interface GenerationAvailabilityRule {
  personId: number;
  weekday: number; // 0=domingo .. 6=sabado
  time: string; // HH:mm
  status: "available" | "unavailable";
}

export interface GenerationUnavailabilityPeriod {
  personId: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface GenerationRequirement {
  roleId: number;
  quantityNeeded: number;
}

export interface GenerationCelebration {
  id: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  communityId: number;
  requirements: GenerationRequirement[];
}

export interface GenerationHistory {
  /** Total de vezes que a pessoa ja foi escalada (usado para equilibrio). */
  assignmentCountByPerson: Record<number, number>;
  /** Data da ultima escala da pessoa (usado para evitar escalar em sequencia). */
  lastAssignmentDateByPerson: Record<number, string>;
  /** Data da ultima escala da pessoa NESSA comunidade (chave `${personId}|${communityId}`). */
  lastAssignmentDateByPersonAndCommunity: Record<string, string>;
  /** Quantas vezes a pessoa ja foi escalada em cada mes (chave "YYYY-MM" -> personId -> total). */
  monthlyAssignmentCountByPerson: Record<string, Record<number, number>>;
  /** Datas em que a pessoa ja tem alguma escala (qualquer missa/funcao) — nunca escalar de novo nessas datas. */
  busyDatesByPerson: Record<number, string[]>;
}

export interface GenerationInput {
  celebrations: GenerationCelebration[];
  people: GenerationPerson[];
  availabilityRules: GenerationAvailabilityRule[];
  unavailabilityPeriods: GenerationUnavailabilityPeriod[];
  history: GenerationHistory;
  weights: ScoringWeights;
  rules: SchedulingRules;
}

/** Um dos motivos que compuseram a pontuacao de um candidato — usado para explicar "por que essa pessoa foi escolhida". */
export interface ScoreReason {
  label: string;
  delta: number;
}

export interface ProposedAssignment {
  celebrationId: number;
  roleId: number;
  personId: number;
  score: number;
  reasons: ScoreReason[];
}

export interface UnfilledSlot {
  celebrationId: number;
  roleId: number;
  missing: number;
}

export interface GenerationResult {
  assignments: ProposedAssignment[];
  unfilled: UnfilledSlot[];
}
