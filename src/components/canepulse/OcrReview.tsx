import { useMemo, useState } from "react";
import { CheckCircle2, Pencil, TriangleAlert, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { HourRow, PendingImport, Unit } from "@/lib/canepulse";
import { cellStatus, readCell, siglaLabel } from "@/lib/canepulse";

type Props = {
  unit: Unit;
  pending: PendingImport;
  onCancel: () => void;
  onConfirm: (hours: HourRow[], ignoredFronts: string[]) => void;
};

/** Tela de Revisão Pós-OCR — grid editável antes da fusão com o estado da usina. */
export function OcrReview({ unit, pending, onCancel, onConfirm }: Props) {
  const [rows, setRows] = useState(pending.rows);
  const registered = useMemo(() => new Set(unit.fronts.map((f) => f.number)), [unit.fronts]);
  const columns = pending.fronts;

  const unknown = columns.filter((c) => !registered.has(c));
  const suspects = rows.reduce(
    (sum, row) =>
      sum + columns.filter((c) => registered.has(c) && cellStatus(row.cells[c] ?? "") === "suspect").length,
    0,
  );

  const setCell = (rowIndex: number, front: string, value: string) =>
    setRows((prev) =>
      prev.map((row, i) =>
        i === rowIndex ? { ...row, cells: { ...row.cells, [front]: value } } : row,
      ),
    );

  const setHour = (rowIndex: number, value: string) =>
    setRows((prev) => prev.map((row, i) => (i === rowIndex ? { ...row, hour: value } : row)));

  const confirm = () => {
    const hours: HourRow[] = rows.map((row) => {
      const counts: Record<string, number> = {};
      const codes: Record<string, string> = {};
      columns.forEach((front) => {
        if (!registered.has(front)) return;
        const cell = readCell(row.cells[front] ?? "");
        counts[front] = cell.value;
        if (cell.code) codes[front] = cell.code;
      });
      return { hour: row.hour, counts, codes };
    });
    onConfirm(hours, unknown);
  };

  return (
    <div className="mt-4 rounded-lg border border-warning/50 bg-warning/5 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-warning/15 text-warning">
          <Pencil className="h-3.5 w-3.5" />
        </span>
        <h5 className="font-display text-sm font-semibold">Tela de Revisão Pós-OCR</h5>
        <Badge variant="outline" className="border-warning/50 text-warning">
          {rows.length} hora(s) · {columns.length} frente(s) lida(s)
        </Badge>
        {suspects > 0 ? (
          <Badge variant="outline" className="border-warning/50 text-warning">
            {suspects} célula(s) de baixa confiança
          </Badge>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Confira e corrija a matriz extraída. Células destacadas em âmbar são de baixa confiança ou
        pertencem a frentes não cadastradas — estas últimas serão descartadas na fusão.
      </p>

      {unknown.length > 0 ? (
        <p className="mt-3 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Frentes fora do cadastro: {unknown.join(", ")}
        </p>
      ) : null}

      <div className="mt-3 max-h-80 overflow-auto rounded-md border border-border/70 bg-background/60">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-secondary/80 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left">Hora</th>
              {columns.map((front) => (
                <th
                  key={front}
                  className={`num px-2 py-2 text-right ${
                    registered.has(front) ? "" : "text-warning"
                  }`}
                >
                  {front}
                  {registered.has(front) ? "" : " ⚠"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${row.hour}-${rowIndex}`} className="border-t border-border/60">
                <td className="px-2 py-1.5">
                  <input
                    value={row.hour}
                    onChange={(e) => setHour(rowIndex, e.target.value)}
                    className="w-16 rounded border border-border/60 bg-transparent px-1.5 py-1 text-xs outline-none focus:border-primary"
                  />
                </td>
                {columns.map((front) => {
                  const raw = row.cells[front] ?? "";
                  const status = cellStatus(raw);
                  const parsed = readCell(raw);
                  const flagged = !registered.has(front) || status === "suspect";
                  const coded = status === "sigla" || status === "mixed";
                  return (
                    <td key={front} className="px-1 py-1.5">
                      <input
                        value={raw}
                        onChange={(e) => setCell(rowIndex, front, e.target.value)}
                        title={
                          coded && parsed.code
                            ? `${parsed.value} conj. · ${siglaLabel(parsed.code)}`
                            : undefined
                        }
                        className={`num w-16 rounded border bg-transparent px-1.5 py-1 text-right text-xs outline-none focus:border-primary ${
                          flagged
                            ? "border-warning/70 bg-warning/10 text-warning"
                            : status === "mixed"
                              ? "border-chart-3/60 text-chart-3"
                              : status === "sigla"
                                ? "border-border/60 text-primary"
                                : "border-border/60"
                        }`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={confirm}>
          <CheckCircle2 className="h-4 w-4" /> ✅ Confirmar e Fundir Dados
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          <X className="h-4 w-4" /> Descartar leitura
        </Button>
        <span className="ml-auto self-center text-[11px] text-muted-foreground">
          Extração de {pending.at}
        </span>
      </div>
    </div>
  );
}
