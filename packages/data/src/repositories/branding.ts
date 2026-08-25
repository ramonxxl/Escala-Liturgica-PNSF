import type { AppDatabase } from "../sqlAdapter";

export interface ParishBranding {
  name: string;
  logo: string | null;
}

function getSetting(db: AppDatabase, key: string): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function setSetting(db: AppDatabase, key: string, value: string, description: string): void {
  db.prepare(
    `INSERT INTO settings (key, value, description) VALUES (@key, @value, @description)
     ON CONFLICT(key) DO UPDATE SET value = @value`
  ).run({ key, value, description });
}

/** Nome e logo da paroquia (armazenados no banco, junto com o resto dos dados — aparecem no dashboard e no relatorio). */
export function getParishBranding(db: AppDatabase): ParishBranding {
  return {
    name: getSetting(db, "parish_name") ?? "",
    logo: getSetting(db, "parish_logo")
  };
}

export function setParishName(db: AppDatabase, name: string): void {
  setSetting(db, "parish_name", name, "Nome da paróquia (aparece no relatório e no dashboard)");
}

export function setParishLogo(db: AppDatabase, dataUrl: string): void {
  setSetting(db, "parish_logo", dataUrl, "Logo da paróquia em base64 (data URL)");
}
