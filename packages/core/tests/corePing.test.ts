import { describe, expect, it } from "vitest";
import { corePing, DEFAULT_SCORING_WEIGHTS } from "../src/index";

describe("core package wiring", () => {
  it("responde ao ping", () => {
    expect(corePing()).toBe("pong-from-core");
  });

  it("tem pesos de pontuacao default coerentes com as regras obrigatorias", () => {
    expect(DEFAULT_SCORING_WEIGHTS.unavailablePenalty).toBeLessThan(
      DEFAULT_SCORING_WEIGHTS.conflictPenalty
    );
  });
});
