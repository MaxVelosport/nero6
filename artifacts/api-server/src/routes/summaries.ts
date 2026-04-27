import { Router } from "express";
import { requireAuth } from "../lib/auth";
import { getSupabaseAdmin } from "../lib/supabase.js";
import { extractTextFromFile } from "../lib/file-extract";
import OpenAI from "openai";
import { getPricing } from "../lib/settings.js";
import { isUserSubscribed } from "../lib/subscription.js";
import { chargeAtomic } from "../lib/billing.js";

const router = Router();

async function getSummaryPrice(mode: string): Promise<number> {
  const pricing = await getPricing();
  const cfg = pricing.summary[mode];
  return cfg?.price ?? SUMMARY_MODES[mode]?.price ?? 0;
}

// ──────────────────────────────────────────────────────────────────────────────
// ЦЕНООБРАЗОВАНИЕ КОНСПЕКТОВ
// Учебник — длинный контекст. Стоимость = обработка + генерация.
//   Краткий (gpt-4o-mini):   ≈ ₽0.8 →  ₽5 с наценкой
//   Стандарт (gpt-4o-mini):  ≈ ₽1.5 →  ₽10 с наценкой
//   Подробный (gpt-4o):      ≈ ₽6.0 →  ₽20 с наценкой
//   Максимальный (gpt-4o):   ≈ ₽12  →  ₽35 с наценкой
// ──────────────────────────────────────────────────────────────────────────────
const SUMMARY_MODES: Record<string, {
  price: number;
  model: string;
  label: string;
  description: string;
  maxTokens: number;
  compressionLabel: string;
  wordTarget: string;
}> = {
  brief: {
    price: 5,
    model: "gpt-4o-mini",
    label: "Краткий",
    description: "Только ключевые тезисы и определения",
    maxTokens: 700,
    compressionLabel: "Мини-конспект",
    wordTarget: "300–500 слов",
  },
  standard: {
    price: 10,
    model: "gpt-4o-mini",
    label: "Стандарт",
    description: "Полный конспект с примерами и пояснениями",
    maxTokens: 1500,
    compressionLabel: "Стандартный конспект",
    wordTarget: "800–1200 слов",
  },
  detailed: {
    price: 20,
    model: "gpt-4o",
    label: "Подробный",
    description: "Детальный разбор с формулами, схемами и связями",
    maxTokens: 3000,
    compressionLabel: "Детальный конспект",
    wordTarget: "1500–2500 слов",
  },
  maximum: {
    price: 35,
    model: "gpt-4o",
    label: "Максимальный",
    description: "Исчерпывающий академический конспект по всему материалу",
    maxTokens: 5000,
    compressionLabel: "Полный конспект",
    wordTarget: "2500–4000 слов",
  },
};

// ── GET /api/summaries/modes
router.get("/modes", async (_req, res) => {
  const pricing = await getPricing();
  const out: Record<string, any> = {};
  for (const [key, cfg] of Object.entries(SUMMARY_MODES)) {
    out[key] = {
      label: pricing.summary[key]?.label ?? cfg.label,
      description: pricing.summary[key]?.description ?? cfg.description,
      price: pricing.summary[key]?.price ?? cfg.price,
      compressionLabel: cfg.compressionLabel,
      wordTarget: cfg.wordTarget,
      model: cfg.model,
    };
  }
  res.json(out);
});

// ── POST /api/summaries/generate
router.post("/generate", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const {
      mode,
      subject,
      topic,           // new: topic-based mode (no file required)
      educationLevel,
      additionalInstructions,
      fileData,
      fileType,
      fileName,
    } = req.body;

    if (!mode || !SUMMARY_MODES[mode]) {
      res.status(400).json({ error: "validation_error", message: "Укажите корректный режим конспекта" });
      return;
    }

    const hasFile  = !!(fileData && fileType && fileName);
    const hasTopic = !!(topic && typeof topic === "string" && topic.trim().length >= 3);

    if (!hasFile && !hasTopic) {
      res.status(400).json({
        error: "validation_error",
        message: "Загрузите файл учебника (PDF, Word, TXT) или укажите тему для конспекта",
      });
      return;
    }

    const cfg = SUMMARY_MODES[mode];
    const baseCost = await getSummaryPrice(mode);

    // ── Строим источник: файл или тема ──────────────────────────────────────
    const subjectStr = subject?.trim() || (hasTopic ? topic!.trim() : "общий предмет");
    const eduStr = educationLevel === "school" ? "школьный уровень" :
      educationLevel === "master" ? "уровень магистратуры" :
      educationLevel === "phd" ? "уровень аспирантуры" : "уровень бакалавриата";

    const compressionInstruction =
      mode === "brief"
        ? `Составь КРАТКИЙ конспект (${cfg.wordTarget}). Включи только самое важное: ключевые определения, главные тезисы, основные формулы. Без лишних деталей.`
        : mode === "standard"
        ? `Составь СТАНДАРТНЫЙ конспект (${cfg.wordTarget}). Включи определения, основные положения, примеры и ключевые термины. Структурируй по разделам.`
        : mode === "detailed"
        ? `Составь ПОДРОБНЫЙ конспект (${cfg.wordTarget}). Включи все разделы, подробные определения, формулы (LaTeX: $...$), примеры, связи между темами и типичные вопросы.`
        : `Составь МАКСИМАЛЬНО ПОЛНЫЙ конспект (${cfg.wordTarget}). Покрой весь материал: все разделы, определения, теоремы, формулы (LaTeX: $...$), примеры, доказательства (если есть), связи, вопросы для самопроверки и типичные экзаменационные вопросы.`;

    let prompt: string;

    if (hasFile) {
      // ── Режим: из файла ─────────────────────────────────────────────────
      let sourceText = "";
      try {
        const raw = await extractTextFromFile(fileData, fileType, fileName);
        const limit = cfg.model === "gpt-4o" ? 90000 : 55000;
        sourceText = raw.slice(0, limit);
      } catch (e: any) {
        res.status(422).json({ error: "file_error", message: `Не удалось прочитать файл: ${e?.message || "неизвестная ошибка"}` });
        return;
      }
      if (sourceText.trim().length < 100) {
        res.status(422).json({ error: "file_error", message: "Файл слишком короткий или пуст. Убедитесь, что он содержит текст." });
        return;
      }

      prompt = `Ты — опытный преподаватель. Прочитай текст учебника ниже и составь по нему академический конспект.

Предмет: ${subjectStr}
Уровень: ${eduStr}

Задача: ${compressionInstruction}
${additionalInstructions ? `\nДополнительные инструкции: ${additionalInstructions}` : ""}

Формат:
- Используй Markdown: заголовки (## и ###), списки, **жирный** для терминов
- Формулы в LaTeX: $...$ для строчных, $$...$$ для блочных
- Сохраняй академический стиль, но пиши понятно
- НЕ пересказывай дословно — структурируй и сжимай

---ТЕКСТ УЧЕБНИКА---
${sourceText}
---КОНЕЦ ТЕКСТА---

Конспект:`;
    } else {
      // ── Режим: по теме (без файла) ──────────────────────────────────────
      const topicStr = topic!.trim();

      prompt = `Ты — опытный преподаватель и методист. Составь академический конспект по теме.

Тема: ${topicStr}
Предмет / дисциплина: ${subjectStr}
Уровень: ${eduStr}

Задача: ${compressionInstruction}
${additionalInstructions ? `\nДополнительные инструкции: ${additionalInstructions}` : ""}

Требования к конспекту:
- Используй Markdown: заголовки (## и ###), нумерованные и маркированные списки, **жирный** для терминов
- Формулы в LaTeX: $...$ для строчных, $$...$$ для блочных
- Начни с краткого введения в тему
- Структурируй материал логически: от базовых понятий к сложным
- Приведи практические примеры, где уместно
- В конце добавь список ключевых понятий или вопросы для самопроверки
- Сохраняй академический стиль, пиши по-русски

Конспект по теме «${topicStr}»:`;
    }

    // ── Атомарное списание ДО AI (с автовозвратом при ошибке) ────────────────
    const descSource = hasFile ? (fileName || subjectStr) : (topic?.trim() || subjectStr);
    const charge = await chargeAtomic({
      userId: user.id, baseCost,
      description: `Конспект: «${descSource}» (${cfg.label})`,
      logger: req.log,
    });
    if (!charge.ok) {
      res.status(charge.status).json({ error: charge.error, message: charge.message, required: charge.required, balance: charge.balance });
      return;
    }

    // ── Вызов AI ─────────────────────────────────────────────────────────────
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    });

    let result: string | null = null;
    try {
      const aiResp = await openai.chat.completions.create({
        model: cfg.model,
        max_tokens: cfg.maxTokens,
        messages: [{ role: "user", content: prompt }],
      });
      result = aiResp.choices[0]?.message?.content || null;
    } catch (aiErr: any) {
      await charge.refund("AI error");
      req.log?.error({ err: aiErr }, "Summaries AI error");
      res.status(502).json({ error: "ai_error", message: "ИИ временно недоступен. Деньги возвращены." });
      return;
    }
    if (!result) {
      await charge.refund("empty AI response");
      res.status(502).json({ error: "ai_error", message: "ИИ не вернул результат. Деньги возвращены." });
      return;
    }

    res.json({
      result,
      cost: charge.cost,
      balanceAfter: charge.balanceAfter,
      mode,
      model: cfg.model,
      label: cfg.label,
      subject: subjectStr,
      topic: hasTopic ? topic!.trim() : undefined,
      fileName: hasFile ? fileName : undefined,
      sourceMode: hasFile ? "file" : "topic",
    });
  } catch (err: any) {
    req.log?.error({ err }, "Summaries generate error");
    res.status(500).json({ error: "internal_error", message: err?.message || "Внутренняя ошибка сервера" });
  }
});

export default router;
