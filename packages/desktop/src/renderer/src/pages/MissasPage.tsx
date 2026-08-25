import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Title
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import type { Community, Role } from "@escala/core";
import type { CelebrationWithRequirements, RecurrenceInput } from "@escala/data";
import { formatDate } from "../utils/format";

const WEEKDAY_OPTIONS = [
  { value: "0", label: "Domingo" },
  { value: "1", label: "Segunda" },
  { value: "2", label: "Terça" },
  { value: "3", label: "Quarta" },
  { value: "4", label: "Quinta" },
  { value: "5", label: "Sexta" },
  { value: "6", label: "Sábado" }
];

interface FormValues {
  date: string;
  time: string;
  communityId: string | null;
  celebrationType: string;
  notes: string;
  requirements: Record<string, number>;
  repeat: "none" | "weekly";
  weekdays: string[];
  recurrenceStart: string;
  recurrenceEnd: string;
}

function emptyRequirements(roles: Role[]): Record<string, number> {
  return Object.fromEntries(roles.map((role) => [String(role.id), 0]));
}

const EMPTY_VALUES: FormValues = {
  date: "",
  time: "",
  communityId: null,
  celebrationType: "Missa Dominical",
  notes: "",
  requirements: {},
  repeat: "none",
  weekdays: [],
  recurrenceStart: "",
  recurrenceEnd: ""
};

interface RecurrencePreviewState {
  input: RecurrenceInput;
  dates: string[];
  conflicts: string[];
}

export default function MissasPage(): JSX.Element {
  const [celebrations, setCelebrations] = useState<CelebrationWithRequirements[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CelebrationWithRequirements | null>(null);

  const [recurrencePreview, setRecurrencePreview] = useState<RecurrencePreviewState | null>(null);
  const [skipConflicts, setSkipConflicts] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [creatingRecurrence, setCreatingRecurrence] = useState(false);

  const [duplicateFor, setDuplicateFor] = useState<CelebrationWithRequirements | null>(null);
  const [dupDate, setDupDate] = useState("");
  const [dupTime, setDupTime] = useState("");
  const [dupCommunityId, setDupCommunityId] = useState<string | null>(null);
  const [dupCelebrationType, setDupCelebrationType] = useState("");
  const [dupKeepRequirements, setDupKeepRequirements] = useState(true);
  const [duplicating, setDuplicating] = useState(false);

  const form = useForm<FormValues>({
    initialValues: EMPTY_VALUES,
    validate: {
      date: (value, values) => (values.repeat === "weekly" || value ? null : "Informe a data"),
      time: (value) => (value ? null : "Informe o horário"),
      communityId: (value) => (value ? null : "Informe a comunidade"),
      celebrationType: (value) => (value.trim().length === 0 ? "Informe o tipo de celebração" : null),
      weekdays: (value, values) =>
        values.repeat === "weekly" && value.length === 0 ? "Selecione ao menos um dia da semana" : null,
      recurrenceStart: (value, values) => (values.repeat === "weekly" && !value ? "Informe a data inicial" : null),
      recurrenceEnd: (value, values) => (values.repeat === "weekly" && !value ? "Informe a data final" : null)
    }
  });

  const load = async (): Promise<void> => {
    const [celebrationList, communityList, roleList] = await Promise.all([
      window.api.celebrations.list(),
      window.api.communities.list(),
      window.api.roles.list()
    ]);
    setCelebrations(celebrationList);
    setCommunities(communityList);
    setRoles(roleList.filter((role) => role.active));
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = (): void => {
    setEditing(null);
    form.setValues({ ...EMPTY_VALUES, requirements: emptyRequirements(roles) });
    setModalOpen(true);
  };

  const openEdit = (celebration: CelebrationWithRequirements): void => {
    setEditing(celebration);
    const requirements = emptyRequirements(roles);
    for (const req of celebration.requirements) {
      requirements[String(req.roleId)] = req.quantityNeeded;
    }
    form.setValues({
      date: celebration.date,
      time: celebration.time,
      communityId: String(celebration.communityId),
      celebrationType: celebration.celebrationType,
      notes: celebration.notes ?? "",
      requirements,
      repeat: "none",
      weekdays: [],
      recurrenceStart: "",
      recurrenceEnd: ""
    });
    setModalOpen(true);
  };

  const requirementsFromValues = (values: FormValues): { roleId: number; quantityNeeded: number }[] =>
    Object.entries(values.requirements)
      .filter(([, quantity]) => quantity > 0)
      .map(([roleId, quantityNeeded]) => ({ roleId: Number(roleId), quantityNeeded }));

  const handlePreviewRecurrence = async (values: FormValues): Promise<void> => {
    const input: RecurrenceInput = {
      communityId: Number(values.communityId),
      celebrationType: values.celebrationType.trim(),
      time: values.time,
      weekdays: values.weekdays.map(Number),
      startDate: values.recurrenceStart,
      endDate: values.recurrenceEnd,
      notes: values.notes.trim() || null,
      requirements: requirementsFromValues(values)
    };

    setLoadingPreview(true);
    try {
      const { dates, conflicts } = await window.api.celebrations.previewRecurrence(input);
      if (dates.length === 0) {
        notifications.show({
          color: "red",
          title: "Nenhuma data no período",
          message: "Nenhuma data do período bate com os dias da semana selecionados."
        });
        return;
      }
      setSkipConflicts(conflicts.length > 0);
      setRecurrencePreview({ input, dates, conflicts });
      setModalOpen(false);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSubmit = form.onSubmit(async (values) => {
    if (values.repeat === "weekly") {
      await handlePreviewRecurrence(values);
      return;
    }

    const input = {
      date: values.date,
      time: values.time,
      communityId: Number(values.communityId),
      celebrationType: values.celebrationType.trim(),
      notes: values.notes.trim() || null,
      requirements: requirementsFromValues(values)
    };

    try {
      if (editing) {
        await window.api.celebrations.update(editing.id, input);
      } else {
        await window.api.celebrations.create(input);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      notifications.show({ color: "red", title: "Erro ao salvar", message: (err as Error).message });
    }
  });

  const handleConfirmRecurrence = async (): Promise<void> => {
    if (!recurrencePreview) return;
    setCreatingRecurrence(true);
    try {
      const result = await window.api.celebrations.createRecurrence(recurrencePreview.input, { skipConflicts });
      notifications.show({
        color: "green",
        title: "Missas criadas",
        message: `${result.createdCount} missa(s) criada(s)${
          result.skippedCount > 0 ? `, ${result.skippedCount} pulada(s) (já existiam)` : ""
        }.`
      });
      setRecurrencePreview(null);
      await load();
    } catch (err) {
      notifications.show({ color: "red", title: "Erro ao criar recorrência", message: (err as Error).message });
    } finally {
      setCreatingRecurrence(false);
    }
  };

  const handleRemove = async (celebration: CelebrationWithRequirements): Promise<void> => {
    if (
      !window.confirm(
        `Excluir a missa de ${formatDate(celebration.date)} ${celebration.time}? Essa ação não pode ser desfeita.`
      )
    )
      return;
    try {
      await window.api.celebrations.remove(celebration.id);
      await load();
    } catch (err) {
      notifications.show({ color: "red", title: "Erro ao excluir", message: (err as Error).message });
    }
  };

  const openDuplicate = (celebration: CelebrationWithRequirements): void => {
    setDuplicateFor(celebration);
    setDupDate("");
    setDupTime(celebration.time);
    setDupCommunityId(String(celebration.communityId));
    setDupCelebrationType(celebration.celebrationType);
    setDupKeepRequirements(true);
  };

  const handleDuplicate = async (): Promise<void> => {
    if (!duplicateFor || !dupDate || !dupTime || !dupCommunityId) {
      notifications.show({ color: "red", title: "Preencha a nova data", message: "" });
      return;
    }
    setDuplicating(true);
    try {
      await window.api.celebrations.create({
        date: dupDate,
        time: dupTime,
        communityId: Number(dupCommunityId),
        celebrationType: dupCelebrationType.trim(),
        requirements: dupKeepRequirements
          ? duplicateFor.requirements.map((r) => ({ roleId: r.roleId, quantityNeeded: r.quantityNeeded }))
          : []
      });
      notifications.show({ color: "green", title: "Missa duplicada", message: "" });
      setDuplicateFor(null);
      await load();
    } catch (err) {
      notifications.show({ color: "red", title: "Erro ao duplicar", message: (err as Error).message });
    } finally {
      setDuplicating(false);
    }
  };

  const conflictSet = new Set(recurrencePreview?.conflicts ?? []);
  const recurrenceWillCreate = recurrencePreview
    ? recurrencePreview.dates.length - (skipConflicts ? recurrencePreview.conflicts.length : 0)
    : 0;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>Missas</Title>
        <Button onClick={openCreate} disabled={communities.length === 0}>
          Nova missa
        </Button>
      </Group>

      {communities.length === 0 && (
        <Text c="dimmed">Cadastre ao menos uma comunidade antes de criar uma missa.</Text>
      )}

      <Table striped highlightOnHover verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Data</Table.Th>
            <Table.Th>Horário</Table.Th>
            <Table.Th>Comunidade</Table.Th>
            <Table.Th>Tipo</Table.Th>
            <Table.Th>Necessidades</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {celebrations.map((celebration) => (
            <Table.Tr key={celebration.id}>
              <Table.Td>{formatDate(celebration.date)}</Table.Td>
              <Table.Td>{celebration.time}</Table.Td>
              <Table.Td>{celebration.communityName}</Table.Td>
              <Table.Td>{celebration.celebrationType}</Table.Td>
              <Table.Td>
                <Group gap={4}>
                  {celebration.requirements.length === 0 && <Text c="dimmed">—</Text>}
                  {celebration.requirements.map((req) => (
                    <Badge key={req.roleId} variant="light" size="sm">
                      {req.roleName}: {req.quantityNeeded}
                    </Badge>
                  ))}
                </Group>
              </Table.Td>
              <Table.Td>
                <Badge variant="outline">{celebration.status}</Badge>
              </Table.Td>
              <Table.Td>
                <Group gap="xs" justify="flex-end">
                  <Button variant="subtle" size="xs" onClick={() => openEdit(celebration)}>
                    Editar
                  </Button>
                  <Button variant="subtle" size="xs" onClick={() => openDuplicate(celebration)}>
                    Duplicar
                  </Button>
                  <Button variant="subtle" color="red" size="xs" onClick={() => handleRemove(celebration)}>
                    Excluir
                  </Button>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
          {celebrations.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={7}>
                <Text c="dimmed" ta="center">
                  Nenhuma missa cadastrada.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar missa" : "Nova missa"}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <Stack gap="sm">
            <Select
              label="Comunidade"
              placeholder="Selecione"
              required
              data={communities.map((c) => ({ value: String(c.id), label: c.name }))}
              {...form.getInputProps("communityId")}
            />
            <TextInput
              label="Tipo de celebração"
              placeholder="Ex: Missa Dominical"
              required
              {...form.getInputProps("celebrationType")}
            />
            <TextInput type="time" label="Horário" required {...form.getInputProps("time")} />

            {!editing && (
              <Select
                label="Repetição"
                data={[
                  { value: "none", label: "Não se repete" },
                  { value: "weekly", label: "Semanalmente" }
                ]}
                {...form.getInputProps("repeat")}
                allowDeselect={false}
              />
            )}

            {form.values.repeat === "none" || editing ? (
              <TextInput type="date" label="Data" required {...form.getInputProps("date")} />
            ) : (
              <>
                <Checkbox.Group
                  label="Dias da semana"
                  {...form.getInputProps("weekdays")}
                >
                  <Group gap="sm" mt={4}>
                    {WEEKDAY_OPTIONS.map((option) => (
                      <Checkbox key={option.value} value={option.value} label={option.label} />
                    ))}
                  </Group>
                </Checkbox.Group>
                <Group grow>
                  <TextInput
                    type="date"
                    label="Data inicial"
                    required
                    {...form.getInputProps("recurrenceStart")}
                  />
                  <TextInput type="date" label="Data final" required {...form.getInputProps("recurrenceEnd")} />
                </Group>
              </>
            )}

            <Textarea label="Observações" placeholder="Opcional" {...form.getInputProps("notes")} />

            <Text fw={600} size="sm" mt="xs">
              Necessidades por função
            </Text>
            {roles.length === 0 && (
              <Text c="dimmed" size="sm">
                Cadastre funções primeiro para configurar as necessidades.
              </Text>
            )}
            <Stack gap="xs">
              {roles.map((role) => (
                <Group key={role.id} justify="space-between">
                  <Text size="sm">{role.name}</Text>
                  <NumberInput
                    w={90}
                    min={0}
                    {...form.getInputProps(`requirements.${role.id}`)}
                  />
                </Group>
              ))}
            </Stack>

            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={loadingPreview}>
                {!editing && form.values.repeat === "weekly" ? "Ver prévia" : "Salvar"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={recurrencePreview !== null}
        onClose={() => setRecurrencePreview(null)}
        title={recurrencePreview ? `Prévia da recorrência — ${recurrencePreview.dates.length} data(s)` : ""}
        size="md"
      >
        {recurrencePreview && (
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              {recurrencePreview.input.celebrationType} — {recurrencePreview.input.time}
            </Text>

            <Stack gap={4} mah={280} style={{ overflowY: "auto" }}>
              {recurrencePreview.dates.map((date) => (
                <Group key={date} justify="space-between">
                  <Text size="sm">{formatDate(date)}</Text>
                  {conflictSet.has(date) && (
                    <Badge color="yellow" variant="light" size="sm">
                      🟡 já existe
                    </Badge>
                  )}
                </Group>
              ))}
            </Stack>

            {recurrencePreview.conflicts.length > 0 && (
              <Checkbox
                checked={skipConflicts}
                onChange={(e) => setSkipConflicts(e.currentTarget.checked)}
                label={`Ignorar ${recurrencePreview.conflicts.length} ocorrência(s) já existente(s)`}
              />
            )}

            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={() => setRecurrencePreview(null)}>
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmRecurrence}
                loading={creatingRecurrence}
                disabled={recurrencePreview.conflicts.length > 0 && !skipConflicts}
              >
                Criar {recurrenceWillCreate} Missas
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <Modal opened={duplicateFor !== null} onClose={() => setDuplicateFor(null)} title="Duplicar missa">
        {duplicateFor && (
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              Data original: {formatDate(duplicateFor.date)} {duplicateFor.time}
            </Text>
            <TextInput
              type="date"
              label="Nova data"
              required
              value={dupDate}
              onChange={(e) => setDupDate(e.currentTarget.value)}
            />
            <TextInput
              type="time"
              label="Horário"
              required
              value={dupTime}
              onChange={(e) => setDupTime(e.currentTarget.value)}
            />
            <Select
              label="Comunidade"
              required
              data={communities.map((c) => ({ value: String(c.id), label: c.name }))}
              value={dupCommunityId}
              onChange={setDupCommunityId}
            />
            <TextInput
              label="Tipo de celebração"
              required
              value={dupCelebrationType}
              onChange={(e) => setDupCelebrationType(e.currentTarget.value)}
            />
            <Checkbox
              checked={dupKeepRequirements}
              onChange={(e) => setDupKeepRequirements(e.currentTarget.checked)}
              label="Manter necessidades"
            />
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={() => setDuplicateFor(null)}>
                Cancelar
              </Button>
              <Button onClick={handleDuplicate} loading={duplicating}>
                Criar cópia
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
