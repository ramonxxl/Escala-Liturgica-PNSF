import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type AppDatabase } from "../src/db";
import {
  createCommunity,
  listCommunities,
  removeCommunity,
  setCommunityActive,
  updateCommunity
} from "../src/repositories/communities";
import { createRole, listRoles } from "../src/repositories/roles";
import { createPerson, getPerson, listPeople, removePerson, updatePerson } from "../src/repositories/people";

let dir: string;
let db: AppDatabase;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "escala-repo-"));
  db = await openDatabase(join(dir, "escala-liturgica.db"));
});

afterEach(() => {
  db?.close();
  if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

describe("communitiesRepository", () => {
  it("cria, lista, atualiza, desativa e remove", () => {
    const created = createCommunity(db, { name: "Matriz", address: "Rua A" });
    expect(created.id).toBeGreaterThan(0);
    expect(listCommunities(db)).toHaveLength(1);

    const updated = updateCommunity(db, created.id, { name: "Matriz Central" });
    expect(updated.name).toBe("Matriz Central");

    setCommunityActive(db, created.id, false);
    expect(listCommunities(db)[0].active).toBe(false);

    removeCommunity(db, created.id);
    expect(listCommunities(db)).toHaveLength(0);
  });
});

describe("rolesRepository", () => {
  it("cria e lista funcoes", () => {
    createRole(db, { name: "Leitor" });
    createRole(db, { name: "Ministro" });
    const roles = listRoles(db);
    expect(roles.map((r) => r.name)).toEqual(["Leitor", "Ministro"]);
  });
});

describe("peopleRepository", () => {
  it("cria integrante com comunidade e multiplas funcoes", () => {
    const community = createCommunity(db, { name: "Matriz" });
    const leitor = createRole(db, { name: "Leitor" });
    const ministro = createRole(db, { name: "Ministro" });

    const person = createPerson(db, {
      fullName: "Maria da Silva",
      communityId: community.id,
      roleIds: [leitor.id, ministro.id]
    });

    expect(person.communityName).toBe("Matriz");
    expect(person.roles.map((r) => r.name)).toEqual(["Leitor", "Ministro"]);

    const list = listPeople(db);
    expect(list).toHaveLength(1);
    expect(list[0].roles).toHaveLength(2);
  });

  it("atualiza integrante trocando as funcoes atribuidas", () => {
    const leitor = createRole(db, { name: "Leitor" });
    const acolhida = createRole(db, { name: "Acolhida" });
    const person = createPerson(db, { fullName: "Joao", roleIds: [leitor.id] });

    const updated = updatePerson(db, person.id, { fullName: "Joao Souza", roleIds: [acolhida.id] });

    expect(updated.fullName).toBe("Joao Souza");
    expect(updated.roles.map((r) => r.name)).toEqual(["Acolhida"]);
  });

  it("impede excluir comunidade em uso por um integrante ativo", () => {
    const community = createCommunity(db, { name: "Matriz" });
    createPerson(db, { fullName: "Maria", communityId: community.id, roleIds: [] });

    expect(() => removeCommunity(db, community.id)).toThrow();
  });

  it("remove integrante sem funcoes vinculadas sem erro", () => {
    const person = createPerson(db, { fullName: "Carlos", roleIds: [] });
    removePerson(db, person.id);
    expect(listPeople(db)).toHaveLength(0);
  });
});

describe("vinculo de conjuge", () => {
  it("cria o vinculo dos dois lados ao definir o conjuge", () => {
    const maria = createPerson(db, { fullName: "Maria", roleIds: [] });
    const joao = createPerson(db, { fullName: "João", roleIds: [] });

    const updated = updatePerson(db, maria.id, { fullName: "Maria", roleIds: [], spousePersonId: joao.id });

    expect(updated.spousePersonId).toBe(joao.id);
    expect(updated.spouseName).toBe("João");
    expect(getPerson(db, joao.id)?.spousePersonId).toBe(maria.id);
  });

  it("trocar de conjuge desfaz o vinculo anterior dos dois lados", () => {
    const maria = createPerson(db, { fullName: "Maria", roleIds: [] });
    const joao = createPerson(db, { fullName: "João", roleIds: [] });
    const carlos = createPerson(db, { fullName: "Carlos", roleIds: [] });

    updatePerson(db, maria.id, { fullName: "Maria", roleIds: [], spousePersonId: joao.id });
    updatePerson(db, maria.id, { fullName: "Maria", roleIds: [], spousePersonId: carlos.id });

    expect(getPerson(db, maria.id)?.spousePersonId).toBe(carlos.id);
    expect(getPerson(db, carlos.id)?.spousePersonId).toBe(maria.id);
    expect(getPerson(db, joao.id)?.spousePersonId).toBeNull(); // vinculo antigo desfeito
  });

  it("remover o conjuge (definir como null) desfaz o vinculo dos dois lados", () => {
    const maria = createPerson(db, { fullName: "Maria", roleIds: [] });
    const joao = createPerson(db, { fullName: "João", roleIds: [] });

    updatePerson(db, maria.id, { fullName: "Maria", roleIds: [], spousePersonId: joao.id });
    updatePerson(db, maria.id, { fullName: "Maria", roleIds: [], spousePersonId: null });

    expect(getPerson(db, maria.id)?.spousePersonId).toBeNull();
    expect(getPerson(db, joao.id)?.spousePersonId).toBeNull();
  });
});
