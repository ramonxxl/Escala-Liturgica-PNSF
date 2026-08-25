import { describe, expect, it } from "vitest";
import { corePing, DEFAULT_SCORING_WEIGHTS } from "../src/index";

describe("core package wiring", () => {
  it("responde ao ping", () => {
    expect(corePing()).toBe("pong-from-core");
  });

  it("penalidades de limite configurado sao mais fortes que as penalidades padrao (reforco forte, nao regra dura)", () => {
    expect(DEFAULT_SCORING_WEIGHTS.nearMonthlyLimitPenalty).toBeLessThan(DEFAULT_SCORING_WEIGHTS.recentlyAssignedPenalty);
    expect(DEFAULT_SCORING_WEIGHTS.minIntervalPenalty).toBeLessThan(DEFAULT_SCORING_WEIGHTS.overloadPenalty);
  });
});
