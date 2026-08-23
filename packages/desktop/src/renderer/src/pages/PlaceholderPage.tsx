import { Stack, Text, Title } from "@mantine/core";

export default function PlaceholderPage({ title }: { title: string }): JSX.Element {
  return (
    <Stack gap="xs">
      <Title order={2}>{title}</Title>
      <Text c="dimmed">Esta tela ainda será implementada em uma próxima fase.</Text>
    </Stack>
  );
}
