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
    }),
    { target: 0, projection: 0, lost: 0 },
  );
  const gap = total.projection - total.target;

  blocks.push(SEP);
  blocks.push(
    [
      "🏁 *FECHAMENTO CONSOLIDADO*",
      `• Meta total: ${fmt(total.target)} t`,
      `• Projeção total: ${fmt(total.projection)} t`,
      `• Saldo final: ${signed(gap)} t`,
      `• Perda acumulada: ${fmt(total.lost)} t`,
      gap < 0 ? "🚨 *ATENÇÃO: fechamento abaixo da meta.*" : "✅ *Meta projetada atendida.*",
    ].join("\n"),
  );

  return blocks.join("\n\n");
}
