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

  return items;
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
  const missingJust = units.flatMap((u, i) =>
    metrics[i].fronts.filter((f) => f.delta < 0 && !f.front.justification && !f.autoJustification),
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
    title: "OCR sem etapa de conferência humana",
    critique:
      "A leitura Vision grava direto no estado sem diff nem confiança por célula. Um erro de OCR contamina silenciosamente perda, aderência e projeção de 24h.",
    prompt:
      "Implemente no CanePulse uma tela de revisão pós-OCR: mostre a matriz extraída em grid editável com destaque para células de baixa confiança e frentes não cadastradas, exigindo confirmação explícita antes de fundir os dados ao estado da unidade.",
  });

  return out;
}
