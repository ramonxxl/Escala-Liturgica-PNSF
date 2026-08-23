import { useEffect, useState } from "react";
import { ActionIcon, Badge, Button, Group, Select, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { Availability, Person, Unavailability } from "@escala/core";
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

export default function DisponibilidadePage(): JSX.Element {
  const [people, setPeople] = useState<Person[]>([]);
  const [personId, setPersonId] = useState<string | null>(null);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [unavailabilities, setUnavailabilities] = useState<Unavailability[]>([]);

  const [newWeekday, setNewWeekday] = useState<string | null>("0");
  const [newTime, setNewTime] = useState("");
  const [newStatus, setNewStatus] = useState<string | null>("unavailable");

  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newReason, setNewReason] = useState("");

  useEffect(() => {
    window.api.people.list().then((list) => setPeople(list.filter((p) => p.active)));
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

  const handleAddAvailability = async (): Promise<void> => {
    if (!personId || !newTime || newWeekday === null || !newStatus) {
      notifications.show({ color: "red", title: "Preencha dia, horário e status", message: "" });
      return;
    }
    await window.api.availabilities.create({
      personId: Number(personId),
      weekday: Number(newWeekday),
      time: newTime,
      status: newStatus as Availability["status"]
    });
    setNewTime("");
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
              Ex: toda quinta-feira às 19h30 o integrante está indisponível.
            </Text>

            <Table striped verticalSpacing="xs" w="fit-content">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Dia</Table.Th>
                  <Table.Th>Horário</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {availabilities.map((rule) => (
                  <Table.Tr key={rule.id}>
                    <Table.Td>{WEEKDAYS[rule.weekday ?? 0]}</Table.Td>
                    <Table.Td>{rule.time}</Table.Td>
                    <Table.Td>
                      <Badge color={rule.status === "available" ? "green" : "red"} variant="light">
                        {rule.status === "available" ? "Disponível" : "Indisponível"}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon variant="subtle" color="red" onClick={() => handleRemoveAvailability(rule.id)}>
                        ✕
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {availabilities.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={4}>
                      <Text c="dimmed" size="sm">
                        Nenhuma regra cadastrada.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>

            <Group align="flex-end">
              <Select
                label="Dia da semana"
                data={WEEKDAYS.map((label, index) => ({ value: String(index), label }))}
                value={newWeekday}
                onChange={setNewWeekday}
                w={180}
              />
              <TextInput
                label="Horário"
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.currentTarget.value)}
                w={120}
              />
              <Select
                label="Status"
                data={[
                  { value: "available", label: "Disponível" },
                  { value: "unavailable", label: "Indisponível" }
                ]}
                value={newStatus}
                onChange={setNewStatus}
                w={160}
              />
              <Button onClick={handleAddAvailability}>Adicionar</Button>
            </Group>
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
