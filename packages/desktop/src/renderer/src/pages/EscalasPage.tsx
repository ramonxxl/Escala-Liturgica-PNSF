import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Group, Select, Stack, Table, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { CelebrationWithRequirements, PersistedAssignment, ScheduleWithAssignments } from "@escala/data";
import type { UnfilledSlot } from "@escala/core";
import { formatDate } from "../utils/format";

export default function EscalasPage(): JSX.Element {
  const [celebrations, setCelebrations] = useState<CelebrationWithRequirements[]>([]);
  const [celebrationId, setCelebrationId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduleWithAssignments | undefined>(undefined);
  const [unfilled, setUnfilled] = useState<UnfilledSlot[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    window.api.celebrations.list().then(setCelebrations);
  }, []);

  const selectedCelebration = useMemo(
    () => celebrations.find((c) => String(c.id) === celebrationId),
    [celebrations, celebrationId]
  );

  const loadSchedule = async (id: string): Promise<void> => {
    const existing = await window.api.schedules.getForCelebration(Number(id));
    setSchedule(existing);
    setUnfilled([]);
  };

  const handleSelectCelebration = async (id: string | null): Promise<void> => {
    setCelebrationId(id);
    setSchedule(undefined);
    setUnfilled([]);
    if (id) await loadSchedule(id);
  };

  const handleGenerate = async (): Promise<void> => {
    if (!celebrationId) return;
    setGenerating(true);
    try {
      const result = await window.api.schedules.generate(Number(celebrationId));
      setSchedule(result.schedule);
      setUnfilled(result.unfilled);
      notifications.show({ color: "green", title: "Escala gerada", message: "" });
    } catch (err) {
      notifications.show({ color: "red", title: "Erro ao gerar escala", message: (err as Error).message });
    } finally {
      setGenerating(false);
    }
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

  return (
    <Stack gap="md">
      <Title order={2}>Escalas</Title>

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
            {schedule && unfilled.length === 0 && (
              <Badge color="green" variant="light">
                ✅ Escala gerada
              </Badge>
            )}
            {unfilled.length > 0 && (
              <Badge color="yellow" variant="light">
                ⚠️ {unfilled.length} função(ões) pendente(s)
              </Badge>
            )}
          </Group>

          {unfilled.length > 0 && (
            <Alert color="yellow" title="Necessidades não preenchidas">
              <Stack gap={4}>
                {unfilled.map((slot) => (
                  <Text size="sm" key={`${slot.celebrationId}-${slot.roleId}`}>
                    {roleNameById.get(slot.roleId) ?? `Função #${slot.roleId}`}: faltam {slot.missing}
                  </Text>
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
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {[...assignmentsByRole.entries()].map(([roleName, assignments]) =>
                  assignments.map((assignment, index) => (
                    <Table.Tr key={assignment.id}>
                      {index === 0 && <Table.Td rowSpan={assignments.length}>{roleName}</Table.Td>}
                      <Table.Td>{assignment.personName}</Table.Td>
                      <Table.Td>{assignment.score}</Table.Td>
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
    </Stack>
  );
}
