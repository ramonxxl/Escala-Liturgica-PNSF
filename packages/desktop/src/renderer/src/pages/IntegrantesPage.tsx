import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Group,
  Modal,
  MultiSelect,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Textarea,
  Title
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import type { Community, Role } from "@escala/core";
import type { PersonWithRoles } from "@escala/data";

interface FormValues {
  fullName: string;
  phone: string;
  email: string;
  communityId: string | null;
  spousePersonId: string | null;
  notes: string;
  roleIds: string[];
}

const EMPTY_FORM: FormValues = {
  fullName: "",
  phone: "",
  email: "",
  communityId: null,
  spousePersonId: null,
  notes: "",
  roleIds: []
};

export default function IntegrantesPage(): JSX.Element {
  const [people, setPeople] = useState<PersonWithRoles[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PersonWithRoles | null>(null);

  const form = useForm<FormValues>({
    initialValues: EMPTY_FORM,
    validate: {
      fullName: (value) => (value.trim().length === 0 ? "Informe o nome completo" : null)
    }
  });

  const load = async (): Promise<void> => {
    const [peopleList, communityList, roleList] = await Promise.all([
      window.api.people.list(),
      window.api.communities.list(),
      window.api.roles.list()
    ]);
    setPeople(peopleList);
    setCommunities(communityList);
    setRoles(roleList);
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = (): void => {
    setEditing(null);
    form.setValues(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (person: PersonWithRoles): void => {
    setEditing(person);
    form.setValues({
      fullName: person.fullName,
      phone: person.phone ?? "",
      email: person.email ?? "",
      communityId: person.communityId ? String(person.communityId) : null,
      spousePersonId: person.spousePersonId ? String(person.spousePersonId) : null,
      notes: person.notes ?? "",
      roleIds: person.roles.map((role) => String(role.id))
    });
    setModalOpen(true);
  };

  const handleSubmit = form.onSubmit(async (values) => {
    const input = {
      fullName: values.fullName.trim(),
      phone: values.phone.trim() || null,
      email: values.email.trim() || null,
      communityId: values.communityId ? Number(values.communityId) : null,
      spousePersonId: values.spousePersonId ? Number(values.spousePersonId) : null,
      notes: values.notes.trim() || null,
      roleIds: values.roleIds.map(Number)
    };
    try {
      if (editing) {
        await window.api.people.update(editing.id, input);
      } else {
        await window.api.people.create(input);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      notifications.show({ color: "red", title: "Erro ao salvar", message: (err as Error).message });
    }
  });

  const toggleActive = async (person: PersonWithRoles): Promise<void> => {
    await window.api.people.setActive(person.id, !person.active);
    await load();
  };

  const handleRemove = async (person: PersonWithRoles): Promise<void> => {
    if (!window.confirm(`Excluir "${person.fullName}"? Essa ação não pode ser desfeita.`)) return;
    try {
      await window.api.people.remove(person.id);
      await load();
    } catch {
      notifications.show({
        color: "red",
        title: "Não foi possível excluir",
        message: "Esse integrante está em uso (já foi escalado). Desative-o em vez de excluir."
      });
    }
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>Integrantes</Title>
        <Button onClick={openCreate}>Novo integrante</Button>
      </Group>

      <Table striped highlightOnHover verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Nome</Table.Th>
            <Table.Th>Comunidade</Table.Th>
            <Table.Th>Cônjuge</Table.Th>
            <Table.Th>Funções</Table.Th>
            <Table.Th>Ativo</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {people.map((person) => (
            <Table.Tr key={person.id}>
              <Table.Td>{person.fullName}</Table.Td>
              <Table.Td>{person.communityName || "—"}</Table.Td>
              <Table.Td>{person.spouseName ? `💑 ${person.spouseName}` : "—"}</Table.Td>
              <Table.Td>
                <Group gap={4}>
                  {person.roles.length === 0 && <Text c="dimmed">—</Text>}
                  {person.roles.map((role) => (
                    <Badge key={role.id} variant="light" size="sm">
                      {role.name}
                    </Badge>
                  ))}
                </Group>
              </Table.Td>
              <Table.Td>
                <Switch checked={person.active} onChange={() => toggleActive(person)} />
              </Table.Td>
              <Table.Td>
                <Group gap="xs" justify="flex-end">
                  <Button variant="subtle" size="xs" onClick={() => openEdit(person)}>
                    Editar
                  </Button>
                  <Button variant="subtle" color="red" size="xs" onClick={() => handleRemove(person)}>
                    Excluir
                  </Button>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
          {people.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text c="dimmed" ta="center">
                  Nenhum integrante cadastrado.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar integrante" : "Novo integrante"}
      >
        <form onSubmit={handleSubmit}>
          <Stack gap="sm">
            <TextInput
              label="Nome completo"
              placeholder="Ex: Maria da Silva"
              required
              {...form.getInputProps("fullName")}
            />
            <TextInput label="Telefone" placeholder="Opcional" {...form.getInputProps("phone")} />
            <TextInput label="E-mail" placeholder="Opcional" {...form.getInputProps("email")} />
            <Select
              label="Comunidade"
              placeholder="Selecione"
              clearable
              data={communities.map((c) => ({ value: String(c.id), label: c.name }))}
              {...form.getInputProps("communityId")}
            />
            <Select
              label="Cônjuge"
              description="Se marcados como casal, o gerador de escala prioriza escalar os dois na mesma missa"
              placeholder="Opcional"
              clearable
              searchable
              data={people
                .filter((p) => p.id !== editing?.id)
                .map((p) => ({ value: String(p.id), label: p.fullName }))}
              {...form.getInputProps("spousePersonId")}
            />
            <MultiSelect
              label="Funções"
              placeholder="Selecione uma ou mais"
              data={roles.map((r) => ({ value: String(r.id), label: r.name }))}
              {...form.getInputProps("roleIds")}
            />
            <Textarea label="Observações" placeholder="Opcional" {...form.getInputProps("notes")} />
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
