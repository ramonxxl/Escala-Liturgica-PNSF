import { DEFAULT_SCHEDULING_RULES, type SchedulingRules } from "@escala/core";
import type { AppDatabase } from "../sqlAdapter";

const SETTINGS_KEY = "scheduling_rules";

/** Regras de escala configuraveis pelo coordenador (tela de Configuracoes) — usadas pelo motor de geracao. */
export function getSchedulingRules(db: AppDatabase): SchedulingRules {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(SETTINGS_KEY) as
    | { value: string }
    | undefined;
  if (!row) return DEFAULT_SCHEDULING_RULES;
  return { ...DEFAULT_SCHEDULING_RULES, ...JSON.parse(row.value) };
}

export function setSchedulingRules(db: AppDatabase, rules: Partial<SchedulingRules>): SchedulingRules {
  const merged = { ...getSchedulingRules(db), ...rules };
  db.prepare(
    `INSERT INTO settings (key, value, description) VALUES (@key, @value, @description)
     ON CONFLICT(key) DO UPDATE SET value = @value`
  ).run({
    key: SETTINGS_KEY,
    value: JSON.stringify(merged),
    description: "Regras de escala configuráveis (cônjuge, limite mensal, intervalo mínimo)"
  });
  return merged;
}
