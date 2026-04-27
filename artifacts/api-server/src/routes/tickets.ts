import { Router } from "express";
import { requireAuth } from "../lib/auth";
import { getSupabaseAdmin } from "../lib/supabase.js";
import { extractTextFromFile } from "../lib/file-extract";
import OpenAI from "openai";
import { chargeAtomic } from "../lib/billing.js";

const router = Router();

// ──────────────────────────────────────────────────────────────────────────────
// ЦЕНООБРАЗОВАНИЕ БИЛЕТОВ
// ──────────────────────────────────────────────────────────────────────────────
const TICKET_MODES: Record<string, {
  pricePerTicket: number;
  minCharge: number;
  model: string;
  modelLabel: string;
  label: string;
  description: string;
  maxTokensPerTicket: number;
}> = {
  fast: {
    pricePerTicket: 3,
    minCharge: 15,
    model: "gpt-4o-mini",
    modelLabel: "GPT-4o mini",
    label: "Быстрый",
    description: "Краткие ответы, основные определения",
    maxTokensPerTicket: 400,
  },
  standard: {
    pricePerTicket: 7,
    minCharge: 25,
    model: "gpt-4o-mini",
    modelLabel: "GPT-4o mini",
    label: "Стандарт",
    description: "Развёрнутые ответы с примерами",
    maxTokensPerTicket: 700,
  },
  premium: {
    pricePerTicket: 15,
    minCharge: 45,
    model: "gpt-4o",
    modelLabel: "GPT-4o",
    label: "Премиум",
    description: "Подробные ответы, схемы, связи между темами",
    maxTokensPerTicket: 1200,
  },
  super_premium: {
    pricePerTicket: 40,
    minCharge: 120,
    model: "gpt-4o",
    modelLabel: "GPT-4o",
    label: "Супер Премиум",
    description: "Академические ответы экзаменационного уровня с разбором",
    maxTokensPerTicket: 2000,
  },
};

function calcTicketCost(mode: string, ticketCount: number): number {
  const m = TICKET_MODES[mode] ?? TICKET_MODES.standard;
  return Math.max(m.minCharge, m.pricePerTicket * ticketCount);
}

// Parse questions from text (numbered list or newline-separated)
// Handles short answers like "ДНК", "pH", single-word topics, etc.
function parseQuestions(text: string): string[] {
  const lines = text
    .split(/\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  return lines
    .map(line => line.replace(/^[\d]+[.):\s]+/, "").trim())
    .filter(q => q.length > 0)
    .slice(0, 100); // max 100 билетов за раз
}

// ── GET /api/tickets/modes — список режимов с ценами
router.get("/modes", (req, res) => {
  const result: Record<string, any> = {};
  for (const [key, cfg] of Object.entries(TICKET_MODES)) {
    result[key] = {
      label: cfg.label,
      description: cfg.description,
      pricePerTicket: cfg.pricePerTicket,
      minCharge: cfg.minCharge,
      modelLabel: cfg.modelLabel,
    };
  }
  res.json(result);
});

// ── POST /api/tickets/estimate — предварительная стоимость
router.post("/estimate", requireAuth, (req, res) => {
  const { mode, ticketCount } = req.body;
  if (!mode || !TICKET_MODES[mode]) {
    res.status(400).json({ error: "validation_error", message: "Укажите корректный режим" });
    return;
  }
  const count = Math.max(1, Math.min(100, parseInt(ticketCount) || 1));
  const cost = calcTicketCost(mode, count);
  const cfg = TICKET_MODES[mode];
  res.json({
    mode, ticketCount: count, cost,
    pricePerTicket: cfg.pricePerTicket,
    minCharge: cfg.minCharge,
    label: cfg.label,
    modelLabel: cfg.modelLabel,
  });
});

// ── POST /api/tickets — создать билеты
router.post("/", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const {
      subject,
      questions: questionsRaw,
      mode,
      educationLevel,
      fileData,     // base64
      fileType,     // MIME
      fileName,
    } = req.body;

    if (!subject?.trim()) {
      res.status(400).json({ error: "validation_error", message: "Укажите предмет" });
      return;
    }
    if (!questionsRaw || typeof questionsRaw !== "string" || questionsRaw.trim().length < 1) {
      res.status(400).json({ error: "validation_error", message: "Укажите список вопросов/тем для билетов" });
      return;
    }
    if (!mode || !TICKET_MODES[mode]) {
      res.status(400).json({ error: "validation_error", message: "Укажите режим" });
      return;
    }

    const questions = parseQuestions(questionsRaw);
    if (questions.length === 0) {
      res.status(400).json({ error: "validation_error", message: "Не удалось распознать вопросы. Введите по одному вопросу на строку." });
      return;
    }

    const baseCost = calcTicketCost(mode, questions.length);
    const cfg = TICKET_MODES[mode];
    const sb = getSupabaseAdmin();

    // Извлекаем текст из учебника (если загружен)
    let textbookText = "";
    if (fileData && fileType && fileName) {
      try {
        const raw = await extractTextFromFile(fileData, fileType, fileName);
        // Ограничиваем до 60 000 символов чтобы не перегрузить контекст
        textbookText = raw.slice(0, 60000);
      } catch {
        textbookText = "";
      }
    }

    // Формируем промпт
    const subjectStr = subject.trim();
    const eduStr = educationLevel === "school" ? "школьный уровень" :
      educationLevel === "master" ? "уровень магистратуры" :
      educationLevel === "phd" ? "уровень аспирантуры" : "уровень бакалавриата";
    const answerLength = cfg.maxTokensPerTicket <= 400 ? "краткий (3–5 предложений)" :
      cfg.maxTokensPerTicket <= 700 ? "развёрнутый (1–2 абзаца с примером)" :
      cfg.maxTokensPerTicket <= 1200 ? "подробный (3–4 абзаца, схемы, связи)" :
      "академический (полный разбор, структура, примеры, возможные дополнительные вопросы)";

    const questionsBlock = questions.map((q, i) => `${i + 1}. ${q}`).join("\n");

    const systemPrompt = `Ты — опытный преподаватель и экзаменатор. Твоя задача — составить подробные ответы на экзаменационные билеты.

Предмет: ${subjectStr}
Уровень: ${eduStr}
Формат ответа: ${answerLength}

${textbookText ? `Ниже приведён текст учебника/материалов по предмету. Используй его как основной источник.\n\n---УЧЕБНИК---\n${textbookText}\n---КОНЕЦ УЧЕБНИКА---\n` : ""}

Ответь на ВСЕ вопросы ниже. Для каждого вопроса:
1. Дай чёткое определение / ответ
2. Объясни суть (основные положения)
3. Приведи конкретный пример (если применимо)
4. Укажи ключевые термины, которые важно упомянуть на экзамене
Используй Markdown: заголовки, списки, жирный текст. Формулы пиши в LaTeX ($...$).

СПИСОК ВОПРОСОВ:
${questionsBlock}

Отвечай в формате:
## Билет 1. [Вопрос]
[Развёрнутый ответ]

## Билет 2. [Вопрос]
[Развёрнутый ответ]

...и так для всех ${questions.length} вопросов.`;

    // Атомарное списание ДО AI
    const charge = await chargeAtomic({
      userId: user.id, baseCost,
      description: `Экзаменационные билеты: ${subjectStr}`,
      logger: (req as any).log,
    });
    if (!charge.ok) {
      res.status(charge.status).json({ error: charge.error, message: charge.message, required: charge.required, balance: charge.balance });
      return;
    }
    const cost = charge.cost;
    const subscribed = charge.subscribed;

    // Вызов AI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    });
    const maxOut = cfg.maxTokensPerTicket * questions.length;

    let resultText: string;
    try {
      const aiResp = await openai.chat.completions.create({
        model: cfg.model,
        max_tokens: Math.min(maxOut, 16000),
        messages: [{ role: "user", content: systemPrompt }],
      });
      resultText = aiResp.choices[0]?.message?.content || "";
      if (!resultText.trim()) throw new Error("Empty AI response");
    } catch (aiErr: any) {
      await charge.refund("AI error");
      (req as any).log?.error({ err: aiErr }, "Tickets AI error");
      res.status(502).json({ error: "ai_error", message: "ИИ временно недоступен. Деньги возвращены." });
      return;
    }

    // Сохранение и списание
    const title = `Экзаменационные билеты: ${subjectStr} (${questions.length} вопросов)`;
    let taskId: number | undefined;

    if (sb) {
      const { data } = await sb.from("Neyrozachet_tasks").insert({
        user_id: user.id,
        title,
        description: `Режим: ${cfg.label}\n\nВопросы:\n${questionsBlock}`,
        subject: subjectStr,
        task_type: "exam_tickets",
        education_level: educationLevel || "bachelor",
        solving_mode: mode,
        status: "completed",
        complexity_score: Math.min(10, Math.ceil(questions.length / 5)),
        estimated_cost: cost,
        actual_cost: cost,
        estimated_time: Math.ceil(questions.length * 0.3),
        result: resultText,
        completed_at: new Date().toISOString(),
      }).select("id").single();
      taskId = data?.id;
    } else {
      const { db, tasksTable } = await import("@workspace/db");
      const [t] = await db.insert(tasksTable).values({
        userId: user.id,
        title,
        description: `Режим: ${cfg.label}\n\nВопросы:\n${questionsBlock}`,
        subject: subjectStr,
        taskType: "exam_tickets" as any,
        educationLevel: (educationLevel || "bachelor") as any,
        solvingMode: mode as any,
        status: "completed",
        complexityScore: Math.min(10, Math.ceil(questions.length / 5)),
        estimatedCost: cost,
        actualCost: cost,
        estimatedTime: Math.ceil(questions.length * 0.3),
        result: resultText,
        completedAt: new Date(),
      }).returning();
      taskId = t?.id;
    }

    res.json({
      success: true,
      taskId,
      ticketCount: questions.length,
      cost,
      balanceAfter: charge.balanceAfter,
      mode,
      subscribed,
      result: resultText,
    });
  } catch (err: any) {
    (req as any).log?.error({ err }, "Tickets generation error");
    res.status(500).json({ error: "internal_error", message: err?.message || "Ошибка генерации билетов" });
  }
});

export default router;
