import type { Unit } from "./canepulse";
import { computeUnitMetrics, fmt, siglaLabel, signed } from "./canepulse";

export type AuditItem = {
  severity: "critical" | "risk" | "ok" | "info";
  title: string;
  detail: string;
  action: string;
};

/** AGENTE 1 — Suply-DMG: prescriptive logistics audit over every unit/front. */
export function runSuplyDmgAudit(units: Unit[]): AuditItem[] {
  const items: AuditItem[] = [];

  units.forEach((unit) => {
    const m = computeUnitMetrics(unit);
    if (!m.hasData) {
      items.push({
        severity: "info",
        title: `${unit.name}: sem dados operacionais`,
        detail:
          "Nenhuma matriz horária importada ou nenhuma frente cadastrada — a auditoria não pode medir perda real.",
        action:
          "Cadastre as frentes com potencial (conj./h) e importe o print da planilha horária para liberar o diagnóstico.",
      });
      return;
    }

    const gap = m.initialTonnes + m.projection24 - (unit.dailyTarget || 0);
    if (gap < 0) {
      items.push({
        severity: "critical",
        title: `🛑 ${unit.name}: fechamento projetado ${signed(gap)} t vs meta`,
        detail: `Ritmo real de ${fmt(m.realRatePerHour, 1)} t/h contra meta horária de ${fmt(
          m.hourlyTarget,
          1,
        )} t/h. Aderência global em ${fmt(m.compliance, 1)}% com ${fmt(m.lostTonnes)} t perdidas na janela de ${m.activeHours}h.`,
        action: `Recupere ${fmt(Math.abs(gap) / 24, 1)} t/h. Priorize as frentes com maior perda abaixo e realoque conjuntos do pátio (${fmt(
          unit.initialStock,
        )} conj. disponíveis) para eliminar starvation de campo.`,
      });
    } else if (m.planningBalance24 < 0) {
      items.push({
        severity: "risk",
        title: `⚠️ ${unit.name}: planejamento estrutural insuficiente`,
        detail: `Mesmo a 100% do potencial as frentes entregam ${fmt(
          m.potentialRatePerHour,
          1,
        )} t/h contra meta de ${fmt(m.hourlyTarget, 1)} t/h — saldo ${signed(m.planningBalance24)} t/dia.`,
        action:
          "O gargalo é de capacidade instalada, não de execução: abra frente adicional ou eleve o potencial contratado antes de cobrar performance de campo.",
      });
    } else {
      items.push({
        severity: "ok",
        title: `✅ ${unit.name}: fechamento projetado ${signed(gap)} t`,
        detail: `Aderência ${fmt(m.compliance, 1)}% e ritmo de ${fmt(m.realRatePerHour, 1)} t/h sustentam a meta de ${fmt(
          unit.dailyTarget,
        )} t.`,
        action: "Manter pacing atual e proteger o estoque de pátio para absorver paradas industriais.",
      });
    }

    const deviation = m.deviationRealVsPotential;
    if (deviation > 0.01) {
      items.push({
        severity: "risk",
        title: `📉 ${unit.name}: ${fmt(deviation, 1)} t/h perdidos vs capacidade máxima`,
        detail: `O campo entrega ${fmt(m.realRatePerHour, 1)} t/h de um potencial de ${fmt(
          m.potentialRatePerHour,
          1,
        )} t/h — equivalente a ${fmt(deviation * 24)} t/dia deixadas na lavoura.`,
        action:
          "Ataque primeiro a frente com maior desvio percentual; ganho marginal por caminhão realocado é maior onde a aderência está mais baixa.",
      });
    }

    [...m.fronts]
      .sort((a, b) => b.lostTonnes - a.lostTonnes)
      .slice(0, 3)
      .filter((f) => f.lostTonnes > 0)
      .forEach((f) => {
        const topCode = [...f.codes].sort((a, b) => b.hours.length - a.hours.length)[0];
        items.push({
          severity: f.compliance < 80 ? "critical" : "risk",
          title: `🔹 Frente ${f.front.number}: aderência ${fmt(f.compliance, 1)}% · perda ${fmt(f.lostTonnes)} t`,
          detail: topCode
            ? `Código dominante ${topCode.code} (${siglaLabel(topCode.code)}) em ${topCode.hours.length}h (${topCode.hours.join(
                ", ",
              )}). Real ${fmt(f.real, 1)} conj. vs potencial ${fmt(f.potentialTotal, 1)} conj.`
            : `Real ${fmt(f.real, 1)} conj. vs potencial ${fmt(
                f.potentialTotal,
                1,
              )} conj. sem sigla registrada — perda sem causa apontada na matriz.`,
          action: topCode
            ? actionForCode(topCode.code, f.front.number)
            : `Exija justificativa horária da frente ${f.front.number}: perda de ${fmt(
                f.lostTonnes,
              )} t sem causa registrada impede plano de ação.`,
        });
      });
  });

  items.unshift(...rainModeAudit(units));
  items.push(...reallocationPlan(units));

  return items;
}

const CLIMATE_CODES = new Set(["CH", "CDC", "EN"]);

/** Modo Chuva: acumula perda climática (CH/CDC/EN) por unidade e frente. */
function rainModeAudit(units: Unit[]): AuditItem[] {
  const rows = units
    .map((unit) => {
      const m = computeUnitMetrics(unit);
      const hits = m.fronts.flatMap((f) =>
        f.codes
          .filter((c) => CLIMATE_CODES.has(c.code))
          .map((c) => ({
            front: f.front.number,
            code: c.code,
            hours: c.hours.length,
            tonnes: (f.front.potential || 0) * c.hours.length * (unit.density || 0),
          })),
      );
      const tonnes = hits.reduce((s, h) => s + h.tonnes, 0);
      const hours = hits.reduce((s, h) => s + h.hours, 0);
      return { unit, tonnes, hours, hits };
    })
    .filter((r) => r.hits.length > 0);

  if (rows.length === 0) return [];

  const total = rows.reduce((s, r) => s + r.tonnes, 0);
  return [
    {
      severity: total > 0 ? "critical" : "info",
      title: `🌧️ Modo Chuva ativo: ${fmt(total)} t acumuladas de perda climática`,
      detail: rows
        .map(
          (r) =>
            `${r.unit.name}: ${fmt(r.tonnes)} t em ${r.hours}h paradas — ${r.hits
              .map((h) => `F${h.front} ${h.code} (${h.hours}h)`)
              .join(", ")}`,
        )
        .join(" · "),
      action:
        "Congele cobrança de aderência nas horas climáticas, migre conjuntos para blocos de solo drenado e recomponha a perda com horas extras em janela seca — cada hora de chuva vale a perda listada acima.",
    },
  ];
}

/** Prescrição de realocação imediata de ativos entre frentes com base no desvio ativo. */
function reallocationPlan(units: Unit[]): AuditItem[] {
  return units.flatMap((unit) => {
    const m = computeUnitMetrics(unit);
    if (!m.hasData) return [];
    const worst = [...m.fronts].sort((a, b) => a.compliance - b.compliance)[0];
    const best = [...m.fronts].sort((a, b) => b.compliance - a.compliance)[0];
    if (!worst || !best || worst.front.id === best.front.id) return [];
    const movable = Math.max(1, Math.round((best.compliance - 100) / 25));
    return [
      {
        severity: worst.compliance < 90 ? "risk" : "info",
        title: `🔁 ${unit.name}: realocar ${movable} conjunto(s) da frente ${best.front.number} → ${worst.front.number}`,
        detail: `Frente ${best.front.number} opera a ${fmt(best.compliance, 1)}% (folga) enquanto ${worst.front.number} está a ${fmt(
          worst.compliance,
          1,
        )}% com ${fmt(worst.lostTonnes)} t perdidas. Pátio disponível: ${fmt(unit.initialStock)} conj.`,
        action: `Mova ${movable} conjunto(s) no próximo fechamento de hora e revalide o ritmo: ganho estimado de ${fmt(
          movable * (unit.density || 0),
          1,
        )} t/h.`,
      },
    ];
  });
}


function actionForCode(code: string, front: string): string {
  const map: Record<string, string> = {
    FC: `Realoque 2 conjuntos do pátio para a frente ${front} e reveja o ciclo de retorno — starvation por falta de caminhão.`,
    FCJ: `Reforce a fila de conjuntos da frente ${front}; avalie escala extra de motoristas no turno crítico.`,
    CH: `Perda climática: replaneje o eito para bloco de solo mais drenado e antecipe carregamento em janela seca.`,
    MC: `Acione manutenção preditiva da colhedora da frente ${front} e mantenha colhedora reserva alocada ao bloco.`,
    MCJ: `Programe inspeção dos conjuntos da frente ${front} fora do horário de pico de moagem.`,
    MT: `Escale trator reserva na frente ${front}; parada de tração congela todo o eito.`,
    MCC: `Direcione caminhão substituto imediato e revise plano de manutenção da flota da frente ${front}.`,
    TT: `Libere trajeto alternativo para a frente ${front} e comunique o CCO para redirecionar a fila.`,
    DM: `Reavalie posicionamento do malhador: distância excessiva na frente ${front} corrói o ciclo.`,
    EN: `Acione resgate mecanizado na frente ${front} e restrinja tráfego em solo saturado.`,
    IUP: `Perda industrial: use o pátio como pulmão e reduza pacing das frentes para evitar cana envelhecida.`,
    IMR: `Com moagem reduzida, escalone a chegada das frentes para preservar qualidade da matéria-prima.`,
    SO: `Cubra a lacuna de operador na frente ${front} com escala reserva; hora sem operador é perda integral.`,
    MF: `Compacte a mudança de frente ${front} para fora do pico e pré-posicione conjuntos no novo eito.`,
    TDT: `Sobreponha turnos na frente ${front} para eliminar o vazio de troca.`,
    AGP: `Garanta pipa dedicada ao bloco da frente ${front}; espera por pipa é parada evitável.`,
  };
  return (
    map[code] ??
    `Trate a causa ${code} (${siglaLabel(code)}) na frente ${front} com plano de ação horário e reavalie o pacing.`
  );
}

export type DevCritique = {
  title: string;
  critique: string;
  prompt: string;
};

/** AGENTE 2 — Senior Software Engineer Co-Pilot: harsh architectural self-audit + copy-ready prompts. */
export function runEngineerCopilot(units: Unit[]): DevCritique[] {
  const out: DevCritique[] = [];
  const metrics = units.map((u) => computeUnitMetrics(u));
  const totalFronts = units.reduce((s, u) => s + u.fronts.length, 0);
  const totalHours = units.reduce((s, u) => s + u.hours.length, 0);
  const missingJust = metrics.flatMap((m) =>
    m.fronts.filter((f) => f.delta < 0 && !f.front.justification && !f.autoJustification),
  ).length;

  const noDensity = units.filter((u) => !u.density).length;
  const noTarget = units.filter((u) => !u.dailyTarget).length;

  out.push({
    title: "Persistência frágil: todo o estado crítico vive em localStorage",
    critique: `O app carrega ${units.length} unidade(s), ${totalFronts} frente(s) e ${totalHours} linha(s) horárias inteiramente no navegador. Um cache limpo destrói o histórico operacional e não existe auditoria multiusuário — inaceitável para dado que embasa decisão de moagem.`,
    prompt:
      "Migre o estado do CanePulse de localStorage para o Lovable Cloud: crie tabelas units, fronts e hour_rows com RLS por usuário, GRANTs corretos, mantenha localStorage apenas como cache offline e sincronize via TanStack Query com optimistic updates.",
  });

  if (noDensity || noTarget) {
    out.push({
      title: "Validação de entrada permissiva demais",
      critique: `${noDensity} unidade(s) sem carga líquida e ${noTarget} sem meta diária ainda renderizam dashboards — os KPIs saem zerados e passam por 'operação estável', o que é um falso negativo grave.`,
      prompt:
        "Adicione validação por unidade no CanePulse com Zod: bloqueie a aba Motor Analítico e o Relatório enquanto meta diária ou carga líquida forem 0, exibindo um estado vazio explicativo com CTA para o Setup e badge de 'dados incompletos' no card da usina.",
    });
  }

  if (missingJust > 0) {
    out.push({
      title: "Fluxo de justificativa sem enforcement",
      critique: `${missingJust} frente(s) com déficit seguem sem justificativa manual ou sigla OCR. A UI aceita perda sem causa, então o relatório executivo é publicado incompleto.`,
      prompt:
        "No CanePulse, crie uma flag operacional 'Justificativa Pendente': bloqueie a exportação/WhatsApp com um diálogo de confirmação listando as frentes sem causa, adicione contador no topo da aba Relatório e destaque a linha na tabela de perdas.",
    });
  }

  out.push({
    title: "Camada de visualização subaproveitada",
    critique:
      "As métricas horárias hoje são cartões e tabelas estáticas. Sem série temporal por hora, o gestor não vê a inflexão do ritmo dentro do turno, apenas a média achatada da janela.",
    prompt:
      "Adicione ao Motor Analítico do CanePulse um gráfico de linha/área (Recharts) de ritmo t/h por hora, com linha de referência de Meta Horária e Potencial, tooltip com siglas do período e seletor de frente; use apenas tokens semânticos do design system.",
  });

  out.push({
    title: "Tema visual sem variação de densidade para telas de campo",
    critique:
      "O tema atual é único: em tablet sob sol o contraste cai e as tabelas ficam apertadas. Não existe modo alto-contraste nem densidade compacta/confortável.",
    prompt: [
      "**Atualizar tema do CanePulse**",
      "- Adicione em `src/styles.css` uma variação de tema `[data-contrast='high']` elevando `--foreground`, `--border` e `--primary`.",
      "- Crie um toggle no TopBar: `Padrão | Alto Contraste` e persista em localStorage.",
      "- Adicione densidade `compacta/confortável` controlando padding das tabelas via classe utilitária.",
      "- Use somente tokens semânticos, sem cores hardcoded.",
    ].join("\n"),
  });

  out.push({
    title: "Componentes de botão sem hierarquia operacional",
    critique:
      "Ações críticas (fundir OCR, exportar relatório) usam a mesma variante de botões secundários — o operador não distingue o que é irreversível.",
    prompt: [
      "**Atualizar componentes de botão do CanePulse**",
      "- Em `src/components/ui/button.tsx` adicione variantes `critical`, `confirm` e `ghostWarning` via `cva`, usando tokens `destructive`, `success` e `warning`.",
      "- Aplique `confirm` no botão '✅ Confirmar e Fundir Dados' e `critical` em remoções.",
      "- Inclua estado `loading` com spinner e `aria-busy`.",
    ].join("\n"),
  });

  out.push({
    title: "Parâmetros operacionais fixos no código",
    critique:
      "Limites de 7 usinas, 8 frentes, janela de 24h e thresholds de aderência (90%/100%) estão espalhados como números mágicos, impedindo calibração por grupo.",
    prompt: [
      "**Parametrizar o CanePulse**",
      "- Crie `src/lib/config.ts` com `MAX_UNITS`, `MAX_FRONTS`, `DAY_HOURS`, `COMPLIANCE_RISK`, `COMPLIANCE_OK`.",
      "- Substitua todos os números mágicos por essas constantes.",
      "- Exponha os thresholds em um card 'Parâmetros do Grupo' na aba Setup, persistindo em localStorage.",
    ].join("\n"),
  });



  return out;
}
