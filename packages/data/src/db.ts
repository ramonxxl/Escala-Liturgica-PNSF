import { existsSync, readFileSync, writeFileSync } from "fs";
import initSqlJs from "sql.js";
import { DEFAULT_SCORING_WEIGHTS } from "@escala/core";
import { MIGRATIONS } from "./migrations";
import { wrapDatabase, type AppDatabase } from "./sqlAdapter";

export type { AppDatabase } from "./sqlAdapter";

/**
 * Abre (ou cria) o banco SQLite no caminho informado e aplica as migrations
 * pendentes. Chamado uma vez pelo main process do Electron, apontando para
 * app.getPath('userData').
 */
export async function openDatabase(filePath: string): Promise<AppDatabase> {
  const SQL = await initSqlJs();
  const raw = existsSync(filePath) ? new SQL.Database(readFileSync(filePath)) : new SQL.Database();

  if (!existsSync(filePath)) {
    writeFileSync(filePath, Buffer.from(raw.export()));
  }

  const db = wrapDatabase(raw, filePath);
  db.pragma("foreign_keys = ON");

  runMigrations(db);
  seedDefaultSettings(db);

  return db;
}

function runMigrations(db: AppDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db.prepare("SELECT id FROM schema_migrations").all().map((row) => (row as { id: string }).id)
  );

  const applyMigration = db.transaction((id: string, sql: string) => {
    db.exec(sql);
    db.prepare("INSERT INTO schema_migrations (id) VALUES (?)").run(id);
  });

  for (const migration of MIGRATIONS) {
    if (!applied.has(migration.id)) {
      applyMigration(migration.id, migration.sql);
    }
  }
}

function seedDefaultSettings(db: AppDatabase): void {
  const insert = db.prepare(
    "INSERT OR IGNORE INTO settings (key, value, description) VALUES (@key, @value, @description)"
  );

  const seed = db.transaction(() => {
    insert.run({
      key: "scoring_weights",
      value: JSON.stringify(DEFAULT_SCORING_WEIGHTS),
      description: "Pesos do motor de pontuacao para geracao automatica de escalas"
    });
  });

  seed();
}
