import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Boxes,
  Building2,
  Gauge,
  ImageUp,
  Loader2,
  Plus,
  ScanSearch,
  Target,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { parseSpreadsheetImage } from "@/lib/vision.functions";
import type { Unit } from "@/lib/canepulse";
import { fmt, newId, readCell, siglaLabel } from "@/lib/canepulse";

type Props = {
  unit: Unit;
  index: number;
  onChange: (patch: Partial<Unit>) => void;
  onRemove: () => void;
};

export function UnitPanel({ unit, index, onChange, onRemove }: Props) {
  const parseImage = useServerFn(parseSpreadsheetImage);
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [frontNumber, setFrontNumber] = useState("");
  const [frontPotential, setFrontPotential] = useState("");

  const addFront = () => {
    if (!frontNumber.trim()) {
      toast.error("Informe o número da frente.");
      return;
    }
    if (unit.fronts.length >= 8) {
      toast.error("Limite de 8 frentes por unidade.");
      return;
    }
    if (unit.fronts.some((f) => f.number === frontNumber.trim())) {
      toast.error("Frente já cadastrada.");
      return;
    }
    onChange({
      fronts: [
        ...unit.fronts,
        {
          id: newId(),
          number: frontNumber.trim(),
          potential: Math.round((Number(frontPotential.replace(",", ".")) || 0) * 10) / 10,
        },
      ],
    });
    setFrontNumber("");
    setFrontPotential("");
  };

  const handleFile = async (file: File) => {
    if (unit.fronts.length === 0) {
      toast.error("Cadastre as frentes antes de importar a planilha.");
      return;
    }
    setLoading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read-error"));
        reader.readAsDataURL(file);
      });
      const result = await parseImage({
        data: { image: dataUrl, fronts: unit.fronts.map((f) => f.number) },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const seen: string[] = [];
      const rows = result.hours.map((row) => {
        const cells: Record<string, string> = {};
        Object.entries(row.counts).forEach(([front, value]) => {
          if (!seen.includes(front)) seen.push(front);
          cells[front] = String(value ?? "").trim();
        });
        return { hour: row.hour, cells };
      });
      onChange({
        pendingImport: {
          rows,
          fronts: seen.sort((a, b) => Number(a) - Number(b)),
          at: new Date().toLocaleString("pt-BR"),
        },
      });
      toast.success(`${rows.length} hora(s) extraída(s) — revise antes de fundir.`);

    } catch {
      toast.error("Erro ao processar a imagem.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="surface-panel rounded-xl border border-border/70 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Building2 className="h-4 w-4" />
        </span>
        <h3 className="font-display text-base font-semibold">Unidade {index + 1}</h3>
        {unit.lastImport ? (
          <Badge variant="outline" className="border-primary/40 text-primary">
            Planilha lida às {unit.lastImport}
          </Badge>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="ml-auto text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" /> Remover
        </Button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Nome da Unidade" icon={<Building2 className="h-3.5 w-3.5" />}>
          <Input value={unit.name} onChange={(e) => onChange({ name: e.target.value })} />
        </Field>
        <Field label="Meta de Moagem Diária (t)" icon={<Target className="h-3.5 w-3.5" />}>
          <Input
            type="number"
            min={0}
            value={unit.dailyTarget || ""}
            onChange={(e) => onChange({ dailyTarget: Number(e.target.value) || 0 })}
            placeholder="0"
            className="num"
          />
        </Field>
        <Field label="Carga Líquida Média (t/conj.)" icon={<Gauge className="h-3.5 w-3.5" />}>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={unit.density || ""}
            onChange={(e) => onChange({ density: Number(e.target.value) || 0 })}
            placeholder="0"
            className="num"
          />
        </Field>
        <Field label="Estoque Inicial do Pátio (Conjuntos)" icon={<Boxes className="h-3.5 w-3.5" />}>
          <Input
            type="number"
            min={0}
            step="1"
            value={unit.initialStock || ""}
            onChange={(e) => onChange({ initialStock: Number(e.target.value) || 0 })}
            placeholder="0"
            className="num"
          />
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Toneladas iniciais:{" "}
            <span className="num text-foreground">
              {fmt((unit.initialStock || 0) * (unit.density || 0))} t
            </span>
          </p>
        </Field>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Fronts */}
        <div className="rounded-lg border border-border/70 bg-background/40 p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Frentes de Trabalho</h4>
            <span className="text-[11px] text-muted-foreground">{unit.fronts.length}/8</span>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-[110px] flex-1">
              <Label className="text-[11px] text-muted-foreground">Número da Frente</Label>
              <Input
                value={frontNumber}
                onChange={(e) => setFrontNumber(e.target.value)}
                placeholder="86"
                className="num mt-1"
              />
            </div>
            <div className="min-w-[110px] flex-1">
              <Label className="text-[11px] text-muted-foreground">Potencial (conj./h)</Label>
              <Input
                type="number"
                min={0}
                step="0.1"
                inputMode="decimal"
                placeholder="1.8"
                value={frontPotential}
                onChange={(e) => setFrontPotential(e.target.value)}
                className="num mt-1"
              />
            </div>
            <Button onClick={addFront} className="shrink-0">
              <Plus className="h-4 w-4" /> Adicionar Frente
            </Button>
          </div>

          <div className="mt-4 overflow-hidden rounded-md border border-border/70">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Frente</th>
                  <th className="px-3 py-2 text-right">Potencial/h</th>
                  <th className="px-3 py-2 text-right">Potencial 24h (t)</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {unit.fronts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-xs text-muted-foreground">
                      Nenhuma frente cadastrada.
                    </td>
                  </tr>
                ) : (
                  unit.fronts.map((front) => (
                    <tr key={front.id} className="border-t border-border/60">
                      <td className="px-3 py-2 num font-medium">{front.number}</td>
                      <td className="px-3 py-2 num text-right">{fmt(front.potential, 1)}</td>
                      <td className="px-3 py-2 num text-right text-muted-foreground">
                        {fmt(front.potential * 24 * unit.density, 1)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() =>
                            onChange({ fronts: unit.fronts.filter((f) => f.id !== front.id) })
                          }
                          className="text-muted-foreground transition-colors hover:text-destructive"
                          aria-label={`Remover frente ${front.number}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Upload */}
        <div className="rounded-lg border border-border/70 bg-background/40 p-4">
          <h4 className="text-sm font-semibold">Leitura da Planilha (Vision AI)</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Envie o print da planilha horária (Horas × Frentes). Frentes não cadastradas são
            ignoradas automaticamente.
          </p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
            className="mt-3 flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 py-8 text-center transition-colors hover:bg-primary/10"
          >
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            ) : (
              <ImageUp className="h-6 w-6 text-primary" />
            )}
            <span className="text-sm font-medium">
              {loading ? "Processando OCR…" : "Clique ou arraste o screenshot"}
            </span>
            <span className="text-[11px] text-muted-foreground">PNG, JPG ou WEBP</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />

          {unit.ignoredFronts.length > 0 ? (
            <p className="mt-3 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Frentes ignoradas (não cadastradas): {unit.ignoredFronts.join(", ")}
            </p>
          ) : null}

          {unit.hours.length > 0 ? (
            <div className="mt-4 max-h-64 overflow-auto rounded-md border border-border/70">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-secondary/70 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 text-left">Hora</th>
                    {unit.fronts.map((f) => (
                      <th key={f.id} className="px-2 py-2 text-right num">
                        {f.number}
                      </th>
                    ))}
                    <th className="px-2 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {unit.hours.map((row, i) => (
                    <tr key={`${row.hour}-${i}`} className="border-t border-border/60">
                      <td className="px-2 py-1.5 font-medium">{row.hour}</td>
                      {unit.fronts.map((f) => {
                        const code = row.codes?.[f.number];
                        return (
                          <td key={f.id} className="px-2 py-1.5 text-right">
                            {code ? (
                              <span
                                title={siglaLabel(code)}
                                className="inline-flex items-center rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning"
                              >
                                {code}
                              </span>
                            ) : (
                              <span className="num">{fmt(row.counts[f.number] ?? 0, 1)}</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-2 py-1.5 num text-right text-primary">
                        {fmt(
                          unit.fronts.reduce((s, f) => s + (row.counts[f.number] ?? 0), 0),
                          1,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <ScanSearch className="h-3.5 w-3.5" /> Nenhuma matriz importada ainda.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
