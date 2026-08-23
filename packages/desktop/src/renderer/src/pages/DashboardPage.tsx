import { useEffect, useState } from "react";
import { Card, Stack, Text, Title } from "@mantine/core";

interface DbStatus {
  ok: boolean;
  path: string;
  settingsCount: number;
}

export default function DashboardPage(): JSX.Element {
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);

  useEffect(() => {
    window.api.dbStatus().then(setDbStatus);
  }, []);

  return (
    <Stack gap="md">
      <Title order={2}>Dashboard</Title>
      <Text c="dimmed">
        O painel com próximas missas, escalas pendentes e conflitos será implementado junto com o motor de
        geração de escalas.
      </Text>

      <Card withBorder radius="md" padding="md" maw={480}>
        <Text fw={600} mb="xs">
          Status do sistema
        </Text>
        <Text size="sm">
          Banco de dados:{" "}
          {dbStatus ? `conectado (${dbStatus.settingsCount} configuração(ões))` : "carregando..."}
        </Text>
      </Card>
    </Stack>
  );
}
