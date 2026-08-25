import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase, type AppDatabase } from "../src/db";

let dir: string;
let db: AppDatabase;

afterEach(() => {
  db?.close();
  if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

describe("openDatabase", () => {
  it("cria o arquivo, aplica as migrations e semeia os settings", async () => {
    dir = mkdtempSync(join(tmpdir(), "escala-db-"));
    const dbPath = join(dir, "escala-liturgica.db");

    db = await openDatabase(dbPath);

    expect(existsSync(dbPath)).toBe(true);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => (row as { name: string }).name);

    for (const expected of [
      "people",
      "roles",
      "person_roles",
      "communities",
      "celebrations",
      "celebration_requirements",
      "availabilities",
      "unavailabilities",
      "schedules",
      "schedule_assignments",
      "substitutions",
      "confirmations",
      "settings",
      "audit_logs"
    ]) {
      expect(tables).toContain(expected);
    }

    const weights = db
      .prepare("SELECT value FROM settings WHERE key = 'scoring_weights'")
      .get() as { value: string };
    expect(JSON.parse(weights.value).available).toBe(10);
  });

  it("e idempotente ao reabrir o mesmo banco (nao duplica migrations nem settings)", async () => {
    dir = mkdtempSync(join(tmpdir(), "escala-db-"));
    const dbPath = join(dir, "escala-liturgica.db");

    (await openDatabase(dbPath)).close();
    db = await openDatabase(dbPath);

    const count = db.prepare("SELECT COUNT(*) AS c FROM settings WHERE key = 'scoring_weights'").get() as {
      c: number;
    };
    expect(count.c).toBe(1);
  });

  it("garante integridade referencial (foreign_keys = ON)", async () => {
    dir = mkdtempSync(join(tmpdir(), "escala-db-"));
    db = await openDatabase(join(dir, "escala-liturgica.db"));

    expect(() =>
      db.prepare("INSERT INTO people (full_name, community_id) VALUES (?, ?)").run("Maria", 999)
    ).toThrow();
  });
});
