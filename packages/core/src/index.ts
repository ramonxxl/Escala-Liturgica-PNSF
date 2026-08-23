export * from "./domain/types";
export * from "./domain/dateUtils";
export * from "./engine/scoringWeights";
export * from "./engine/types";
export * from "./engine/eligibility";
export * from "./engine/scoring";
export * from "./engine/generator";

/** Usado apenas para validar a integracao entre os pacotes na Fase 0. */
export function corePing(): string {
  return "pong-from-core";
}
