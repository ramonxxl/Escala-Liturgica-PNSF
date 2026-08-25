import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, FileButton, Group, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { CelebrationWithRequirements, ScheduleWithAssignments } from "@escala/data";
import { formatDate } from "../utils/format";
import { readLogoFile, useParishBranding } from "../utils/branding";

const MONTHS_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro"
];

function formatLongDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return `${day} de ${MONTHS_PT[month - 1]} de ${year}`;
}

function formatTime(time: string): string {
  return time.replace(":", "h");
}

/** "Ana" | "Ana e Carlos" | "Ana, Carlos e José" — mesmo estilo das planilhas reais da paróquia. */
function joinNamesPtBr(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

interface ReportEntry {
  celebration: CelebrationWithRequirements;
  schedule: ScheduleWithAssignments | undefined;
}

interface ReportRow {
  key: string;
  celebrationId: number;
  date: string;
  time: string;
  communityName: string;
  celebrationType: string;
  roleName: string;
  names: string[];
  isFirstOfCelebration: boolean;
  rowSpan: number;
}

function groupByRole(schedule: ScheduleWithAssignments | undefined): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const assignment of schedule?.assignments ?? []) {
    const list = map.get(assignment.roleName) ?? [];
    list.push(assignment.personName);
    map.set(assignment.roleName, list);
  }
  return map;
}

function buildRows(entries: ReportEntry[]): ReportRow[] {
  const rows: ReportRow[] = [];
  for (const { celebration, schedule } of entries) {
    const roleEntries = [...groupByRole(schedule).entries()];
    if (roleEntries.length === 0) {
      rows.push({
        key: `${celebration.id}-empty`,
        celebrationId: celebration.id,
        date: celebration.date,
        time: celebration.time,
        communityName: celebration.communityName,
        celebrationType: celebration.celebrationType,
        roleName: "—",
        names: [],
        isFirstOfCelebration: true,
        rowSpan: 1
      });
      continue;
    }
    roleEntries.forEach(([roleName, names], index) => {
      rows.push({
        key: `${celebration.id}-${roleName}`,
        celebrationId: celebration.id,
        date: celebration.date,
        time: celebration.time,
        communityName: celebration.communityName,
        celebrationType: celebration.celebrationType,
        roleName,
        names,
        isFirstOfCelebration: index === 0,
        rowSpan: roleEntries.length
      });
    });
  }
  return rows;
}

export default function RelatorioPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const start = searchParams.get("start") ?? "";
  const end = searchParams.get("end") ?? "";

  const { branding, updateName, updateLogo } = useParishBranding();
  const [entries, setEntries] = useState<ReportEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      const all = await window.api.celebrations.list();
      const inRange = all
        .filter((c) => c.date >= start && c.date <= end)
        .sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));

      const withSchedules = await Promise.all(
        inRange.map(async (celebration) => ({
          celebration,
          schedule: await window.api.schedules.getForCelebration(celebration.id)
        }))
      );

      if (!cancelled) {
        setEntries(withSchedules);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [start, end]);

  const rows = useMemo(() => buildRows(entries), [entries]);

  const handleLogoFile = async (file: File | null): Promise<void> => {
    if (!file) return;
    try {
      updateLogo(await readLogoFile(file));
    } catch (err) {
      notifications.show({ color: "red", title: "Erro ao carregar logo", message: (err as Error).message });
    }
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>Relatório para impressão</Title>
        <Button onClick={() => window.print()}>Imprimir / salvar PDF</Button>
      </Group>

      <Group align="flex-end">
        <TextInput
          label="Nome da paróquia"
          placeholder="Ex: Paróquia Nossa Senhora de Fátima"
          value={branding.name}
          onChange={(e) => updateName(e.currentTarget.value)}
          maw={360}
        />
        <FileButton onChange={handleLogoFile} accept="image/png,image/jpeg">
          {(props) => (
            <Button variant="default" {...props}>
              {branding.logo ? "Trocar logo" : "Adicionar logo"}
            </Button>
          )}
        </FileButton>
      </Group>

      {loading && <Text>Carregando...</Text>}

      <div id="print-report">
        <Group justify="center" gap={8} mb={6} wrap="nowrap">
          {branding.logo && <img src={branding.logo} alt="" className="report-logo" />}
          <Stack gap={0} align="center">
            <Text fw={700} size="md">
              ESCALA LITÚRGICA{branding.name ? ` — ${branding.name.toUpperCase()}` : ""}
            </Text>
            {start && end && (
              <Text size="xs" c="dimmed">
                {formatLongDate(start)} até {formatLongDate(end)}
              </Text>
            )}
          </Stack>
        </Group>

        <Table withTableBorder withColumnBorders className="report-table">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Data</Table.Th>
              <Table.Th>Horário</Table.Th>
              <Table.Th>Comunidade</Table.Th>
              <Table.Th>Função</Table.Th>
              <Table.Th>Integrante(s)</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={row.key}>
                {row.isFirstOfCelebration && (
                  <>
                    <Table.Td rowSpan={row.rowSpan}>{formatDate(row.date)}</Table.Td>
                    <Table.Td rowSpan={row.rowSpan}>{formatTime(row.time)}</Table.Td>
                    <Table.Td rowSpan={row.rowSpan}>
                      {row.communityName}
                      <Text size="xs" c="dimmed">
                        {row.celebrationType}
                      </Text>
                    </Table.Td>
                  </>
                )}
                <Table.Td>{row.roleName}</Table.Td>
                <Table.Td>
                  {row.names.length > 0 ? (
                    joinNamesPtBr(row.names)
                  ) : (
                    <Text c="dimmed" size="sm">
                      escala não gerada
                    </Text>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
            {rows.length === 0 && !loading && (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text>Nenhuma missa no período selecionado.</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </div>
    </Stack>
  );
}
