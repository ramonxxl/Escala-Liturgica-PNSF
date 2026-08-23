import { useEffect, useState } from "react";
import { Button, Group, Modal, Stack, Switch, Table, Text, TextInput, Textarea, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import type { Community } from "@escala/core";

interface FormValues {
  name: string;
  address: string;
  notes: string;
}

export default function ComunidadesPage(): JSX.Element {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Community | null>(null);

  const form = useForm<FormValues>({
    initialValues: { name: "", address: "", notes: "" },
    validate: {
      name: (value) => (value.trim().length === 0 ? "Informe o nome" : null)
    }
  });

  const load = async (): Promise<void> => {
    setCommunities(await window.api.communities.list());
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = (): void => {
    setEditing(null);
    form.setValues({ name: "", address: "", notes: "" });
    setModalOpen(true);
  };

  const openEdit = (community: Community): void => {
    setEditing(community);
    form.setValues({
      name: community.name,
      address: community.address ?? "",
      notes: community.notes ?? ""
    });
    setModalOpen(true);
  };

  const handleSubmit = form.onSubmit(async (values) => {
    const input = {
      name: values.name.trim(),
      address: values.address.trim() || null,
      notes: values.notes.trim() || null
    };
    try {
      if (editing) {
        await window.api.communities.update(editing.id, input);
      } else {
        await window.api.communities.create(input);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      notifications.show({ color: "red", title: "Erro ao salvar", message: (err as Error).message });
    }
  });

  const toggleActive = async (community: Community): Promise<void> => {
    await window.api.communities.setActive(community.id, !community.active);
    await load();
  };

  const handleRemove = async (community: Community): Promise<void> => {
    if (!window.confirm(`Excluir a comunidade "${community.name}"? Essa ação não pode ser desfeita.`)) return;
    try {
      await window.api.communities.remove(community.id);
      await load();
    } catch {
      notifications.show({
        color: "red",
        title: "Não foi possível excluir",
        message:
          "Essa comunidade está em uso (possui missas ou integrantes vinculados). Desative-a em vez de excluir."
      });
    }
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>Comunidades</Title>
        <Button onClick={openCreate}>Nova comunidade</Button>
      </Group>

      <Table striped highlightOnHover verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Nome</Table.Th>
            <Table.Th>Endereço</Table.Th>
            <Table.Th>Ativa</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {communities.map((community) => (
            <Table.Tr key={community.id}>
              <Table.Td>{community.name}</Table.Td>
              <Table.Td>{community.address || "—"}</Table.Td>
              <Table.Td>
                <Switch checked={community.active} onChange={() => toggleActive(community)} />
              </Table.Td>
              <Table.Td>
                <Group gap="xs" justify="flex-end">
                  <Button variant="subtle" size="xs" onClick={() => openEdit(community)}>
                    Editar
                  </Button>
                  <Button variant="subtle" color="red" size="xs" onClick={() => handleRemove(community)}>
                    Excluir
                  </Button>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
          {communities.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={4}>
                <Text c="dimmed" ta="center">
                  Nenhuma comunidade cadastrada.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar comunidade" : "Nova comunidade"}
      >
        <form onSubmit={handleSubmit}>
          <Stack gap="sm">
            <TextInput label="Nome" placeholder="Ex: Matriz" required {...form.getInputProps("name")} />
            <TextInput label="Endereço" placeholder="Opcional" {...form.getInputProps("address")} />
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
