// Vinculo de conjuge entre integrantes (casais que preferem servir juntos).
// Relacao simetrica: guardamos o vinculo nos dois registros ao mesmo tempo
// (ver syncSpouseLink em repositories/people.ts).

export const migration_0002_add_spouse = {
  id: "0002_add_spouse",
  sql: `
ALTER TABLE people ADD COLUMN spouse_person_id INTEGER REFERENCES people(id) ON DELETE SET NULL;
`
};
