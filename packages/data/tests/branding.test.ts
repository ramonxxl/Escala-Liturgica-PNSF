import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type AppDatabase } from "../src/db";
import { getParishBranding, setParishLogo, setParishName } from "../src/repositories/branding";

let dir: string;
let db: AppDatabase;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "escala-branding-"));
  db = await openDatabase(join(dir, "escala-liturgica.db"));
});

afterEach(() => {
  db?.close();
  if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

describe("branding", () => {
  it("comeca vazio", () => {
    expect(getParishBranding(db)).toEqual({ name: "", logo: null });
  });

  it("salva e sobrescreve nome e logo", () => {
    setParishName(db, "Paróquia Nossa Senhora de Fátima");
    setParishLogo(db, "data:image/png;base64,abc123");

    expect(getParishBranding(db)).toEqual({
      name: "Paróquia Nossa Senhora de Fátima",
      logo: "data:image/png;base64,abc123"
    });

    setParishName(db, "Novo Nome");
    expect(getParishBranding(db).name).toBe("Novo Nome");
  });
});
