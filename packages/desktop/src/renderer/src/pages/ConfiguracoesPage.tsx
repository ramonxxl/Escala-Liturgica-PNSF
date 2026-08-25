import { useEffect, useState } from "react";
import { Button, NumberInput, Paper, Select, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { SchedulingRules, SpouseSchedulingRule } from "@escala/core";

const SPOUSE_RULE_OPTIONS: { value: SpouseSchedulingRule; label: string; description: string }[] = [
  { value: "priorizar", label: "Priorizar", description: "O gerador prefere escalar marido e esposa na mesma missa quando um dos dois já está escalado." },
  { value: "evitar", label: "Evitar", description: "O gerador evita escalar marido e esposa na mesma missa." },
  { value: "nenhuma", label: "Nenhuma", description: "O vínculo de cônjuge não afeta a geração da escala." }
];

export default function ConfiguracoesPage(): JSX.Element {
  const [rules, setRules] = useState<SchedulingRules | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    window.api.settings.getSchedulingRules().then(setRules);
  }, []);

  const handleSave = async (): Promise<void> => {
    if (!rules) return;
    setSaving(true);
    try {
      const saved = await window.api.settings.setSchedulingRules(rules);
      setRules(saved);
      notifications.show({ color: "green", title: "Regras salvas", message: "" });
    } catch (err) {
      notifications.show({ color: "red", title: "Erro ao salvar", message: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  if (!rules) return <Text c="dimmed">Carregando...</Text>;

  const spouseDescription = SPOUSE_RULE_OPTIONS.find((o) => o.value === rules.spouseRule)?.description ?? "";

  return (
    <Stack gap="md" maw={520}>
      <Title order={2}>Configurações</Title>
      <Text size="sm" c="dimmed">
        Regras que afetam como o gerador automático de escalas pontua os candidatos. Nenhuma delas bloqueia uma
        vaga — se ninguém mais estiver elegível, o gerador prefere preencher "fora da regra" a deixar a vaga vazia.
      </Text>

      <Paper withBorder radius="md" p="md">
        <Stack gap="sm">
          <Select
            label="Regra de cônjuge"
            description={spouseDescription}
            data={SPOUSE_RULE_OPTIONS.map(({ value, label }) => ({ value, label }))}
            value={rules.spouseRule}
            onChange={(value) => value && setRules({ ...rules, spouseRule: value as SpouseSchedulingRule })}
            allowDeselect={false}
          />

          <NumberInput
            label="Máximo de escalas por pessoa/mês"
            description="Deixe em branco para não ter limite."
            placeholder="Sem limite"
            min={1}
            value={rules.maxPerMonth ?? ""}
            onChange={(value) => setRules({ ...rules, maxPerMonth: value === "" ? null : Number(value) })}
          />

          <NumberInput
            label="Intervalo mínimo entre escalas (dias)"
            description="Deixe em branco para não ter intervalo mínimo."
            placeholder="Sem intervalo mínimo"
            min={1}
            value={rules.minIntervalDays ?? ""}
            onChange={(value) => setRules({ ...rules, minIntervalDays: value === "" ? null : Number(value) })}
          />

          <Button onClick={handleSave} loading={saving} w="fit-content">
            Salvar
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
