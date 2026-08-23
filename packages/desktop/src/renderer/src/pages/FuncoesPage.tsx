import { useEffect, useState } from "react";
import { Button, Group, Modal, Stack, Switch, Table, Text, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import type { Role } from "@escala/core";

interface FormValues {
  name: string;
  description: string;
}

export default function FuncoesPage(): JSX.Element {
  const [roles, setRoles] = useState<Role[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);

  const form = useForm<FormValues>({
    initialValues: { name: "", description: "" },
    validate: {
      name: (value) => (value.trim().length === 0 ? "Informe o nome" : null)
    }
  });

  const load = async (): Promise<void> => {
    setRoles(await window.api.roles.list());
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = (): void => {
    setEditing(null);
    form.setValues({ name: "", description: "" });
    setModalOpen(true);
  };

  const openEdit = (role: Role): void => {
    setEditing(role);
    form.setValues({ name: role.name, description: role.description ?? "" });
    setModalOpen(true);
  };

  const handleSubmit = form.onSubmit(async (values) => {
    const input = { name: values.name.trim(), description: values.description.trim() || null };
    try {
      if (editing) {
        await window.api.roles.update(editing.id, input);
      } else {
        await window.api.roles.create(input);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      notifications.show({ color: "red", title: "Erro ao salvar", message: (err as Error).message });
    }
  });

  const toggleActive = async (role: Role): Promise<void> => {
    await window.api.roles.setActive(role.id, !role.active);
    await load();
  };

  const handleRemove = async (role: Role): Promise<void> => {
    if (!window.confirm(`Excluir a função "${role.name}"? Essa ação não pode ser desfeita.`)) return;
    try {
      await window.api.roles.remove(role.id);
      await load();
    } catch {
      notifications.show({
        color: "red",
        title: "Não foi possível excluir",
        message:
          "Essa função está em uso (atribuída a algum integrante ou missa). Desative-a em vez de excluir."
      });
    }
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>Funções</Title>
        <Button onClick={openCreate}>Nova função</Button>
      </Group>

      <Table striped highlightOnHover verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Nome</Table.Th>
            <Table.Th>Descrição</Table.Th>
            <Table.Th>Ativa</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {roles.map((role) => (
            <Table.Tr key={role.id}>
              <Table.Td>{role.name}</Table.Td>
              <Table.Td>{role.description || "—"}</Table.Td>
              <Table.Td>
                <Switch checked={role.active} onChange={() => toggleActive(role)} />
              </Table.Td>
              <Table.Td>
                <Group gap="xs" justify="flex-end">
                  <Button variant="subtle" size="xs" onClick={() => openEdit(role)}>
                    Editar
                  </Button>
                  <Button variant="subtle" color="red" size="xs" onClick={() => handleRemove(role)}>
                    Excluir
                  </Button>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
          {roles.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={4}>
                <Text c="dimmed" ta="center">
                  Nenhuma função cadastrada.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar função" : "Nova função"}
      >
        <form onSubmit={handleSubmit}>
          <Stack gap="sm">
            <TextInput label="Nome" placeholder="Ex: Leitor" required {...form.getInputProps("name")} />
            <TextInput label="Descrição" placeholder="Opcional" {...form.getInputProps("description")} />
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
