import { ipcMain } from "electron";
import { corePing } from "@escala/core";
import {
  type AppDatabase,
  type CommunityInput,
  type RoleInput,
  type PersonInput,
  listCommunities,
  createCommunity,
  updateCommunity,
  setCommunityActive,
  removeCommunity,
  listRoles,
  createRole,
  updateRole,
  setRoleActive,
  removeRole,
  listPeople,
  createPerson,
  updatePerson,
  setPersonActive,
  removePerson
} from "@escala/data";

export function registerIpcHandlers(db: AppDatabase, dbPath: string): void {
  ipcMain.handle("app:ping", () => corePing());

  ipcMain.handle("db:status", () => {
    const row = db.prepare("SELECT COUNT(*) AS count FROM settings").get() as { count: number };
    return { ok: true, path: dbPath, settingsCount: row.count };
  });

  ipcMain.handle("communities:list", () => listCommunities(db));
  ipcMain.handle("communities:create", (_event, input: CommunityInput) => createCommunity(db, input));
  ipcMain.handle("communities:update", (_event, id: number, input: CommunityInput) =>
    updateCommunity(db, id, input)
  );
  ipcMain.handle("communities:setActive", (_event, id: number, active: boolean) =>
    setCommunityActive(db, id, active)
  );
  ipcMain.handle("communities:remove", (_event, id: number) => removeCommunity(db, id));

  ipcMain.handle("roles:list", () => listRoles(db));
  ipcMain.handle("roles:create", (_event, input: RoleInput) => createRole(db, input));
  ipcMain.handle("roles:update", (_event, id: number, input: RoleInput) => updateRole(db, id, input));
  ipcMain.handle("roles:setActive", (_event, id: number, active: boolean) => setRoleActive(db, id, active));
  ipcMain.handle("roles:remove", (_event, id: number) => removeRole(db, id));

  ipcMain.handle("people:list", () => listPeople(db));
  ipcMain.handle("people:create", (_event, input: PersonInput) => createPerson(db, input));
  ipcMain.handle("people:update", (_event, id: number, input: PersonInput) => updatePerson(db, id, input));
  ipcMain.handle("people:setActive", (_event, id: number, active: boolean) => setPersonActive(db, id, active));
  ipcMain.handle("people:remove", (_event, id: number) => removePerson(db, id));
}
