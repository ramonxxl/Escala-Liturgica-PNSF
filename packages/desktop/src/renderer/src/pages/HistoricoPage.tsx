import { useEffect, useState } from "react";
import { Stack, Table, Text, Title } from "@mantine/core";
import type { HistorySummary } from "@escala/data";

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const MONTHS_PT = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez"
  ];
  const index = Number(m) - 1;
  return `${MONTHS_PT[index] ?? m}/${year.slice(2)}`;
}

export default function HistoricoPage(): JSX.Element {
  const [history, setHistory] = useState<HistorySummary | null>(null);

  useEffect(() => {
    window.api.history.summary().then(setHistory);
  }, []);

  return (
    <Stack gap="md">
      <Title order={2}>Histórico</Title>
      <Text c="dimmed" size="sm">
        Quantidade de escalas por integrante em cada mês (não conta atribuições recusadas). Usado pelo motor de
        geração para equilibrar quem participa mais ou menos.
      </Text>

      {history && history.people.length === 0 && (
        <Text c="dimmed">Nenhuma escala gerada ainda.</Text>
      )}

      {history && history.people.length > 0 && (
        <Table striped highlightOnHover verticalSpacing="xs" w="fit-content">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Integrante</Table.Th>
              {history.months.map((month) => (
                <Table.Th key={month} ta="center">
                  {formatMonth(month)}
                </Table.Th>
              ))}
              <Table.Th ta="center">Total</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {history.people.map((person) => (
              <Table.Tr key={person.personId}>
                <Table.Td>{person.personName}</Table.Td>
                {history.months.map((month) => (
                  <Table.Td key={month} ta="center">
                    {person.countsByMonth[month] ?? "—"}
                  </Table.Td>
                ))}
                <Table.Td ta="center" fw={700}>
                  {person.total}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
