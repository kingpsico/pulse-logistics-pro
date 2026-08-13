import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  image: z.string().min(10),
  fronts: z.array(z.string()),
});

const PARSE_PROMPT = `You are an OCR engine for sugarcane logistics spreadsheets.
The image is a matrix: rows or columns are HOURS, and the other axis are WORK FRONT numbers (e.g. 86, 91, 9002).
Each cell contains either the number of trucks (conjuntos) dispatched by that front in that hour, or an operational
code (siglas) such as CH, FC, MC, MCJ, MT, MP, MF, MCC, TT, DM, EN, IUP, IMR, FCJ, CDC, MDB, TDT, AGP, SO, MET, APE, FDV, ADE, CBV.
Return STRICT JSON only, no markdown, with this shape:
{"hours":[{"hour":"06:00","counts":{"86":4,"91":"CH"}}]}
Rules:
- "hour" must be a readable label taken from the sheet (keep the original label).
- counts keys must be the front numbers exactly as printed (digits only).
- Cell values are either a number (may be decimal), a code string, or BOTH together (e.g. "1 | CH", "2 - FC", "1 MC"). When a cell mixes a number and a code, return the full text exactly as printed so the engine can keep both.
- Empty or dash cells are 0.
- Do not invent hours or fronts that are not visible.`;

export const parseSpreadsheetImage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return { ok: false as const, error: "AI Vision indisponível: chave não configurada." };
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
          { role: "system", content: PARSE_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract the hour x front matrix. Registered fronts of interest: ${
                  data.fronts.join(", ") || "(none)"
                }. Still return everything you see.`,
              },
              { type: "image_url", image_url: { url: data.image } },
            ],
          },
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
      return { ok: false as const, error: `Falha na leitura da imagem (${response.status}): ${detail.slice(0, 200)}` };
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = payload.choices?.[0]?.message?.content ?? "";
    const json = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

    try {
      const parsed = z
        .object({
          hours: z.array(
            z.object({
              hour: z.string(),
              counts: z.record(z.string(), z.union([z.number(), z.string()])),
            }),
          ),
        })
        .parse(JSON.parse(json));
      return { ok: true as const, hours: parsed.hours };
    } catch {
      return { ok: false as const, error: "Não foi possível interpretar a planilha da imagem." };
    }
  });
