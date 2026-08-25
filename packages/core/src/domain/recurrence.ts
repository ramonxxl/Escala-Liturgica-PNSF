import { getWeekday } from "./dateUtils";

/**
 * Todas as datas ISO "YYYY-MM-DD" entre `startDate` e `endDate` (inclusive)
 * cujo dia da semana esteja em `weekdays` (0=domingo..6=sabado). Usada tanto
 * na pre-visualizacao quanto na criacao de verdade de uma missa recorrente —
 * unica fonte de verdade pra "quais datas essa regra gera".
 */
export function computeRecurrenceDates(startDate: string, endDate: string, weekdays: number[]): string[] {
  const weekdaySet = new Set(weekdays);
  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
  const cursor = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(endYear, endMonth - 1, endDay);

  const dates: string[] = [];
  while (cursor <= end) {
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    if (weekdaySet.has(getWeekday(iso))) dates.push(iso);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}
