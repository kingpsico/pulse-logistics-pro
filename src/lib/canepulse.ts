export type Front = {
  id: string;
  number: string;
  potential: number; // conjuntos per hour (float, 1 decimal)
  justification?: string;
};

export type HourRow = {
  hour: string; // e.g. "06:00"
  counts: Record<string, number>; // front number -> trucks dispatched
  codes?: Record<string, string>; // front number -> operational sigla (CH, FC, ...)
};

/** Raw OCR extraction awaiting human review before it is merged into the live state. */
export type PendingRow = { hour: string; cells: Record<string, string> };
export type PendingImport = {
  rows: PendingRow[];
  fronts: string[]; // every front number seen in the sheet
  at: string;
};

export type Unit = {
  id: string;
  name: string;
  dailyTarget: number; // tonnes / day
  density: number; // tonnes per truck (or t/m3)
  initialStock: number; // conjuntos already in the yard at the start
  fronts: Front[];
  hours: HourRow[];
  ignoredFronts: string[];
  lastImport?: string;
  pendingImport?: PendingImport | null;
};


/** Operational siglas: cell contains a code instead of a number → delivery = 0 + auto justification. */
export const SIGLAS: Record<string, { icon: string; label: string }> = {
  CH: { icon: "🌧️", label: "Clima" },
  FC: { icon: "🚛", label: "Falta de Caminhão" },
  MC: { icon: "⚙️", label: "Manut. Colhedora" },
  MCJ: { icon: "⚙️", label: "Manut. Conjuntos" },
  MT: { icon: "⚙️", label: "Manut. Tratores" },
  MP: { icon: "⚙️", label: "Manut. Pipa" },
  MF: { icon: "🕒", label: "Mudança de Frente" },
  MCC: { icon: "⚙️", label: "Manut. Caminhão" },
  TT: { icon: "🛑", label: "Trajeto Trancado" },
  DM: { icon: "🗺️", label: "Distância do malhador" },
  EN: { icon: "🚜", label: "Encalhado" },
  IUP: { icon: "🏭", label: "Ind. Usina Parada" },
  IMR: { icon: "🏭", label: "Moagem Reduzida" },
  FCJ: { icon: "🚛", label: "Falta de Conjunto" },
  CDC: { icon: "🌱", label: "Condição do Canavial" },
  MDB: { icon: "🗺️", label: "Mudança de Bloco" },
  TDT: { icon: "🕒", label: "Troca de Turno" },
  AGP: { icon: "💦", label: "Aguardando Pipa" },
  SO: { icon: "👥", label: "Sem Operador" },
  MET: { icon: "🗺️", label: "Motorista Errou Trajeto" },
  APE: { icon: "🕒", label: "Aguardando Ponto de Encontro" },
  FDV: { icon: "🗺️", label: "Frente dividida" },
  ADE: { icon: "🚜", label: "Abertura de Eito" },
  CBV: { icon: "🚛", label: "Carregando bate e volta" },
};

export const siglaLabel = (code: string) => {
  const entry = SIGLAS[code.toUpperCase()];
  return entry ? `${entry.icon} ${entry.label}` : code;
};

/** Weather/field-condition codes that shade the rhythm chart. */
export const WEATHER_CODES = ["CH", "CDC", "EN"] as const;

const NUMBER_RE = /\d+(?:[.,]\d+)?/;
const LETTERS_RE = /[A-Z]+/g;

/**
 * Normalizes a raw OCR cell into a numeric delivery and/or a sigla code.
 * Supports mixed cells such as "1 | CH", "2 - FC", "1 MC", "CH 1".
 */
export function readCell(raw: unknown): { value: number; code?: string } {
  if (typeof raw === "number") return { value: Number.isFinite(raw) ? raw : 0 };
  const text = String(raw ?? "").trim();
  if (!text || /^[-–—\s|/]+$/.test(text)) return { value: 0 };

  const upper = text.toUpperCase();
  const groups = upper.match(LETTERS_RE) ?? [];
  const known = groups.filter((g) => SIGLAS[g]);
  const code =
    known.sort((a, b) => b.length - a.length)[0] ??
    groups.sort((a, b) => b.length - a.length)[0];

  const numMatch = upper.match(NUMBER_RE);
  const value = numMatch ? Number(numMatch[0].replace(",", ".")) : 0;

  return { value: Number.isFinite(value) ? value : 0, ...(code ? { code } : {}) };
}

/** Review heuristic: classifies a raw OCR cell for the post-OCR verification grid. */
export function cellStatus(raw: string): "number" | "sigla" | "mixed" | "empty" | "suspect" {
  const text = String(raw ?? "").trim();
  if (!text || /^[-–—\s|/]+$/.test(text)) return "empty";

  const upper = text.toUpperCase();
  const groups = upper.match(LETTERS_RE) ?? [];
  const hasKnown = groups.some((g) => SIGLAS[g]);
  const hasUnknownLetters = groups.some((g) => !SIGLAS[g]);
  const hasNumber = NUMBER_RE.test(upper);

  if (hasUnknownLetters) return "suspect";
  if (hasKnown && hasNumber) return "mixed";
  if (hasKnown) return "sigla";
  if (hasNumber) return /^[0-9.,\s]+$/.test(text) ? "number" : "suspect";
  return "suspect";
}

export const newId = () => Math.random().toString(36).slice(2, 10);


export const emptyUnit = (index: number): Unit => ({
  id: newId(),
  name: `Unidade ${index + 1}`,
  dailyTarget: 0,
  density: 0,
  initialStock: 0,
  fronts: [],
  hours: [],
  ignoredFronts: [],
  pendingImport: null,

});

export type FrontMetrics = {
  front: Front;
  real: number;
  potentialTotal: number;
  delta: number;
  compliance: number;
  realTonnes: number;
  lostTonnes: number;
  codes: { code: string; hours: string[] }[];
  autoJustification: string;
};

export type UnitMetrics = {
  activeHours: number;
  hourLabels: string[];
  fronts: FrontMetrics[];
  realTrucks: number;
  potentialTrucks: number;
  realTonnes: number;
  potentialTonnes: number;
  initialTonnes: number;
  totalRealTonnesDay: number;
  realRatePerHour: number; // t/h
  potentialRatePerHour: number; // t/h
  hourlyTarget: number; // t/h target = dailyTarget / 24
  planningBalance24: number; // (potential t/h - target t/h) * 24
  deviationRealVsPotential: number; // potential t/h - real t/h
  projection24: number;
  potential24: number;
  targetDeltaReal: number;
  targetDeltaPotential: number;
  compliance: number;
  lostTonnes: number;
  hasData: boolean;
  /** Entrega total projetada = (real t/h × 24) + toneladas iniciais do pátio */
  projectedTotalDelivery: number;
  /** Déficit total = meta diária − entrega total projetada */
  totalDeficit: number;
  /** Horas de parada industrial previstas (0 se sem risco) */
  starvationHours: number;
  starvationLabel: string;
  starvationRisk: boolean;
};

/** Converte horas decimais em texto "Xh e Ymin". */
export function formatHoursMinutes(hours: number) {
  const total = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h e ${String(m).padStart(2, "0")}min`;
}


const safeDiv = (a: number, b: number) => (b > 0 ? a / b : 0);

export function computeUnitMetrics(unit: Unit): UnitMetrics {
  const activeHours = unit.hours.length;
  const registered = unit.fronts;
  const density = unit.density || 0;

  const fronts: FrontMetrics[] = registered.map((front) => {
    const real = unit.hours.reduce((sum, row) => sum + (row.counts[front.number] ?? 0), 0);
    const potentialTotal = (front.potential || 0) * activeHours;
    const delta = real - potentialTotal;

    const byCode = new Map<string, string[]>();
    unit.hours.forEach((row) => {
      const code = row.codes?.[front.number];
      if (!code) return;
      const list = byCode.get(code) ?? [];
      list.push(row.hour);
      byCode.set(code, list);
    });
    const codes = [...byCode.entries()].map(([code, hours]) => ({ code, hours }));

    return {
      front,
      real,
      potentialTotal,
      delta,
      compliance: safeDiv(real, potentialTotal) * 100,
      realTonnes: real * density,
      lostTonnes: Math.max(0, -delta) * density,
      codes,
      autoJustification: codes.map((c) => `${siglaLabel(c.code)} (${c.hours.length}h)`).join(" · "),
    };
  });

  const realTrucks = fronts.reduce((s, f) => s + f.real, 0);
  const potentialTrucks = fronts.reduce((s, f) => s + f.potentialTotal, 0);
  const realTonnes = realTrucks * density;
  const potentialTonnes = potentialTrucks * density;
  const initialTonnes = (unit.initialStock || 0) * density;
  const realRatePerHour = safeDiv(realTonnes, activeHours);
  const potentialHourlyTrucks = registered.reduce((s, f) => s + (f.potential || 0), 0);
  const potentialRatePerHour = potentialHourlyTrucks * density;
  const projection24 = realRatePerHour * 24;
  const potential24 = potentialRatePerHour * 24;
  const hourlyTarget = (unit.dailyTarget || 0) / 24;

  return {
    activeHours,
    hourLabels: unit.hours.map((h) => h.hour),
    fronts,
    realTrucks,
    potentialTrucks,
    realTonnes,
    potentialTonnes,
    initialTonnes,
    totalRealTonnesDay: initialTonnes + realTonnes,
    realRatePerHour,
    potentialRatePerHour,
    hourlyTarget,
    planningBalance24: (potentialRatePerHour - hourlyTarget) * 24,
    deviationRealVsPotential: potentialRatePerHour - realRatePerHour,
    projection24,
    potential24,
    targetDeltaReal: initialTonnes + projection24 - (unit.dailyTarget || 0),
    targetDeltaPotential: initialTonnes + potential24 - (unit.dailyTarget || 0),
    compliance: safeDiv(realTrucks, potentialTrucks) * 100,
    lostTonnes: fronts.reduce((s, f) => s + f.lostTonnes, 0),
    hasData: activeHours > 0 && registered.length > 0,
  };
}

export const fmt = (value: number, digits = 0) =>
  Number.isFinite(value)
    ? value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : "0";

export const signed = (value: number, digits = 0) =>
  `${value >= 0 ? "+" : "−"}${fmt(Math.abs(value), digits)}`;

export const statusOf = (compliance: number, hasData: boolean) => {
  if (!hasData) return "idle" as const;
  if (compliance >= 100) return "ok" as const;
  if (compliance >= 90) return "risk" as const;
  return "critical" as const;
};
