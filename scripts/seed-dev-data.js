// Popula o banco com dados ficticios para testes manuais.
// Roda direto contra o arquivo real usado pelo app (Electron precisa estar fechado).
// Uso: node scripts/seed-dev-data.js

const path = require("path");
const {
  openDatabase,
  createCommunity,
  createRole,
  createPerson,
  createCelebration,
  createAvailability,
  createUnavailability,
  listCommunities
} = require("../packages/data/dist/index.js");

const dbPath = path.join(process.env.APPDATA, "@escala", "desktop", "escala-liturgica.db");

async function main() {
  console.log("Banco:", dbPath);
  const db = await openDatabase(dbPath);

  if (listCommunities(db).length > 0) {
    console.log("Ja existem dados cadastrados — nada foi alterado (apague o banco se quiser recomecar do zero).");
    db.close();
    return;
  }

  const communities = {
    matriz: createCommunity(db, { name: "Matriz", address: "Praça da Matriz, 100" }),
    saoJose: createCommunity(db, { name: "São José", address: "Rua São José, 200" }),
    santaRita: createCommunity(db, { name: "Santa Rita" })
  };

  const roles = {
    leitor: createRole(db, { name: "Leitor" }),
    salmista: createRole(db, { name: "Salmista" }),
    comentarista: createRole(db, { name: "Comentarista" }),
    ministro: createRole(db, { name: "Ministro" }),
    acolhida: createRole(db, { name: "Acolhida" }),
    coroinha: createRole(db, { name: "Coroinha" }),
    cerimoniario: createRole(db, { name: "Cerimoniário" }),
    musica: createRole(db, { name: "Música" }),
    som: createRole(db, { name: "Operador de Som" }),
    datashow: createRole(db, { name: "Datashow" })
  };

  const people = [
    { fullName: "Maria da Silva", phone: "(11) 91234-5601", communityId: communities.matriz.id, roleIds: [roles.leitor.id, roles.comentarista.id] },
    { fullName: "João Pereira", phone: "(11) 91234-5602", communityId: communities.matriz.id, roleIds: [roles.ministro.id, roles.acolhida.id] },
    { fullName: "Ana Souza", phone: "(11) 91234-5603", communityId: communities.saoJose.id, roleIds: [roles.salmista.id] },
    { fullName: "Carlos Oliveira", phone: "(11) 91234-5604", communityId: communities.matriz.id, roleIds: [roles.comentarista.id, roles.leitor.id] },
    { fullName: "Pedro Santos", phone: "(11) 91234-5605", communityId: communities.santaRita.id, roleIds: [roles.ministro.id] },
    { fullName: "Mariana Costa", phone: "(11) 91234-5606", communityId: communities.matriz.id, roleIds: [roles.acolhida.id] },
    { fullName: "Fernanda Lima", phone: "(11) 91234-5607", communityId: communities.saoJose.id, roleIds: [roles.acolhida.id, roles.leitor.id] },
    { fullName: "Rafael Almeida", phone: "(11) 91234-5608", communityId: communities.matriz.id, roleIds: [roles.ministro.id] },
    { fullName: "José Ferreira", phone: "(11) 91234-5609", communityId: communities.santaRita.id, roleIds: [roles.coroinha.id] },
    { fullName: "Paulo Rodrigues", phone: "(11) 91234-5610", communityId: communities.matriz.id, roleIds: [roles.ministro.id, roles.cerimoniario.id] },
    { fullName: "Juliana Martins", phone: "(11) 91234-5611", communityId: communities.saoJose.id, roleIds: [roles.salmista.id, roles.comentarista.id] },
    { fullName: "Lucas Barbosa", phone: "(11) 91234-5612", communityId: communities.matriz.id, roleIds: [roles.som.id, roles.datashow.id] }
  ].map((input) => createPerson(db, input));

  const maria = people[0];
  const joao = people[1];

  createAvailability(db, { personId: maria.id, weekday: 4, time: "19:30", status: "unavailable" });
  createAvailability(db, { personId: maria.id, weekday: 0, time: "08:00", status: "available" });
  createUnavailability(db, {
    personId: joao.id,
    startDate: "2026-09-01",
    endDate: "2026-09-15",
    reason: "Viagem em família"
  });

  createCelebration(db, {
    date: "2026-08-30",
    time: "19:30",
    communityId: communities.matriz.id,
    celebrationType: "Missa Dominical",
    requirements: [
      { roleId: roles.leitor.id, quantityNeeded: 2 },
      { roleId: roles.salmista.id, quantityNeeded: 1 },
      { roleId: roles.comentarista.id, quantityNeeded: 1 },
      { roleId: roles.ministro.id, quantityNeeded: 4 },
      { roleId: roles.acolhida.id, quantityNeeded: 2 }
    ]
  });

  createCelebration(db, {
    date: "2026-09-06",
    time: "10:00",
    communityId: communities.saoJose.id,
    celebrationType: "Missa Dominical",
    requirements: [
      { roleId: roles.leitor.id, quantityNeeded: 1 },
      { roleId: roles.ministro.id, quantityNeeded: 2 },
      { roleId: roles.acolhida.id, quantityNeeded: 1 }
    ]
  });

  createCelebration(db, {
    date: "2026-09-13",
    time: "19:30",
    communityId: communities.matriz.id,
    celebrationType: "Missa Dominical",
    requirements: [
      { roleId: roles.leitor.id, quantityNeeded: 2 },
      { roleId: roles.ministro.id, quantityNeeded: 3 }
    ]
  });

  db.close();
  console.log(`Pronto: ${Object.keys(communities).length} comunidades, ${Object.keys(roles).length} funções, ${people.length} integrantes, 3 missas.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
