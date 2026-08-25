import { ipcMain } from "electron";
import { corePing, type SchedulingRules } from "@escala/core";
import {
  type AppDatabase,
  type CommunityInput,
  type RoleInput,
  type PersonInput,
  type CelebrationInput,
  type AvailabilityInput,
  type UnavailabilityInput,
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
  removePerson,
  listCelebrations,
  createCelebration,
  updateCelebration,
  removeCelebration,
  listDistinctMassSlots,
  listAvailabilitiesByPerson,
  createAvailability,
  removeAvailability,
  listUnavailabilitiesByPerson,
  createUnavailability,
  removeUnavailability,
  generateAndSaveSchedule,
  generateAndSaveScheduleForRange,
  getScheduleForCelebration,
  addAssignment,
  removeAssignment,
  substituteAssignment,
  rankSubstitutes,
  verifySchedule,
  setAssignmentStatus,
  getDashboardSummary,
  getAssignmentHistory,
  getParishBranding,
  setParishName,
  setParishLogo,
  getSchedulingRules,
  setSchedulingRules
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

  ipcMain.handle("celebrations:list", () => listCelebrations(db));
  ipcMain.handle("celebrations:create", (_event, input: CelebrationInput) => createCelebration(db, input));
  ipcMain.handle("celebrations:update", (_event, id: number, input: CelebrationInput) =>
    updateCelebration(db, id, input)
  );
  ipcMain.handle("celebrations:remove", (_event, id: number) => removeCelebration(db, id));
  ipcMain.handle("celebrations:distinctMassSlots", () => listDistinctMassSlots(db));

  ipcMain.handle("availabilities:listByPerson", (_event, personId: number) =>
    listAvailabilitiesByPerson(db, personId)
  );
  ipcMain.handle("availabilities:create", (_event, input: AvailabilityInput) => createAvailability(db, input));
  ipcMain.handle("availabilities:remove", (_event, id: number) => removeAvailability(db, id));

  ipcMain.handle("unavailabilities:listByPerson", (_event, personId: number) =>
    listUnavailabilitiesByPerson(db, personId)
  );
  ipcMain.handle("unavailabilities:create", (_event, input: UnavailabilityInput) =>
    createUnavailability(db, input)
  );
  ipcMain.handle("unavailabilities:remove", (_event, id: number) => removeUnavailability(db, id));

  ipcMain.handle("schedules:generate", (_event, celebrationId: number, roleIds?: number[]) =>
    generateAndSaveSchedule(db, celebrationId, roleIds)
  );
  ipcMain.handle("schedules:getForCelebration", (_event, celebrationId: number) =>
    getScheduleForCelebration(db, celebrationId)
  );
  ipcMain.handle("schedules:addAssignment", (_event, scheduleId: number, roleId: number, personId: number) =>
    addAssignment(db, scheduleId, roleId, personId)
  );
  ipcMain.handle("schedules:removeAssignment", (_event, assignmentId: number) => removeAssignment(db, assignmentId));
  ipcMain.handle("schedules:substitute", (_event, assignmentId: number, newPersonId: number) =>
    substituteAssignment(db, assignmentId, newPersonId)
  );
  ipcMain.handle("schedules:rankSubstitutes", (_event, assignmentId: number) => rankSubstitutes(db, assignmentId));
  ipcMain.handle("schedules:verify", (_event, celebrationId: number) => verifySchedule(db, celebrationId));
  ipcMain.handle("schedules:generateForRange", (_event, startDate: string, endDate: string, roleIds?: number[]) =>
    generateAndSaveScheduleForRange(db, startDate, endDate, roleIds)
  );
  ipcMain.handle(
    "schedules:setAssignmentStatus",
    (_event, assignmentId: number, status: "proposed" | "confirmed" | "declined") =>
      setAssignmentStatus(db, assignmentId, status)
  );

  ipcMain.handle("dashboard:summary", () => getDashboardSummary(db));
  ipcMain.handle("history:summary", () => getAssignmentHistory(db));

  ipcMain.handle("branding:get", () => getParishBranding(db));
  ipcMain.handle("branding:setName", (_event, name: string) => setParishName(db, name));
  ipcMain.handle("branding:setLogo", (_event, dataUrl: string) => setParishLogo(db, dataUrl));

  ipcMain.handle("settings:getSchedulingRules", () => getSchedulingRules(db));
  ipcMain.handle("settings:setSchedulingRules", (_event, rules: Partial<SchedulingRules>) =>
    setSchedulingRules(db, rules)
  );
}
