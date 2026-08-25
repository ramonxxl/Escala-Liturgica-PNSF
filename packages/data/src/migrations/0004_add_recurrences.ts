// Missas recorrentes: uma regra (comunidade, tipo, horario, dias da semana,
// periodo) gera varias linhas em `celebrations` de uma vez. `weekdays` fica
// em JSON (0=domingo..6=sabado) — so suporta recorrencia semanal por
// enquanto; recorrencia mensal seria uma migration aditiva futura.

export const migration_0004_add_recurrences = {
  id: "0004_add_recurrences",
  sql: `
CREATE TABLE IF NOT EXISTS celebration_recurrences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  celebration_type TEXT NOT NULL,
  time TEXT NOT NULL,
  weekdays TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE celebrations ADD COLUMN recurrence_id INTEGER REFERENCES celebration_recurrences(id) ON DELETE SET NULL;
`
};
