import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Divider, Group, Stack, Text, TextInput, Title } from "@mantine/core";
import type { CelebrationWithRequirements, ScheduleWithAssignments } from "@escala/data";

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

interface ReportEntry {
  celebration: CelebrationWithRequirements;
  schedule: ScheduleWithAssignments | undefined;
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

export default function RelatorioPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const start = searchParams.get("start") ?? "";
  const end = searchParams.get("end") ?? "";

  const [parishName, setParishName] = useState<string>(() => localStorage.getItem("parishName") ?? "");
  const [entries, setEntries] = useState<ReportEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    localStorage.setItem("parishName", parishName);
  }, [parishName]);

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

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>Relatório para impressão</Title>
        <Button onClick={() => window.print()}>Imprimir / salvar PDF</Button>
      </Group>

      <TextInput
        label="Nome da paróquia (aparece no relatório)"
        placeholder="Ex: Paróquia Nossa Senhora de Fátima"
        value={parishName}
        onChange={(e) => setParishName(e.currentTarget.value)}
        maw={420}
      />

      {loading && <Text>Carregando...</Text>}

      <div id="print-report">
        <Stack gap="lg">
          <Stack gap={0} align="center">
            <Text fw={700} size="lg">
              ESCALA LITÚRGICA
            </Text>
            {parishName && <Text fw={600}>{parishName.toUpperCase()}</Text>}
            {start && end && (
              <Text size="sm" c="dimmed">
                {formatLongDate(start)} até {formatLongDate(end)}
              </Text>
            )}
          </Stack>

          {entries.map(({ celebration, schedule }) => {
            const byRole = groupByRole(schedule);
            return (
              <Stack key={celebration.id} gap={4} className="report-entry">
                <Divider />
                <Text fw={700}>{formatLongDate(celebration.date).toUpperCase()}</Text>
                <Text fw={600}>
                  {celebration.communityName.toUpperCase()} — {formatTime(celebration.time)} (
                  {celebration.celebrationType})
                </Text>
                {[...byRole.entries()].map(([roleName, names]) => (
                  <div key={roleName}>
                    <Text fw={600} size="sm" mt={4}>
                      {roleName.toUpperCase()}
                    </Text>
                    {names.map((name) => (
                      <Text key={name} size="sm">
                        {name}
                      </Text>
                    ))}
                  </div>
                ))}
                {(!schedule || schedule.assignments.length === 0) && (
                  <Text size="sm" c="dimmed">
                    Escala ainda não gerada.
                  </Text>
                )}
              </Stack>
            );
          })}

          {!loading && entries.length === 0 && <Text>Nenhuma missa no período selecionado.</Text>}
        </Stack>
      </div>
    </Stack>
  );
}
