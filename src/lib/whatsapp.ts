import type { Unit, UnitMetrics } from "./canepulse";
import { fmt, signed } from "./canepulse";

const SEP = "------------------------------------------";

export function buildWhatsAppReport(
  rows: { unit: Unit; metrics: UnitMetrics }[],
  scopeLabel: string,
): string {
  const blocks: string[] = [];

  blocks.push(`🍃 *CANEPULSE — RELATÓRIO OPERACIONAL*\n\n_Escopo:_ ${scopeLabel}`);

  rows.forEach(({ unit, metrics }) => {
    blocks.push(SEP);

    blocks.push(
      [
        `🏢 *${unit.name.toUpperCase()}*`,
        `⏱️ Janela: ${metrics.activeHours}h ${
          metrics.hourLabels.length
            ? `(${metrics.hourLabels[0]} → ${metrics.hourLabels[metrics.hourLabels.length - 1]})`
            : ""
        }`,
      ].join("\n"),
    );

    blocks.push(
      [
        "📊 *INDÚSTRIA*",
        `• Meta diária: ${fmt(unit.dailyTarget)} t`,
        `• Meta horária: ${fmt(metrics.hourlyTarget, 1)} t/h`,
        `• Carga líquida: ${fmt(unit.density, 2)} t/conj.`,
        `• Pátio inicial: ${fmt(unit.initialStock)} conj. (${fmt(metrics.initialTonnes)} t)`,
      ].join("\n"),
    );

    blocks.push(
      [
        "⚠️ *ALERTA DE ABASTECIMENTO (PREDITIVO)*",
        `• Ritmo de Perda/Ganho do Pátio: ${metrics.yardRate < 0 ? "📉" : "📈"} ${signed(
          metrics.yardRate,
          1,
        )} t/h`,
        `• ⏱️ Previsão de Parada Industrial: ${
          metrics.starvationRisk
            ? `${metrics.starvationLabel} por Falta de Cana`
            : metrics.starvationLabel
        }`,
      ].join("\n"),
    );

    blocks.push(
      [
        "📈 *PROJEÇÕES*",
        `• Potencial das frentes: ${fmt(metrics.potentialRatePerHour, 1)} t/h`,
        `• Real das frentes: ${fmt(metrics.realRatePerHour, 1)} t/h`,
        `• Saldo do planejamento: ${signed(metrics.planningBalance24)} t/dia`,
        `• Projeção 24h (real + pátio): ${fmt(metrics.projection24 + metrics.initialTonnes)} t`,
        `• Aderência global: ${fmt(metrics.compliance, 1)}%`,
      ].join("\n"),
    );

    blocks.push(`🛑 *PERDA TOTAL:* ${fmt(metrics.lostTonnes)} t`);

    metrics.fronts.forEach((f) => {
      const just = f.front.justification || f.autoJustification;
      blocks.push(
        [
          `🔹 *Frente ${f.front.number}*`,
          `   • Real: ${fmt(f.real, 1)} conj.`,
          `   • Potencial: ${fmt(f.potentialTotal, 1)} conj.`,
          `   • Aderência: ${fmt(f.compliance, 1)}%`,
          `   • Perda: ${f.lostTonnes > 0 ? `🛑 -${fmt(f.lostTonnes)} t` : "✅ 0 t"}`,
          `   • ${just ? `💬 ${just}` : "⚠️ Justificativa pendente"}`,
        ].join("\n"),
      );
    });
  });

  const total = rows.reduce(
    (acc, r) => ({
      target: acc.target + (r.unit.dailyTarget || 0),
      projection: acc.projection + r.metrics.projection24 + r.metrics.initialTonnes,
      lost: acc.lost + r.metrics.lostTonnes,
      bufferTarget: acc.bufferTarget + r.metrics.hourlyTarget * 2,
      bufferTargetConj:
        acc.bufferTargetConj + (r.unit.density > 0 ? (r.metrics.hourlyTarget * 2) / r.unit.density : 0),
      endStock: acc.endStock + Math.max(0, r.metrics.targetDeltaReal),
      endStockConj:
        acc.endStockConj +
        (r.unit.density > 0 ? Math.max(0, r.metrics.targetDeltaReal) / r.unit.density : 0),
    }),
    {
      target: 0,
      projection: 0,
      lost: 0,
      bufferTarget: 0,
      bufferTargetConj: 0,
      endStock: 0,
      endStockConj: 0,
    },
  );
  const gap = total.projection - total.target;
  const adh = total.target > 0 ? (total.projection / total.target) * 100 : 0;
  const bufferGap = total.endStock - total.bufferTarget;

  blocks.push(SEP);
  blocks.push(
    [
      "🏁 *FECHAMENTO CONSOLIDADO (INDÚSTRIA + PÁTIO)*",
      "",
      `• Meta de Moagem Total: ${fmt(total.target)} t`,
      "",
      `• Projeção de Moagem 24h: ${fmt(total.projection)} t (${fmt(adh, 1)}% Adh)`,
      "",
      `• Saldo de Moagem: ${gap < 0 ? "🔻" : "🔼"} ${signed(gap)} t`,
    ].join("\n"),
  );
  blocks.push(
    [
      "📊 *META DE SEGURANÇA DE PÁTIO (BUFFER 2H)*",
      "",
      `• Estoque Alvo de Turno: ${fmt(total.bufferTarget)} t (${fmt(total.bufferTargetConj)} conj.)`,
      "",
      `• Estoque Projetado Fim: ${fmt(total.endStock)} t (${fmt(total.endStockConj, 1)} conj.)`,
      "",
      `• Saldo de Pulmão: ${bufferGap < 0 ? "🛑" : "✅"} ${signed(bufferGap)} t`,
    ].join("\n"),
  );
  blocks.push(
    gap < 0 && bufferGap < 0
      ? "🚨 *STATUS FINAL: Fechamento CRÍTICO. Volume insuficiente para moagem e pátio zerado para a troca de turno.*"
      : gap < 0
        ? "⚠️ *STATUS FINAL: Fechamento em ATENÇÃO. Moagem abaixo da meta, porém pulmão de pátio preservado.*"
        : bufferGap < 0
          ? "⚠️ *STATUS FINAL: Meta de moagem atendida, mas pulmão de pátio abaixo do buffer de 2h.*"
          : "✅ *STATUS FINAL: Fechamento ADERENTE. Moagem e pulmão de pátio garantidos para a troca de turno.*",
  );
  blocks.push(`🛑 *Perda acumulada:* ${fmt(total.lost)} t`);


  return blocks.join("\n\n");
}
