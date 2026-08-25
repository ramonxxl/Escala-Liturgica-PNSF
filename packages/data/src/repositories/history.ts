import type { AppDatabase } from "../sqlAdapter";

export interface PersonHistory {
  personId: number;
  personName: string;
  countsByMonth: Record<string, number>;
  total: number;
}

export interface HistorySummary {
  /** Meses com pelo menos uma escala, em ordem cronologica ("2026-08"). */
  months: string[];
  people: PersonHistory[];
}

interface HistoryRow {
  person_id: number;
  person_name: string;
  month: string;
  c: number;
}

/** Quantidade de escalas por integrante e por mes (ignora atribuicoes recusadas). Usado na tela de Historico. */
export function getAssignmentHistory(db: AppDatabase): HistorySummary {
  const rows = db
    .prepare(
      `SELECT p.id as person_id, p.full_name as person_name, strftime('%Y-%m', c.date) as month, COUNT(*) as c
       FROM schedule_assignments sa
       JOIN schedules s ON s.id = sa.schedule_id
       JOIN celebrations c ON c.id = s.celebration_id
       JOIN people p ON p.id = sa.person_id
       WHERE sa.status != 'declined'
       GROUP BY p.id, month
       ORDER BY p.full_name, month`
    )
    .all() as HistoryRow[];

  const monthsSet = new Set<string>();
  const peopleMap = new Map<number, PersonHistory>();

  for (const row of rows) {
    monthsSet.add(row.month);
    let entry = peopleMap.get(row.person_id);
    if (!entry) {
      entry = { personId: row.person_id, personName: row.person_name, countsByMonth: {}, total: 0 };
      peopleMap.set(row.person_id, entry);
    }
    entry.countsByMonth[row.month] = row.c;
    entry.total += row.c;
  }

  return {
    months: [...monthsSet].sort(),
    people: [...peopleMap.values()].sort((a, b) => a.personName.localeCompare(b.personName))
  };
}
