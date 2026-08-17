import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AttachmentSchema = z.object({
  name: z.string(),
  kind: z.enum(["image", "pdf", "text"]),
  /** data URL para image/pdf, texto puro para kind = text */
  content: z.string().min(1),
  mime: z.string().optional(),
});

const InputSchema = z.object({
  question: z.string().min(1),
  attachments: z.array(AttachmentSchema).max(8).default([]),
  context: z.string().default(""),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .max(12)
    .default([]),
});

const PERSONA = `Você é o "Gênio da CTT", especialista mestre em Planejamento Elite e Engenheiro de Fluxo Logístico
de cana-de-açúcar com mais de 20 anos de experiência industrial (CTT: corte, transbordo e transporte).

Regras de resposta:
- Escreva em português do Brasil, direto, técnico e extremamente crítico com os números.
- Sempre estruture: 1) 📊 Leitura dos números  2) 🛑 Gargalo raiz  3) 🧩 Crítica construtiva de layout/planejamento  4) ⚡ Ações imediatas (com prazos e responsáveis)  5) 📈 Impacto estimado em t/dia.
- Aponte causa-raiz (não sintoma): densidade de carga, ciclo de conjuntos, raio médio, disponibilidade de colhedora, chuva (CH), falta de caminhão (FC), frente dividida (FDV), impurezas minerais/vegetais.
- Quantifique perdas em toneladas e horas de parada de moenda sempre que houver dados.
- Se os dados forem insuficientes, diga exatamente qual dado falta e por quê.
- Nunca invente números que não estejam nos anexos ou no contexto.`;

export const askGenio = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return { ok: false as const, error: "Gênio indisponível: chave de IA não configurada." };
    }

    const parts: unknown[] = [
      {
        type: "text",
        text: `${data.question}\n\n---\nCONTEXTO OPERACIONAL ATUAL (CanePulse):\n${
          data.context || "(sem métricas carregadas)"
        }`,
      },
    ];

    for (const file of data.attachments) {
      if (file.kind === "image") {
        parts.push({ type: "image_url", image_url: { url: file.content } });
      } else if (file.kind === "pdf") {
        parts.push({
          type: "file",
          file: { filename: file.name, file_data: file.content },
        });
      } else {
        parts.push({
          type: "text",
          text: `Conteúdo tabular do arquivo "${file.name}":\n${file.content.slice(0, 40000)}`,
        });
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: PERSONA },
          ...data.history.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: parts },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      if (response.status === 429) {
        return { ok: false as const, error: "Limite de requisições atingido. Tente novamente." };
      }
      if (response.status === 402) {
        return { ok: false as const, error: "Créditos de IA esgotados no workspace." };
      }
      return {
        ok: false as const,
        error: `Falha na análise (${response.status}): ${detail.slice(0, 200)}`,
      };
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const answer = payload.choices?.[0]?.message?.content?.trim() ?? "";
    if (!answer) return { ok: false as const, error: "O Gênio não retornou análise." };
    return { ok: true as const, answer };
  });
