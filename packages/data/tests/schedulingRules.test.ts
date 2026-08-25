import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type AppDatabase } from "../src/db";
import { getSchedulingRules, setSchedulingRules } from "../src/repositories/schedulingRules";

let dir: string;
let db: AppDatabase;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "escala-rules-"));
  db = await openDatabase(join(dir, "escala-liturgica.db"));
});

afterEach(() => {
  db?.close();
  if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

describe("schedulingRules", () => {
  it("comeca com os valores default", () => {
    expect(getSchedulingRules(db)).toEqual({ spouseRule: "priorizar", maxPerMonth: null, minIntervalDays: null });
  });

  it("salva e sobrescreve as regras", () => {
    setSchedulingRules(db, { spouseRule: "evitar", maxPerMonth: 4 });

    expect(getSchedulingRules(db)).toEqual({ spouseRule: "evitar", maxPerMonth: 4, minIntervalDays: null });

    setSchedulingRules(db, { minIntervalDays: 7 });
    // parcial: mantem o que ja tinha sido setado antes
    expect(getSchedulingRules(db)).toEqual({ spouseRule: "evitar", maxPerMonth: 4, minIntervalDays: 7 });
  });
});
