import { Router } from "express";
import { saveImageFromUrl } from "../lib/imageSave.js";
import { getSupabaseAdmin } from "../lib/supabase.js";
import { ListTasksQueryParams, CreateTaskBody, EstimateTaskBody, GetTaskParams } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { callAIForTask } from "../lib/ai";
import { isImageMime, extractTextFromFile } from "../lib/file-extract";
import { sendTaskCompletedEmail } from "../lib/email.js";
import { isUserSubscribed } from "../lib/subscription.js";
import { getPricing } from "../lib/settings.js";
import { chargeAtomic } from "../lib/billing.js";

const router = Router();

/**
 * Применяет тариф «Месяц безлимит»: если пользователь подписан, цена обнуляется.
 */
async function applySubscription(userId: number, baseCost: number): Promise<{ cost: number; subscribed: boolean }> {
  if (baseCost <= 0) return { cost: 0, subscribed: false };
  const subscribed = await isUserSubscribed(userId);
  return { cost: subscribed ? 0 : baseCost, subscribed };
}

// ──────────────────────────────────────────────────────────────────────────────
// Анализ себестоимости (апр 2025, $1=90₽):
//   Fast:          DeepSeek-V3 ($0.27/1M) + GPT-4o-mini ($0.15+$0.6/1M) → Gemini Flash
//                  API cost ≈ 0.37₽  → minPrice 5₽   (margin ~93%)
//   Standard:      DeepSeek-V3 + GPT-4o ($2.5+$10/1M) + Claude Sonnet ($3+$15/1M) → Gemini Flash
//                  API cost ≈ 4.11₽  → minPrice 15₽  (margin ~73%)
//   Premium:       DeepSeek-R1 ($0.55+$2.19/1M) + GPT-4o + Gemini 2.5 Pro ($1.25+$10/1M) → Claude Sonnet
//                  API cost ≈ 8.12₽  → minPrice 25₽  (margin ~67%)
//   Super Premium: same workers → Claude Opus ($15+$75/1M)
//                  API cost ≈ 30.61₽ → minPrice 89₽  (margin ~66%)
//   Image DALL-E3: $0.04/img = 3.6₽  → price 8₽     (margin ~55%)
// ──────────────────────────────────────────────────────────────────────────────
// MODE_CONFIG теперь загружается из settings (lib/settings.ts → PRICING_DEFAULTS.taskModes).
// Цены можно править через админ-панель «Тарифы».

async function getModeConfig() {
  return (await getPricing()).taskModes;
}

async function estimateCostAndTime(mode: string, complexity: number, forSection = false) {
  const cfg = await getModeConfig();
  const m = cfg[mode] ?? cfg.standard;
  const complexityFactor = 1 + complexity / 10;
  const min = forSection ? m.minSectionPrice : m.minPrice;
  return {
    cost: Math.max(min, Math.round(m.costRub * complexityFactor * m.markup)),
    minutes: Math.ceil(m.baseTime * complexityFactor),
  };
}

function calcComplexity(subject: string, taskType: string, description: string, educationLevel?: string): number {
  let score = 3;
  const subj = subject.toLowerCase();
  const desc = (description || "").toLowerCase();

  // Технические предметы — повышенная сложность
  const highTech = ["математика", "матанализ", "линейная алгебра", "физика", "химия", "теормех",
    "сопромат", "термодинамика", "статистика", "теорвер", "дифференциальные уравнения", "программирование",
    "алгоритмы", "базы данных", "sql", "python", "java", "c++", "машинное обучение"];
  if (highTech.some((s) => subj.includes(s))) score += 2;

  // Тип работы
  if (["coursework", "diploma"].includes(taskType)) score += 3;
  else if (["lab"].includes(taskType)) score += 1;
  else if (["essay"].includes(taskType)) score += 0;

  // Уровень образования (enum: school, bachelor, master, phd, other)
  if (educationLevel === "phd") score += 3;
  else if (educationLevel === "master") score += 2;
  else if (educationLevel === "school") score -= 1;

  // Описание: длина и ключевые слова
  if (description.length > 700) score += 2;
  else if (description.length > 300) score += 1;

  // Сложность по содержанию
  const hardKeywords = ["доказать", "вывести формулу", "аналитически", "численный метод",
    "дифференциальное", "интегральное", "оптимизация", "алгоритм", "архитектура",
    "глубокий анализ", "сравнительный анализ", "обоснование", "магистерская"];
  if (hardKeywords.some((k) => desc.includes(k))) score += 1;

  // Объём: явное указание страниц/задач усложняет оценку
  const pageMatch = desc.match(/(\d+)\s*страниц/);
  if (pageMatch && parseInt(pageMatch[1]) > 40) score += 1;

  return Math.min(10, Math.max(1, score));
}

// Для тестов — считаем количество вопросов (если указано)
function estimateTestQuestions(taskType: string, description: string): number {
  if (taskType !== "test") return 1;
  const m = description.match(/(\d+)\s*(вопрос|задани|задач|тест)/i);
  if (m) return Math.max(1, Math.min(100, parseInt(m[1])));
  return 1;
}

// Для курсовых/дипломных — считаем количество разделов
function estimateSections(taskType: string, description: string): number {
  const multiTypes = ["coursework", "diploma"];
  if (!multiTypes.includes(taskType)) return 1;

  const sectMatch = description.match(/(\d+)\s*(разделов|раздела|раздел|глав|главы|глава|секций|секции|секция)/i);
  if (sectMatch) return Math.max(2, Math.min(15, parseInt(sectMatch[1])));

  const pageMatch = description.match(/(\d+)\s*страниц/i);
  if (pageMatch) {
    const pages = parseInt(pageMatch[1]);
    const pps = taskType === "diploma" ? 6 : 8;
    return Math.max(3, Math.min(15, Math.round(pages / pps)));
  }

  const defaults: Record<string, number> = { coursework: 6, diploma: 10 };
  return defaults[taskType] ?? 1;
}

// Детектирование случаев когда ИИ явно говорит что не может решить задачу
function detectAIFailure(result: string): { failed: boolean; reason: string } {
  const patterns: { pattern: RegExp; reason: string }[] = [
    { pattern: /все\s+ии.{0,25}недоступн/i, reason: "Все ИИ-модели недоступны" },
    { pattern: /не\s+могу\s+решить\s+эту?\s+задач/i, reason: "ИИ не может решить задачу" },
    { pattern: /не\s+могу\s+выполнить\s+эту?\s+задач/i, reason: "ИИ не может выполнить задачу" },
    { pattern: /невозможно\s+решить\s+эту?\s+задач/i, reason: "Задача неразрешима в данном формате" },
    { pattern: /требует(ся)?\s+(специализированн|специальн).{0,50}программ/i, reason: "Требуется специализированное ПО" },
    { pattern: /(matlab|autocad|solidworks|ansys|labview|simulink|stata|spss).{0,80}(необходим|нужн|требует)/i, reason: "Требуется специализированная программа" },
    { pattern: /нечитаем\w{0,5}\s+изображени/i, reason: "Нечитаемое изображение" },
    { pattern: /плохое\s+качество.{0,30}изображени/i, reason: "Плохое качество изображения" },
    { pattern: /не\s+удаётся\s+разобрать.{0,40}изображени/i, reason: "Нечитаемое изображение" },
    { pattern: /недостаточно\s+данных\s+для\s+решени/i, reason: "Недостаточно данных" },
    { pattern: /обратитесь\s+к\s+(специалист|репетитор|преподавател)/i, reason: "Требуется специалист" },
    { pattern: /не\s+в\s+состоянии\s+(решить|выполнить|обработать)/i, reason: "ИИ не в состоянии решить" },
    { pattern: /выходит\s+за\s+рамки\s+(моих\s+)?(возможностей|способностей)/i, reason: "Задача вне возможностей ИИ" },
  ];
  for (const { pattern, reason } of patterns) {
    if (pattern.test(result)) return { failed: true, reason };
  }
  return { failed: false, reason: "" };
}

function mapTask(t: any) {
  return {
    id: String(t.id), title: t.title, description: t.description ?? null,
    subject: t.subject, taskType: t.task_type ?? t.taskType,
    educationLevel: t.education_level ?? t.educationLevel ?? null,
    solvingMode: t.solving_mode ?? t.solvingMode,
    status: t.status,
    complexityScore: t.complexity_score ?? t.complexityScore ?? null,
    estimatedCost: t.estimated_cost ?? t.estimatedCost,
    actualCost: t.actual_cost ?? t.actualCost ?? null,
    estimatedTime: t.estimated_time ?? t.estimatedTime ?? null,
    result: t.result ?? null,
    createdAt: t.created_at instanceof Date ? t.created_at.toISOString() : (t.created_at ?? t.createdAt),
    completedAt: t.completed_at ? (t.completed_at instanceof Date ? t.completed_at.toISOString() : t.completed_at) : (t.completedAt ? t.completedAt.toISOString() : null),
  };
}

router.get("/estimate", requireAuth, async (req, res) => {
  res.json({ message: "use POST /api/tasks/estimate" });
});

router.post("/estimate", async (req, res) => {
  try {
    const parsed = EstimateTaskBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "validation_error", message: "Invalid request data" }); return; }
    const { description, subject, taskType, educationLevel } = parsed.data;
    const complexity = calcComplexity(subject, taskType, description, educationLevel);
    const sections   = estimateSections(taskType, description);
    const questions  = estimateTestQuestions(taskType, description);
    const isMulti    = sections > 1;
    const isMultiQ   = questions > 1;

    const modeConfigForEst = await getModeConfig();
    async function modeEstimate(mode: string) {
      const cfg = modeConfigForEst[mode] ?? modeConfigForEst.standard;

      if (isMulti) {
        // Курсовые/дипломные: план + разделы по minSectionPrice
        const perSec = await estimateCostAndTime(mode, complexity, true);
        return {
          cost: perSec.cost * sections,
          timeMinutes: 1 + perSec.minutes * sections,
          perSectionCost: perSec.cost,
          sectionCount: sections,
          questionCount: undefined,
          perQuestionCost: undefined,
        };
      } else if (isMultiQ) {
        // Тест с указанным числом вопросов: цена за вопрос
        const perQ = cfg.perQuestion;
        const base = await estimateCostAndTime(mode, complexity);
        return {
          cost: perQ * questions,
          timeMinutes: base.minutes,
          perSectionCost: undefined,
          sectionCount: undefined,
          questionCount: questions,
          perQuestionCost: perQ,
        };
      } else {
        // Разовое задание
        const base = await estimateCostAndTime(mode, complexity);
        return {
          cost: base.cost,
          timeMinutes: base.minutes,
          perSectionCost: undefined,
          sectionCount: undefined,
          questionCount: undefined,
          perQuestionCost: undefined,
        };
      }
    }

    const fast  = modeEstimate("fast");
    const std   = modeEstimate("standard");
    const prem  = modeEstimate("premium");
    const sprm  = modeEstimate("super_premium");

    let recommendedMode = "standard";
    if (complexity <= 3 && !isMulti) recommendedMode = "fast";
    else if (complexity >= 8 || (isMulti && sections >= 10)) recommendedMode = "super_premium";
    else if (complexity >= 5 || isMulti) recommendedMode = "premium";

    const modeDesc = isMulti
      ? { suffix: "синтезирует каждый раздел" }
      : { suffix: "синтезирует финальный ответ" };

    res.json({
      complexityScore: complexity, subject, taskType,
      educationLevel: educationLevel || "bachelor", recommendedMode,
      sectionCount: isMulti ? sections : 1,
      isMultiSection: isMulti,
      questionCount: isMultiQ ? questions : undefined,
      isMultiQuestion: isMultiQ,
      modes: {
        fast:          { ...fast,  description: `DeepSeek-V3 + GPT-4o-mini параллельно, Gemini 2.0 Flash ${modeDesc.suffix}` },
        standard:      { ...std,   description: `DeepSeek-V3 + GPT-4o + Claude Sonnet параллельно, Gemini Flash ${modeDesc.suffix}` },
        premium:       { ...prem,  description: `DeepSeek-R1 + GPT-4o + Gemini 2.5 Pro параллельно, Claude Sonnet ${modeDesc.suffix}` },
        super_premium: { ...sprm,  description: `DeepSeek-R1 + GPT-4o + Gemini 2.5 Pro параллельно, Claude Opus ${modeDesc.suffix}` },
      },
    });
  } catch (err) {
    req.log.error({ err }, "EstimateTask error");
    res.status(500).json({ error: "internal_error", message: "Internal server error" });
  }
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const parsed = ListTasksQueryParams.safeParse(req.query);
    const params = parsed.success ? parsed.data : { page: 1, limit: 10 };
    const page = params.page || 1;
    const limit = params.limit || 10;
    const sb = getSupabaseAdmin();

    let allTasks: any[] = [];
    if (sb) {
      const { data } = await sb.from("Neyrozachet_tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      allTasks = data ?? [];
    } else {
      const { db, tasksTable } = await import("@workspace/db");
      const { eq, desc } = await import("drizzle-orm");
      const tasks = await db.select().from(tasksTable).where(eq(tasksTable.userId, user.id)).orderBy(desc(tasksTable.createdAt));
      allTasks = tasks.map((t) => ({ ...t, task_type: t.taskType, solving_mode: t.solvingMode, complexity_score: t.complexityScore, estimated_cost: t.estimatedCost, actual_cost: t.actualCost, estimated_time: t.estimatedTime, education_level: t.educationLevel, created_at: t.createdAt, completed_at: t.completedAt }));
    }

    let filtered = allTasks;
    if ((params as any).status) filtered = filtered.filter((t) => t.status === (params as any).status);
    if ((params as any).subject) filtered = filtered.filter((t) => t.subject === (params as any).subject);
    if ((params as any).search) {
      const q = ((params as any).search as string).toLowerCase();
      filtered = filtered.filter((t) =>
        (t.title || "").toLowerCase().includes(q) ||
        (t.subject || "").toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q)
      );
    }

    const total = filtered.length;
    const offset = (page - 1) * limit;
    const paginated = filtered.slice(offset, offset + limit);

    res.json({ tasks: paginated.map(mapTask), total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    req.log.error({ err }, "ListTasks error");
    res.status(500).json({ error: "internal_error", message: "Internal server error" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const parsed = CreateTaskBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "validation_error", message: "Invalid request data" }); return; }

    const { title, description, subject, taskType, educationLevel, solvingMode, attachmentData, attachmentType, attachmentName } = parsed.data;
    const complexity = calcComplexity(subject, taskType, description || "", educationLevel);
    const sections  = estimateSections(taskType, description || "");
    const questions = estimateTestQuestions(taskType, description || "");
    const isMulti   = sections > 1;
    const isMultiQ  = questions > 1;
    const perSection = await estimateCostAndTime(solvingMode, complexity, isMulti);
    const modeCfgCreate = await getModeConfig();
    const baseCost = isMulti
      ? perSection.cost * sections
      : isMultiQ
        ? (modeCfgCreate[solvingMode]?.perQuestion ?? 5) * questions
        : perSection.cost;
    const minutes = isMulti ? 1 + perSection.minutes * sections : perSection.minutes;

    const sb = getSupabaseAdmin();

    // Атомарное списание ДО создания задачи и AI-вызова
    const charge = await chargeAtomic({
      userId: user.id, baseCost,
      description: `Задание: ${title}`,
      logger: req.log,
    });
    if (!charge.ok) {
      res.status(charge.status).json({ error: charge.error, message: charge.message, required: charge.required, balance: charge.balance });
      return;
    }
    const cost = charge.cost;
    const subscribed = charge.subscribed;

    let task: any;
    if (sb) {
      const { data } = await sb.from("Neyrozachet_tasks").insert({
        user_id: user.id, title, description: description || null, subject,
        task_type: taskType, education_level: educationLevel || null,
        solving_mode: solvingMode, status: "processing",
        complexity_score: complexity, estimated_cost: cost,
        actual_cost: cost, estimated_time: minutes,
      }).select().single();
      task = data;
    } else {
      const { db, tasksTable } = await import("@workspace/db");
      const [t] = await db.insert(tasksTable).values({ userId: user.id, title, description: description || null, subject, taskType: taskType as any, educationLevel: educationLevel || null, solvingMode: solvingMode as any, status: "processing", complexityScore: complexity, estimatedCost: cost, actualCost: cost, estimatedTime: minutes }).returning();
      task = { ...t, task_type: t.taskType, solving_mode: t.solvingMode, complexity_score: t.complexityScore, estimated_cost: t.estimatedCost, actual_cost: t.actualCost, estimated_time: t.estimatedTime, education_level: t.educationLevel, created_at: t.createdAt, completed_at: t.completedAt };
    }
    if (!task) {
      // Не удалось создать задачу — возвращаем деньги
      await charge.refund("Не удалось создать задачу");
      res.status(500).json({ error: "internal_error", message: "Не удалось создать задачу. Деньги возвращены." });
      return;
    }

    res.status(201).json(mapTask(task));

    // Solve task async
    setImmediate(async () => {
      try {
        let extractedText: string | null = null;
        if (attachmentData && attachmentType && !isImageMime(attachmentType)) {
          try { extractedText = await extractTextFromFile(attachmentData, attachmentType, attachmentName || "file"); } catch {}
        }
        const descWithExtract = extractedText ? `${description || ""}\n\n[Содержимое файла: ${attachmentName}]\n${extractedText}` : (description || "");
        const result = await callAIForTask({ title, description: descWithExtract, subject, taskType, solvingMode, complexity, attachmentData: isImageMime(attachmentType || "") ? attachmentData : undefined, attachmentType: isImageMime(attachmentType || "") ? attachmentType : undefined, attachmentName });

        const aiFailure = detectAIFailure(result);

        if (aiFailure.failed) {
          // ИИ не справился — возвращаем деньги (если списывали) и ставим статус needs_manual
          if (sb) {
            await sb.from("Neyrozachet_tasks").update({ status: "needs_manual", result, completed_at: new Date().toISOString() }).eq("id", task.id);
          } else {
            const { db, tasksTable } = await import("@workspace/db");
            const { eq } = await import("drizzle-orm");
            await db.update(tasksTable).set({ status: "needs_manual", result, completedAt: new Date() } as any).where(eq(tasksTable.id, task.id));
          }
          await charge.refund(`ИИ не справился — ${aiFailure.reason}`);
        } else {
          if (sb) {
            await sb.from("Neyrozachet_tasks").update({ status: "completed", result, completed_at: new Date().toISOString() }).eq("id", task.id);
          } else {
            const { db, tasksTable } = await import("@workspace/db");
            const { eq } = await import("drizzle-orm");
            await db.update(tasksTable).set({ status: "completed", result, completedAt: new Date() }).where(eq(tasksTable.id, task.id));
          }
          // Письмо «Решение готово» — только подтверждённым адресам
          if (user.email_verified) {
            sendTaskCompletedEmail(user.email, user.name, title, task.id).catch((e) => {
              req.log.warn({ err: e, taskId: task.id }, "Не удалось отправить письмо о готовом решении");
            });
          }
        }
      } catch (err) {
        if (sb) {
          await sb.from("Neyrozachet_tasks").update({ status: "failed" }).eq("id", task.id);
        } else {
          const { db, tasksTable } = await import("@workspace/db");
          const { eq } = await import("drizzle-orm");
          await db.update(tasksTable).set({ status: "failed" }).where(eq(tasksTable.id, task.id));
        }
        // Возвращаем деньги при сбое AI
        await charge.refund("AI exception");
      }
    });
  } catch (err) {
    req.log.error({ err }, "CreateTask error");
    res.status(500).json({ error: "internal_error", message: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Генерация изображения через DALL-E 3
// ──────────────────────────────────────────────────────────────────────────────
router.post("/generate-image", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { prompt, taskId } = req.body;
    if (!prompt || typeof prompt !== "string") {
      res.status(400).json({ error: "validation_error", message: "prompt required" });
      return;
    }

    const BASE_COST = (await getPricing()).imageGeneration.cost; // ₽ за изображение DALL-E 3

    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");

    // Атомарное списание ДО вызова DALL-E
    const charge = await chargeAtomic({
      userId: user.id, baseCost: BASE_COST,
      description: `Генерация изображения DALL-E 3${taskId ? ` (задача #${taskId})` : ""}`,
      logger: req.log,
    });
    if (!charge.ok) {
      res.status(charge.status).json({ error: charge.error, message: charge.message, required: charge.required, balance: charge.balance });
      return;
    }

    try {
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const enhancedPrompt = `Academic illustration for student work, clear and educational, high quality. ${prompt}`;

      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: enhancedPrompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        response_format: "url",
      });

      const dalleUrl = response.data?.[0]?.url;
      if (!dalleUrl) {
        await charge.refund("No image URL returned");
        res.status(502).json({ error: "generation_failed", message: "ИИ не вернул изображение. Деньги возвращены." });
        return;
      }

      let imageUrl = dalleUrl;
      try {
        const objectPath = await saveImageFromUrl(dalleUrl, "illustrations");
        imageUrl = `/api/storage${objectPath}`;
      } catch { }

      res.json({ url: imageUrl, cost: charge.cost });
    } catch (aiErr: any) {
      await charge.refund("DALL-E error");
      throw aiErr;
    }
  } catch (err: any) {
    console.error("generate-image error:", err);
    res.status(500).json({ error: "generation_failed", message: err?.message ?? "Ошибка генерации" });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Верификация изображения — ИИ считывает данные, пользователь подтверждает
// Не сохраняет в БД, не списывает баланс
// ──────────────────────────────────────────────────────────────────────────────
router.post("/verify-image", requireAuth, async (req, res) => {
  try {
    const { attachmentData, attachmentType, subject, description } = req.body;
    if (!attachmentData || !attachmentType) {
      res.status(400).json({ error: "validation_error", message: "attachmentData and attachmentType required" });
      return;
    }
    if (!attachmentType.startsWith("image/")) {
      res.status(400).json({ error: "validation_error", message: "Only image files are supported for verification" });
      return;
    }
    const { extractImageContent } = await import("../lib/ai");
    const result = await extractImageContent(attachmentData, attachmentType, subject || "учёба", description);
    res.json({ extractedText: result.extractedText, summary: result.summary, quality: result.quality, qualityNote: result.qualityNote });
  } catch (err) {
    req.log.error({ err }, "VerifyImage error");
    res.status(500).json({ error: "internal_error", message: "Не удалось извлечь данные из изображения" });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Доработка задачи — повторный запуск с замечаниями, 40% от исходной стоимости
// ──────────────────────────────────────────────────────────────────────────────
router.post("/:taskId/revision", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId)) { res.status(400).json({ error: "validation_error", message: "Invalid task ID" }); return; }

    const { revisionNotes } = req.body;
    if (!revisionNotes || typeof revisionNotes !== "string" || revisionNotes.trim().length < 5) {
      res.status(400).json({ error: "validation_error", message: "Укажите замечания для доработки (минимум 5 символов)" });
      return;
    }

    const sb = getSupabaseAdmin();
    let originalTask: any;
    if (sb) {
      const { data } = await sb.from("Neyrozachet_tasks").select("*").eq("id", taskId).eq("user_id", user.id).single();
      originalTask = data;
    } else {
      const { db, tasksTable } = await import("@workspace/db");
      const { eq, and } = await import("drizzle-orm");
      const [t] = await db.select().from(tasksTable).where(and(eq(tasksTable.id, taskId), eq(tasksTable.userId, user.id)));
      if (t) originalTask = { ...t, task_type: t.taskType, solving_mode: t.solvingMode, estimated_cost: t.estimatedCost, actual_cost: t.actualCost, education_level: t.educationLevel };
    }

    if (!originalTask) { res.status(404).json({ error: "not_found", message: "Задача не найдена" }); return; }
    if (originalTask.status !== "completed") {
      res.status(422).json({ error: "invalid_state", message: "Доработка возможна только после завершения задачи" });
      return;
    }

    // Стоимость доработки считается из самих замечаний — сколько работы нужно сделать
    // (не процент от оригинала: правка одного абзаца ≠ 40% диплома)
    const solvingMode = originalTask.solving_mode || "standard";
    const revComplexity = calcComplexity(originalTask.subject || "other", "homework", revisionNotes.trim());
    const revEst = await estimateCostAndTime(solvingMode, revComplexity, false);
    const revisionMinutes = revEst.minutes;

    // Атомарное списание ДО создания доработки
    const charge = await chargeAtomic({
      userId: user.id, baseCost: revEst.cost,
      description: `Доработка: ${originalTask.title}`,
      logger: req.log,
    });
    if (!charge.ok) {
      res.status(charge.status).json({ error: charge.error, message: charge.message, required: charge.required, balance: charge.balance });
      return;
    }
    const revisionCost = charge.cost;
    const subRev = charge.subscribed;

    // Создаём задачу-доработку
    const revTitle = `Доработка: ${originalTask.title}`;
    const revDescription = `Доработай следующую работу согласно замечаниям.\n\nОригинальное решение:\n${originalTask.result || "(результат недоступен)"}\n\n---\nЗамечания пользователя:\n${revisionNotes.trim()}`;

    let revTask: any;
    if (sb) {
      const { data } = await sb.from("Neyrozachet_tasks").insert({
        user_id: user.id, title: revTitle, description: revDescription,
        subject: originalTask.subject, task_type: originalTask.task_type,
        education_level: originalTask.education_level,
        solving_mode: solvingMode, status: "processing",
        complexity_score: revComplexity,
        estimated_cost: revisionCost, actual_cost: revisionCost,
        estimated_time: revisionMinutes,
      }).select().single();
      revTask = data;
    } else {
      const { db, tasksTable } = await import("@workspace/db");
      const [t] = await db.insert(tasksTable).values({
        userId: user.id, title: revTitle, description: revDescription,
        subject: originalTask.subject, taskType: (originalTask.task_type || "homework") as any,
        educationLevel: originalTask.education_level,
        solvingMode: solvingMode as any, status: "processing",
        complexityScore: revComplexity,
        estimatedCost: revisionCost, actualCost: revisionCost,
        estimatedTime: revisionMinutes,
      }).returning();
      revTask = { ...t, task_type: t.taskType, solving_mode: t.solvingMode, complexity_score: t.complexityScore, estimated_cost: t.estimatedCost, actual_cost: t.actualCost, estimated_time: t.estimatedTime, education_level: t.educationLevel, created_at: t.createdAt, completed_at: t.completedAt };
    }
    if (!revTask) {
      await charge.refund("Не удалось создать доработку");
      res.status(500).json({ error: "internal_error", message: "Не удалось создать доработку. Деньги возвращены." });
      return;
    }
    void subRev;

    res.status(201).json({ ...mapTask(revTask), revisionCost });

    // Решаем доработку асинхронно
    setImmediate(async () => {
      try {
        const { callAIForTask } = await import("../lib/ai");
        const result = await callAIForTask({
          title: revTitle, description: revDescription,
          subject: originalTask.subject, taskType: originalTask.task_type || "homework",
          solvingMode, complexity: originalTask.complexity_score || 5,
        });
        if (sb) {
          await sb.from("Neyrozachet_tasks").update({ status: "completed", result, completed_at: new Date().toISOString() }).eq("id", revTask.id);
        } else {
          const { db, tasksTable } = await import("@workspace/db");
          const { eq } = await import("drizzle-orm");
          await db.update(tasksTable).set({ status: "completed", result, completedAt: new Date() }).where(eq(tasksTable.id, revTask.id));
        }
        // Письмо «Решение готово» (доработка задачи) — только подтверждённым адресам
        if (user.email_verified) {
          sendTaskCompletedEmail(user.email, user.name, revTitle, revTask.id).catch((e) => {
            req.log.warn({ err: e, taskId: revTask.id }, "Не удалось отправить письмо о доработке");
          });
        }
      } catch {
        if (sb) await sb.from("Neyrozachet_tasks").update({ status: "failed" }).eq("id", revTask.id);
        else {
          const { db, tasksTable } = await import("@workspace/db");
          const { eq } = await import("drizzle-orm");
          await db.update(tasksTable).set({ status: "failed" }).where(eq(tasksTable.id, revTask.id));
        }
      }
    });
  } catch (err) {
    req.log.error({ err }, "Revision error");
    res.status(500).json({ error: "internal_error", message: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Запрос ручного решения — пользователь хочет решение от живого специалиста
// Работает для статусов: needs_manual (ИИ не справился) и completed (не устраивает качество)
// ──────────────────────────────────────────────────────────────────────────────
router.post("/:taskId/request-manual", requireAuth, async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId)) { res.status(400).json({ error: "validation_error", message: "Invalid task ID" }); return; }
    const user = (req as any).user;

    let task: any = null;
    if (sb) {
      const { data } = await sb.from("Neyrozachet_tasks").select("*").eq("id", taskId).eq("user_id", user.id).single();
      task = data;
    } else {
      const { db, tasksTable } = await import("@workspace/db");
      const { eq, and } = await import("drizzle-orm");
      const rows = await db.select().from(tasksTable).where(and(eq(tasksTable.id, taskId), eq(tasksTable.userId, user.id)));
      task = rows[0] ?? null;
    }

    if (!task) { res.status(404).json({ error: "not_found", message: "Задача не найдена" }); return; }

    const currentStatus = task.status;
    if (!["needs_manual", "completed", "failed"].includes(currentStatus)) {
      res.status(422).json({ error: "invalid_state", message: "Запрос ручного решения доступен только после обработки задачи" });
      return;
    }

    if (sb) {
      await sb.from("Neyrozachet_tasks").update({ status: "manual_requested" }).eq("id", taskId);
      await sb.from("Neyrozachet_transactions").insert({ user_id: user.id, type: "manual_request", amount: 0, description: `Запрос ручного решения: задача #${taskId}` });
    } else {
      const { db, tasksTable, transactionsTable } = await import("@workspace/db");
      const { eq } = await import("drizzle-orm");
      await db.update(tasksTable).set({ status: "manual_requested" } as any).where(eq(tasksTable.id, taskId));
      await db.insert(transactionsTable).values({ userId: user.id, type: "manual_request", amount: 0, description: `Запрос ручного решения: задача #${taskId}` });
    }

    res.json({ success: true, message: "Запрос на ручное решение принят. Специалист свяжется с вами в ближайшее время." });
  } catch (err) {
    req.log.error({ err }, "RequestManual error");
    res.status(500).json({ error: "internal_error", message: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Конспект темы — бесплатный (не списывает баланс, короткий запрос)
// ──────────────────────────────────────────────────────────────────────────────
router.post("/summary", requireAuth, async (req, res) => {
  try {
    const { topic, subject, educationLevel } = req.body;
    if (!topic || typeof topic !== "string" || topic.trim().length < 3) {
      res.status(400).json({ error: "validation_error", message: "Укажите тему конспекта" });
      return;
    }
    const subjectStr = subject?.trim() || "общий предмет";
    const eduStr = educationLevel === "school" ? "школьный уровень" :
      educationLevel === "master" ? "уровень магистратуры" :
      educationLevel === "phd" ? "уровень аспирантуры" : "уровень бакалавриата";

    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL });
    const prompt = `Составь структурированный академический конспект по теме «${topic.trim()}» для предмета «${subjectStr}» (${eduStr}).

Структура конспекта:
1. **Определение** — чёткое и краткое
2. **Ключевые понятия и термины** — 5–10 терминов с пояснениями
3. **Основные положения** — маркированный список главных тезисов
4. **Примеры** — 2–3 конкретных примера
5. **Формулы/Алгоритмы** — если применимо (LaTeX: $...$)
6. **Связи с другими темами** — что нужно знать до и после
7. **Типичные ошибки** — чего избегать на экзамене
8. **Вопросы для самопроверки** — 5 вопросов

Используй Markdown. Будь академичен, структурирован, понятен.`;

    const aiResp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 2500,
      messages: [{ role: "user", content: prompt }],
    });
    const result = aiResp.choices[0]?.message?.content || "Не удалось составить конспект.";
    res.json({ result, topic: topic.trim(), subject: subjectStr });
  } catch (err: any) {
    req.log.error({ err }, "Summary error");
    res.status(500).json({ error: "internal_error", message: err?.message || "Ошибка генерации конспекта" });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Публичный просмотр задачи по ID (без авторизации)
// ──────────────────────────────────────────────────────────────────────────────
router.get("/shared/:taskId", async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId)) { res.status(400).json({ error: "validation_error", message: "Неверный ID" }); return; }
    const sb = getSupabaseAdmin();
    if (sb) {
      const { data } = await sb.from("Neyrozachet_tasks").select("id,title,subject,task_type,status,result,created_at,solving_mode,complexity_score,actual_cost,estimated_cost").eq("id", taskId).single();
      if (!data) { res.status(404).json({ error: "not_found" }); return; }
      res.json(mapTask(data));
    } else {
      const { db, tasksTable } = await import("@workspace/db");
      const { eq } = await import("drizzle-orm");
      const [t] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId));
      if (!t) { res.status(404).json({ error: "not_found" }); return; }
      res.json(mapTask({ ...t, task_type: t.taskType, solving_mode: t.solvingMode, complexity_score: t.complexityScore, estimated_cost: t.estimatedCost, actual_cost: t.actualCost, estimated_time: t.estimatedTime, education_level: t.educationLevel, created_at: t.createdAt, completed_at: t.completedAt }));
    }
  } catch (err) {
    req.log.error({ err }, "SharedTask error");
    res.status(500).json({ error: "internal_error" });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Проверка оригинальности текста (ИИ-эвристика, не настоящий антиплагиат)
// ──────────────────────────────────────────────────────────────────────────────
router.post("/:taskId/check-originality", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId)) { res.status(400).json({ error: "validation_error", message: "Invalid task ID" }); return; }
    const sb = getSupabaseAdmin();
    let task: any;
    if (sb) {
      const { data } = await sb.from("Neyrozachet_tasks").select("result,title,subject").eq("id", taskId).eq("user_id", user.id).single();
      task = data;
    } else {
      const { db, tasksTable } = await import("@workspace/db");
      const { eq, and } = await import("drizzle-orm");
      const [t] = await db.select().from(tasksTable).where(and(eq(tasksTable.id, taskId), eq(tasksTable.userId, user.id)));
      task = t;
    }
    if (!task?.result) { res.status(404).json({ error: "not_found", message: "Задача или результат не найдены" }); return; }

    const resultText = (task.result as string).slice(0, 3000);
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL });

    const checkResp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `Ты — эксперт по академической честности. Оцени следующий текст на предмет признаков ИИ-генерации.

Проверь по критериям:
1. Однообразность длин предложений
2. Отсутствие индивидуального стиля
3. Чрезмерная формальность и структурированность
4. Клишированные академические обороты
5. Отсутствие конкретных деталей и личного опыта

Текст для анализа:
${resultText}

Ответь строго в формате JSON:
{"aiScore": <0-100>, "humanScore": <0-100>, "verdict": "<Скорее оригинальный|Смешанный|Скорее ИИ-текст>", "tips": ["совет 1", "совет 2", "совет 3"]}

Где aiScore — % вероятность ИИ-генерации, humanScore = 100 - aiScore.`,
      }],
    });
    const raw = checkResp.choices[0]?.message?.content || "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    let result: any = { aiScore: 50, humanScore: 50, verdict: "Не удалось определить", tips: [] };
    if (jsonMatch) {
      try { result = JSON.parse(jsonMatch[0]); } catch {}
    }
    res.json(result);
  } catch (err: any) {
    req.log.error({ err }, "OriginalityCheck error");
    res.status(500).json({ error: "internal_error", message: err?.message });
  }
});

router.get("/:taskId", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const parsed = GetTaskParams.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: "validation_error", message: "Invalid task ID" }); return; }
    const taskId = parseInt(parsed.data.taskId, 10);
    if (isNaN(taskId)) { res.status(400).json({ error: "validation_error", message: "Invalid task ID" }); return; }

    const sb = getSupabaseAdmin();
    if (sb) {
      const { data } = await sb.from("Neyrozachet_tasks").select("*").eq("id", taskId).eq("user_id", user.id).single();
      if (!data) { res.status(404).json({ error: "not_found", message: "Task not found" }); return; }
      res.json(mapTask(data));
    } else {
      const { db, tasksTable } = await import("@workspace/db");
      const { eq, and } = await import("drizzle-orm");
      const tasks = await db.select().from(tasksTable).where(and(eq(tasksTable.id, taskId), eq(tasksTable.userId, user.id)));
      if (!tasks[0]) { res.status(404).json({ error: "not_found", message: "Task not found" }); return; }
      res.json(mapTask({ ...tasks[0], task_type: tasks[0].taskType, solving_mode: tasks[0].solvingMode, complexity_score: tasks[0].complexityScore, estimated_cost: tasks[0].estimatedCost, actual_cost: tasks[0].actualCost, estimated_time: tasks[0].estimatedTime, education_level: tasks[0].educationLevel, created_at: tasks[0].createdAt, completed_at: tasks[0].completedAt }));
    }
  } catch (err) {
    req.log.error({ err }, "GetTask error");
    res.status(500).json({ error: "internal_error", message: "Internal server error" });
  }
});

export default router;
