import { useEffect, useState } from "react";
import { Card, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import type { DashboardSummary } from "@escala/data";
import { formatDate } from "../utils/format";

export default function DashboardPage(): JSX.Element {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    window.api.dashboard.summary().then(setSummary);
  }, []);

  return (
    <Stack gap="lg">
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
