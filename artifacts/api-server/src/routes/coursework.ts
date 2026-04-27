import { Router } from "express";
import { getSupabaseAdmin } from "../lib/supabase.js";
import { requireAuth } from "../lib/auth.js";
import { callAIRaw } from "../lib/ai.js";

const router = Router();

// ──────────────────────────────────────────────────────────────────────────────
// Content sanitization: strip/fix AI output artifacts
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Fix broken mermaid blocks: escape characters that crash the parser,
 * remove empty blocks, and clamp labels to safe length.
 */
function fixMermaidBlocks(text: string): string {
  return text.replace(/```mermaid\n([\s\S]*?)```/g, (_match, body: string) => {
    if (!body.trim()) return "";

    // Fix node labels: replace unquoted labels containing <>,"()" with quoted versions
    let fixed = body
      // Replace labels like A[text with "quotes"] → A["text with 'quotes'"]
      .replace(/(\w+)\[([^\]]*["<>][^\]]*)\]/g, (_m, id: string, label: string) => {
        const safe = label.replace(/"/g, "'");
        return `${id}["${safe}"]`;
      })
      // Replace labels like A{text with "quotes"} in decision nodes
      .replace(/(\w+)\{([^\}]*["<>][^\}]*)\}/g, (_m, id: string, label: string) => {
        const safe = label.replace(/"/g, "'");
        return `${id}{"${safe}"}`;
      })
      // Remove HTML entities that break mermaid
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");

    // Validate: must start with a valid diagram type keyword
    const firstLine = fixed.trim().split("\n")[0].trim().toLowerCase();
    const validTypes = ["flowchart", "graph", "sequencediagram", "classDiagram",
      "statediagram", "erdiagram", "gantt", "pie", "mindmap", "timeline"];
    const isValid = validTypes.some(t => firstLine.startsWith(t.toLowerCase()));
    if (!isValid) return "";

    return "```mermaid\n" + fixed + "```";
  });
}

/**
 * Strip placeholder/external images and sanitize all AI-generated content.
 * Replaces ![alt](url) with italicised caption so the document stays readable.
 * Fixes broken mermaid blocks.
 */
function sanitizeChapterContent(content: string): string {
  // 1. Replace ALL markdown images (any URL) — AI must use mermaid, not images
  content = content.replace(/!\[([^\]]*)\]\([^\)]+\)/g, (_match, alt: string) => {
    const trimmed = alt.trim();
    // If the alt text describes a diagram, replace with a visible notice
    return trimmed ? `*[Рисунок: ${trimmed}]*` : "";
  });

  // 2. Fix broken mermaid blocks
  content = fixMermaidBlocks(content);

  // 3. Remove HTML image tags
  content = content.replace(/<img[^>]*>/gi, "");

  // 4. Remove lone URLs that look like image placeholders
  content = content.replace(/https?:\/\/[^\s)]+(?:placeholder|via\.placeholder|dummyimage|lorempixel)[^\s)]*/gi, "");

  // 5. Clean up multiple blank lines left by removals
  content = content.replace(/\n{4,}/g, "\n\n\n");

  return content.trim();
}

/**
 * Count approximate word count of generated text.
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// ─── Цены за генерацию одного раздела ─────────────────────────────────────
// Загружаются из settings (PRICING_DEFAULTS.coursework). Цены может править админ.
async function getCourseworkPricing() {
  const { getPricing } = await import("../lib/settings.js");
  return (await getPricing()).coursework;
}
async function getChapterCost(workType: string, isReferences: boolean): Promise<number> {
  const cw = await getCourseworkPricing();
  if (isReferences) return cw.referencesCost;
  // legacy alias: phd_thesis → phd
  const key = workType === "phd_thesis" ? "phd" : workType;
  return cw.chapterCosts[key] ?? 45;
}
const FREE_REVISIONS_PER_CHAPTER = 2; // бесплатных доработок на каждый раздел

// ─── In-memory fallback для локальной разработки ──────────────────────────
// В production счётчики хранятся в Supabase (Neyrozachet_transactions type='free_revision')
const revisionTrackerFallback = new Map<string, number>();

function getFreeRevKey(userId: string | number, topic: string, chapterTitle: string): string {
  return `${userId}|${topic.slice(0, 60)}|${chapterTitle.slice(0, 60)}`;
}

async function getUsedFreeRevisions(
  sb: ReturnType<typeof getSupabaseAdmin>,
  userId: string | number,
  topic: string,
  chapterTitle: string
): Promise<number> {
  if (sb) {
    const descKey = `FREE_REV|${topic.slice(0, 55)}|${chapterTitle.slice(0, 55)}`;
    const { data } = await sb
      .from("Neyrozachet_transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "free_revision")
      .eq("description", descKey);
    return data?.length ?? 0;
  }
  return revisionTrackerFallback.get(getFreeRevKey(userId, topic, chapterTitle)) ?? 0;
}

async function recordFreeRevision(
  sb: ReturnType<typeof getSupabaseAdmin>,
  userId: string | number,
  topic: string,
  chapterTitle: string
): Promise<void> {
  if (sb) {
    const descKey = `FREE_REV|${topic.slice(0, 55)}|${chapterTitle.slice(0, 55)}`;
    await sb.from("Neyrozachet_transactions").insert({
      user_id: userId,
      type: "free_revision",
      amount: 0,
      description: descKey,
    });
  } else {
    const key = getFreeRevKey(userId, topic, chapterTitle);
    revisionTrackerFallback.set(key, (revisionTrackerFallback.get(key) ?? 0) + 1);
  }
}

async function resetFreeRevisions(
  sb: ReturnType<typeof getSupabaseAdmin>,
  userId: string | number,
  topic: string,
  chapterTitle: string
): Promise<void> {
  if (sb) {
    const descKey = `FREE_REV|${topic.slice(0, 55)}|${chapterTitle.slice(0, 55)}`;
    await sb
      .from("Neyrozachet_transactions")
      .delete()
      .eq("user_id", userId)
      .eq("type", "free_revision")
      .eq("description", descKey);
  } else {
    revisionTrackerFallback.set(getFreeRevKey(userId, topic, chapterTitle), 0);
  }
}

const WORK_TYPE_LABELS: Record<string, string> = {
  essay:     "Реферат",
  report:    "Отчёт по практике",
  coursework: "Курсовая работа",
  diploma:   "Дипломная работа (ВКР)",
  master:    "Магистерская диссертация",
  phd_thesis: "Кандидатская диссертация",
};

// ──────────────────────────────────────────────────────────────────────────────
// Fallback chapter structure if AI plan generation fails
// ──────────────────────────────────────────────────────────────────────────────
function getDefaultChapters(
  workType: string, topic: string, _subject: string, targetPages: number
): Array<{ title: string; estimatedPages: number }> {
  const short = topic.length > 60 ? topic.slice(0, 60) + "…" : topic;

  if (workType === "essay") {
    return [
      { title: "Введение", estimatedPages: 2 },
      { title: `Теоретические основы: ${short}`, estimatedPages: Math.round(targetPages * 0.35) },
      { title: "Анализ проблематики и современное состояние вопроса", estimatedPages: Math.round(targetPages * 0.45) },
      { title: "Заключение", estimatedPages: 2 },
      { title: "Список литературы", estimatedPages: 2 },
    ];
  }
  if (workType === "report") {
    return [
      { title: "Введение", estimatedPages: 2 },
      { title: "Характеристика объекта и условий прохождения практики", estimatedPages: Math.round(targetPages * 0.25) },
      { title: `Анализ деятельности организации по теме «${short}»`, estimatedPages: Math.round(targetPages * 0.45) },
      { title: "Индивидуальное задание и выводы", estimatedPages: Math.round(targetPages * 0.15) },
      { title: "Заключение", estimatedPages: 2 },
      { title: "Список использованных источников", estimatedPages: 2 },
    ];
  }
  if (workType === "master" || workType === "phd_thesis") {
    return [
      { title: "Введение. Актуальность, научная новизна и практическая значимость", estimatedPages: 5 },
      { title: `Глава 1. Теоретические и методологические основы исследования ${short}`, estimatedPages: Math.round(targetPages * 0.22) },
      { title: "Глава 2. Обзор литературы и сравнительный анализ подходов", estimatedPages: Math.round(targetPages * 0.18) },
      { title: "Глава 3. Методология и дизайн исследования", estimatedPages: Math.round(targetPages * 0.15) },
      { title: `Глава 4. Результаты эмпирического исследования`, estimatedPages: Math.round(targetPages * 0.25) },
      { title: "Глава 5. Обсуждение результатов и рекомендации", estimatedPages: Math.round(targetPages * 0.1) },
      { title: "Заключение", estimatedPages: 5 },
      { title: "Список использованных источников", estimatedPages: 5 },
    ];
  }
  // coursework / diploma
  return [
    { title: "Введение", estimatedPages: 3 },
    { title: `Глава 1. Теоретические основы: ${short}`, estimatedPages: Math.round(targetPages * 0.27) },
    { title: "Глава 2. Анализ и методология", estimatedPages: Math.round(targetPages * 0.27) },
    { title: "Глава 3. Практическая часть", estimatedPages: Math.round(targetPages * 0.3) },
    { title: "Заключение", estimatedPages: 3 },
    { title: "Список использованных источников", estimatedPages: 2 },
  ];
}

// ──────────────────────────────────────────────────────────────────────────────
// Helper: get/deduct balance via Supabase
// ──────────────────────────────────────────────────────────────────────────────
async function getBalance(sb: ReturnType<typeof getSupabaseAdmin>, userId: string): Promise<number> {
  if (!sb) return 9999;
  const { data } = await sb.from("Neyrozachet_users").select("balance").eq("id", userId).single();
  return data?.balance ?? 0;
}

// Атомарное списание через CAS-loop. Бросает Error при провале (баланс/конкуренция).
async function deductBalance(
  sb: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  amount: number,
  description: string
): Promise<void> {
  if (!sb) return;
  if (amount > 0) {
    let casOk = false;
    for (let attempt = 0; attempt < 5 && !casOk; attempt++) {
      const { data: u } = await sb.from("Neyrozachet_users").select("balance").eq("id", userId).single();
      const cur = (u as any)?.balance ?? 0;
      if (cur < amount) {
        const e: any = new Error(`Недостаточно средств. Нужно ${amount} ₽, на балансе ${cur} ₽`);
        e.status = 402; e.code = "insufficient_balance"; e.required = amount; e.balance = cur;
        throw e;
      }
      const { data: row } = await sb.from("Neyrozachet_users")
        .update({ balance: cur - amount }).eq("id", userId).eq("balance", cur)
        .select("balance").maybeSingle();
      if (row) casOk = true;
    }
    if (!casOk) {
      const e: any = new Error("Слишком много одновременных операций. Попробуйте снова.");
      e.status = 409; e.code = "concurrency";
      throw e;
    }
  }
  await sb.from("Neyrozachet_transactions").insert({
    user_id: userId,
    type: "payment",
    amount,
    description,
  });
}

// Атомарное возмещение через CAS-loop.
async function refundBalance(
  sb: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  amount: number,
  description: string
): Promise<void> {
  if (!sb || amount <= 0) return;
  let casOk = false;
  for (let attempt = 0; attempt < 5 && !casOk; attempt++) {
    const { data: u } = await sb.from("Neyrozachet_users").select("balance").eq("id", userId).single();
    const cur = (u as any)?.balance ?? 0;
    const { data: row } = await sb.from("Neyrozachet_users")
      .update({ balance: cur + amount }).eq("id", userId).eq("balance", cur)
      .select("balance").maybeSingle();
    if (row) casOk = true;
  }
  await sb.from("Neyrozachet_transactions").insert({
    user_id: userId,
    type: "refund",
    amount,
    description,
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/coursework/generate-plan  (FREE)
// Generates AI chapter structure for the work
// ──────────────────────────────────────────────────────────────────────────────
router.post("/generate-plan", requireAuth, async (req, res) => {
  try {
    const { topic, subject, workType, requirements, targetPages } = req.body;
    if (!topic?.trim() || !subject?.trim() || !workType) {
      res.status(400).json({ error: "validation_error", message: "topic, subject, workType обязательны" });
      return;
    }

    const workLabel = WORK_TYPE_LABELS[workType] || workType;
    const pages = Number(targetPages) || 40;

    // Max total sections (including введение, заключение, список) per work type
    const MAX_SECTIONS: Record<string, number> = {
      essay:      5,  // введение + 2 основных + заключение + список
      report:     6,  // введение + 2-3 основных + заключение + список
      coursework: 6,  // введение + 3 главы + заключение + список
      diploma:    7,  // введение + 4 главы + заключение + список
      master:     8,  // введение + 5 глав + заключение + список
      phd_thesis: 8,
    };
    const maxSections = MAX_SECTIONS[workType] ?? 6;

    // Human-readable exact count instruction per work type
    const structureRule: Record<string, string> = {
      essay:      `РОВНО 5 разделов: Введение (2-3 стр.) + 2 основных содержательных раздела + Заключение (2 стр.) + Список литературы (1-2 стр.)`,
      report:     `РОВНО 6 разделов: Введение (2 стр.) + 3 содержательных раздела + Заключение (2 стр.) + Список источников (1-2 стр.)`,
      coursework: `РОВНО 6 разделов: Введение (3 стр.) + Глава 1 (теория) + Глава 2 (анализ) + Глава 3 (практика) + Заключение (3 стр.) + Список использованных источников (2 стр.)`,
      diploma:    `РОВНО 7 разделов: Введение (3-5 стр.) + 4 главы + Заключение (3-5 стр.) + Список использованных источников (3 стр.)`,
      master:     `РОВНО 8 разделов: Введение (5 стр.) + 5 глав + Заключение (5 стр.) + Список использованных источников (4 стр.)`,
      phd_thesis: `РОВНО 8 разделов: Введение (5 стр.) + 5 глав с методологией + Заключение (5 стр.) + Список использованных источников (4 стр.)`,
    };
    const exactStructure = structureRule[workType] ?? structureRule.coursework;

    const systemPrompt = "Ты — опытный научный редактор, специализирующийся на академических работах. Отвечаешь строго в формате JSON, без markdown-обёрток. КРИТИЧЕСКИ ВАЖНО: создай ровно столько разделов, сколько указано — не больше и не меньше.";

    const userMessage = `Составь план (структуру разделов) для академической работы.

Тип работы: ${workLabel}
Тема: «${topic}»
Дисциплина: «${subject}»
Целевой объём: ${pages} страниц
${requirements?.trim() ? `Требования преподавателя: ${requirements}` : ""}

Ответь строго в формате JSON:
{
  "chapters": [
    {"title": "Введение", "estimatedPages": 3},
    ...
  ]
}

ОБЯЗАТЕЛЬНАЯ СТРУКТУРА: ${exactStructure}

Требования:
- Конкретные, содержательные названия разделов — точно по теме «${topic}»
- Распредели страницы реалистично, итого ≈ ${pages} страниц
- НЕ ДОБАВЛЯЙ лишних разделов, подразделов или дополнительных глав
- Количество элементов в массиве "chapters" должно быть ровно ${maxSections}`;

    let chapters: Array<{ title: string; estimatedPages: number }>;

    try {
      const raw = await callAIRaw({
        provider: "deepseek",
        model: "deepseek-chat",
        systemPrompt,
        userMessage,
        maxTokens: 1200,
      });

      const clean = raw.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(clean);
      chapters = parsed.chapters;
      if (!Array.isArray(chapters) || chapters.length < 3) throw new Error("invalid");
      // No hard cap — user may add extra sections from the editor if needed
    } catch {
      chapters = getDefaultChapters(workType, topic, subject, pages);
    }

    res.json({ chapters });
  } catch (err) {
    (req as any).log?.error({ err }, "Plan generation error");
    res.status(500).json({ error: "internal_error", message: "Ошибка генерации плана" });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/coursework/price-preview  (FREE — returns cost estimate)
// ──────────────────────────────────────────────────────────────────────────────
router.post("/price-preview", requireAuth, async (req, res) => {
  const { workType, chapterCount } = req.body;
  const cw = await getCourseworkPricing();
  const perChapter = await getChapterCost(workType, false);
  const total = perChapter * (chapterCount || 6);
  res.json({ perChapter, total, revisionCost: Math.round(perChapter * cw.revisionDiscount), referencesCost: cw.referencesCost });
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/coursework/generate-chapter  (CHARGED per chapter)
// Generates full chapter content with AI
// ──────────────────────────────────────────────────────────────────────────────
router.post("/generate-chapter", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { topic, subject, workType, requirements, chapter, allChapters, chapterIndex } = req.body;

    if (!topic?.trim() || !subject?.trim() || !workType || !chapter?.title) {
      res.status(400).json({ error: "validation_error", message: "topic, subject, workType, chapter.title обязательны" });
      return;
    }

    // Определяем стоимость раздела ДО проверки баланса
    const chapterTitle: string = chapter.title || "";
    const isReferencesChapter = chapterTitle.toLowerCase().includes("список");
    const baseCost = await getChapterCost(workType, isReferencesChapter);
    const { isUserSubscribed } = await import("../lib/subscription.js");
    const subscribed = await isUserSubscribed(Number(user.id));
    const cost = subscribed ? 0 : baseCost;

    const sb = getSupabaseAdmin();
    const currentBalance = await getBalance(sb, user.id);

    // Deduct before generation (refund on error). При подписке amount=0, но запись в transactions всё равно делаем.
    const workLabel = WORK_TYPE_LABELS[workType] || workType;
    try {
      await deductBalance(sb, user.id, cost, `Научная работа «${topic}»: раздел «${chapter.title}»${subscribed ? " (по подписке)" : ""}`);
    } catch (e: any) {
      const status = e?.status || 500;
      res.status(status).json({
        error: e?.code || "internal_error",
        message: e?.message || "Не удалось списать средства",
        required: e?.required, balance: e?.balance,
      });
      return;
    }

    try {
      const chaptersList = Array.isArray(allChapters)
        ? allChapters.map((c: any, i: number) => `${i + 1}. ${c.title} (~${c.estimatedPages} стр.)`).join("\n")
        : "";

      const idx = Number(chapterIndex) || 0;
      const isIntro = chapterTitle.toLowerCase().includes("введен");
      const isConclusion = chapterTitle.toLowerCase().includes("заключен");
      const isReferences = isReferencesChapter;
      const isShort = chapter.estimatedPages <= 3 || isIntro || isConclusion || isReferences;

      const targetWords = chapter.estimatedPages * 280;
      const sysBase = `Ты — опытный автор академических текстов. Пишешь профессиональным академическим русским языком. Конкретное содержание, точные данные и факты, ссылки на реальных авторов в формате [Фамилия, год].

⛔ АБСОЛЮТНЫЕ ЗАПРЕТЫ (нарушение недопустимо):
- НИКАКИХ изображений: ![...](url), <img>, http-ссылки на картинки, placeholder — НЕЛЬЗЯ
- НИКАКИХ клише: "В современном мире", "На сегодняшний день", "Актуальность данной темы", "Следует отметить, что", "Таким образом можно сделать вывод" — в начале абзацев НЕЛЬЗЯ
- НИКАКОГО переноса строки внутри LaTeX-формулы — формула всегда на одной строке или в блоке $$...$$
- НИКАКИХ пустых блоков \`\`\`mermaid ... \`\`\`

ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА ОФОРМЛЕНИЯ:

1. ФОРМУЛЫ — LaTeX без исключений:
   - Inline (в тексте): $E = mc^2$
   - Блочные (отдельная строка): $$S = \\sum_{i=1}^{n} x_i$$

2. ТАБЛИЦЫ — в Markdown (минимум 3 строки данных):
   | Параметр | Значение | Описание |
   |----------|----------|----------|
   | ...      | ...      | ...      |

3. ДИАГРАММЫ — СТРОГО mermaid. ВМЕСТО любого ![...](url) — пиши mermaid-блок.
   Блок-схема (используй этот синтаксис точно):
   \`\`\`mermaid
   flowchart TD
     A["Начало"] --> B{"Условие?"}
     B -- "Да" --> C["Действие 1"]
     B -- "Нет" --> D["Действие 2"]
     C --> E["Конец"]
     D --> E
   \`\`\`
   Последовательность:
   \`\`\`mermaid
   sequenceDiagram
     participant A as Клиент
     participant B as Система
     A->>B: Запрос данных
     B-->>A: Результат
   \`\`\`
   Иерархия/классы:
   \`\`\`mermaid
   classDiagram
     class Родитель {
       +атрибут1: тип
       +метод(): возврат
     }
     Родитель <|-- Потомок
   \`\`\`
   ПОСЛЕ каждой диаграммы — подпись: *Рисунок X — название диаграммы*

4. Заголовки подразделов: ### Название
5. Формулы пишутся прямо в тексте — НЕ пиши "Формула (1):", "(см. рисунок 1)"
6. Каждый абзац — минимум 120 слов, максимум 250 слов. Не "лить воду".`;

      let content: string;

      if (isShort) {
        // ── Короткие разделы (введение/заключение/список/≤3 стр.) — одним запросом ──
        let instructions = "";
        if (isIntro) {
          instructions = `Раздел «Введение» (~${targetWords} слов):
- Актуальность темы (2-3 абзаца с аргументами)
- Объект и предмет исследования
- Цель работы
- Задачи (5-7 конкретных задач)
- Методологическая и теоретическая основа
- Структура работы (перечень разделов)
- Практическая значимость`;
        } else if (isConclusion) {
          instructions = `Раздел «Заключение» (~${targetWords} слов):
- Выводы по каждой главе (по абзацу)
- Достижение цели и выполнение задач
- Практическая значимость результатов
- Перспективы дальнейшего исследования`;
        } else if (isReferences) {
          instructions = `Список использованных источников (15-25 источников):
- Формат ГОСТ Р 7.0.5-2008
- Монографии, статьи, интернет-ресурсы, не менее 3 на иностранном языке
- Строго по теме «${topic}» и дисциплине «${subject}», годы 2018-2024
- Алфавитный порядок`;
        } else {
          instructions = `Содержательный текст ~${targetWords} слов: вступительный абзац, 2-3 подраздела с заголовками (###), выводы.
- Формулы (если уместны) — обязательно в LaTeX: $...$ или $$...$$
- Таблицы сравнения/данных — в Markdown | ... |
- Процессы/алгоритмы/структуры — mermaid-диаграмма`;
        }

        const shortUserMsg = `Напиши раздел «${chapter.title}» для ${workLabel} на тему «${topic}» (дисциплина: ${subject}).${requirements?.trim() ? ` Требования: ${requirements}.` : ""}

Структура всей работы: ${chaptersList}

${instructions}

ВАЖНО: Пиши только сам текст раздела. Без пояснений, без фраз "В этом разделе я расскажу", без переноса строки внутри формул.`;
        const shortMaxTok = Math.max(2000, Math.ceil(targetWords * 2.5));

        content = sanitizeChapterContent(await callAIRaw({
          provider: "openai",
          model: "gpt-4o",
          systemPrompt: sysBase,
          userMessage: shortUserMsg,
          maxTokens: shortMaxTok,
        }));

        // Retry once if content is significantly too short (< 50% of target)
        if (!isReferences && countWords(content) < targetWords * 0.50) {
          content = sanitizeChapterContent(await callAIRaw({
            provider: "openai",
            model: "gpt-4o",
            systemPrompt: sysBase,
            userMessage: shortUserMsg + `\n\nТЕКУЩИЙ РЕЗУЛЬТАТ СЛИШКОМ КОРОТКИЙ. Нужно минимум ${targetWords} слов. Дополни и расширь каждый раздел.`,
            maxTokens: shortMaxTok,
          }));
        }
      } else {
        // ── Большие разделы — параллельная генерация по подразделам ──
        const subsCount = chapter.estimatedPages <= 6 ? 3 : chapter.estimatedPages <= 10 ? 4 : 5;
        const wordsPerSub = Math.round((targetWords - 300) / subsCount); // -300 для вступ+вывод

        // Сначала получаем заголовки подразделов от AI (быстрый DeepSeek)
        let subTitles: string[];
        try {
          const titlesRaw = await callAIRaw({
            provider: "deepseek",
            model: "deepseek-chat",
            systemPrompt: "Ты — научный редактор. Отвечаешь строго в формате JSON без markdown.",
            userMessage: `Для раздела «${chapter.title}» в ${workLabel} на тему «${topic}» предложи ${subsCount} содержательных подраздела.
Ответ строго: {"titles": ["Заголовок 1", "Заголовок 2", ...]}`,
            maxTokens: 400,
          });
          const clean = titlesRaw.replace(/```json\n?|\n?```/g, "").trim();
          subTitles = JSON.parse(clean).titles;
          if (!Array.isArray(subTitles) || subTitles.length < subsCount) throw new Error("invalid");
          subTitles = subTitles.slice(0, subsCount);
        } catch {
          subTitles = Array.from({ length: subsCount }, (_, i) => `${i + 1}.${idx + 1} Подраздел ${i + 1}`);
        }

        const context = `${workLabel} на тему «${topic}» (дисциплина: ${subject}${requirements?.trim() ? `, требования: ${requirements}` : ""}). Структура работы: ${chaptersList}. Текущий раздел: «${chapter.title}».`;

        // Параллельная генерация всех подразделов
        const subPromises = subTitles.map((subTitle, i) =>
          callAIRaw({
            provider: "openai",
            model: "gpt-4o",
            systemPrompt: sysBase,
            userMessage: `${context}

Напиши подраздел «${subTitle}» (подраздел ${i + 1} из ${subsCount}).
Объём: РОВНО ${wordsPerSub} слов (${Math.round(wordsPerSub / 280 * 10) / 10} стр.), 3-4 абзаца по 150-200 слов.
Требования:
- Конкретные факты, данные, цифры, ссылки на авторов [Фамилия, год] — без общих фраз и воды
- Формулы (расчёты, зависимости) — обязательно LaTeX: $...$ inline или $$...$$ блочные
- Таблица сравнения/анализа — Markdown | ... | если уместна
- Схема/алгоритм/архитектура — \`\`\`mermaid flowchart ... \`\`\` (запрещено использовать ![](url))
- НЕ начинать абзацы с "В данном подразделе", "Следует отметить", "На сегодняшний день"

Начни СТРОГО с заголовка ### ${subTitle}, затем пиши текст.`,
            maxTokens: Math.max(1500, Math.ceil(wordsPerSub * 2.8)),
          }).then(t => sanitizeChapterContent(t))
        );

        // Вводный абзац раздела
        const introPromise = callAIRaw({
          provider: "openai",
          model: "gpt-4o",
          systemPrompt: sysBase,
          userMessage: `${context}

Напиши вступительный абзац для раздела «${chapter.title}» (140-180 слов).
Задача: конкретно обозначить проблему раздела, его цели и структуру. Сразу к делу — без общих фраз и водянистых вступлений. Без заголовка — сразу текст.`,
          maxTokens: 700,
        }).then(t => sanitizeChapterContent(t));

        // Выводы раздела
        const outroPromise = callAIRaw({
          provider: "openai",
          model: "gpt-4o",
          systemPrompt: sysBase,
          userMessage: `${context}

Напиши краткие выводы по разделу «${chapter.title}» (150-200 слов).
Конкретно: итоги по каждому подразделу (1-2 предложения на подраздел), общий вывод. Начни без вводных слов — например: "Раздел посвящён..." или "Проведённый анализ показал...".`,
          maxTokens: 700,
        }).then(t => sanitizeChapterContent(t));

        // Запускаем всё параллельно
        const [introText, ...subTexts] = await Promise.all([introPromise, ...subPromises]);
        const outroText = await outroPromise;

        content = [
          `## ${chapter.title}\n`,
          introText.trim(),
          "",
          ...subTexts.map(t => t.trim()),
          "",
          `**Выводы по разделу.** ${outroText.trim()}`,
        ].join("\n\n");
      }

      // Final sanitization pass for large chapters assembled from parts
      content = sanitizeChapterContent(content);

      // Сбрасываем счётчик бесплатных доработок при (ре)генерации раздела
      await resetFreeRevisions(sb, user.id, topic, chapter.title);

      res.json({
        content,
        cost,
        balanceAfter: currentBalance - cost,
        freeRevisionsLeft: FREE_REVISIONS_PER_CHAPTER,
      });
    } catch (err) {
      // Refund on generation error
      await refundBalance(sb, user.id, cost, `Возврат: ошибка генерации раздела «${chapter.title}»`);
      throw err;
    }
  } catch (err) {
    (req as any).log?.error({ err }, "Chapter generation error");
    res.status(500).json({ error: "internal_error", message: "Ошибка генерации раздела. Средства возвращены." });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/coursework/revise-chapter
// Revises a chapter — first 2 per chapter are FREE, then charged
// ──────────────────────────────────────────────────────────────────────────────
router.post("/revise-chapter", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const {
      topic, subject, workType, chapter, chapterIndex, allChapters,
      currentContent, revisionNotes,
    } = req.body;

    if (!topic?.trim() || !subject?.trim() || !workType || !chapter?.title || !currentContent || !revisionNotes?.trim()) {
      res.status(400).json({ error: "validation_error", message: "Не хватает обязательных полей" });
      return;
    }

    const sb = getSupabaseAdmin();

    // ── Проверка бесплатных доработок через Supabase (персистентный счётчик) ──
    const usedRevisions = await getUsedFreeRevisions(sb, user.id, topic, chapter.title);
    const isFree = usedRevisions < FREE_REVISIONS_PER_CHAPTER;
    const freeRevisionsLeft = Math.max(0, FREE_REVISIONS_PER_CHAPTER - usedRevisions - 1);

    const chapterTitle: string = chapter.title || "";
    const isReferencesChapter = chapterTitle.toLowerCase().includes("список");
    const cw = await getCourseworkPricing();
    const baseChapterCost = await getChapterCost(workType, isReferencesChapter);
    const paidCost = Math.round(baseChapterCost * cw.revisionDiscount);
    const { isUserSubscribed } = await import("../lib/subscription.js");
    const subscribed = await isUserSubscribed(Number(user.id));
    const cost = (isFree || subscribed) ? 0 : paidCost;

    // Всегда читаем текущий баланс (нужен для balanceAfter)
    const currentBalance = await getBalance(sb, user.id);

    if (cost > 0) {
      try {
        await deductBalance(sb, user.id, cost, `Доработка раздела «${chapter.title}» (${WORK_TYPE_LABELS[workType] || workType})`);
      } catch (e: any) {
        const status = e?.status || 500;
        res.status(status).json({
          error: e?.code || "internal_error",
          message: e?.message || "Не удалось списать средства",
          required: e?.required, balance: e?.balance,
        });
        return;
      }
    } else if (subscribed && !isFree) {
      // При подписке записываем «0 ₽» транзакцию для истории
      await deductBalance(sb, user.id, 0, `Доработка раздела «${chapter.title}» (по подписке)`);
    }

    const workLabel = WORK_TYPE_LABELS[workType] || workType;
    const chaptersList = Array.isArray(allChapters)
      ? allChapters.map((c: any, i: number) => `${i + 1}. ${c.title}`).join("\n")
      : "";

    const systemPrompt = `Ты — опытный научный редактор. Дорабатываешь академические тексты строго по замечаниям, сохраняя академический стиль.
Оформление: формулы — LaTeX ($...$ inline, $$...$$ блочные); таблицы — Markdown | ... |; схемы — ТОЛЬКО \`\`\`mermaid ... \`\`\`.
⛔ ЗАПРЕЩЕНО: ![...](url), <img>, внешние ссылки на изображения, placeholder-URL. Не убирай уже имеющиеся формулы и таблицы, если замечание не касается их.`;

    const userMessage = `Доработай следующий раздел академической ${workLabel} строго по замечаниям.

Тема работы: «${topic}»
Дисциплина: «${subject}»
Раздел: «${chapter.title}»
Структура работы: ${chaptersList || "не указана"}

ТЕКУЩИЙ ВАРИАНТ РАЗДЕЛА:
${currentContent}

─────────────────────────────────────────────
ЗАМЕЧАНИЯ И ПРАВКИ:
${revisionNotes}
─────────────────────────────────────────────

Исправь ВСЕ указанные замечания. Сохрани академический стиль, структуру и объём.
Верни ТОЛЬКО переработанный текст раздела — без пояснений, заголовков "переработанный вариант" и т.п.`;

    const rawContent = await callAIRaw({
      provider: "openai",
      model: "gpt-4o",
      systemPrompt,
      userMessage,
      maxTokens: 4500,
    });
    const content = sanitizeChapterContent(rawContent);

    // Фиксируем использование бесплатной доработки в Supabase
    if (isFree) {
      await recordFreeRevision(sb, user.id, topic, chapter.title);
    }

    const balanceAfter = cost > 0 ? currentBalance - cost : currentBalance;

    res.json({ content, cost, isFree: cost === 0, freeRevisionsLeft, balanceAfter });
  } catch (err) {
    (req as any).log?.error({ err }, "Chapter revision error");
    res.status(500).json({ error: "internal_error", message: "Ошибка доработки раздела" });
  }
});

export default router;
