// Adiciona comunidades reais ao banco. Idempotente: nomes ja cadastrados
// sao ignorados, entao pode rodar de novo com uma lista atualizada.
// Uso: node scripts/add-communities.js "Matriz" "São José" ...

const path = require("path");
const { openDatabase, createCommunity, listCommunities } = require("../packages/data/dist/index.js");

const dbPath = path.join(process.env.APPDATA, "@escala", "desktop", "escala-liturgica.db");

async function main() {
  const names = process.argv.slice(2);
  if (names.length === 0) {
    console.error('Uso: node scripts/add-communities.js "Matriz" "São José" ...');
    process.exit(1);
  }

  console.log("Banco:", dbPath);
  const db = await openDatabase(dbPath);

  const existingNames = new Set(listCommunities(db).map((c) => c.name.toLowerCase()));

  let added = 0;
  for (const name of names) {
    if (existingNames.has(name.toLowerCase())) {
      console.log(`Já existe, pulando: ${name}`);
      continue;
    }
    createCommunity(db, { name });
    added++;
  }

  db.close();
  console.log(`Pronto: ${added} comunidade(s) adicionada(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
