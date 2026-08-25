import { useEffect, useState } from "react";
import { Avatar, Button, Card, FileButton, Group, SimpleGrid, Stack, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { DashboardSummary } from "@escala/data";
import { formatDate } from "../utils/format";
import { readLogoFile, useParishBranding } from "../utils/branding";

export default function DashboardPage(): JSX.Element {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const { branding, updateName, updateLogo } = useParishBranding();

  useEffect(() => {
    window.api.dashboard.summary().then(setSummary);
  }, []);

  const handleLogoFile = async (file: File | null): Promise<void> => {
    if (!file) return;
    try {
      updateLogo(await readLogoFile(file));
    } catch (err) {
      notifications.show({ color: "red", title: "Erro ao carregar logo", message: (err as Error).message });
    }
  };

  return (
    <Stack gap="lg">
      <Group>
        {branding.logo ? (
          <img src={branding.logo} alt="" className="parish-logo-dashboard" />
        ) : (
          <Avatar size={56} radius="md">
            ⛪
          </Avatar>
        )}
        <Stack gap={2}>
          <TextInput
            variant="unstyled"
            placeholder="Nome da paróquia"
            value={branding.name}
            onChange={(e) => updateName(e.currentTarget.value)}
            styles={{ input: { fontWeight: 700, fontSize: 22, padding: 0 } }}
          />
          <FileButton onChange={handleLogoFile} accept="image/png,image/jpeg">
            {(props) => (
              <Button variant="subtle" size="compact-xs" {...props}>
                {branding.logo ? "Trocar logo" : "Adicionar logo"}
              </Button>
            )}
          </FileButton>
        </Stack>
      </Group>

      <Title order={2}>Dashboard</Title>

      <Stack gap="xs">
        <Text fw={600}>Próximas missas</Text>
        {summary && summary.upcomingCelebrations.length === 0 && (
          <Text c="dimmed" size="sm">
            Nenhuma missa futura cadastrada.
          </Text>
        )}
        {summary?.upcomingCelebrations.map((celebration) => (
          <Card key={celebration.id} withBorder radius="md" padding="sm" maw={480}>
            <Group justify="space-between">
              <div>
                <Text fw={600}>
                  {formatDate(celebration.date)} — {celebration.time}
                </Text>
                <Text size="sm" c="dimmed">
                  {celebration.communityName} · {celebration.celebrationType}
                </Text>
              </div>
            </Group>
          </Card>
        ))}
      </Stack>

      <Stack gap="xs">
        <Text fw={600}>Situação</Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} maw={640}>
          <Card withBorder radius="md" padding="md">
            <Text size="sm" c="dimmed">
              Próxima escala
            </Text>
            {summary?.nextCelebration ? (
              <Text fw={700} size="lg">
                {summary.nextCelebration.filled}/{summary.nextCelebration.needed} funções preenchidas
              </Text>
            ) : (
              <Text c="dimmed">—</Text>
            )}
          </Card>
          <Card withBorder radius="md" padding="md">
            <Text size="sm" c="dimmed">
              Confirmações
            </Text>
            <Text fw={700} size="lg">
              {summary?.confirmedCount ?? 0} confirmados
            </Text>
          </Card>
          <Card withBorder radius="md" padding="md">
            <Text size="sm" c="dimmed">
              Pendências
            </Text>
            <Text fw={700} size="lg">
              {summary?.pendingCount ?? 0}
            </Text>
          </Card>
          <Card withBorder radius="md" padding="md">
            <Text size="sm" c="dimmed">
              Conflitos
            </Text>
            <Text fw={700} size="lg" c={summary && summary.conflictCount > 0 ? "red" : undefined}>
              {summary?.conflictCount ?? 0}
            </Text>
          </Card>
        </SimpleGrid>
      </Stack>
    </Stack>
  );
}
