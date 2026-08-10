import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock4,
  Download,
  FileText,
  MessageCircle,
  Printer,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FrontMetrics, Unit, UnitMetrics } from "@/lib/canepulse";
import { computeUnitMetrics, fmt, signed, siglaLabel, statusOf } from "@/lib/canepulse";
import { buildWhatsAppReport } from "@/lib/whatsapp";


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
      projection: acc.projection + r.metrics.projection24 + r.metrics.initialTonnes,
      potential24: acc.potential24 + r.metrics.potential24 + r.metrics.initialTonnes,
      lost: acc.lost + r.metrics.lostTonnes,
      yard: acc.yard + r.metrics.initialTonnes,
    }),
    { target: 0, real: 0, potential: 0, projection: 0, potential24: 0, lost: 0, yard: 0 },
  );

  const copyWhatsApp = async () => {
    const text = buildWhatsAppReport(rows, scope === "group" ? "Grupo (consolidado)" : (selected[0]?.name ?? "-"));
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Relatório copiado para o WhatsApp");
    } catch {
      toast.error("Não foi possível copiar o relatório.");
    }
  };

  const exportReport = () => {

    const lines = [
      "CanePulse — Relatório operacional",
      `Escopo: ${scope === "group" ? "Grupo" : (selected[0]?.name ?? "-")}`,
      "",
      ...rows.flatMap(({ unit, metrics }) => [
        `# ${unit.name}`,
        `Meta diária: ${fmt(unit.dailyTarget)} t | Carga líquida: ${fmt(unit.density, 2)} t/conj. | Pátio inicial: ${fmt(unit.initialStock)} conj. (${fmt(metrics.initialTonnes)} t)`,
        `Janela: ${metrics.activeHours} h (${metrics.hourLabels.join(", ")})`,
        `Real: ${fmt(metrics.realTonnes)} t | Potencial: ${fmt(metrics.potentialTonnes)} t | Ritmo: ${fmt(metrics.realRatePerHour, 1)} t/h`,
        `Meta horária: ${fmt(metrics.hourlyTarget, 1)} t/h | Saldo planejamento: ${signed(metrics.planningBalance24)} t/dia`,
        `Projeção 24h real (+ pátio): ${fmt(metrics.projection24 + metrics.initialTonnes)} t`,
        ...metrics.fronts.map(
          (f) =>
            `  Frente ${f.front.number}: real ${fmt(f.real, 1)} / potencial ${fmt(f.potentialTotal, 1)} (${fmt(f.compliance, 1)}%)${
              f.delta < 0
                ? ` — perda ${fmt(f.lostTonnes)} t — justificativa: ${f.front.justification || f.autoJustification || "pendente"}`
                : ""
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
          <Button variant="secondary" onClick={copyWhatsApp}>
            <MessageCircle className="h-4 w-4" /> Copiar para WhatsApp
          </Button>
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
          <TabsTrigger value="hourly">Fechamento de Hora</TabsTrigger>
          <TabsTrigger value="daily">Final do Dia (24h)</TabsTrigger>
        </TabsList>

        <TabsContent value="hourly" className="mt-6 space-y-8">
          {active.length === 0 ? (
            <Empty />
          ) : (
            active.map(({ unit, metrics }) => (
              <ReportCard key={unit.id} unit={unit} metrics={metrics} />
            ))
          )}
        </TabsContent>

        <TabsContent value="daily" className="mt-6 space-y-8">
          {active.length === 0 ? (
            <Empty />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi label="Meta consolidada" value={`${fmt(totals.target)} t`} />
                <Kpi
                  label="Projeção 24h (real + pátio)"
                  value={`${fmt(totals.projection)} t`}
                  tone={totals.projection >= totals.target ? "ok" : "critical"}
                />
                <Kpi label="Estoque inicial do pátio" value={`${fmt(totals.yard)} t`} />
                <Kpi label="Tonelagem perdida" value={`${fmt(totals.lost)} t`} tone="risk" />
              </div>

              {active.map(({ unit, metrics }) => (
                <ReportCard key={unit.id} unit={unit} metrics={metrics} daily />
              ))}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReportCard({
  unit,
  metrics,
  daily = false,
}: {
  unit: Unit;
  metrics: UnitMetrics;
  daily?: boolean;
}) {
  const status = statusOf(metrics.compliance, true);
  const Icon = status === "ok" ? CheckCircle2 : status === "risk" ? AlertTriangle : ShieldAlert;
  const cls =
    status === "ok" ? "text-success" : status === "risk" ? "text-warning" : "text-destructive";
  const border =
    status === "ok" ? "border-success/40" : status === "risk" ? "border-warning/40" : "border-destructive/40";
  const statusText =
    status === "ok" ? "Aderente" : status === "risk" ? "Atenção" : "Crítico";

  return (
    <article className="overflow-hidden rounded-xl border border-border/70 bg-background/40">
      {/* Header block */}
      <header className="flex flex-wrap items-center gap-3 border-b border-border/70 bg-secondary/30 px-6 py-4">
        <div>
          <h4 className="font-display text-base font-semibold">{unit.name}</h4>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
            <Clock4 className="h-3 w-3" />
            {metrics.hourLabels[0]} — {metrics.hourLabels[metrics.hourLabels.length - 1]} ·{" "}
            {metrics.activeHours} h monitoradas
          </p>
        </div>
        <span
          className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${border} ${cls}`}
        >
          <Icon className="h-3.5 w-3.5" /> {statusText} · {fmt(metrics.compliance, 1)}%
        </span>
      </header>

      {/* Consolidated metrics grid */}
      <div className="grid gap-px bg-border/60 sm:grid-cols-2 xl:grid-cols-4">
        <Cell label="Real Despachado" value={`${fmt(metrics.realTrucks, 1)} conj.`} hint={`${fmt(metrics.realTonnes)} t`} />
        <Cell
          label="Potencial Planejado"
          value={`${fmt(metrics.potentialTrucks, 1)} conj.`}
          hint={`${fmt(metrics.potentialTonnes)} t`}
        />
        <Cell label="Aderência Global" value={`${fmt(metrics.compliance, 1)}%`} tone={status} />
        <Cell
          label="Ritmo Real de Moagem"
          value={`${fmt(metrics.realRatePerHour, 1)} t/h`}
          hint={`Massa realizada: ${fmt(metrics.totalRealTonnesDay)} t`}
        />
      </div>

      {daily ? (
        <div className="grid gap-px border-t border-border/60 bg-border/60 sm:grid-cols-3">
          <Cell label="Meta Diária" value={`${fmt(unit.dailyTarget)} t`} />
          <Cell
            label="Fechamento Projetado (24h + pátio)"
            value={`${fmt(metrics.projection24 + metrics.initialTonnes)} t`}
            hint={`${signed(metrics.targetDeltaReal)} t vs meta`}
            tone={metrics.targetDeltaReal >= 0 ? "ok" : "critical"}
          />
          <Cell
            label="Saldo do Planejamento"
            value={`${signed(metrics.planningBalance24)} t/dia`}
            hint="Potencial das frentes vs meta horária"
            tone={metrics.planningBalance24 >= 0 ? "ok" : "critical"}
          />
        </div>
      ) : null}

      {/* Performance loss table */}
      <div className="px-6 py-5">
        <h5 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Perdas por frente de trabalho
        </h5>
        <div className="mt-3 overflow-x-auto rounded-lg border border-border/70">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Frente</th>
                <th className="px-5 py-3 text-right font-medium">Produção × Meta</th>
                <th className="px-5 py-3 text-left font-medium">Aderência</th>
                <th className="px-5 py-3 text-right font-medium">Tonelagem Perdida</th>
                <th className="px-5 py-3 text-left font-medium">Justificativa</th>
              </tr>
            </thead>
            <tbody>
              {metrics.fronts.map((f) => (
                <FrontRow key={f.front.id} f={f} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </article>
  );
}

function FrontRow({ f }: { f: FrontMetrics }) {
  const deficit = f.delta < 0;
  const manual = f.front.justification?.trim();
  const tags = f.codes.map((c) => `${siglaLabel(c.code)} · ${c.hours.length}h`);
  return (
    <tr className="border-t border-border/60 align-middle">
      <td className="num px-5 py-4 font-semibold">{f.front.number}</td>
      <td className="num px-5 py-4 text-right">
        {fmt(f.real, 1)} <span className="text-muted-foreground">/ {fmt(f.potentialTotal, 1)}</span>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full rounded-full ${
                f.compliance >= 100 ? "bg-success" : f.compliance >= 90 ? "bg-warning" : "bg-destructive"
              }`}
              style={{ width: `${Math.min(100, Math.max(0, f.compliance))}%` }}
            />
          </div>
          <span className="num text-xs text-muted-foreground">{fmt(f.compliance, 1)}%</span>
        </div>
      </td>
      <td className="px-5 py-4 text-right">
        {deficit ? (
          <span className="num font-bold text-destructive">−{fmt(f.lostTonnes)} t</span>
        ) : (
          <span className="num text-success">0 t</span>
        )}
      </td>
      <td className="px-5 py-4">
        {tags.length > 0 || manual ? (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"
              >
                {t}
              </span>
            ))}
            {manual ? (
              <span className="rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px] text-muted-foreground">
                {manual}
              </span>
            ) : null}
          </div>
        ) : deficit ? (
          <span className="inline-flex items-center rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 text-[11px] font-medium text-warning">
            ⚠️ Justificativa Pendente
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> Sem perdas
          </span>
        )}
      </td>
    </tr>
  );
}

function Cell({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "ok" | "risk" | "critical" | "idle";
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
    <div className="bg-card px-6 py-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`num mt-2 font-display text-xl font-semibold ${cls}`}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
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
    <div className="rounded-lg border border-border/70 bg-background/40 p-5">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`num mt-2 font-display text-xl font-semibold ${cls}`}>{value}</p>
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
