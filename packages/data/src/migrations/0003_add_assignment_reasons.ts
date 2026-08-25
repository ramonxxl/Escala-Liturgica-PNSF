// Motivos que compuseram a pontuacao de uma atribuicao gerada automaticamente
// (explicabilidade: "por que essa pessoa foi escolhida"). Guardado como JSON;
// atribuicoes manuais ficam com o campo vazio (nao ha pontuacao pra explicar).

export const migration_0003_add_assignment_reasons = {
  id: "0003_add_assignment_reasons",
  sql: `
ALTER TABLE schedule_assignments ADD COLUMN reasons TEXT;
`
};
