import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock4,
  Download,
  FileText,
  Printer,
  ShieldAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Unit } from "@/lib/canepulse";
import { computeUnitMetrics, fmt, statusOf } from "@/lib/canepulse";

export function ReportsPanel({ units }: { units: Unit[] }) {
  const [scope, setScope] = useState<string>("group");
  const selected = useMemo(
    () => (scope === "group" ? units : units.filter((u) => u.id === scope)),
    [scope, units],
  );

  const rows = selected.map((unit) => ({ unit, metrics: computeUnitMetrics(unit) }));
  const active = rows.filter((r) => r.metrics.hasData);

  const totals = active.reduce(
    (acc, r) => ({
      target: acc.target + r.unit.dailyTarget,
      real: acc.real + r.metrics.realTonnes,
      potential: acc.potential + r.metrics.potentialTonnes,
      projection: acc.projection + r.metrics.projection24,
      potential24: acc.potential24 + r.metrics.potential24,
      lost: acc.lost + r.metrics.fronts.reduce((s, f) => s + f.lostTonnes, 0),
    }),
    { target: 0, real: 0, potential: 0, projection: 0, potential24: 0, lost: 0 },
  );

  const exportReport = () => {
    const lines = [
      "CanePulse — Relatório operacional",
      `Escopo: ${scope === "group" ? "Grupo" : (selected[0]?.name ?? "-")}`,
      "",
      ...rows.flatMap(({ unit, metrics }) => [
        `# ${unit.name}`,
        `Meta diária: ${fmt(unit.dailyTarget)} t | Densidade: ${fmt(unit.density, 2)} t/viagem`,
        `Janela: ${metrics.activeHours} h (${metrics.hourLabels.join(", ")})`,
        `Real: ${fmt(metrics.realTonnes)} t | Potencial: ${fmt(metrics.potentialTonnes)} t | Ritmo: ${fmt(metrics.realRatePerHour, 1)} t/h`,
        `Projeção 24h real: ${fmt(metrics.projection24)} t | Potencial 24h: ${fmt(metrics.potential24)} t`,
        ...metrics.fronts.map(
          (f) =>
            `  Frente ${f.front.number}: real ${fmt(f.real)} / potencial ${fmt(f.potentialTotal)} (${fmt(f.compliance, 1)}%)${
              f.delta < 0 ? ` — justificativa: ${f.front.justification || "não informada"}` : ""
            }`,
        ),
        "",
      ]),
      `TOTAL — Meta ${fmt(totals.target)} t | Projeção ${fmt(totals.projection)} t | Perda ${fmt(totals.lost)} t`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "canepulse-relatorio.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="surface-panel rounded-xl border border-border/70 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="flex items-center gap-2 font-display text-base font-semibold">
          <FileText className="h-4 w-4 text-primary" /> Relatórios
        </h3>
        <div className="ml-auto flex items-center gap-2">
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Escopo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="group">Grupo (consolidado)</SelectItem>
              {units.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="secondary" size="icon" onClick={exportReport} aria-label="Exportar relatório">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="icon" onClick={() => window.print()} aria-label="Imprimir">
            <Printer className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="hourly" className="mt-5">
        <TabsList>
          <TabsTrigger value="hourly">Relatório de Fechamento de Hora</TabsTrigger>
          <TabsTrigger value="daily">Relatório Final do Dia (24h)</TabsTrigger>
        </TabsList>

        <TabsContent value="hourly" className="mt-5 space-y-5">
          {active.length === 0 ? (
            <Empty />
          ) : (
            active.map(({ unit, metrics }) => (
              <article key={unit.id} className="rounded-lg border border-border/70 bg-background/40 p-5">
                <header className="flex flex-wrap items-center gap-2">
                  <h4 className="font-display text-sm font-semibold">{unit.name}</h4>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock4 className="h-3 w-3" />
                    {metrics.hourLabels[0]} → {metrics.hourLabels[metrics.hourLabels.length - 1]}
                  </span>
                </header>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  No intervalo de <strong className="text-foreground">{metrics.activeHours} hora(s)</strong>{" "}
                  monitoradas, as frentes registradas entregaram{" "}
                  <strong className="num text-foreground">{fmt(metrics.realTrucks)} conjuntos</strong>{" "}
                  contra um potencial de{" "}
                  <strong className="num text-foreground">{fmt(metrics.potentialTrucks)}</strong>, o que
                  representa aderência de{" "}
                  <strong className="num text-foreground">{fmt(metrics.compliance, 1)}%</strong>. O ritmo
                  real de moagem é de{" "}
                  <strong className="num text-primary">{fmt(metrics.realRatePerHour, 1)} t/h</strong>,
                  equivalente a {fmt(metrics.realTonnes)} t movimentadas no período.
                </p>
                <ul className="mt-4 space-y-2">
                  {metrics.fronts.map((f) => (
                    <li key={f.front.id} className="flex flex-wrap items-center gap-2 text-xs">
                      {f.delta < 0 ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      )}
                      <span className="num font-medium">Frente {f.front.number}</span>
                      <span className="num text-muted-foreground">
                        {fmt(f.real)} / {fmt(f.potentialTotal)} conj. ({fmt(f.compliance, 1)}%)
                      </span>
                      {f.delta < 0 ? (
                        <span className="text-muted-foreground">
                          — perda de {fmt(f.lostTonnes)} t ·{" "}
                          <em className="text-warning">
                            {f.front.justification || "justificativa pendente"}
                          </em>
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </article>
            ))
          )}
        </TabsContent>

        <TabsContent value="daily" className="mt-5 space-y-5">
          {active.length === 0 ? (
            <Empty />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Kpi label="Meta consolidada" value={`${fmt(totals.target)} t`} />
                <Kpi
                  label="Projeção 24h (real)"
                  value={`${fmt(totals.projection)} t`}
                  tone={totals.projection >= totals.target ? "ok" : "critical"}
                />
                <Kpi label="Tonelagem perdida" value={`${fmt(totals.lost)} t`} tone="risk" />
              </div>

              {active.map(({ unit, metrics }) => {
                const status = statusOf(metrics.compliance, true);
                const Icon =
                  status === "ok" ? CheckCircle2 : status === "risk" ? AlertTriangle : ShieldAlert;
                const cls =
                  status === "ok"
                    ? "text-success"
                    : status === "risk"
                      ? "text-warning"
                      : "text-destructive";
                const bottlenecks = metrics.fronts.filter((f) => f.delta < 0);
                return (
                  <article
                    key={unit.id}
                    className="rounded-lg border border-border/70 bg-background/40 p-5"
                  >
                    <header className="flex flex-wrap items-center gap-2">
                      <Icon className={`h-4 w-4 ${cls}`} />
                      <h4 className="font-display text-sm font-semibold">{unit.name}</h4>
                      <span className={`num text-xs font-medium ${cls}`}>
                        {fmt(metrics.compliance, 1)}% de aderência
                      </span>
                    </header>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      Fechamento projetado de{" "}
                      <strong className="num text-foreground">{fmt(metrics.projection24)} t</strong> contra
                      meta de <strong className="num text-foreground">{fmt(unit.dailyTarget)} t</strong> —{" "}
                      <strong className={`num ${metrics.targetDeltaReal >= 0 ? "text-success" : "text-destructive"}`}>
                        {metrics.targetDeltaReal >= 0 ? "superávit" : "déficit"} de{" "}
                        {fmt(Math.abs(metrics.targetDeltaReal))} t
                      </strong>
                      . Operando em potencial pleno, o fechamento seria de {fmt(metrics.potential24)} t.
                    </p>
                    <div className="mt-4">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Principais gargalos
                      </p>
                      {bottlenecks.length === 0 ? (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-success">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Nenhum gargalo registrado.
                        </p>
                      ) : (
                        <ul className="mt-1.5 space-y-1.5">
                          {bottlenecks.map((f) => (
                            <li key={f.front.id} className="text-xs text-muted-foreground">
                              <span className="num font-medium text-foreground">
                                Frente {f.front.number}
                              </span>{" "}
                              — {fmt(f.lostTonnes)} t perdidas ·{" "}
                              <em className="text-warning">
                                {f.front.justification || "justificativa pendente"}
                              </em>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </article>
                );
              })}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "ok" | "risk" | "critical";
}) {
  const cls =
    tone === "ok"
      ? "text-success"
      : tone === "risk"
        ? "text-warning"
        : tone === "critical"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border/70 bg-background/40 p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`num mt-1 font-display text-xl font-semibold ${cls}`}>{value}</p>
    </div>
  );
}

function Empty() {
  return (
    <p className="rounded-lg border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
      Sem dados suficientes. Importe planilhas horárias para gerar os relatórios.
    </p>
  );
}
