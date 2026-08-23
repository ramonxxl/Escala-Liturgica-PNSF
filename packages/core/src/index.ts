export * from "./domain/types";
export * from "./engine/scoringWeights";

/** Usado apenas para validar a integracao entre os pacotes na Fase 0. */
export function corePing(): string {
  return "pong-from-core";
}
