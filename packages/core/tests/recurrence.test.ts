import { describe, expect, it } from "vitest";
import { computeRecurrenceDates } from "../src/domain/recurrence";

describe("computeRecurrenceDates", () => {
  it("gera todas as ocorrencias de um unico dia da semana no periodo", () => {
    // 2026-08-30 e domingo
    const dates = computeRecurrenceDates("2026-08-30", "2026-09-27", [0]);
    expect(dates).toEqual(["2026-08-30", "2026-09-06", "2026-09-13", "2026-09-20", "2026-09-27"]);
  });

  it("gera ocorrencias de multiplos dias da semana, intercalados e em ordem", () => {
    // domingo (0) e quarta (3)
    const dates = computeRecurrenceDates("2026-08-30", "2026-09-06", [0, 3]);
    expect(dates).toEqual(["2026-08-30", "2026-09-02", "2026-09-06"]);
  });

  it("retorna vazio quando nenhum dia do periodo bate com os dias da semana pedidos", () => {
    // 2026-08-30 e domingo; pedindo so segunda (1) nesse unico dia
    const dates = computeRecurrenceDates("2026-08-30", "2026-08-30", [1]);
    expect(dates).toEqual([]);
  });

  it("periodo de um unico dia que bate com o dia da semana pedido", () => {
    const dates = computeRecurrenceDates("2026-08-30", "2026-08-30", [0]);
    expect(dates).toEqual(["2026-08-30"]);
  });
});
