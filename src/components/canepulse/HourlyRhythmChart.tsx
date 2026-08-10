import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Unit, UnitMetrics } from "@/lib/canepulse";
import { fmt, siglaLabel } from "@/lib/canepulse";

type Point = { hour: string; rate: number; codes: { front: string; code: string }[] };

/** Ritmo horário (t/h) com linhas de referência de Meta e Potencial + tooltip com siglas. */
export function HourlyRhythmChart({ unit, metrics }: { unit: Unit; metrics: UnitMetrics }) {
  const [selected, setSelected] = useState("all");

  const potentialLine = useMemo(() => {
    if (selected === "all") return metrics.potentialRatePerHour;
    const front = unit.fronts.find((f) => f.number === selected);
    return (front?.potential || 0) * (unit.density || 0);
  }, [selected, unit, metrics.potentialRatePerHour]);

  const metaLine = useMemo(() => {
    if (selected === "all") return metrics.hourlyTarget;
    const totalPotential = unit.fronts.reduce((s, f) => s + (f.potential || 0), 0);
    const front = unit.fronts.find((f) => f.number === selected);
    if (!totalPotential || !front) return 0;
    return metrics.hourlyTarget * ((front.potential || 0) / totalPotential);
  }, [selected, unit.fronts, metrics.hourlyTarget]);

  const data: Point[] = useMemo(() => {
    const density = unit.density || 0;
    const fronts = selected === "all" ? unit.fronts.map((f) => f.number) : [selected];
    return unit.hours.map((row) => ({
      hour: row.hour,
      rate: fronts.reduce((s, n) => s + (row.counts[n] ?? 0), 0) * density,
      codes: fronts
        .map((n) => ({ front: n, code: row.codes?.[n] ?? "" }))
        .filter((c) => c.code),
    }));
  }, [unit, selected]);

  const maxY = Math.max(potentialLine, metaLine, ...data.map((d) => d.rate), 1);

  return (
    <div className="surface-panel rounded-xl border border-border/70 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Activity className="h-4 w-4" />
        </span>
        <div>
          <h4 className="font-display text-sm font-semibold">Ritmo Horário de Moagem (t/h)</h4>
          <p className="text-[11px] text-muted-foreground">
            Curva real por hora com Meta Horária e Potencial das Frentes como referência.
          </p>
        </div>
        <div className="ml-auto w-full sm:w-56">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger>
              <SelectValue placeholder="Seletor de Frente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Consolidado da Usina</SelectItem>
              {unit.fronts.map((f) => (
                <SelectItem key={f.id} value={f.number}>
                  Frente {f.number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-5 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="rhythmFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="hour"
              stroke="var(--color-muted-foreground)"
              tick={{ fontSize: 11 }}
              tickLine={false}
            />
            <YAxis
              stroke="var(--color-muted-foreground)"
              tick={{ fontSize: 11 }}
              tickLine={false}
              domain={[0, Math.ceil(maxY * 1.15)]}
              width={52}
            />
            <Tooltip content={<RhythmTooltip meta={metaLine} potential={potentialLine} />} />
            <ReferenceLine
              y={metaLine}
              stroke="var(--color-chart-2)"
              strokeDasharray="6 4"
              label={{
                value: `Meta ${fmt(metaLine, 1)} t/h`,
                position: "insideTopLeft",
                fill: "var(--color-chart-2)",
                fontSize: 10,
              }}
            />
            <ReferenceLine
              y={potentialLine}
              stroke="var(--color-chart-1)"
              strokeDasharray="2 4"
              label={{
                value: `Potencial ${fmt(potentialLine, 1)} t/h`,
                position: "insideBottomLeft",
                fill: "var(--color-chart-1)",
                fontSize: 10,
              }}
            />
            <Area
              type="monotone"
              dataKey="rate"
              stroke="var(--color-chart-1)"
              strokeWidth={2}
              fill="url(#rhythmFill)"
              activeDot={{ r: 4, fill: "var(--color-chart-1)" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function RhythmTooltip({
  active,
  payload,
  label,
  meta,
  potential,
}: {
  active?: boolean;
  payload?: { payload: Point }[];
  label?: string;
  meta: number;
  potential: number;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const below = point.rate < meta;

  return (
    <div className="rounded-lg border border-border/70 bg-card/95 px-3 py-2.5 shadow-lg backdrop-blur">
      <p className="font-display text-xs font-semibold">{label}</p>
      <p className="num mt-1 text-sm font-semibold text-chart-1">{fmt(point.rate, 1)} t/h</p>
      <p className="num mt-0.5 text-[11px] text-muted-foreground">
        Meta {fmt(meta, 1)} · Potencial {fmt(potential, 1)} t/h
      </p>
      {below ? (
        <p className="num mt-1 text-[11px] font-medium text-destructive">
          −{fmt(meta - point.rate, 1)} t/h vs meta
        </p>
      ) : (
        <p className="mt-1 text-[11px] font-medium text-success">Acima da meta horária</p>
      )}
      {point.codes.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {point.codes.map((c) => (
            <span
              key={`${c.front}-${c.code}`}
              className="rounded-full border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning"
            >
              {c.front}: {c.code} · {siglaLabel(c.code)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
