import { isEligible, slotKey } from "./eligibility";
import { scoreCandidate } from "./scoring";
import type { GenerationInput, GenerationResult, ProposedAssignment, UnfilledSlot } from "./types";

/**
 * Gera uma proposta de escala para as missas informadas.
 *
 * Estrategia: para cada missa (em ordem cronologica), preenche primeiro as
 * funcoes mais escassas (menos candidatos elegiveis), escolhendo a cada vaga
 * o candidato elegivel com maior pontuacao. O historico de escalas usado na
 * pontuacao e atualizado a cada escolha dentro da propria rodada, entao o
 * gerador se autoequilibra ao longo do lote (quem acabou de ser escalado
 * fica com pontuacao menor para a proxima vaga).
 *
 * So sao consideradas escolhas que respeitem as regras obrigatorias (ver
 * eligibility.ts) — nunca escala alguem indisponivel, de ferias, sem a
 * funcao, inativo ou ja ocupado no mesmo horario. Quando nao ha candidatos
 * suficientes, a vaga fica em aberto e e reportada em `unfilled`.
 */
export function generateSchedule(input: GenerationInput): GenerationResult {
  const assignments: ProposedAssignment[] = [];
  const unfilled: UnfilledSlot[] = [];
  const usedSlots = new Set<string>();

  const assignmentCountByPerson: Record<number, number> = { ...input.history.assignmentCountByPerson };
  const lastAssignmentDateByPerson: Record<number, string> = { ...input.history.lastAssignmentDateByPerson };

  const sortedCelebrations = [...input.celebrations].sort((a, b) =>
    a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)
  );

  for (const celebration of sortedCelebrations) {
    const eligibleCountByRole = new Map<number, number>();
    for (const requirement of celebration.requirements) {
      const count = input.people.filter((person) =>
        isEligible(person, requirement.roleId, celebration.date, celebration.time, input, usedSlots)
      ).length;
      eligibleCountByRole.set(requirement.roleId, count);
    }

    const requirementsByScarcity = [...celebration.requirements].sort(
      (a, b) => (eligibleCountByRole.get(a.roleId) ?? 0) - (eligibleCountByRole.get(b.roleId) ?? 0)
    );

    for (const requirement of requirementsByScarcity) {
      let filled = 0;

      for (let i = 0; i < requirement.quantityNeeded; i++) {
        const counts = Object.values(assignmentCountByPerson);
        const averageAssignmentCount = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
        const maxAssignmentCount = counts.length ? Math.max(...counts) : 0;

        const candidates = input.people.filter((person) =>
          isEligible(person, requirement.roleId, celebration.date, celebration.time, input, usedSlots)
        );

        if (candidates.length === 0) break;

        const scored = candidates
          .map((person) => ({
            person,
            score: scoreCandidate(
              person,
              requirement.roleId,
              {
                date: celebration.date,
                time: celebration.time,
                availabilityRules: input.availabilityRules,
                history: { assignmentCountByPerson, lastAssignmentDateByPerson },
                averageAssignmentCount,
                maxAssignmentCount
              },
              input.weights
            )
          }))
          .sort((a, b) => b.score - a.score || a.person.id - b.person.id);

        const chosen = scored[0];

        assignments.push({
          celebrationId: celebration.id,
          roleId: requirement.roleId,
          personId: chosen.person.id,
          score: chosen.score
        });

        usedSlots.add(slotKey(chosen.person.id, celebration.date, celebration.time));
        assignmentCountByPerson[chosen.person.id] = (assignmentCountByPerson[chosen.person.id] ?? 0) + 1;
        lastAssignmentDateByPerson[chosen.person.id] = celebration.date;

        filled++;
      }

      if (filled < requirement.quantityNeeded) {
        unfilled.push({
          celebrationId: celebration.id,
          roleId: requirement.roleId,
          missing: requirement.quantityNeeded - filled
        });
      }
    }
  }

  return { assignments, unfilled };
}
