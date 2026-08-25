import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  MultiSelect,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { Role } from "@escala/core";
import type {
  CelebrationWithRequirements,
  PersistedAssignment,
  PersonWithRoles,
  ScheduleWithAssignments,
  SubstituteCandidate
} from "@escala/data";
import { formatDate } from "../utils/format";

function currentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const toIso = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: toIso(start), end: toIso(end) };
}

export default function EscalasPage(): JSX.Element {
  const navigate = useNavigate();
  const [celebrations, setCelebrations] = useState<CelebrationWithRequirements[]>([]);
  const [people, setPeople] = useState<PersonWithRoles[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [celebrationId, setCelebrationId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduleWithAssignments | undefined>(undefined);
  const [generating, setGenerating] = useState(false);
  const [addPersonByRole, setAddPersonByRole] = useState<Record<number, string | null>>({});

  const [substituteFor, setSubstituteFor] = useState<PersistedAssignment | null>(null);
  const [candidates, setCandidates] = useState<SubstituteCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [generatingRange, setGeneratingRange] = useState(false);

  useEffect(() => {
    window.api.celebrations.list().then(setCelebrations);
    window.api.people.list().then(setPeople);
    window.api.roles.list().then(setRoles);
  }, []);

  const roleIdsFilter = roleFilter.length > 0 ? roleFilter.map(Number) : undefined;

  const selectedCelebration = useMemo(
    () => celebrations.find((c) => String(c.id) === celebrationId),
    [celebrations, celebrationId]
  );

  const refreshSchedule = async (id: string): Promise<void> => {
    const existing = await window.api.schedules.getForCelebration(Number(id));
    setSchedule(existing);
  };

  const handleSelectCelebration = async (id: string | null): Promise<void> => {
    setCelebrationId(id);
    setSchedule(undefined);
    if (id) await refreshSchedule(id);
  };

  const handleGenerate = async (): Promise<void> => {
    if (!celebrationId) return;
    setGenerating(true);
    try {
      const result = await window.api.schedules.generate(Number(celebrationId), roleIdsFilter);
      setSchedule(result);
      notifications.show({ color: "green", title: "Escala gerada", message: "" });
    } catch (err) {
      notifications.show({ color: "red", title: "Erro ao gerar escala", message: (err as Error).message });
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateRange = async (): Promise<void> => {
    if (!rangeStart || !rangeEnd) return;
    setGeneratingRange(true);
    try {
      const result = await window.api.schedules.generateForRange(rangeStart, rangeEnd, roleIdsFilter);
      notifications.show({
        color: "green",
        title: "Escalas do período geradas",
        message: `${result.schedules.length} missa(s) geradas${
          result.skipped.length > 0 ? `, ${result.skipped.length} pulada(s) (escala já publicada)` : ""
        }.`
      });
      const freshCelebrations = await window.api.celebrations.list();
      setCelebrations(freshCelebrations);
      if (celebrationId) await refreshSchedule(celebrationId);
    } catch (err) {
      notifications.show({ color: "red", title: "Erro ao gerar escalas do período", message: (err as Error).message });
    } finally {
      setGeneratingRange(false);
    }
  };

  const handleRemove = async (assignment: PersistedAssignment): Promise<void> => {
    if (!window.confirm(`Remover ${assignment.personName} de ${assignment.roleName}?`)) return;
    await window.api.schedules.removeAssignment(assignment.id);
    if (celebrationId) await refreshSchedule(celebrationId);
  };

  const handleSetStatus = async (
    assignment: PersistedAssignment,
    status: "proposed" | "confirmed" | "declined"
  ): Promise<void> => {
    await window.api.schedules.setAssignmentStatus(assignment.id, status);
    if (celebrationId) await refreshSchedule(celebrationId);
  };

  const handleAddPerson = async (roleId: number): Promise<void> => {
    if (!schedule) return;
    const personId = addPersonByRole[roleId];
    if (!personId) return;
    try {
      await window.api.schedules.addAssignment(schedule.id, roleId, Number(personId));
      setAddPersonByRole((prev) => ({ ...prev, [roleId]: null }));
      if (celebrationId) await refreshSchedule(celebrationId);
    } catch (err) {
      notifications.show({ color: "red", title: "Erro ao adicionar", message: (err as Error).message });
    }
  };

  const openSubstituteModal = async (assignment: PersistedAssignment): Promise<void> => {
    setSubstituteFor(assignment);
    setLoadingCandidates(true);
    try {
      setCandidates(await window.api.schedules.rankSubstitutes(assignment.id));
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handlePickSubstitute = async (personId: number): Promise<void> => {
    if (!substituteFor) return;
    await window.api.schedules.substitute(substituteFor.id, personId);
    setSubstituteFor(null);
    if (celebrationId) await refreshSchedule(celebrationId);
  };

  const assignmentsByRole = useMemo(() => {
    const map = new Map<string, PersistedAssignment[]>();
    if (!schedule) return map;
    for (const assignment of schedule.assignments) {
      const list = map.get(assignment.roleName) ?? [];
      list.push(assignment);
      map.set(assignment.roleName, list);
    }
    return map;
  }, [schedule]);

  const roleNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const req of selectedCelebration?.requirements ?? []) {
      map.set(req.roleId, req.roleName);
    }
    return map;
  }, [selectedCelebration]);

  const assignedPersonIds = useMemo(
    () => new Set(schedule?.assignments.map((a) => a.personId) ?? []),
    [schedule]
  );

  const personById = useMemo(() => {
    const map = new Map<number, PersonWithRoles>();
    for (const p of people) map.set(p.id, p);
    return map;
  }, [people]);

  const isSpouseAlsoAssigned = (personId: number): boolean => {
    const spouseId = personById.get(personId)?.spousePersonId;
    return spouseId != null && assignedPersonIds.has(spouseId);
  };

  const peopleForRole = (roleId: number): { value: string; label: string }[] =>
    people
      .filter((p) => p.active && !assignedPersonIds.has(p.id) && p.roles.some((r) => r.id === roleId))
      .map((p) => ({ value: String(p.id), label: p.fullName }));

  return (
    <Stack gap="md">
      <Title order={2}>Escalas</Title>

      <MultiSelect
        label="Gerar somente para estas funções"
        description="Deixe vazio para gerar todas as funções. As funções não selecionadas ficam intocadas."
        placeholder="Todas as funções"
        maw={420}
        data={roles.map((r) => ({ value: String(r.id), label: r.name }))}
        value={roleFilter}
        onChange={setRoleFilter}
        searchable
        clearable
      />

      <Paper withBorder radius="md" p="md" maw={560}>
        <Text fw={600} mb="xs">
          Gerar escala de um período
        </Text>
        <Text size="sm" c="dimmed" mb="sm">
          Gera todas as missas do período de uma vez, distribuindo os integrantes entre elas (evita repetir a
          mesma pessoa demais vezes no mês). Missas com escala já publicada não são alteradas.
        </Text>
        <Group align="flex-end">
          <TextInput label="De" type="date" value={rangeStart} onChange={(e) => setRangeStart(e.currentTarget.value)} />
          <TextInput label="Até" type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.currentTarget.value)} />
          <Button
            variant="default"
            onClick={() => {
              const { start, end } = currentMonthRange();
              setRangeStart(start);
              setRangeEnd(end);
            }}
          >
            Mês atual
          </Button>
          <Button onClick={handleGenerateRange} loading={generatingRange} disabled={!rangeStart || !rangeEnd}>
            Gerar escala do período
          </Button>
          <Button
            variant="light"
            disabled={!rangeStart || !rangeEnd}
            onClick={() => navigate(`/relatorio?start=${rangeStart}&end=${rangeEnd}`)}
          >
            Ver relatório para impressão
          </Button>
        </Group>
      </Paper>

      <Select
        label="Missa"
        placeholder="Selecione uma missa"
        maw={420}
        data={celebrations.map((c) => ({
          value: String(c.id),
          label: `${formatDate(c.date)} ${c.time} — ${c.communityName} (${c.celebrationType})`
        }))}
        value={celebrationId}
        onChange={handleSelectCelebration}
        searchable
      />

      {celebrations.length === 0 && <Text c="dimmed">Cadastre uma missa com necessidades primeiro.</Text>}

      {selectedCelebration && (
        <>
          <Group>
            <Button onClick={handleGenerate} loading={generating}>
              {schedule ? "Regerar escala" : "Gerar escala"}
            </Button>
            {schedule && schedule.unfilled.length === 0 && (
              <Badge color="green" variant="light">
                ✅ Escala gerada
              </Badge>
            )}
            {schedule && schedule.unfilled.length > 0 && (
              <Badge color="yellow" variant="light">
                ⚠️ {schedule.unfilled.length} função(ões) pendente(s)
              </Badge>
            )}
          </Group>

          {schedule && schedule.unfilled.length > 0 && (
            <Alert color="yellow" title="Necessidades não preenchidas">
              <Stack gap="sm">
                {schedule.unfilled.map((slot) => (
                  <Group key={`${slot.celebrationId}-${slot.roleId}`} align="flex-end">
                    <Text size="sm" w={220}>
                      {roleNameById.get(slot.roleId) ?? `Função #${slot.roleId}`}: faltam {slot.missing}
                    </Text>
                    <Select
                      placeholder="Adicionar integrante"
                      data={peopleForRole(slot.roleId)}
                      value={addPersonByRole[slot.roleId] ?? null}
                      onChange={(value) => setAddPersonByRole((prev) => ({ ...prev, [slot.roleId]: value }))}
                      w={220}
                      searchable
                    />
                    <Button size="xs" onClick={() => handleAddPerson(slot.roleId)}>
                      Adicionar
                    </Button>
                  </Group>
                ))}
              </Stack>
            </Alert>
          )}

          {schedule && schedule.assignments.length > 0 && (
            <Table striped verticalSpacing="xs" w="fit-content">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Função</Table.Th>
                  <Table.Th>Integrante</Table.Th>
                  <Table.Th>Pontuação</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {[...assignmentsByRole.entries()].map(([roleName, assignments]) =>
                  assignments.map((assignment, index) => (
                    <Table.Tr key={assignment.id}>
                      {index === 0 && <Table.Td rowSpan={assignments.length}>{roleName}</Table.Td>}
                      <Table.Td>
                        <Group gap={6}>
                          {assignment.personName}
                          {isSpouseAlsoAssigned(assignment.personId) && (
                            <Badge color="pink" variant="light" size="sm">
                              💑 com cônjuge
                            </Badge>
                          )}
                          {assignment.conflictFlag && (
                            <Badge color="red" variant="light" size="sm">
                              ⚠️ conflito
                            </Badge>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>{assignment.score}</Table.Td>
                      <Table.Td>
                        <Badge
                          color={
                            assignment.status === "confirmed"
                              ? "green"
                              : assignment.status === "declined"
                                ? "red"
                                : "gray"
                          }
                          variant="light"
                        >
                          {assignment.status === "confirmed"
                            ? "Confirmado"
                            : assignment.status === "declined"
                              ? "Recusado"
                              : "Pendente"}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs" justify="flex-end">
                          {assignment.status !== "confirmed" && (
                            <Button
                              variant="subtle"
                              color="green"
                              size="xs"
                              onClick={() => handleSetStatus(assignment, "confirmed")}
                            >
                              Confirmar
                            </Button>
                          )}
                          {assignment.status !== "proposed" && (
                            <Button
                              variant="subtle"
                              size="xs"
                              onClick={() => handleSetStatus(assignment, "proposed")}
                            >
                              Marcar pendente
                            </Button>
                          )}
                          <Button variant="subtle" size="xs" onClick={() => openSubstituteModal(assignment)}>
                            Substituir
                          </Button>
                          <Button variant="subtle" color="red" size="xs" onClick={() => handleRemove(assignment)}>
                            Remover
                          </Button>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          )}

          {!schedule && (
            <Text c="dimmed" size="sm">
              Nenhuma escala gerada ainda para essa missa.
            </Text>
          )}
        </>
      )}

      <Modal
        opened={substituteFor !== null}
        onClose={() => setSubstituteFor(null)}
        title={substituteFor ? `Substituir ${substituteFor.personName} (${substituteFor.roleName})` : ""}
      >
        {loadingCandidates && <Text size="sm">Buscando candidatos...</Text>}
        {!loadingCandidates && candidates.length === 0 && (
          <Text size="sm" c="dimmed">
            Nenhum candidato disponível para essa função nesse horário.
          </Text>
        )}
        <Stack gap="xs">
          {candidates.map((candidate, index) => (
            <Group key={candidate.personId} justify="space-between" wrap="nowrap">
              <Text size="sm">
                {index + 1}. {candidate.personName}
                {candidate.sameCommunity && (
                  <Text span c="dimmed" size="xs">
                    {" "}
                    (mesma comunidade)
                  </Text>
                )}
              </Text>
              <Group gap="xs">
                <Badge variant="light">{candidate.score} pts</Badge>
                <Button size="xs" onClick={() => handlePickSubstitute(candidate.personId)}>
                  Escolher
                </Button>
              </Group>
            </Group>
          ))}
        </Stack>
      </Modal>
    </Stack>
  );
}
