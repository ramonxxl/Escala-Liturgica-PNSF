import { useEffect, useMemo, useState } from "react";
import { ActionIcon, Badge, Button, Group, Select, Stack, Table, Text, TextInput, Title, UnstyledButton } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { Availability, Person, Unavailability } from "@escala/core";
import type { MassSlots } from "@escala/data";
import { formatDate } from "../utils/format";

const WEEKDAYS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado"
];

const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function cellKey(weekday: number, time: string): string {
  return `${weekday}|${time}`;
}

export default function DisponibilidadePage(): JSX.Element {
  const [people, setPeople] = useState<Person[]>([]);
  const [personId, setPersonId] = useState<string | null>(null);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [unavailabilities, setUnavailabilities] = useState<Unavailability[]>([]);
  const [massSlots, setMassSlots] = useState<MassSlots>({ weekdays: [], times: [] });

  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newReason, setNewReason] = useState("");

  useEffect(() => {
    window.api.people.list().then((list) => setPeople(list.filter((p) => p.active)));
    window.api.celebrations.distinctMassSlots().then(setMassSlots);
  }, []);

  const loadPersonData = async (id: string): Promise<void> => {
    const [availList, unavailList] = await Promise.all([
      window.api.availabilities.listByPerson(Number(id)),
      window.api.unavailabilities.listByPerson(Number(id))
    ]);
    setAvailabilities(availList);
    setUnavailabilities(unavailList);
  };

  const handleSelectPerson = async (id: string | null): Promise<void> => {
    setPersonId(id);
    if (id) await loadPersonData(id);
  };

  const availabilityByCell = useMemo(() => {
    const map = new Map<string, Availability>();
    for (const rule of availabilities) {
      if (rule.weekday !== null && rule.time) map.set(cellKey(rule.weekday, rule.time), rule);
    }
    return map;
  }, [availabilities]);

  const gridKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const weekday of massSlots.weekdays) {
      for (const time of massSlots.times) keys.add(cellKey(weekday, time));
    }
    return keys;
  }, [massSlots]);

  // regras cadastradas pra um dia/horario que nao corresponde a nenhuma missa cadastrada
  // (ex: missa removida depois, ou horario digitado antes de existir a grade) — mantidas visiveis pra nao sumir com dado do usuario
  const orphanRules = useMemo(
    () => availabilities.filter((rule) => rule.weekday === null || !gridKeys.has(cellKey(rule.weekday, rule.time ?? ""))),
    [availabilities, gridKeys]
  );

  const handleCycleCell = async (weekday: number, time: string): Promise<void> => {
    if (!personId) return;
    const existing = availabilityByCell.get(cellKey(weekday, time));
    if (!existing) {
      await window.api.availabilities.create({ personId: Number(personId), weekday, time, status: "unavailable" });
    } else if (existing.status === "unavailable") {
      await window.api.availabilities.remove(existing.id);
      await window.api.availabilities.create({ personId: Number(personId), weekday, time, status: "available" });
    } else {
      await window.api.availabilities.remove(existing.id);
    }
    await loadPersonData(personId);
  };

  const handleRemoveAvailability = async (id: number): Promise<void> => {
    if (!personId) return;
    await window.api.availabilities.remove(id);
    await loadPersonData(personId);
  };

  const handleAddUnavailability = async (): Promise<void> => {
    if (!personId || !newStart || !newEnd) {
      notifications.show({ color: "red", title: "Preencha data inicial e final", message: "" });
      return;
    }
    try {
      await window.api.unavailabilities.create({
        personId: Number(personId),
        startDate: newStart,
        endDate: newEnd,
        reason: newReason.trim() || null
      });
      setNewStart("");
      setNewEnd("");
      setNewReason("");
      await loadPersonData(personId);
    } catch (err) {
      notifications.show({ color: "red", title: "Erro ao salvar período", message: (err as Error).message });
    }
  };

  const handleRemoveUnavailability = async (id: number): Promise<void> => {
    if (!personId) return;
    await window.api.unavailabilities.remove(id);
    await loadPersonData(personId);
  };

  return (
    <Stack gap="md">
      <Title order={2}>Disponibilidade</Title>

      <Select
        label="Integrante"
        placeholder="Selecione um integrante"
        data={people.map((p) => ({ value: String(p.id), label: p.fullName }))}
        value={personId}
        onChange={handleSelectPerson}
        searchable
        maw={360}
      />

      {personId && (
        <>
          <Stack gap="xs">
            <Text fw={600}>Disponibilidade semanal recorrente</Text>
            <Text size="sm" c="dimmed">
              Clique numa célula pra alternar: sem marcação → 🔴 indisponível → 🟢 disponível → sem marcação. As
              linhas e colunas vêm dos dias/horários que já têm missa cadastrada.
            </Text>

            {massSlots.weekdays.length === 0 || massSlots.times.length === 0 ? (
              <Text c="dimmed" size="sm">
                Cadastre pelo menos uma missa primeiro — a grade é montada a partir dos dias e horários das missas.
              </Text>
            ) : (
              <Table.ScrollContainer minWidth={200 + massSlots.weekdays.length * 90}>
                <Table striped withTableBorder verticalSpacing="xs" w="fit-content">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Horário</Table.Th>
                      {massSlots.weekdays.map((weekday) => (
                        <Table.Th key={weekday} ta="center">
                          {WEEKDAYS_SHORT[weekday]}
                        </Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {massSlots.times.map((time) => (
                      <Table.Tr key={time}>
                        <Table.Td>{time}</Table.Td>
                        {massSlots.weekdays.map((weekday) => {
                          const rule = availabilityByCell.get(cellKey(weekday, time));
                          return (
                            <Table.Td key={weekday} ta="center">
                              <UnstyledButton
                                onClick={() => handleCycleCell(weekday, time)}
                                title={
                                  rule
                                    ? rule.status === "available"
                                      ? "Disponível — clique para remover a marcação"
                                      : "Indisponível — clique para marcar como disponível"
                                    : "Sem marcação — clique para marcar como indisponível"
                                }
                              >
                                {rule ? (rule.status === "available" ? "🟢" : "🔴") : "—"}
                              </UnstyledButton>
                            </Table.Td>
                          );
                        })}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}

            {orphanRules.length > 0 && (
              <Stack gap={4} mt="xs">
                <Text size="sm" c="dimmed">
                  Outras regras cadastradas (fora da grade acima):
                </Text>
                {orphanRules.map((rule) => (
                  <Group key={rule.id} gap="xs">
                    <Badge color={rule.status === "available" ? "green" : "red"} variant="light">
                      {WEEKDAYS[rule.weekday ?? 0]} {rule.time} —{" "}
                      {rule.status === "available" ? "Disponível" : "Indisponível"}
                    </Badge>
                    <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleRemoveAvailability(rule.id)}>
                      ✕
                    </ActionIcon>
                  </Group>
                ))}
              </Stack>
            )}
          </Stack>

          <Stack gap="xs" mt="md">
            <Text fw={600}>Períodos de indisponibilidade (férias, viagens, etc.)</Text>

            <Table striped verticalSpacing="xs" w="fit-content">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>De</Table.Th>
                  <Table.Th>Até</Table.Th>
                  <Table.Th>Motivo</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {unavailabilities.map((period) => (
                  <Table.Tr key={period.id}>
                    <Table.Td>{formatDate(period.startDate)}</Table.Td>
                    <Table.Td>{formatDate(period.endDate)}</Table.Td>
                    <Table.Td>{period.reason || "—"}</Table.Td>
                    <Table.Td>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleRemoveUnavailability(period.id)}
                      >
                        ✕
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {unavailabilities.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={4}>
                      <Text c="dimmed" size="sm">
                        Nenhum período cadastrado.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>

            <Group align="flex-end">
              <TextInput
                label="De"
                type="date"
                value={newStart}
                onChange={(e) => setNewStart(e.currentTarget.value)}
              />
              <TextInput label="Até" type="date" value={newEnd} onChange={(e) => setNewEnd(e.currentTarget.value)} />
              <TextInput
                label="Motivo"
                placeholder="Opcional"
                value={newReason}
                onChange={(e) => setNewReason(e.currentTarget.value)}
              />
              <Button onClick={handleAddUnavailability}>Adicionar</Button>
            </Group>
          </Stack>
        </>
      )}
    </Stack>
  );
}
