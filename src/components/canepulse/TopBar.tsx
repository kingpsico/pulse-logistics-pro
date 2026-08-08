import { Activity, ShieldCheck } from "lucide-react";

export function TopBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Activity className="h-4 w-4" />
          </span>
          <span className="font-display text-[15px] font-semibold tracking-tight">
            Cane<span className="text-primary">Pulse</span>
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <ShieldCheck className="h-3 w-3 text-primary" />
          Logged: Diogo Mendes
        </span>
        <span className="ml-auto text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Logistics &amp; Milling Optimization
        </span>
      </div>
    </header>
  );
}
