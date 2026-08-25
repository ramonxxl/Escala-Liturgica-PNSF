// Tipos de dominio compartilhados. Espelham as tabelas do banco (packages/data),
// mas nao dependem de SQLite/Electron/React — este pacote e puro TypeScript.

export interface Community {
  id: number;
  name: string;
  address: string | null;
  notes: string | null;
  active: boolean;
}

export interface Person {
  id: number;
  fullName: string;
  phone: string | null;
  email: string | null;
  communityId: number | null;
  active: boolean;
  notes: string | null;
  /** Conjuge (outro integrante) — vinculo simetrico, usado para preferir escalar os dois juntos. */
  spousePersonId: number | null;
}

export interface Role {
  id: number;
  name: string;
  description: string | null;
  active: boolean;
}

export interface PersonRole {
  id: number;
  personId: number;
  roleId: number;
  preferenceWeight: number;
}

export interface Celebration {
  id: number;
  date: string; // ISO date, ex: 2026-08-30
  time: string; // HH:mm
  communityId: number;
  celebrationType: string;
  notes: string | null;
  status: "draft" | "generated" | "confirmed" | "completed" | "cancelled";
}

export interface CelebrationRequirement {
  id: number;
  celebrationId: number;
  roleId: number;
  quantityNeeded: number;
}

export interface Availability {
  id: number;
  personId: number;
  weekday: number | null; // 0-6, quando recorrente
  specificDate: string | null; // quando pontual
  time: string | null;
  status: "available" | "unavailable";
  recurring: boolean;
}

export interface Unavailability {
  id: number;
  personId: number;
  startDate: string;
  endDate: string;
  reason: string | null;
}

export interface Schedule {
  id: number;
  celebrationId: number;
  status: "draft" | "published" | "archived";
  generatedAt: string;
  algorithmVersion: string;
  notes: string | null;
}

export interface ScheduleAssignment {
  id: number;
  scheduleId: number;
  roleId: number;
  personId: number;
  status: "proposed" | "confirmed" | "declined";
  score: number;
  source: "auto" | "manual";
  conflictFlag: boolean;
}

export interface Substitution {
  id: number;
  scheduleAssignmentId: number;
  originalPersonId: number;
  newPersonId: number | null;
  reason: string | null;
  status: "pending" | "resolved" | "cancelled";
  requestedAt: string;
  resolvedAt: string | null;
}

export interface Confirmation {
  id: number;
  scheduleAssignmentId: number;
  confirmedAt: string | null;
  confirmedBy: string | null;
  method: "manual" | "app";
  status: "pending" | "confirmed" | "declined";
}
