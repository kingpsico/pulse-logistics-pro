import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Unit, UnitMetrics } from "@/lib/canepulse";
import { WEATHER_CODES, fmt, siglaLabel } from "@/lib/canepulse";

type Point = {
  hour: string;
  rate: number;
  stock3h: number;
  lowBuffer: boolean;
  codes: { front: string; code: string }[];
};


const SERIES_TOKENS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

/** Eixo temporal padrão 07h → 24h para benchmarking entre usinas. */
const BASE_AXIS = Array.from({ length: 18 }, (_, i) => `${String((i + 7) % 24).padStart(2, "0")}:00`);

const isWeather = (code: string) => WEATHER_CODES.includes(code.toUpperCase() as never);

/** Ritmo horário (t/h) com Meta/Potencial, sombreamento climático e comparação de usinas. */
export function HourlyRhythmChart({
  unit,
  metrics,
  allUnits = [],
}: {
  unit: Unit;
  metrics: UnitMetrics;
  allUnits?: Unit[];
}) {
  const [selected, setSelected] = useState("all");
  const [compare, setCompare] = useState(false);

  const comparableUnits = useMemo(
    () => allUnits.filter((u) => u.hours.length > 0 && u.fronts.length > 0),
    [allUnits],
  );
  const compareMode = compare && comparableUnits.length > 1;

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
    const buffer = metrics.hourlyTarget * 2;
    let cumulative = metrics.initialTonnes;
    let inflowSum = 0;
    return unit.hours.map((row, i) => {
      const rate = fronts.reduce((s, n) => s + (row.counts[n] ?? 0), 0) * density;
      inflowSum += rate;
      cumulative += rate - metaLine;
      const avgInflow = inflowSum / (i + 1);
      const stock3h = cumulative + (avgInflow - metaLine) * 3;
      return {
        hour: row.hour,
        rate,
        stock3h,
        lowBuffer: stock3h < buffer,
        codes: fronts.map((n) => ({ front: n, code: row.codes?.[n] ?? "" })).filter((c) => c.code),
      };
    });
  }, [unit, selected, metaLine, metrics.hourlyTarget, metrics.initialTonnes]);


  /** Eixo consolidado (07h→24h + horas extras vistas nas planilhas). */
  const axis = useMemo(() => {
    const seen = new Set<string>();
    comparableUnits.concat(unit).forEach((u) => u.hours.forEach((h) => seen.add(h.hour)));
    const extras = [...seen].filter((h) => !BASE_AXIS.includes(h)).sort();
    return [...BASE_AXIS, ...extras];
  }, [comparableUnits, unit]);

  const compareData = useMemo(
    () =>
      axis.map((hour) => {
        const point: Record<string, string | number | null> = { hour };
        comparableUnits.forEach((u) => {
          const row = u.hours.find((h) => h.hour === hour);
          point[u.id] = row
            ? u.fronts.reduce((s, f) => s + (row.counts[f.number] ?? 0), 0) * (u.density || 0)
            : null;
        });
        return point;
      }),
    [axis, comparableUnits],
  );

  /** Faixas horárias com códigos climáticos (CH, CDC, EN) nas frentes ativas. */
  const weatherBands = useMemo(() => {
    const source = compareMode ? comparableUnits : [unit];
    const axisRef = compareMode ? axis : data.map((d) => d.hour);
    const flagged = new Set<string>();
    source.forEach((u) => {
      const fronts =
        !compareMode && selected !== "all" ? [selected] : u.fronts.map((f) => f.number);
      u.hours.forEach((row) => {
        if (fronts.some((n) => isWeather(row.codes?.[n] ?? ""))) flagged.add(row.hour);
      });
    });
    return [...flagged]
      .filter((h) => axisRef.includes(h))
      .map((hour) => {
        const i = axisRef.indexOf(hour);
        const next: string = axisRef[i + 1] ?? hour;
        return { x1: hour, x2: next };
      });
  }, [compareMode, comparableUnits, unit, data, axis, selected]);

  const maxY = compareMode
    ? Math.max(
        1,
        ...compareData.flatMap((p) =>
          comparableUnits.map((u) => (typeof p[u.id] === "number" ? (p[u.id] as number) : 0)),
        ),
      )
    : Math.max(
        potentialLine,
        metaLine,
        ...data.map((d) => d.rate),
        ...data.map((d) => d.stock3h),
        1,
      );


  const bands = weatherBands.map((b) => (
    <ReferenceArea
      key={`weather-${b.x1}`}
      x1={b.x1}
      x2={b.x2}
      fill="var(--color-warning)"
      fillOpacity={0.12}
      stroke="none"
      ifOverflow="extendDomain"
    />
  ));

  return (
    <div className="surface-panel rounded-xl border border-border/70 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Activity className="h-4 w-4" />
        </span>
        <div>
          <h4 className="font-display text-sm font-semibold">Ritmo Horário de Moagem (t/h)</h4>
          <p className="text-[11px] text-muted-foreground">
            {compareMode
              ? "Benchmark entre usinas no eixo 07h → 24h. Faixas ambar = horas com clima/condição de canavial."
              : "Curva real por hora com Meta Horária e Potencial das Frentes como referência."}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-4">
          {comparableUnits.length > 1 ? (
            <div className="flex items-center gap-2">
              <Switch id={`cmp-${unit.id}`} checked={compare} onCheckedChange={setCompare} />
              <Label htmlFor={`cmp-${unit.id}`} className="text-[11px] text-muted-foreground">
                Comparar Unidades
              </Label>
            </div>
          ) : null}
          {!compareMode ? (
            <div className="w-full sm:w-56">
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
          ) : null}
        </div>
      </div>

      <div className="mt-5 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {compareMode ? (
            <LineChart data={compareData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="hour"
                stroke="var(--color-muted-foreground)"
                tick={{ fontSize: 10 }}
                tickLine={false}
                interval={0}
              />
              <YAxis
                stroke="var(--color-muted-foreground)"
                tick={{ fontSize: 11 }}
                tickLine={false}
                domain={[0, Math.ceil(maxY * 1.15)]}
                width={52}
              />
              {bands}
              <Tooltip
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 10,
                  fontSize: 12,
                }}
                formatter={(value: number) => `${fmt(value, 1)} t/h`}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {comparableUnits.map((u, i) => (
                <Line
                  key={u.id}
                  type="monotone"
                  dataKey={u.id}
                  name={u.name}
                  stroke={SERIES_TOKENS[i % SERIES_TOKENS.length]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          ) : (
            <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
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
              {bands}
              <Tooltip
                content={
                  <RhythmTooltip
                    meta={metaLine}
                    potential={potentialLine}
                    buffer={metrics.hourlyTarget * 2}
                  />
                }
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
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
                name="Ritmo Real (t/h)"
                stroke="var(--color-chart-1)"
                strokeWidth={2}
                fill="url(#rhythmFill)"
                activeDot={{ r: 4, fill: "var(--color-chart-1)" }}
              />
              <Line
                type="monotone"
                dataKey="stock3h"
                name="Progressão de Estoque (+3h)"
                stroke="var(--color-chart-5)"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={<StockDot buffer={metrics.hourlyTarget * 2} />}
                activeDot={{ r: 4 }}
                connectNulls
              />
            </ComposedChart>

          )}
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
  const point = payload[0]?.payload;
  if (!point) return null;
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
