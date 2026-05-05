import { Router } from "express";
import { getSupabaseAdmin } from "../lib/supabase.js";
import { requireAuth } from "../lib/auth";
import { saveImageFromUrl } from "../lib/imageSave.js";

async function persistImage(dalleUrl: string): Promise<string> {
  try {
    return await saveImageFromUrl(dalleUrl, "illustrations");
  } catch (saveErr) {
    console.error("[illustrations] persistImage failed, falling back to DALL-E URL:", saveErr);
    return dalleUrl;
  }
}

const router = Router();

const COSTS = {
  prompt: 10,
  restyle: 15,
  "by-paper": 49,
};

const GOST_STYLE = `Clean academic diagram or technical illustration, black and white or minimal color palette, 
suitable for Russian GOST academic paper standards, clear labels in Russian, 
high contrast, professional technical drawing style, no decorative elements, 
white background, precise lines.`;

// ── POST /api/illustrations/analyze ──────────────────────────────────────────
// Free step: Claude analyzes paper text, returns 4 illustration suggestions (no image gen, no cost)
// Body: { paperText: string, paperTitle?: string }
router.post("/analyze", requireAuth, async (req, res) => {
  try {
    const { paperText, paperTitle } = req.body;

    if (!paperText || paperText.length < 200) {
      res.status(400).json({ error: "validation_error", message: "Нужен текст работы (не менее 200 символов)" });
      return;
    }

    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const analysisResp = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 900,
      messages: [
        {
          role: "user",
          content: `Ты помогаешь студенту создать иллюстрации для академической работы по ГОСТ.

Работа: "${paperTitle || "Без названия"}"
Текст (фрагмент):
---
${paperText.slice(0, 3000)}
---

Предложи ровно 4 иллюстрации, которые наиболее полезны для этой работы.
Для каждой дай:
1. caption — подпись на русском (что изображено, в ГОСТ-стиле, например "Рисунок 1 — Схема алгоритма...")
2. prompt — промт на АНГЛИЙСКОМ для DALL-E (конкретное описание схемы/графика, 1-2 предложения)
3. reason — 1 фраза почему этот рисунок нужен в работе (на русском)

Отвечай СТРОГО в JSON-массиве:
[
  {"caption": "Рисунок 1 — ...", "prompt": "...", "reason": "..."},
  {"caption": "Рисунок 2 — ...", "prompt": "...", "reason": "..."},
  {"caption": "Рисунок 3 — ...", "prompt": "...", "reason": "..."},
  {"caption": "Рисунок 4 — ...", "prompt": "...", "reason": "..."}
]`,
        },
      ],
    });

    let suggestions: { caption: string; prompt: string; reason: string }[] = [];
    const rawText = analysisResp.content[0]?.type === "text" ? analysisResp.content[0].text : "";
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try { suggestions = JSON.parse(jsonMatch[0]); } catch { suggestions = []; }
    }

    if (suggestions.length === 0) {
      suggestions = [
        { caption: "Рисунок 1 — Общая схема системы", prompt: `Academic block diagram for paper: ${paperTitle || "academic work"}`, reason: "Визуализирует общую архитектуру системы" },
        { caption: "Рисунок 2 — Структура базы данных", prompt: `Database structure diagram for: ${paperTitle || "student project"}`, reason: "Показывает связи между сущностями" },
        { caption: "Рисунок 3 — Алгоритм основного процесса", prompt: `Process flowchart for academic paper: ${paperTitle || "work"}`, reason: "Описывает ключевой алгоритм работы" },
        { caption: "Рисунок 4 — Результаты тестирования", prompt: `Results chart for academic research: ${paperTitle || "academic research"}`, reason: "Демонстрирует эффективность разработки" },
      ];
    }

    res.json({ suggestions: suggestions.slice(0, 4) });
  } catch (err: any) {
    console.error("illustrations/analyze error:", err);
    res.status(500).json({ error: "analysis_failed", message: err?.message ?? "Ошибка анализа" });
  }
});

// ── POST /api/illustrations/generate ─────────────────────────────────────────
// Body: { mode, prompt?, imageBase64?, imageMime?, paperText?, paperTitle?, suggestions? }
// For by-paper mode: if suggestions[] provided, skips Claude and goes straight to DALL-E
router.post("/generate", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { mode, prompt, imageBase64, imageMime, paperText, paperTitle, suggestions: preSuggestions } = req.body;

    if (!mode || !COSTS[mode as keyof typeof COSTS]) {
      res.status(400).json({ error: "validation_error", message: "Укажите режим: prompt, restyle или by-paper" });
      return;
    }

    const baseCost = COSTS[mode as keyof typeof COSTS];
    const { isUserSubscribed } = await import("../lib/subscription.js");
    const subscribed = await isUserSubscribed(Number(user.id)).catch(() => false);
    const COST = subscribed ? 0 : baseCost;
    const sb = getSupabaseAdmin();
    const { data: userData } = await sb.from("Neyrozachet_users").select("balance").eq("id", user.id).single();
    const balance = userData?.balance ?? 0;
    if (!subscribed && balance < COST) {
      res.status(402).json({
        error: "insufficient_balance",
        message: `Недостаточно средств. Нужно ${COST} ₽, у вас ${balance} ₽`,
        required: COST,
        balance,
      });
      return;
    }

    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    let images: { url: string; caption: string }[] = [];

    if (mode === "prompt") {
      if (!prompt) {
        res.status(400).json({ error: "validation_error", message: "Нужен текстовый промт" });
        return;
      }
      const enhancedPrompt = `${GOST_STYLE} ${prompt}`;
      const resp = await openai.images.generate({
        model: "dall-e-3",
        prompt: enhancedPrompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        response_format: "url",
      });
      const dalleUrl = resp.data?.[0]?.url;
      if (!dalleUrl) throw new Error("DALL-E не вернул изображение");
      const url = await persistImage(dalleUrl);
      images = [{ url, caption: prompt }];
    }

    else if (mode === "restyle") {
      if (!imageBase64 || !imageMime) {
        res.status(400).json({ error: "validation_error", message: "Нужно загруженное изображение (base64)" });
        return;
      }
      const descResp = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Опиши это изображение/схему подробно на английском языке — какие элементы, структура, связи, что изображено. Описание будет использовано для перегенерации в академическом ГОСТ-стиле.",
              },
              {
                type: "image_url",
                image_url: { url: `data:${imageMime};base64,${imageBase64}`, detail: "high" },
              },
            ],
          },
        ],
      });
      const description = descResp.choices[0]?.message?.content ?? prompt ?? "diagram";
      const restylePrompt = `${GOST_STYLE} Recreate this as a clean academic diagram: ${description}`;
      const imgResp = await openai.images.generate({
        model: "dall-e-3",
        prompt: restylePrompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        response_format: "url",
      });
      const dalleUrl2 = imgResp.data?.[0]?.url;
      if (!dalleUrl2) throw new Error("DALL-E не вернул изображение");
      const url2 = await persistImage(dalleUrl2);
      images = [{ url: url2, caption: "Адаптированный рисунок" }];
    }

    else if (mode === "by-paper") {
      let suggestions: { caption: string; prompt: string }[] = [];

      // If pre-computed suggestions provided (from /analyze step) — skip Claude
      if (Array.isArray(preSuggestions) && preSuggestions.length > 0) {
        suggestions = preSuggestions.slice(0, 4);
      } else {
        // Fallback: run Claude inline (old behaviour)
        if (!paperText || paperText.length < 200) {
          res.status(400).json({ error: "validation_error", message: "Нужен текст работы (не менее 200 символов)" });
          return;
        }
        const Anthropic = (await import("@anthropic-ai/sdk")).default;
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const analysisResp = await anthropic.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 800,
          messages: [
            {
              role: "user",
              content: `Ты помогаешь студенту создать иллюстрации для академической работы по ГОСТ.
Работа: "${paperTitle || "Без названия"}"
Текст: ${paperText.slice(0, 3000)}
Предложи ровно 4 иллюстрации. Отвечай строго в JSON:
[{"caption":"...","prompt":"..."},{"caption":"...","prompt":"..."},{"caption":"...","prompt":"..."},{"caption":"...","prompt":"..."}]`,
            },
          ],
        });
        const rawText = analysisResp.content[0]?.type === "text" ? analysisResp.content[0].text : "";
        const jsonMatch = rawText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try { suggestions = JSON.parse(jsonMatch[0]); } catch { suggestions = []; }
        }
        if (suggestions.length === 0) {
          suggestions = [
            { caption: "Рисунок 1 — Общая схема", prompt: `Academic block diagram for paper: ${paperTitle || "academic work"}` },
            { caption: "Рисунок 2 — Структура системы", prompt: `System structure diagram for: ${paperTitle || "student project"}` },
            { caption: "Рисунок 3 — Алгоритм процесса", prompt: `Process flowchart for academic paper: ${paperTitle || "work"}` },
            { caption: "Рисунок 4 — Результаты анализа", prompt: `Data analysis results chart for: ${paperTitle || "academic research"}` },
          ];
        }
      }

      const genResults = await Promise.allSettled(
        suggestions.slice(0, 4).map(async (s) => {
          const imgResp = await openai.images.generate({
            model: "dall-e-3",
            prompt: `${GOST_STYLE} ${s.prompt}`,
            n: 1,
            size: "1024x1024",
            quality: "standard",
            response_format: "url",
          });
          const dalleUrl3 = imgResp.data?.[0]?.url;
          if (!dalleUrl3) throw new Error("No URL");
          const url = await persistImage(dalleUrl3);
          return { url, caption: s.caption };
        })
      );

      images = genResults
        .filter((r): r is PromiseFulfilledResult<{ url: string; caption: string }> => r.status === "fulfilled")
        .map((r) => r.value);

      if (images.length === 0) throw new Error("Не удалось сгенерировать ни одного изображения");
    }

    if (!subscribed) {
      await sb.from("Neyrozachet_users").update({ balance: balance - COST }).eq("id", user.id);
      await sb.from("Neyrozachet_transactions").insert({
        user_id: user.id,
        type: "payment",
        amount: COST,
        description: `Генератор иллюстраций (${mode}) — ${images.length} шт.`,
      });
    }

    res.json({ images, cost: COST, newBalance: subscribed ? balance : balance - COST, subscribed });
  } catch (err: any) {
    console.error("illustrations/generate error:", err);
    res.status(500).json({ error: "generation_failed", message: err?.message ?? "Ошибка генерации" });
  }
});

export default router;
