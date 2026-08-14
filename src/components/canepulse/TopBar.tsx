import { Activity } from "lucide-react";

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
            <span className="text-muted-foreground"> — Diogo Mendes | Análise Logística</span>
          </span>
        </div>
      </div>
    </header>
  );
}

