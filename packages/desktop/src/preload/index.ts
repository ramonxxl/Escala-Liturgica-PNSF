import { contextBridge, ipcRenderer } from "electron";
import type { Community, Role, Availability, Unavailability } from "@escala/core";
import type {
  CommunityInput,
  RoleInput,
  PersonInput,
  PersonWithRoles,
  CelebrationInput,
  CelebrationWithRequirements,
  AvailabilityInput,
  UnavailabilityInput,
  ScheduleWithAssignments,
  PersistedAssignment,
  SubstituteCandidate,
  BatchGenerationResult,
  DashboardSummary,
  HistorySummary,
  ParishBranding
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
  },

  availabilities: {
    listByPerson: (personId: number): Promise<Availability[]> =>
      ipcRenderer.invoke("availabilities:listByPerson", personId),
    create: (input: AvailabilityInput): Promise<Availability> =>
      ipcRenderer.invoke("availabilities:create", input),
    remove: (id: number): Promise<void> => ipcRenderer.invoke("availabilities:remove", id)
  },

  unavailabilities: {
    listByPerson: (personId: number): Promise<Unavailability[]> =>
      ipcRenderer.invoke("unavailabilities:listByPerson", personId),
    create: (input: UnavailabilityInput): Promise<Unavailability> =>
      ipcRenderer.invoke("unavailabilities:create", input),
    remove: (id: number): Promise<void> => ipcRenderer.invoke("unavailabilities:remove", id)
  },

  schedules: {
    generate: (celebrationId: number, roleIds?: number[]): Promise<ScheduleWithAssignments> =>
      ipcRenderer.invoke("schedules:generate", celebrationId, roleIds),
    getForCelebration: (celebrationId: number): Promise<ScheduleWithAssignments | undefined> =>
      ipcRenderer.invoke("schedules:getForCelebration", celebrationId),
    addAssignment: (scheduleId: number, roleId: number, personId: number): Promise<PersistedAssignment> =>
      ipcRenderer.invoke("schedules:addAssignment", scheduleId, roleId, personId),
    removeAssignment: (assignmentId: number): Promise<void> =>
      ipcRenderer.invoke("schedules:removeAssignment", assignmentId),
    substitute: (assignmentId: number, newPersonId: number): Promise<PersistedAssignment> =>
      ipcRenderer.invoke("schedules:substitute", assignmentId, newPersonId),
    rankSubstitutes: (assignmentId: number): Promise<SubstituteCandidate[]> =>
      ipcRenderer.invoke("schedules:rankSubstitutes", assignmentId),
    generateForRange: (startDate: string, endDate: string, roleIds?: number[]): Promise<BatchGenerationResult> =>
      ipcRenderer.invoke("schedules:generateForRange", startDate, endDate, roleIds),
    setAssignmentStatus: (
      assignmentId: number,
      status: "proposed" | "confirmed" | "declined"
    ): Promise<PersistedAssignment> => ipcRenderer.invoke("schedules:setAssignmentStatus", assignmentId, status)
  },

  dashboard: {
    summary: (): Promise<DashboardSummary> => ipcRenderer.invoke("dashboard:summary")
  },

  history: {
    summary: (): Promise<HistorySummary> => ipcRenderer.invoke("history:summary")
  },

  branding: {
    get: (): Promise<ParishBranding> => ipcRenderer.invoke("branding:get"),
    setName: (name: string): Promise<void> => ipcRenderer.invoke("branding:setName", name),
    setLogo: (dataUrl: string): Promise<void> => ipcRenderer.invoke("branding:setLogo", dataUrl)
  }
};

contextBridge.exposeInMainWorld("api", api);

export type Api = typeof api;
