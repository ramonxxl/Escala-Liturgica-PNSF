import type { AppDatabase } from "../sqlAdapter";

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export interface UpcomingCelebration {
  id: number;
  date: string;
  time: string;
  communityName: string;
  celebrationType: string;
}

export interface NextCelebrationStatus {
  id: number;
  date: string;
  time: string;
  communityName: string;
  filled: number;
  needed: number;
}

export interface DashboardSummary {
  upcomingCelebrations: UpcomingCelebration[];
  nextCelebration: NextCelebrationStatus | null;
  confirmedCount: number;
  pendingCount: number;
  conflictCount: number;
}

interface UpcomingRow {
  id: number;
  date: string;
  time: string;
  celebration_type: string;
  community_name: string;
}

/**
 * Resumo para a tela inicial: proximas missas, status de preenchimento da
 * proxima missa, e contagem de confirmacoes/pendencias/conflitos entre as
 * atribuicoes de missas futuras.
 */
export function getDashboardSummary(db: AppDatabase): DashboardSummary {
  const today = todayIso();

  const upcomingRows = db
    .prepare(
      `SELECT c.id as id, c.date as date, c.time as time, c.celebration_type as celebration_type,
              co.name as community_name
       FROM celebrations c
       JOIN communities co ON co.id = c.community_id
       WHERE c.date >= ?
       ORDER BY c.date, c.time
       LIMIT 5`
    )
    .all(today) as UpcomingRow[];

  const upcomingCelebrations: UpcomingCelebration[] = upcomingRows.map((row) => ({
    id: row.id,
    date: row.date,
    time: row.time,
    communityName: row.community_name,
    celebrationType: row.celebration_type
  }));

  let nextCelebration: NextCelebrationStatus | null = null;
  if (upcomingRows.length > 0) {
    const first = upcomingRows[0];
    const needed = db
      .prepare("SELECT COALESCE(SUM(quantity_needed), 0) as total FROM celebration_requirements WHERE celebration_id = ?")
      .get(first.id) as { total: number };
    const filled = db
      .prepare(
        `SELECT COUNT(*) as c FROM schedule_assignments sa
         JOIN schedules s ON s.id = sa.schedule_id
         WHERE s.celebration_id = ?`
      )
      .get(first.id) as { c: number };

    nextCelebration = {
      id: first.id,
      date: first.date,
      time: first.time,
      communityName: first.community_name,
      filled: filled.c,
      needed: needed.total
    };
  }

  const statusRows = db
    .prepare(
      `SELECT sa.status as status, COUNT(*) as c
       FROM schedule_assignments sa
       JOIN schedules s ON s.id = sa.schedule_id
       JOIN celebrations c ON c.id = s.celebration_id
       WHERE c.date >= ?
       GROUP BY sa.status`
    )
    .all(today) as { status: string; c: number }[];

  const confirmedCount = statusRows.find((r) => r.status === "confirmed")?.c ?? 0;
  const pendingCount = statusRows.find((r) => r.status === "proposed")?.c ?? 0;

  const conflictRow = db
    .prepare(
      `SELECT COUNT(*) as c FROM schedule_assignments sa
       JOIN schedules s ON s.id = sa.schedule_id
       JOIN celebrations c ON c.id = s.celebration_id
       WHERE c.date >= ? AND sa.conflict_flag = 1`
    )
    .get(today) as { c: number };

  return {
    upcomingCelebrations,
    nextCelebration,
    confirmedCount,
    pendingCount,
    conflictCount: conflictRow.c
  };
}
