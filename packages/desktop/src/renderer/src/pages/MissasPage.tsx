import { useEffect, useState } from "react";
import {
  Badge,
  Button,
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
import type { CelebrationWithRequirements } from "@escala/data";
import { formatDate } from "../utils/format";

interface FormValues {
  date: string;
  time: string;
  communityId: string | null;
  celebrationType: string;
  notes: string;
  requirements: Record<string, number>;
}

function emptyRequirements(roles: Role[]): Record<string, number> {
  return Object.fromEntries(roles.map((role) => [String(role.id), 0]));
}

export default function MissasPage(): JSX.Element {
  const [celebrations, setCelebrations] = useState<CelebrationWithRequirements[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CelebrationWithRequirements | null>(null);

  const form = useForm<FormValues>({
    initialValues: {
      date: "",
      time: "",
      communityId: null,
      celebrationType: "",
      notes: "",
      requirements: {}
    },
    validate: {
      date: (value) => (value ? null : "Informe a data"),
      time: (value) => (value ? null : "Informe o horário"),
      communityId: (value) => (value ? null : "Informe a comunidade"),
      celebrationType: (value) => (value.trim().length === 0 ? "Informe o tipo de celebração" : null)
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
    form.setValues({
      date: "",
      time: "",
      communityId: null,
      celebrationType: "Missa Dominical",
      notes: "",
      requirements: emptyRequirements(roles)
    });
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
      requirements
    });
    setModalOpen(true);
  };

  const handleSubmit = form.onSubmit(async (values) => {
    const requirements = Object.entries(values.requirements)
      .filter(([, quantity]) => quantity > 0)
      .map(([roleId, quantityNeeded]) => ({ roleId: Number(roleId), quantityNeeded }));

    const input = {
      date: values.date,
      time: values.time,
      communityId: Number(values.communityId),
      celebrationType: values.celebrationType.trim(),
      notes: values.notes.trim() || null,
      requirements
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
            <Group grow>
              <TextInput type="date" label="Data" required {...form.getInputProps("date")} />
              <TextInput type="time" label="Horário" required {...form.getInputProps("time")} />
            </Group>
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
              <Button type="submit">Salvar</Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
