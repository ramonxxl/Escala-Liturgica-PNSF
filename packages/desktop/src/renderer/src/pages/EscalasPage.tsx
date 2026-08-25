import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  MultiSelect,
  Paper,
  Popover,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { Community, Role } from "@escala/core";
import type {
  CelebrationWithRequirements,
  PersistedAssignment,
  PersonWithRoles,
  ScheduleProblem,
  ScheduleStatusInfo,
  ScheduleWithAssignments,
  SubstituteCandidate
} from "@escala/data";
import { formatDate, formatMonthYear } from "../utils/format";

function monthRange(date: Date): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const toIso = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: toIso(start), end: toIso(end) };
}

function StatusBadge({ status }: { status: ScheduleStatusInfo["status"] | undefined }): JSX.Element {
  if (status === "completa") {
    return (
      <Badge color="green" variant="light">
        🟢 Completa
      </Badge>
    );
  }
  if (status === "pendente") {
    return (
      <Badge color="yellow" variant="light">
        🟡 Pendente
      </Badge>
    );
  }
  return (
    <Badge color="gray" variant="light">
      ⚪ Não gerada
    </Badge>
  );
}

export default function EscalasPage(): JSX.Element {
  const navigate = useNavigate();
  const [celebrations, setCelebrations] = useState<CelebrationWithRequirements[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
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

  const [verifying, setVerifying] = useState(false);
  const [problems, setProblems] = useState<ScheduleProblem[] | null>(null);

  const [monthDate, setMonthDate] = useState(new Date());
  const [statusByCelebration, setStatusByCelebration] = useState<Map<number, ScheduleStatusInfo>>(new Map());
  const [filterCommunityId, setFilterCommunityId] = useState<string | null>(null);
  const [filterRoleId, setFilterRoleId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  useEffect(() => {
    window.api.celebrations.list().then(setCelebrations);
    window.api.communities.list().then(setCommunities);
    window.api.people.list().then(setPeople);
    window.api.roles.list().then(setRoles);
  }, []);

  const { start: periodStart, end: periodEnd } = useMemo(() => monthRange(monthDate), [monthDate]);

  const refreshStatuses = async (): Promise<void> => {
    const rows = await window.api.schedules.statusForRange(periodStart, periodEnd);
    setStatusByCelebration(new Map(rows.map((r) => [r.celebrationId, r])));
  };

  useEffect(() => {
    refreshStatuses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodStart, periodEnd]);

  const visibleCelebrations = useMemo(
    () =>
      celebrations
        .filter((c) => c.date >= periodStart && c.date <= periodEnd)
        .filter((c) => !filterCommunityId || String(c.communityId) === filterCommunityId)
        .filter((c) => !filterRoleId || c.requirements.some((r) => String(r.roleId) === filterRoleId))
        .filter((c) => !filterStatus || (statusByCelebration.get(c.id)?.status ?? "nao_gerada") === filterStatus),
    [celebrations, periodStart, periodEnd, filterCommunityId, filterRoleId, filterStatus, statusByCelebration]
  );

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
      await refreshStatuses();
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
      await refreshStatuses();
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
    await refreshStatuses();
  };

  const handleSetStatus = async (
    assignment: PersistedAssignment,
    status: "proposed" | "confirmed" | "declined"
  ): Promise<void> => {
    await window.api.schedules.setAssignmentStatus(assignment.id, status);
    if (celebrationId) await refreshSchedule(celebrationId);
    await refreshStatuses();
  };

  const handleAddPerson = async (roleId: number): Promise<void> => {
    if (!schedule) return;
    const personId = addPersonByRole[roleId];
    if (!personId) return;
    try {
      await window.api.schedules.addAssignment(schedule.id, roleId, Number(personId));
      setAddPersonByRole((prev) => ({ ...prev, [roleId]: null }));
      if (celebrationId) await refreshSchedule(celebrationId);
      await refreshStatuses();
    } catch (err) {
      notifications.show({ color: "red", title: "Erro ao adicionar", message: (err as Error).message });
    }
  };

  const handleVerify = async (): Promise<void> => {
    if (!celebrationId) return;
    setVerifying(true);
    try {
      setProblems(await window.api.schedules.verify(Number(celebrationId)));
    } finally {
      setVerifying(false);
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
    await refreshStatuses();
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
              const { start, end } = monthRange(new Date());
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

      {celebrations.length === 0 ? (
        <Text c="dimmed">Cadastre uma missa com necessidades primeiro.</Text>
      ) : (
        <Stack gap="sm">
          <Group>
            <ActionIcon variant="default" onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
              ◀
            </ActionIcon>
            <Text fw={600} w={160} ta="center">
              {formatMonthYear(monthDate)}
            </Text>
            <ActionIcon variant="default" onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
              ▶
            </ActionIcon>
          </Group>

          <Group>
            <Select
              label="Comunidade"
              placeholder="Todas"
              data={communities.map((c) => ({ value: String(c.id), label: c.name }))}
              value={filterCommunityId}
              onChange={setFilterCommunityId}
              clearable
              searchable
              w={200}
            />
            <Select
              label="Função"
              placeholder="Todas"
              data={roles.map((r) => ({ value: String(r.id), label: r.name }))}
              value={filterRoleId}
              onChange={setFilterRoleId}
              clearable
              searchable
              w={200}
            />
            <Select
              label="Situação"
              placeholder="Todas"
              data={[
                { value: "completa", label: "🟢 Completa" },
                { value: "pendente", label: "🟡 Pendente" },
                { value: "nao_gerada", label: "⚪ Não gerada" }
              ]}
              value={filterStatus}
              onChange={setFilterStatus}
              clearable
              w={180}
            />
          </Group>

          {visibleCelebrations.length === 0 ? (
            <Text c="dimmed" size="sm">
              Nenhuma missa nesse período com esses filtros.
            </Text>
          ) : (
            <Table striped highlightOnHover verticalSpacing="xs" w="fit-content">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Data</Table.Th>
                  <Table.Th>Horário</Table.Th>
                  <Table.Th>Comunidade</Table.Th>
                  <Table.Th>Situação</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {visibleCelebrations.map((c) => (
                  <Table.Tr
                    key={c.id}
                    onClick={() => handleSelectCelebration(String(c.id))}
                    style={{ cursor: "pointer" }}
                  >
                    <Table.Td>{formatDate(c.date)}</Table.Td>
                    <Table.Td>{c.time}</Table.Td>
                    <Table.Td>{c.communityName}</Table.Td>
                    <Table.Td>
                      <StatusBadge status={statusByCelebration.get(c.id)?.status} />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      )}

      <Modal
        opened={selectedCelebration !== undefined}
        onClose={() => handleSelectCelebration(null)}
        size="xl"
        title={
          selectedCelebration
            ? `⛪ ${selectedCelebration.celebrationType} — ${formatDate(selectedCelebration.date)} ${selectedCelebration.time} — ${selectedCelebration.communityName}`
            : ""
        }
      >
        {selectedCelebration && (
          <Stack gap="md">
            <Group>
              <Button onClick={handleGenerate} loading={generating}>
                {schedule ? "Regerar escala" : "Gerar escala"}
              </Button>
              {schedule && (
                <Button variant="light" onClick={handleVerify} loading={verifying}>
                  🔍 Verificar escala
                </Button>
              )}
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
              <Table striped verticalSpacing="xs">
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
                            {assignment.reasons.length > 0 && (
                              <Popover width={280} position="right" withArrow shadow="md">
                                <Popover.Target>
                                  <ActionIcon
                                    variant="subtle"
                                    size="sm"
                                    radius="xl"
                                    title="Por que essa pessoa foi escolhida?"
                                  >
                                    ❓
                                  </ActionIcon>
                                </Popover.Target>
                                <Popover.Dropdown>
                                  <Text size="sm" fw={600} mb={4}>
                                    Por que {assignment.personName} foi escolhido(a)?
                                  </Text>
                                  <Stack gap={2}>
                                    {assignment.reasons.map((reason, i) => (
                                      <Group key={i} justify="space-between" gap="xs" wrap="nowrap">
                                        <Text size="xs">{reason.label}</Text>
                                        <Text size="xs" c={reason.delta >= 0 ? "green" : "red"} fw={600}>
                                          {reason.delta >= 0 ? "+" : ""}
                                          {reason.delta}
                                        </Text>
                                      </Group>
                                    ))}
                                  </Stack>
                                </Popover.Dropdown>
                              </Popover>
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
          </Stack>
        )}
      </Modal>

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

      <Modal opened={problems !== null} onClose={() => setProblems(null)} title="Verificação da escala">
        {problems && problems.length === 0 && (
          <Text c="green" fw={600}>
            ✅ Escala válida — nenhum problema encontrado.
          </Text>
        )}
        {problems && problems.length > 0 && (
          <Stack gap="xs">
            {problems.map((problem, i) => (
              <Alert key={i} color={problem.severity === "error" ? "red" : "yellow"} py="xs">
                {problem.message}
              </Alert>
            ))}
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
