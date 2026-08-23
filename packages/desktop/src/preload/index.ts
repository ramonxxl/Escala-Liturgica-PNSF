import { contextBridge, ipcRenderer } from "electron";
import type { Community, Role } from "@escala/core";
import type {
  CommunityInput,
  RoleInput,
  PersonInput,
  PersonWithRoles,
  CelebrationInput,
  CelebrationWithRequirements
} from "@escala/data";

// Superficie minima exposta ao renderer. O renderer nunca acessa
// Node/Electron/SQLite diretamente — apenas estes metodos via IPC.
const api = {
  ping: (): Promise<string> => ipcRenderer.invoke("app:ping"),
  dbStatus: (): Promise<{ ok: boolean; path: string; settingsCount: number }> =>
    ipcRenderer.invoke("db:status"),

  communities: {
    list: (): Promise<Community[]> => ipcRenderer.invoke("communities:list"),
    create: (input: CommunityInput): Promise<Community> => ipcRenderer.invoke("communities:create", input),
    update: (id: number, input: CommunityInput): Promise<Community> =>
      ipcRenderer.invoke("communities:update", id, input),
    setActive: (id: number, active: boolean): Promise<void> =>
      ipcRenderer.invoke("communities:setActive", id, active),
    remove: (id: number): Promise<void> => ipcRenderer.invoke("communities:remove", id)
  },

  roles: {
    list: (): Promise<Role[]> => ipcRenderer.invoke("roles:list"),
    create: (input: RoleInput): Promise<Role> => ipcRenderer.invoke("roles:create", input),
    update: (id: number, input: RoleInput): Promise<Role> => ipcRenderer.invoke("roles:update", id, input),
    setActive: (id: number, active: boolean): Promise<void> =>
      ipcRenderer.invoke("roles:setActive", id, active),
    remove: (id: number): Promise<void> => ipcRenderer.invoke("roles:remove", id)
  },

  people: {
    list: (): Promise<PersonWithRoles[]> => ipcRenderer.invoke("people:list"),
    create: (input: PersonInput): Promise<PersonWithRoles> => ipcRenderer.invoke("people:create", input),
    update: (id: number, input: PersonInput): Promise<PersonWithRoles> =>
      ipcRenderer.invoke("people:update", id, input),
    setActive: (id: number, active: boolean): Promise<void> =>
      ipcRenderer.invoke("people:setActive", id, active),
    remove: (id: number): Promise<void> => ipcRenderer.invoke("people:remove", id)
  },

  celebrations: {
    list: (): Promise<CelebrationWithRequirements[]> => ipcRenderer.invoke("celebrations:list"),
    create: (input: CelebrationInput): Promise<CelebrationWithRequirements> =>
      ipcRenderer.invoke("celebrations:create", input),
    update: (id: number, input: CelebrationInput): Promise<CelebrationWithRequirements> =>
      ipcRenderer.invoke("celebrations:update", id, input),
    remove: (id: number): Promise<void> => ipcRenderer.invoke("celebrations:remove", id)
  }
};

contextBridge.exposeInMainWorld("api", api);

export type Api = typeof api;
