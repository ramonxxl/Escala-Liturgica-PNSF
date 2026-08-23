// Migration inicial. Cada migration exporta { id, sql }. `id` deve ser unico
// e crescente — o runner (src/db.ts) aplica em ordem e registra em schema_migrations.

export const migration_0001_init = {
  id: "0001_init",
  sql: `
CREATE TABLE IF NOT EXISTS communities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  community_id INTEGER REFERENCES communities(id) ON DELETE RESTRICT,
  active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS person_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  preference_weight INTEGER NOT NULL DEFAULT 0,
  UNIQUE (person_id, role_id)
);

CREATE TABLE IF NOT EXISTS celebrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  celebration_type TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'generated', 'confirmed', 'completed', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS celebration_requirements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  celebration_id INTEGER NOT NULL REFERENCES celebrations(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  quantity_needed INTEGER NOT NULL DEFAULT 1,
  UNIQUE (celebration_id, role_id)
);

CREATE TABLE IF NOT EXISTS availabilities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  weekday INTEGER,
  specific_date TEXT,
  time TEXT,
  status TEXT NOT NULL CHECK (status IN ('available', 'unavailable')),
  recurring INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS unavailabilities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  celebration_id INTEGER NOT NULL UNIQUE REFERENCES celebrations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  algorithm_version TEXT NOT NULL DEFAULT 'v1',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS schedule_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'confirmed', 'declined')),
  score REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'auto' CHECK (source IN ('auto', 'manual')),
  conflict_flag INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS substitutions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_assignment_id INTEGER NOT NULL REFERENCES schedule_assignments(id) ON DELETE CASCADE,
  original_person_id INTEGER NOT NULL REFERENCES people(id),
  new_person_id INTEGER REFERENCES people(id),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'cancelled')),
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS confirmations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_assignment_id INTEGER NOT NULL REFERENCES schedule_assignments(id) ON DELETE CASCADE,
  confirmed_at TEXT,
  confirmed_by TEXT,
  method TEXT NOT NULL DEFAULT 'manual' CHECK (method IN ('manual', 'app')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined'))
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  actor TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_celebrations_date_community ON celebrations(date, community_id);
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_schedule ON schedule_assignments(schedule_id);
CREATE INDEX IF NOT EXISTS idx_availabilities_person_weekday ON availabilities(person_id, weekday);
CREATE INDEX IF NOT EXISTS idx_unavailabilities_person_dates ON unavailabilities(person_id, start_date, end_date);
`
};
