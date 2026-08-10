import { useState } from "react";
import { Bot, Copy, Lock, LogOut, ShieldCheck, Terminal, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Unit } from "@/lib/canepulse";
import { runEngineerCopilot, runSuplyDmgAudit, type AuditItem } from "@/lib/copilots";

const ADMIN_USER = "Diogo Mendes";
const ADMIN_PASS = "diogo1236651";

export function AdminCentral({
  units,
  authed,
  onAuthChange,
}: {
  units: Unit[];
  authed: boolean;
  onAuthChange: (value: boolean) => void;
}) {
  if (!authed) return <LoginGate onSuccess={() => onAuthChange(true)} />;
  return <AdminDashboard units={units} onLogout={() => onAuthChange(false)} />;
}

function LoginGate({ onSuccess }: { onSuccess: () => void }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState(false);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (user.trim() === ADMIN_USER && pass === ADMIN_PASS) {
      setError(false);
      onSuccess();
      toast.success("Acesso liberado à Central Suprema Admin");
    } else {
      setError(true);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="surface-panel mx-auto max-w-md rounded-xl border border-border/70 p-6"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Lock className="h-4 w-4" />
        </span>
        <h2 className="font-display text-base font-semibold">🔒 Central Suprema Admin</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Área restrita ao criador. Informe as credenciais para liberar os co-pilotos analíticos.
      </p>

      <div className="mt-5 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="admin-user">Usuário</Label>
          <Input
            id="admin-user"
            value={user}
            autoComplete="username"
            onChange={(e) => setUser(e.target.value)}
            placeholder="Diogo Mendes"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-pass">Senha</Label>
          <Input
            id="admin-pass"
            type="password"
            value={pass}
            autoComplete="current-password"
            onChange={(e) => setPass(e.target.value)}
          />
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-destructive">Credenciais inválidas para esta central.</p>
      ) : null}

      <Button type="submit" className="mt-5 w-full">
        <ShieldCheck className="h-4 w-4" /> Entrar
      </Button>
    </form>
  );
}

function AdminDashboard({ units, onLogout }: { units: Unit[]; onLogout: () => void }) {
  const audit = runSuplyDmgAudit(units);
  const critiques = runEngineerCopilot(units);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">🔒 Central Suprema Admin</h2>
          <p className="text-sm text-muted-foreground">
            Sessão exclusiva de Diogo Mendes — co-pilotos analíticos em tempo real.
          </p>
        </div>
        <Button variant="secondary" className="ml-auto" onClick={onLogout}>
          <LogOut className="h-4 w-4" /> Encerrar sessão
        </Button>
      </div>

      <Tabs defaultValue="suply">
        <TabsList>
          <TabsTrigger value="suply">Suply-DMG</TabsTrigger>
          <TabsTrigger value="dev">Engineer Co-Pilot</TabsTrigger>
        </TabsList>

        <TabsContent value="suply" className="mt-6 space-y-4">
          <AgentHeader
            icon={<Bot className="h-4 w-4" />}
            name="Suply-DMG"
            role="Analista sênior de dados em logística canavieira"
            summary={`${audit.length} achado(s) na varredura das unidades, matrizes horárias e siglas OCR.`}
          />
          {audit.map((item, index) => (
            <AuditCard key={index} item={item} />
          ))}
        </TabsContent>

        <TabsContent value="dev" className="mt-6 space-y-4">
          <AgentHeader
            icon={<Terminal className="h-4 w-4" />}
            name="Senior Software Engineer Co-Pilot"
            role="Arquiteto de software 15+ anos"
            summary="Auditoria técnica da arquitetura, uso de estado e UX, com prompts prontos para colar no Lovable."
          />
          {critiques.map((c, index) => (
            <div key={index} className="surface-panel rounded-xl border border-border/70 p-5">
              <h3 className="flex items-start gap-2 font-display text-sm font-semibold">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {c.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{c.critique}</p>
              <div className="mt-4 rounded-lg border border-border/70 bg-secondary/40 p-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  Prompt pronto para o Lovable
                  <Button
                    size="sm"
                    variant="secondary"
                    className="ml-auto"
                    onClick={() => {
                      navigator.clipboard.writeText(c.prompt);
                      toast.success("Prompt copiado");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copiar
                  </Button>
                </div>
                <p className="mt-2 whitespace-pre-line font-mono text-xs leading-relaxed text-foreground/90">
                  {c.prompt}
                </p>

              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AgentHeader({
  icon,
  name,
  role,
  summary,
}: {
  icon: React.ReactNode;
  name: string;
  role: string;
  summary: string;
}) {
  return (
    <div className="surface-panel rounded-xl border border-primary/40 p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
          {icon}
        </span>
        <div>
          <p className="font-display text-sm font-semibold">{name}</p>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{role}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{summary}</p>
    </div>
  );
}

const severityStyles: Record<AuditItem["severity"], string> = {
  critical: "border-destructive/50",
  risk: "border-amber-500/40",
  ok: "border-primary/40",
  info: "border-border/70",
};

function AuditCard({ item }: { item: AuditItem }) {
  return (
    <div className={`surface-panel rounded-xl border p-5 ${severityStyles[item.severity]}`}>
      <h3 className="font-display text-sm font-semibold">{item.title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
      <p className="mt-3 rounded-lg border border-border/70 bg-secondary/40 p-3 text-sm">
        <span className="font-semibold text-primary">Ação requerida: </span>
        {item.action}
      </p>
    </div>
  );
}
