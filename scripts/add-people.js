// Adiciona integrantes reais ao banco, associados a uma funcao (criando a
// funcao se ainda nao existir). Idempotente: nomes ja cadastrados (mesma
// funcao) sao ignorados, entao pode rodar de novo com uma lista atualizada.
// Uso: node scripts/add-people.js "Nome da Funcao" "Fulano" "Ciclana" ...

const path = require("path");
const { openDatabase, createRole, listRoles, createPerson, listPeople } = require("../packages/data/dist/index.js");

const dbPath = path.join(process.env.APPDATA, "@escala", "desktop", "escala-liturgica.db");

async function main() {
  const [, , roleName, ...names] = process.argv;
  if (!roleName || names.length === 0) {
    console.error('Uso: node scripts/add-people.js "Nome da Funcao" "Fulano" "Ciclana" ...');
    process.exit(1);
  }

  console.log("Banco:", dbPath);
  const db = await openDatabase(dbPath);

  let role = listRoles(db).find((r) => r.name.toLowerCase() === roleName.toLowerCase());
  if (!role) {
    role = createRole(db, { name: roleName });
    console.log(`Função criada: ${role.name}`);
  }

  const existingNames = new Set(
    listPeople(db)
      .filter((p) => p.roles.some((r) => r.id === role.id))
      .map((p) => p.fullName.toLowerCase())
  );

  let added = 0;
  for (const name of names) {
    if (existingNames.has(name.toLowerCase())) {
      console.log(`Já existe, pulando: ${name}`);
      continue;
    }
    createPerson(db, { fullName: name, roleIds: [role.id] });
    added++;
  }

  db.close();
  console.log(`Pronto: ${added} integrante(s) adicionado(s) à função "${role.name}".`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
