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
  requirements: GenerationRequirement[];
}

export interface GenerationHistory {
  /** Total de vezes que a pessoa ja foi escalada (usado para equilibrio). */
  assignmentCountByPerson: Record<number, number>;
  /** Data da ultima escala da pessoa (usado para evitar escalar em sequencia). */
  lastAssignmentDateByPerson: Record<number, string>;
}

export interface GenerationInput {
  celebrations: GenerationCelebration[];
  people: GenerationPerson[];
  availabilityRules: GenerationAvailabilityRule[];
  unavailabilityPeriods: GenerationUnavailabilityPeriod[];
  history: GenerationHistory;
  weights: ScoringWeights;
}

export interface ProposedAssignment {
  celebrationId: number;
  roleId: number;
  personId: number;
  score: number;
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
