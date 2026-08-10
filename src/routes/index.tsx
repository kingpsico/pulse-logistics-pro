import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Factory, Layers, Plus, Target } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TopBar } from "@/components/canepulse/TopBar";
import { UnitPanel } from "@/components/canepulse/UnitPanel";
import { UnitAnalytics } from "@/components/canepulse/UnitAnalytics";
import { ReportsPanel } from "@/components/canepulse/ReportsPanel";
import type { Unit } from "@/lib/canepulse";
import { computeUnitMetrics, emptyUnit, fmt } from "@/lib/canepulse";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CanePulse — Logística Canavieira e Otimização de Moagem" },
      {
        name: "description",
        content:
          "Painel enterprise para gestão de frentes de trabalho, leitura de planilhas por Vision AI e projeção de moagem em tempo real.",
      },
      { property: "og:title", content: "CanePulse — Otimização de Moagem" },
      {
        property: "og:description",
        content:
          "Monitore potencial vs entrega real das frentes, ritmo de moagem (t/h) e fechamento projetado de 24h.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CanePulse,
});

const STORAGE_KEY = "canepulse:state:v1";
const TAB_KEY = "canepulse:tab:v1";
const AUTH_KEY = "canepulse:admin:v1";

function CanePulse() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [tab, setTab] = useState("setup");
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Unit[]) : [emptyUnit(0)];
      setUnits(parsed.map((u) => ({ ...emptyUnit(0), ...u })));
      const savedTab = localStorage.getItem(TAB_KEY);
      if (savedTab) setTab(savedTab);
      setAdminAuthed(localStorage.getItem(AUTH_KEY) === "1");
    } catch {
      setUnits([emptyUnit(0)]);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(units));
  }, [units, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(TAB_KEY, tab);
  }, [tab, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(AUTH_KEY, adminAuthed ? "1" : "0");
  }, [adminAuthed, hydrated]);


  const patchUnit = (id: string, patch: Partial<Unit>) =>
    setUnits((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));

  const justify = (unitId: string, frontId: string, text: string) =>
    setUnits((prev) =>
      prev.map((u) =>
        u.id === unitId
          ? {
              ...u,
              fronts: u.fronts.map((f) => (f.id === frontId ? { ...f, justification: text } : f)),
            }
          : u,
      ),
    );

  const groupTarget = useMemo(
    () => units.reduce((sum, u) => sum + (u.dailyTarget || 0), 0),
    [units],
  );
  const groupFronts = useMemo(() => units.reduce((s, u) => s + u.fronts.length, 0), [units]);
  const groupProjection = useMemo(
    () =>
      units.reduce((s, u) => {
        const m = computeUnitMetrics(u);
        return s + m.projection24 + m.initialTonnes;
      }, 0),
    [units],
  );

  return (
    <div className="min-h-screen">
      <TopBar />
      <Toaster />

      <main className="mx-auto max-w-[1600px] px-5 pb-20 pt-8">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto flex-wrap gap-1 p-1">
            <TabsTrigger value="setup">Setup</TabsTrigger>
            <TabsTrigger value="feed">Abastecimento e Visão</TabsTrigger>
            <TabsTrigger value="analytics">Motor Analítico</TabsTrigger>
            <TabsTrigger value="reports">Relatório</TabsTrigger>
            <TabsTrigger value="admin">🔒 Central Suprema Admin</TabsTrigger>
          </TabsList>


          <TabsContent value="setup" className="mt-8">
            <h1 className="font-display text-2xl font-semibold">
              Controle operacional de{" "}
              <span className="text-gradient-primary">moagem e logística</span>
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
              Configure até 7 unidades industriais com até 8 frentes cada, informe o estoque inicial do
              pátio e acompanhe o fechamento projetado do dia.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <SummaryCard
                icon={<Target className="h-4 w-4" />}
                label="Meta Global do Grupo (t/dia)"
                value={fmt(groupTarget)}
                highlight
              />
              <SummaryCard
                icon={<Factory className="h-4 w-4" />}
                label="Unidades ativas"
                value={`${units.length}/7`}
              />
              <SummaryCard
                icon={<Layers className="h-4 w-4" />}
                label="Projeção 24h do grupo (t)"
                value={fmt(groupProjection)}
                hint={`${groupFronts} frentes cadastradas`}
              />
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <h2 className="font-display text-lg font-semibold">Unidades industriais</h2>
              <Button
                className="ml-auto"
                disabled={units.length >= 7}
                onClick={() => setUnits((prev) => [...prev, emptyUnit(prev.length)])}
              >
                <Plus className="h-4 w-4" /> Adicionar Unidade
              </Button>
            </div>

            <div className="mt-4 space-y-6">
              {units.map((unit, index) => (
                <UnitPanel
                  key={unit.id}
                  unit={unit}
                  index={index}
                  onChange={(patch) => patchUnit(unit.id, patch)}
                  onRemove={() => setUnits((prev) => prev.filter((u) => u.id !== unit.id))}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="feed" className="mt-8 space-y-6">
            <div>
              <h2 className="font-display text-lg font-semibold">Abastecimento e Visão</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Cadastre frentes com potencial decimal (ex.: 1.8 conj./h) e importe o print da matriz
                horária. Siglas operacionais (CH, FC, MC…) contam 0 conjunto e geram justificativa
                automática.
              </p>
            </div>
            {units.map((unit, index) => (
              <UnitPanel
                key={unit.id}
                unit={unit}
                index={index}
                onChange={(patch) => patchUnit(unit.id, patch)}
                onRemove={() => setUnits((prev) => prev.filter((u) => u.id !== unit.id))}
              />
            ))}
          </TabsContent>

          <TabsContent value="analytics" className="mt-8 space-y-10">
            {units.map((unit) => (
              <div key={unit.id} className="space-y-4">
                <h2 className="font-display text-lg font-semibold">{unit.name}</h2>
                <UnitAnalytics
                  unit={unit}
                  metrics={computeUnitMetrics(unit)}
                  onJustify={(frontId, text) => justify(unit.id, frontId, text)}
                />
              </div>
            ))}
          </TabsContent>

          <TabsContent value="reports" className="mt-8">
            <ReportsPanel units={units} />
          </TabsContent>

          <TabsContent value="admin" className="mt-8">
            <AdminCentral units={units} authed={adminAuthed} onAuthChange={setAdminAuthed} />
          </TabsContent>

        </Tabs>
      </main>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  hint,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`surface-panel rounded-xl border p-5 ${
        highlight ? "border-primary/40" : "border-border/70"
      }`}
    >
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <p className="num mt-2 font-display text-3xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
