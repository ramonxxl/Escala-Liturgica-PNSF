import { getWeekday } from "../domain/dateUtils";
import type { GenerationAvailabilityRule, GenerationPerson, GenerationUnavailabilityPeriod } from "./types";

export function hasRole(person: GenerationPerson, roleId: number): boolean {
  return person.roles.some((r) => r.roleId === roleId);
}

export function isOnVacation(personId: number, date: string, periods: GenerationUnavailabilityPeriod[]): boolean {
  return periods.some((p) => p.personId === personId && date >= p.startDate && date <= p.endDate);
}

export function isMarkedUnavailable(
  personId: number,
  date: string,
  time: string,
  rules: GenerationAvailabilityRule[]
): boolean {
  const weekday = getWeekday(date);
  return rules.some(
    (r) => r.personId === personId && r.weekday === weekday && r.time === time && r.status === "unavailable"
  );
}

export function slotKey(personId: number, date: string, time: string): string {
  return `${personId}|${date}|${time}`;
}

export function dayKey(personId: number, date: string): string {
  return `${personId}|${date}`;
}

/**
 * Regras obrigatorias do motor de geracao (nunca violadas automaticamente):
 * pessoa ativa, com a funcao, nao indisponivel/de ferias naquele dia e
 * horario, e ainda nao escalada nesse mesmo dia (evita escalar a mesma
 * pessoa em duas missas/funcoes diferentes no mesmo dia — cada um so pode
 * servir numa celebracao por dia).
 */
export function isEligible(
  person: GenerationPerson,
  roleId: number,
  date: string,
  time: string,
  input: {
    availabilityRules: GenerationAvailabilityRule[];
    unavailabilityPeriods: GenerationUnavailabilityPeriod[];
  },
  usedDates: ReadonlySet<string>
): boolean {
  if (!person.active) return false;
  if (!hasRole(person, roleId)) return false;
  if (isOnVacation(person.id, date, input.unavailabilityPeriods)) return false;
  if (isMarkedUnavailable(person.id, date, time, input.availabilityRules)) return false;
  if (usedDates.has(dayKey(person.id, date))) return false;
  return true;
}
