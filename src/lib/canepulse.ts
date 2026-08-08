export type Front = {
  id: string;
  number: string;
  potential: number; // trucks per hour
  justification?: string;
};

export type HourRow = {
  hour: string; // e.g. "06:00"
  counts: Record<string, number>; // front number -> trucks dispatched
};

export type Unit = {
  id: string;
  name: string;
  dailyTarget: number; // tonnes / day
  density: number; // tonnes per truck (or t/m3)
  fronts: Front[];
  hours: HourRow[];
  ignoredFronts: string[];
  lastImport?: string;
};

export const newId = () => Math.random().toString(36).slice(2, 10);

export const emptyUnit = (index: number): Unit => ({
  id: newId(),
  name: `Unidade ${index + 1}`,
  dailyTarget: 0,
  density: 0,
  fronts: [],
  hours: [],
  ignoredFronts: [],
});

export type FrontMetrics = {
  front: Front;
  real: number;
  potentialTotal: number;
  delta: number;
  compliance: number;
  realTonnes: number;
  lostTonnes: number;
};

export type UnitMetrics = {
  activeHours: number;
  hourLabels: string[];
  fronts: FrontMetrics[];
  realTrucks: number;
  potentialTrucks: number;
  realTonnes: number;
  potentialTonnes: number;
  realRatePerHour: number; // t/h
  potentialRatePerHour: number; // t/h
  projection24: number;
  potential24: number;
  targetDeltaReal: number;
  targetDeltaPotential: number;
  compliance: number;
  hasData: boolean;
};

const safeDiv = (a: number, b: number) => (b > 0 ? a / b : 0);

export function computeUnitMetrics(unit: Unit): UnitMetrics {
  const activeHours = unit.hours.length;
  const registered = unit.fronts;

  const fronts: FrontMetrics[] = registered.map((front) => {
    const real = unit.hours.reduce((sum, row) => sum + (row.counts[front.number] ?? 0), 0);
    const potentialTotal = (front.potential || 0) * activeHours;
    const delta = real - potentialTotal;
    return {
      front,
      real,
      potentialTotal,
      delta,
      compliance: safeDiv(real, potentialTotal) * 100,
      realTonnes: real * (unit.density || 0),
      lostTonnes: Math.max(0, -delta) * (unit.density || 0),
    };
  });

  const realTrucks = fronts.reduce((s, f) => s + f.real, 0);
  const potentialTrucks = fronts.reduce((s, f) => s + f.potentialTotal, 0);
  const density = unit.density || 0;
  const realTonnes = realTrucks * density;
  const potentialTonnes = potentialTrucks * density;
  const realRatePerHour = safeDiv(realTonnes, activeHours);
  const potentialHourlyTrucks = registered.reduce((s, f) => s + (f.potential || 0), 0);
  const potentialRatePerHour = potentialHourlyTrucks * density;
  const projection24 = realRatePerHour * 24;
  const potential24 = potentialRatePerHour * 24;

  return {
    activeHours,
    hourLabels: unit.hours.map((h) => h.hour),
    fronts,
    realTrucks,
    potentialTrucks,
    realTonnes,
    potentialTonnes,
    realRatePerHour,
    potentialRatePerHour,
    projection24,
    potential24,
    targetDeltaReal: projection24 - (unit.dailyTarget || 0),
    targetDeltaPotential: potential24 - (unit.dailyTarget || 0),
    compliance: safeDiv(realTrucks, potentialTrucks) * 100,
    hasData: activeHours > 0 && registered.length > 0,
  };
}

export const fmt = (value: number, digits = 0) =>
  Number.isFinite(value)
    ? value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : "0";

export const statusOf = (compliance: number, hasData: boolean) => {
  if (!hasData) return "idle" as const;
  if (compliance >= 100) return "ok" as const;
  if (compliance >= 90) return "risk" as const;
  return "critical" as const;
};
