import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  Clock4,
  Gauge,
  LineChart,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import type { Unit, UnitMetrics } from "@/lib/canepulse";
import { fmt, signed, siglaLabel, statusOf } from "@/lib/canepulse";

type Props = {
  unit: Unit;
  metrics: UnitMetrics;
  onJustify: (frontId: string, text: string) => void;
};

export function UnitAnalytics({ unit, metrics, onJustify }: Props) {
  if (!metrics.hasData) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
        Cadastre frentes e importe a planilha de {unit.name} para liberar os indicadores.
      </div>
    );
  }

  const status = statusOf(metrics.compliance, metrics.hasData);

  return (
    <div className="space-y-5">
      {/* Meta vs Potencial vs Real */}
      <div className="surface-panel overflow-hidden rounded-xl border border-primary/30">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-primary/5 px-5 py-3">
          <Target className="h-4 w-4 text-primary" />
          <h4 className="font-display text-sm font-semibold">Meta × Potencial × Real</h4>
          <span className="ml-auto text-[11px] uppercase tracking-wider text-muted-foreground">
            Janela: {metrics.activeHours} h
          </span>
        </div>
        <div className="grid gap-px bg-border/60 sm:grid-cols-2 xl:grid-cols-5">
          <MatrixCell
            label="Meta Horária"
            value={`${fmt(metrics.hourlyTarget, 1)} t/h`}
            hint={`${fmt(unit.dailyTarget)} t/dia ÷ 24`}
          />
          <MatrixCell
            label="Potencial das Frentes"
            value={`${fmt(metrics.potentialRatePerHour, 1)} t/h`}
            hint={`${fmt(
              unit.fronts.reduce((s, f) => s + (f.potential || 0), 0),
              1,
            )} conj./h × ${fmt(unit.density, 2)} t`}
            tone={metrics.potentialRatePerHour >= metrics.hourlyTarget ? "ok" : "critical"}
          />
          <MatrixCell
            label="Real das Frentes"
            value={`${fmt(metrics.realRatePerHour, 1)} t/h`}
            hint={`${fmt(metrics.realTrucks / Math.max(1, metrics.activeHours), 1)} conj./h médios`}
            tone={metrics.realRatePerHour >= metrics.hourlyTarget ? "ok" : "risk"}
          />
          <MatrixCell
            label="Saldo do Planejamento Diário"
            value={`${signed(metrics.planningBalance24)} t/dia`}
            hint="(Potencial − Meta) × 24"
            tone={metrics.planningBalance24 >= 0 ? "ok" : "critical"}
            arrow={metrics.planningBalance24 >= 0 ? "up" : "down"}
          />
          <MatrixCell
            label="Desvio Real vs Potencial"
            value={`${signed(-metrics.deviationRealVsPotential, 1)} t/h`}
            hint={`Perda de campo: ${fmt(Math.max(0, metrics.deviationRealVsPotential) * 24)} t/dia`}
            tone={metrics.deviationRealVsPotential <= 0 ? "ok" : "critical"}
            arrow={metrics.deviationRealVsPotential <= 0 ? "up" : "down"}
          />
        </div>
        <div className="border-t border-border/70 px-5 py-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Real sobre potencial disponível</span>
            <span className="num font-semibold text-foreground">{fmt(metrics.compliance, 1)}%</span>
          </div>
          <Progress value={Math.min(100, metrics.compliance)} className="mt-2 h-2" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={<Gauge className="h-4 w-4" />}
          label="Moagem Real (t/h)"
          value={fmt(metrics.realRatePerHour, 1)}
          hint={`${fmt(metrics.realTrucks, 1)} conj. × ${fmt(unit.density, 2)} t ÷ ${metrics.activeHours} h`}
        />
        <Metric
          icon={<LineChart className="h-4 w-4" />}
          label="Projeção 24h (Real)"
          value={fmt(metrics.projection24)}
          hint={`+ pátio ${fmt(metrics.initialTonnes)} t · Meta ${fmt(unit.dailyTarget)} t`}
          tone={metrics.targetDeltaReal >= 0 ? "ok" : "critical"}
        />
        <Metric
          icon={<Boxes className="h-4 w-4" />}
          label="Massa Realizada (t)"
          value={fmt(metrics.totalRealTonnesDay)}
          hint={`Pátio ${fmt(metrics.initialTonnes)} t + frentes ${fmt(metrics.realTonnes)} t`}
        />
        <Metric
          icon={<Clock4 className="h-4 w-4" />}
          label="Janela Analisada"
          value={`${metrics.activeHours} h`}
          hint={metrics.hourLabels.join(" · ")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Potencial vs Real — Período" icon={<TrendingUp className="h-4 w-4" />}>
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Potencial (conj.)" value={fmt(metrics.potentialTrucks, 1)} />
            <Stat label="Real (conj.)" value={fmt(metrics.realTrucks, 1)} />
            <Stat label="Potencial (t)" value={fmt(metrics.potentialTonnes)} />
            <Stat label="Real (t)" value={fmt(metrics.realTonnes)} />
          </div>
          <StatusBadge status={status} />
        </Panel>

        <Panel title="Fechamento do Dia vs Meta" icon={<Target className="h-4 w-4" />}>
          <BalanceRow
            label="Se todas as frentes operarem no potencial (24h + pátio)"
            value={metrics.targetDeltaPotential}
          />
          <BalanceRow
            label="Tendência real projetada para 24h (+ pátio)"
            value={metrics.targetDeltaReal}
          />
          <p className="mt-4 text-xs text-muted-foreground">
            Meta da unidade: <span className="num text-foreground">{fmt(unit.dailyTarget)} t</span> ·
            Toneladas iniciais do pátio:{" "}
            <span className="num text-foreground">{fmt(metrics.initialTonnes)} t</span>
          </p>
        </Panel>
      </div>

      <Panel title="Desempenho por Frente (Potencial vs Real)" icon={<Gauge className="h-4 w-4" />}>
        <div className="space-y-3">
          {metrics.fronts.map((f) => {
            const deficit = f.delta < 0;
            return (
              <div
                key={f.front.id}
                className={`rounded-lg border p-3 ${
                  deficit ? "border-destructive/50 bg-destructive/10" : "border-border/70 bg-background/40"
                }`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="num font-display text-sm font-semibold">
                    Frente {f.front.number}
                  </span>
                  <Badge
                    variant="outline"
                    className={
                      deficit ? "border-destructive/50 text-destructive" : "border-success/50 text-success"
                    }
                  >
                    {deficit ? (
                      <TrendingDown className="mr-1 h-3 w-3" />
                    ) : (
                      <TrendingUp className="mr-1 h-3 w-3" />
                    )}
                    {fmt(f.compliance, 1)}%
                  </Badge>
                  <span className="num text-xs text-muted-foreground">
                    Potencial {fmt(f.potentialTotal, 1)} · Real {fmt(f.real, 1)} · Δ {fmt(f.delta, 1)} conj.
                  </span>
                  <span className="num ml-auto text-xs text-muted-foreground">
                    {deficit ? `Perda: ${fmt(f.lostTonnes)} t` : `Entregue: ${fmt(f.realTonnes)} t`}
                  </span>
                </div>
                {f.codes.length > 0 ? (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {f.codes.map((c) => (
                      <span
                        key={c.code}
                        className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning"
                      >
                        {siglaLabel(c.code)} · {c.hours.length}h
                      </span>
                    ))}
                  </div>
                ) : null}
                {deficit ? (
                  <div className="mt-3">
                    <label className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-warning">
                      <AlertTriangle className="h-3.5 w-3.5" /> Justificativa
                      {f.codes.length > 0 ? " complementar" : " obrigatória"}
                    </label>
                    <Textarea
                      value={f.front.justification ?? ""}
                      onChange={(e) => onJustify(f.front.id, e.target.value)}
                      placeholder={
                        f.codes.length > 0
                          ? `Auto: ${f.autoJustification}`
                          : "Ex.: chuva na frente, manutenção corretiva, falta de operador…"
                      }
                      className="mt-1.5 min-h-[64px] text-sm"
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function MatrixCell({
  label,
  value,
  hint,
  tone = "neutral",
  arrow,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "ok" | "risk" | "critical";
  arrow?: "up" | "down";
}) {
  const toneClass =
    tone === "ok"
      ? "text-success"
      : tone === "risk"
        ? "text-warning"
        : tone === "critical"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="bg-card px-5 py-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`num mt-2 flex items-center gap-1 font-display text-xl font-semibold ${toneClass}`}>
        {arrow === "up" ? <ArrowUpRight className="h-4 w-4" /> : null}
        {arrow === "down" ? <ArrowDownRight className="h-4 w-4" /> : null}
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  hint,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "ok" | "risk" | "critical";
}) {
  const toneClass =
    tone === "ok"
      ? "text-success"
      : tone === "risk"
        ? "text-warning"
        : tone === "critical"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="surface-panel rounded-xl border border-border/70 p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <p className={`num mt-2 font-display text-2xl font-semibold ${toneClass}`}>{value}</p>
      {hint ? <p className="mt-1 truncate text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="surface-panel rounded-xl border border-border/70 p-5">
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-primary">{icon}</span>
        {title}
      </h4>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="num mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function BalanceRow({ label, value }: { label: string; value: number }) {
  const positive = value >= 0;
  return (
    <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`num text-sm font-semibold ${positive ? "text-success" : "text-destructive"}`}
      >
        {signed(value)} t
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: "idle" | "ok" | "risk" | "critical" }) {
  if (status === "idle") return null;
  const map = {
    ok: { icon: CheckCircle2, text: "Operação aderente ao potencial", cls: "text-success" },
    risk: { icon: AlertTriangle, text: "Risco: perda parcial de ritmo", cls: "text-warning" },
    critical: { icon: AlertTriangle, text: "Crítico: déficit relevante de entrega", cls: "text-destructive" },
  } as const;
  const { icon: Icon, text, cls } = map[status];
  return (
    <p className={`mt-4 flex items-center gap-2 text-xs font-medium ${cls}`}>
      <Icon className="h-4 w-4" /> {text}
    </p>
  );
}
