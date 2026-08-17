import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Loader2,
  Send,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import type { Unit } from "@/lib/canepulse";
import { computeUnitMetrics, fmt } from "@/lib/canepulse";
import { askGenio } from "@/lib/genio.functions";

const LOG_KEY = "canepulse:genio:log:v1";

type Attachment = {
  id: string;
  name: string;
  kind: "image" | "pdf" | "text";
  content: string;
  mime?: string;
  size: number;
};

type Message = { id: string; role: "user" | "assistant"; content: string; at: string };

const uid = () => Math.random().toString(36).slice(2, 10);

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo"));
    reader.readAsDataURL(file);
  });

async function toAttachment(file: File): Promise<Attachment | null> {
  const lower = file.name.toLowerCase();
  const base = { id: uid(), name: file.name, size: file.size, mime: file.type };

  if (file.type.startsWith("image/")) {
    return { ...base, kind: "image", content: await readAsDataUrl(file) };
  }
  if (file.type === "application/pdf" || lower.endsWith(".pdf")) {
    return { ...base, kind: "pdf", content: await readAsDataUrl(file) };
  }
  if (lower.endsWith(".csv") || lower.endsWith(".txt") || file.type.startsWith("text/")) {
    return { ...base, kind: "text", content: await file.text() };
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".xlsm")) {
    const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheets = book.SheetNames.map((name) => {
      const sheet = book.Sheets[name];
      return `## Planilha: ${name}\n${sheet ? XLSX.utils.sheet_to_csv(sheet) : ""}`;
    });
    return { ...base, kind: "text", content: sheets.join("\n\n") };
  }
  return null;
}

function buildContext(units: Unit[]) {
  return units
    .map((unit) => {
      const m = computeUnitMetrics(unit);
      const fronts = m.fronts
        .map(
          (f) =>
            `    - Frente ${f.front.number}: real ${fmt(f.real, 1)} conj. / potencial ${fmt(
              f.potentialTotal,
              1,
            )} conj. (${fmt(f.compliance, 0)}% aderência, perda ${fmt(f.lostTonnes, 0)} t)${
              f.autoJustification ? ` — ${f.autoJustification}` : ""
            }`,
        )
        .join("\n");
      return [
        `• ${unit.name}: meta ${fmt(unit.dailyTarget)} t/dia | carga ${fmt(unit.density, 1)} t/conj. | estoque inicial ${fmt(unit.initialStock, 1)} conj.`,
        `    Horas monitoradas: ${m.activeHours} | ritmo real ${fmt(m.realRatePerHour, 1)} t/h | meta horária ${fmt(m.hourlyTarget, 1)} t/h | média móvel 3h ${fmt(m.inflowAvg3h, 1)} t/h`,
        `    Projeção 24h ${fmt(m.projectedTotalDelivery)} t | déficit ${fmt(m.totalDeficit)} t | parada prevista: ${m.starvationLabel}`,
        fronts,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
}

export function GenioCTT({ units }: { units: Unit[] }) {
  const [files, setFiles] = useState<Attachment[]>([]);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOG_KEY);
      if (raw) setMessages(JSON.parse(raw) as Message[]);
    } catch {
      setMessages([]);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(LOG_KEY, JSON.stringify(messages.slice(-40)));
  }, [messages, hydrated]);

  const context = useMemo(() => buildContext(units), [units]);

  const addFiles = async (list: FileList | File[]) => {
    const incoming = Array.from(list);
    const parsed: Attachment[] = [];
    for (const file of incoming) {
      try {
        const att = await toAttachment(file);
        if (att) parsed.push(att);
        else toast.error(`Formato não suportado: ${file.name}`);
      } catch {
        toast.error(`Não foi possível ler ${file.name}`);
      }
    }
    if (parsed.length) {
      setFiles((prev) => [...prev, ...parsed].slice(0, 8));
      toast.success(`${parsed.length} arquivo(s) anexado(s) ao Gênio`);
    }
  };

  const send = async () => {
    if (!question.trim()) {
      toast.error("Escreva a pergunta para o Gênio da CTT.");
      return;
    }
    setLoading(true);
    const userMsg: Message = {
      id: uid(),
      role: "user",
      content: files.length
        ? `${question.trim()}\n\n📎 ${files.map((f) => f.name).join(", ")}`
        : question.trim(),
      at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const result = await askGenio({
        data: {
          question: question.trim(),
          context,
          attachments: files.map((f) => ({
            name: f.name,
            kind: f.kind,
            content: f.content,
            ...(f.mime ? { mime: f.mime } : {}),
          })),
          history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        },
      });

      if (!result.ok) {
        toast.error(result.error);
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: "assistant", content: `🚨 ${result.error}`, at: new Date().toISOString() },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: "assistant", content: result.answer, at: new Date().toISOString() },
        ]);
        setQuestion("");
      }
    } catch {
      toast.error("Falha de comunicação com o Gênio da CTT.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="surface-panel rounded-xl border border-primary/40 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-display text-base font-semibold">
              🔮 Gênio da CTT — Inteligência Artificial Multimodal
            </h3>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Planejador Elite · Engenheiro de Fluxo Logístico · 20+ anos de indústria
            </p>
          </div>
          {messages.length > 0 ? (
            <Button
              variant="secondary"
              size="sm"
              className="ml-auto"
              onClick={() => setMessages([])}
            >
              <Trash2 className="h-3.5 w-3.5" /> Limpar histórico
            </Button>
          ) : null}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Anexe prints da matriz horária, planilhas CSV/Excel ou relatórios PDF (impurezas, ciclo,
          disponibilidade) e pergunte. A análise cruza os anexos com as métricas ativas das usinas.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void addFiles(e.dataTransfer.files);
          }}
          className={`surface-panel flex flex-col rounded-xl border border-dashed p-5 transition-colors ${
            dragging ? "border-primary bg-primary/5" : "border-border/70"
          }`}
        >
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
            <UploadCloud className="h-8 w-8 text-primary" />
            <p className="font-display text-sm font-semibold">Canvas de anexos multiformato</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Arraste e solte aqui, ou selecione: Imagens/Prints, planilhas CSV, arquivos Excel e
              documentos PDF.
            </p>
            <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
              Selecionar arquivos
            </Button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/*,.csv,.txt,.xlsx,.xls,.xlsm,.pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {files.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {files.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center gap-2 rounded-lg border border-border/70 bg-secondary/40 px-3 py-2 text-xs"
                >
                  <span className="text-primary">
                    {file.kind === "image" ? (
                      <ImageIcon className="h-3.5 w-3.5" />
                    ) : file.kind === "pdf" ? (
                      <FileText className="h-3.5 w-3.5" />
                    ) : (
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <span className="truncate">{file.name}</span>
                  <Badge variant="outline" className="ml-auto shrink-0 border-border/60">
                    {(file.size / 1024).toFixed(0)} KB
                  </Badge>
                  <button
                    type="button"
                    aria-label={`Remover ${file.name}`}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                    onClick={() => setFiles((prev) => prev.filter((f) => f.id !== file.id))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="surface-panel flex flex-col rounded-xl border border-border/70 p-5">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={8}
            placeholder="Pergunte ao Gênio da CTT (Ex: Analise este relatório de impurezas e me diga qual frente está quebrando a moenda)..."
            className="min-h-40 resize-y text-sm"
          />
          <div className="mt-3 flex items-center gap-2">
            <p className="text-[11px] text-muted-foreground">
              {files.length} anexo(s) · {units.length} usina(s) no contexto
            </p>
            <Button className="ml-auto" onClick={() => void send()} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {loading ? "Analisando..." : "Consultar o Gênio"}
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`surface-panel rounded-xl border p-5 ${
              message.role === "assistant" ? "border-primary/40" : "border-border/70"
            }`}
          >
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              {message.role === "assistant" ? "🔮 Gênio da CTT" : "🧑‍💼 Diogo Mendes"}
              <span className="ml-auto">
                {new Date(message.at).toLocaleString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "2-digit",
                  month: "2-digit",
                })}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
              {message.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
