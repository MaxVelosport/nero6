import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function getDeepSeek(): OpenAI {
  if (!process.env.DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY is not set");
  return new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
  });
}

function getXai(): OpenAI {
  if (!process.env.XAI_API_KEY) throw new Error("XAI_API_KEY is not set");
  return new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: "https://api.x.ai/v1",
  });
}

function getOpenRouter(): OpenAI {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not set");
  return new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": process.env.APP_URL || "https://neurozachet.ru",
      "X-Title": process.env.APP_NAME || "NeyroZachet",
    },
  });
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function buildSystemPrompt(subject: string, sessionContext?: string): string {
  const s = subject.toLowerCase();

  const subjectHint =
    /сопромат|теормех|тоэ|электротехн|термодин|детал|материалов|строит|геодез/.test(s)
      ? "Инженерные задачи: единицы СИ, пошаговые расчёты, проверка размерности. Формулы в LaTeX."
    : /python|java|c\+\+|c#|javascript|sql|алгоритм|кибербез|сети|machine learning|веб|программир|информатик/.test(s)
      ? "IT/программирование: пиши рабочий код в блоках ```язык```, объясняй алгоритм, указывай сложность O(...)."
    : /мат|физик|хим|биол|биохим|теорвер|статис|дискрет|эконометр|астроном|экол/.test(s)
      ? "Точные науки: пошаговое решение, формулы LaTeX, единицы измерения, итог в \\boxed{...}."
    : /право|юрид|конституц|гражданск|уголовн|административн|трудов|международн/.test(s)
      ? "Право: ссылайся на конкретные статьи НПА (ГК РФ ст. X, УК РФ ст. X). Квалификация: состав правоотношения → применимые нормы → вывод."
    : /анатом|физиолог|фармакол|паталог|гигиен|эпидемиол|медицин/.test(s)
      ? "Медицина: медицинская номенклатура, для фармакологии — МНН/механизм/побочки, для анатомии — топографические ориентиры."
    : /микроэконом|макроэконом|экономик|финанс|менедж|маркет|бухучёт|бухгалт|налог|логистик/.test(s)
      ? "Экономика/бизнес: формулы в LaTeX, числовые расчёты пошагово, интерпретируй экономический смысл, для бухучёта — проводки Дт/Кт."
    : /английск|немецк|французск|китайск|испанск|итальянск/.test(s)
      ? "Иностранный язык: сохраняй стиль при переводе, объясняй грамматические конструкции по-русски, academic vocabulary для эссе."
    : /истори|философ|социол|политол|культурол|педагог|литерат|журналист|реклам/.test(s)
      ? "Гуманитарные: структурированный академический ответ, даты/факты/имена/концепции, ссылки на первоисточники и классиков."
    : /психолог/.test(s)
      ? "Психология: ссылайся на авторитетных авторов и концепции, разграничивай клиническую и общую психологию, доказательный подход."
    : /егэ|огэ/.test(s)
      ? "Подготовка к ЕГЭ/ОГЭ: алгоритм решения типовых задач ФИПИ, типичные ошибки, критерии проверки развёрнутых ответов."
    : "Адаптируй глубину и стиль к уровню студента, приводи практические примеры.";

  let prompt = `Ты — умный учебный ассистент НейроЗачёт. Помогаешь студентам по предмету: **${subject}**.

Правила:
- Отвечай на русском языке, чётко и по делу
- Используй Markdown: **жирный**, *курсив*, заголовки ##, списки, блоки кода \`\`\`
- Формулы СТРОГО в LaTeX: $...$ (inline), $$...$$ (block) — НЕ используй \\[...\\] или \\(...\\)
- Будь точным и лаконичным — студентам нужен результат, а не вода
- Если вопрос неясен — уточни, но кратко

## Диаграммы и графики
Когда задача требует визуализации, ОБЯЗАТЕЛЬНО добавляй диаграммы или графики:

**Диаграммы** (блок-схемы, UML, ER-диаграммы, последовательности, дерево решений, иерархии, архитектура системы):
Используй Mermaid в блоке \`\`\`mermaid ... \`\`\`
Примеры: flowchart TD, sequenceDiagram, erDiagram, classDiagram, gantt, pie, mindmap, stateDiagram-v2

**Графики с данными** (гистограммы, линейные, круговые, графики функций, сравнение показателей):
Используй блок \`\`\`chart ... \`\`\` с JSON:
- Линейный: \`{"type":"line","title":"Название","data":[{"x":"А","y1":10},...],"xKey":"x","yKeys":["y1","y2"]}\`
- Столбчатый: \`{"type":"bar","title":"...","data":[{"name":"А","value":42}],"xKey":"name","yKeys":["value"]}\`
- Круговой: \`{"type":"pie","title":"...","labels":["A","B","C"],"values":[30,45,25]}\`
- С областью: \`{"type":"area","title":"...","data":[...],"xKey":"x","yKeys":["y"]}\`

Специфика предмета: ${subjectHint}`;

  if (sessionContext) {
    prompt += `\n\n${sessionContext}`;
  }

  return prompt;
}

export async function callAI(params: {
  modelId: string;
  messages: ChatMessage[];
  subject: string;
  attachmentData?: string | null;
  attachmentType?: string | null;
  attachmentName?: string | null;
  sessionContext?: string;
}): Promise<{ content: string; modelUsed: string }> {
  const { modelId, messages, subject, attachmentData, attachmentType, sessionContext } = params;

  const imageHint = attachmentData && attachmentType?.startsWith("image/")
    ? "\n\nВАЖНО (изображение прикреплено): Если изображение размытое, тёмное, обрезано или текст не читается — сразу скажи об этом пользователю и попроси сделать более чёткое фото. Не угадывай условие — только извлекай то, что чётко видно."
    : "";

  const systemPrompt = buildSystemPrompt(subject, sessionContext) + imageHint;
  const hasImage = !!attachmentData && attachmentType?.startsWith("image/");

  const historyMessages = messages.filter(m => m.role !== "system");

  const geminiViaOR = async () => ({
    content: await callOpenRouter("google/gemini-2.0-flash-001", systemPrompt, historyMessages, hasImage ? attachmentData : null, attachmentType),
    modelUsed: "gemini-2-flash",
  });

  if (modelId === "claude-sonnet") {
    try {
      return { content: await callClaude(systemPrompt, historyMessages, hasImage ? attachmentData : null, attachmentType), modelUsed: "claude-sonnet" };
    } catch (e: any) {
      console.warn(`[AI] claude-sonnet failed (${e?.message}), falling back to Gemini`);
      return await geminiViaOR();
    }
  }

  if (modelId === "gpt-4o") {
    try {
      return { content: await callOpenAI(systemPrompt, historyMessages, hasImage ? attachmentData : null, attachmentType), modelUsed: "gpt-4o" };
    } catch (e: any) {
      console.warn(`[AI] gpt-4o failed (${e?.message}), falling back to Gemini`);
      return await geminiViaOR();
    }
  }

  if (modelId === "deepseek-v3") {
    if (hasImage) {
      return await geminiViaOR();
    }
    try {
      return { content: await callDeepSeek(systemPrompt, historyMessages), modelUsed: "deepseek-v3" };
    } catch (e: any) {
      console.warn(`[AI] deepseek-v3 failed (${e?.message}), falling back to Gemini`);
      return await geminiViaOR();
    }
  }

  if (modelId === "gemini-2-flash") {
    try {
      return await geminiViaOR();
    } catch (e: any) {
      console.warn(`[AI] gemini-2-flash failed (${e?.message}), falling back to gpt-4o-mini`);
      try {
        return { content: await callOpenAIMini(systemPrompt, historyMessages, hasImage ? attachmentData : null, attachmentType), modelUsed: "gpt-4o-mini" };
      } catch (e2: any) {
        console.warn(`[AI] gpt-4o-mini fallback failed (${e2?.message}), trying deepseek`);
        if (hasImage) throw e2;
        return { content: await callDeepSeek(systemPrompt, historyMessages), modelUsed: "deepseek-v3" };
      }
    }
  }

  if (modelId === "grok") {
    try {
      return { content: await callGrok(systemPrompt, historyMessages), modelUsed: "grok" };
    } catch {
      try {
        return { content: await callOpenRouter("x-ai/grok-3", systemPrompt, historyMessages, null, null), modelUsed: "grok" };
      } catch (e: any) {
        console.warn(`[AI] grok failed everywhere (${e?.message}), falling back to Gemini`);
        return await geminiViaOR();
      }
    }
  }

  return await geminiViaOR();
}

async function callOpenAI(
  systemPrompt: string,
  messages: ChatMessage[],
  imageData?: string | null,
  imageType?: string | null,
  model: string = "gpt-4o"
): Promise<string> {
  const builtMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
  ];

  for (let i = 0; i < messages.length - 1; i++) {
    builtMessages.push({ role: messages[i].role as "user" | "assistant", content: messages[i].content });
  }

  const lastMsg = messages[messages.length - 1];
  if (imageData && imageType) {
    builtMessages.push({
      role: "user",
      content: [
        { type: "text", text: lastMsg.content },
        {
          type: "image_url",
          image_url: { url: `data:${imageType};base64,${imageData}` },
        },
      ],
    });
  } else {
    builtMessages.push({ role: lastMsg.role as "user" | "assistant", content: lastMsg.content });
  }

  const response = await getOpenAI().chat.completions.create({
    model,
    messages: builtMessages,
    max_tokens: 4096,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content || "Не удалось получить ответ.";
}

async function callOpenAIMini(
  systemPrompt: string,
  messages: ChatMessage[],
  imageData?: string | null,
  imageType?: string | null
): Promise<string> {
  return callOpenAI(systemPrompt, messages, imageData, imageType, "gpt-4o-mini");
}

async function callClaude(
  systemPrompt: string,
  messages: ChatMessage[],
  imageData?: string | null,
  imageType?: string | null
): Promise<string> {
  const claudeMessages: Anthropic.MessageParam[] = [];

  for (let i = 0; i < messages.length - 1; i++) {
    claudeMessages.push({
      role: messages[i].role as "user" | "assistant",
      content: messages[i].content,
    });
  }

  const lastMsg = messages[messages.length - 1];
  if (imageData && imageType) {
    claudeMessages.push({
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: imageType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: imageData,
          },
        },
        { type: "text", text: lastMsg.content },
      ],
    });
  } else {
    claudeMessages.push({
      role: lastMsg.role as "user" | "assistant",
      content: lastMsg.content,
    });
  }

  const response = await getAnthropic().messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    system: systemPrompt,
    messages: claudeMessages,
  });

  const block = response.content[0];
  if (block.type === "text") return block.text;
  return "Не удалось получить ответ.";
}

async function callClaudeOpus(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  const claudeMessages: Anthropic.MessageParam[] = messages.map(m => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const response = await getAnthropic().messages.create({
    model: "claude-opus-4-5",
    max_tokens: 8000,
    system: systemPrompt,
    messages: claudeMessages,
  });

  const block = response.content[0];
  if (block.type === "text") return block.text;
  return "Не удалось получить ответ.";
}

async function callDeepSeek(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  const builtMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages.map(m => ({ role: m.role as "user" | "assistant" | "system", content: m.content })),
  ];

  const response = await getDeepSeek().chat.completions.create({
    model: "deepseek-chat",
    messages: builtMessages,
    max_tokens: 4096,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content || "Не удалось получить ответ.";
}

async function callDeepSeekReasoner(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  const builtMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages.map(m => ({ role: m.role as "user" | "assistant" | "system", content: m.content })),
  ];

  const response = await getDeepSeek().chat.completions.create({
    model: "deepseek-reasoner",
    messages: builtMessages,
    max_tokens: 8000,
  });

  return response.choices[0]?.message?.content || "Не удалось получить ответ.";
}

async function callGrok(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  const builtMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages.map(m => ({ role: m.role as "user" | "assistant" | "system", content: m.content })),
  ];

  const response = await getXai().chat.completions.create({
    model: "grok-3",
    messages: builtMessages,
    max_tokens: 4096,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content || "Не удалось получить ответ.";
}

async function callOpenRouter(
  model: string,
  systemPrompt: string,
  messages: ChatMessage[],
  imageData?: string | null,
  imageType?: string | null
): Promise<string> {
  const builtMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
  ];

  for (let i = 0; i < messages.length - 1; i++) {
    builtMessages.push({ role: messages[i].role as "user" | "assistant", content: messages[i].content });
  }

  const lastMsg = messages[messages.length - 1];
  if (imageData && imageType) {
    builtMessages.push({
      role: "user",
      content: [
        { type: "text", text: lastMsg.content },
        {
          type: "image_url",
          image_url: { url: `data:${imageType};base64,${imageData}` },
        },
      ],
    });
  } else {
    builtMessages.push({ role: lastMsg.role as "user" | "assistant", content: lastMsg.content });
  }

  const response = await getOpenRouter().chat.completions.create({
    model,
    messages: builtMessages,
    max_tokens: 4096,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content || "Не удалось получить ответ.";
}

// Типы работ, которые пишутся по разделам (план → каждый раздел отдельно)
const MULTI_SECTION_TYPES = ["coursework", "diploma", "essay"];

function parsePlanSections(plan: string): string[] {
  const lines = plan.split("\n");
  const sections: string[] = [];
  for (const line of lines) {
    const match = line.match(/^\s*\d+[.)]\s+(.+)/);
    if (match) {
      const title = match[1].trim().replace(/[.:]$/, "");
      if (title.length > 2) sections.push(title);
    }
  }
  return sections.length >= 3
    ? sections
    : ["Введение", "Теоретическая часть", "Практическая часть", "Заключение"];
}

async function generateWorkPlan(
  title: string,
  description: string,
  subject: string,
  taskType: string
): Promise<{ planText: string; sections: string[] }> {
  const typeLabels: Record<string, string> = {
    coursework: "курсовой работы",
    diploma: "дипломной работы",
    essay: "эссе/реферата",
  };
  const typeLabel = typeLabels[taskType] || "академической работы";
  const sectionCount = taskType === "diploma" ? "9-12" : taskType === "essay" ? "4-5" : "6-8";

  const planSystem = `Ты — академический консультант. Составляешь план учебных работ для студентов на русском языке.`;
  const planUser = `Составь оглавление для ${typeLabel}: "${title}"
Предмет: ${subject}
${description ? `Задание: ${description}` : ""}

Выведи ТОЛЬКО пронумерованный список разделов (${sectionCount} разделов):
1. Введение
2. [Название раздела]
...
N. Заключение

Требования:
- Только нумерованный список, никакого другого текста
- Названия разделов на русском, академическим стилем
- Первый раздел — Введение, последний — Заключение`;

  const planText = await callDeepSeek(planSystem, [{ role: "user", content: planUser }]);
  const sections = parsePlanSections(planText);
  return { planText, sections };
}

type WorkerDef = { name: string; fn: () => Promise<string> };

async function runSingleEnsemble(
  workers: WorkerDef[],
  solvingMode: string,
  synthSystemPrompt: string,
  synthUserContent: string
): Promise<string> {
  const settled = await Promise.allSettled(workers.map(w => w.fn()));
  const workerResults = workers.map((w, i) => ({
    name: w.name,
    result:
      settled[i].status === "fulfilled"
        ? (settled[i] as PromiseFulfilledResult<string>).value
        : "(модель недоступна)",
  }));

  const available = workerResults.filter(r => r.result !== "(модель недоступна)");
  if (available.length === 0) return "(все модели недоступны)";

  const solutionsBlock = workerResults
    .map((r, i) => `## Вариант ${i + 1} (${r.name})\n\n${r.result}`)
    .join("\n\n---\n\n");

  const synthMessages: ChatMessage[] = [
    { role: "user", content: `${synthUserContent}\n\n---\n\n${solutionsBlock}` },
  ];

  try {
    if (solvingMode === "super_premium") return await callClaudeOpus(synthSystemPrompt, synthMessages);
    if (solvingMode === "premium") return await callClaude(synthSystemPrompt, synthMessages);
    return await callOpenRouter("google/gemini-2.0-flash-001", synthSystemPrompt, synthMessages);
  } catch {
    return available.reduce((best, cur) => cur.result.length > best.result.length ? cur : best).result;
  }
}

export async function callAIForTask(params: {
  title: string;
  description: string;
  subject: string;
  taskType: string;
  solvingMode: string;
  complexity: number;
  attachmentData?: string;
  attachmentType?: string;
  attachmentName?: string;
}): Promise<string> {
  const { title, description, subject, taskType, solvingMode, complexity, attachmentData, attachmentType, attachmentName } = params;

  const hasImage = !!attachmentData && attachmentType?.startsWith("image/");
  const imgData = hasImage ? attachmentData! : null;
  const imgType = hasImage ? attachmentType! : null;

  const isPresentation = taskType === "presentation" || description.startsWith("СОЗДАЙ ПРЕЗЕНТАЦИЮ");

  // Фабрика воркеров — одни и те же модели, разные промпты/сообщения
  function makeWorkers(systemPrompt: string, messages: ChatMessage[]): WorkerDef[] {
    if (solvingMode === "fast") {
      return [
        { name: "DeepSeek-V3", fn: () => callDeepSeek(systemPrompt, messages) },
        { name: "GPT-4o-mini", fn: () => callOpenAIMini(systemPrompt, messages, imgData, imgType) },
      ];
    } else if (solvingMode === "standard") {
      return [
        { name: "DeepSeek-V3", fn: () => callDeepSeek(systemPrompt, messages) },
        { name: "GPT-4o", fn: () => callOpenAI(systemPrompt, messages, imgData, imgType) },
        { name: "Claude Sonnet", fn: () => callClaude(systemPrompt, messages, imgData, imgType) },
      ];
    } else {
      // premium / super_premium — одни воркеры, синтезатор разный
      return [
        { name: "DeepSeek-R1", fn: () => callDeepSeekReasoner(systemPrompt, messages) },
        { name: "GPT-4o", fn: () => callOpenAI(systemPrompt, messages, imgData, imgType) },
        { name: "Gemini 2.5 Pro", fn: () => callOpenRouter("google/gemini-2.5-pro", systemPrompt, messages, imgData, imgType) },
      ];
    }
  }

  // ── МНОГОРАЗДЕЛЬНЫЙ РЕЖИМ: курсовые, дипломные, эссе ────────────────────────
  if (MULTI_SECTION_TYPES.includes(taskType) && complexity >= 4) {
    // Шаг 1: Генерируем план
    const { planText, sections } = await generateWorkPlan(title, description, subject, taskType);

    const sectionSystemPrompt = `Ты — профессиональный академический автор. Пишешь один раздел учебной работы.
Предмет: ${subject}. Сложность: ${complexity}/10.

Правила:
- Академический стиль, научная лексика, русский язык
- Объём раздела: 6-10 развёрнутых абзацев
- Используй Markdown: ### для подзаголовков внутри раздела, списки, формулы LaTeX
- Не пиши название раздела как заголовок — оно уже будет добавлено
- Не пиши другие разделы — только тот, который указан
- Ссылайся на понятия из соседних разделов для связности текста`;

    const synthSectionSystem = `Ты — редактор и верификатор академических текстов. Тебе предоставлены несколько версий одного раздела от разных ИИ-авторов.
Твоя задача: синтезировать лучший финальный вариант раздела.

Правила:
- Один итоговый текст на русском, без указания, какая модель что написала
- Бери самое точное, полное и академически корректное из всех версий
- Академический стиль, Markdown-форматирование, LaTeX для формул
- Объём: 6-10 абзацев`;

    let fullDocument = `# ${title}\n\n`;
    fullDocument += `## Оглавление\n\n${planText}\n\n---\n\n`;

    for (let i = 0; i < sections.length; i++) {
      const sectionTitle = sections[i];
      const sectionUserContent = `Работа: "${title}"
Предмет: ${subject}
Оглавление: ${sections.map((s, j) => `${j + 1}. ${s}`).join(", ")}

Напиши ТОЛЬКО раздел ${i + 1} из ${sections.length}: "${sectionTitle}"
${description ? `\nКонтекст задания: ${description}` : ""}`;

      const synthUserContent = `Работа: "${title}", раздел ${i + 1}/${sections.length}: "${sectionTitle}"
Синтезируй лучший финальный вариант этого раздела из предложенных версий:`;

      const workers = makeWorkers(sectionSystemPrompt, [{ role: "user", content: sectionUserContent }]);
      const sectionResult = await runSingleEnsemble(workers, solvingMode, synthSectionSystem, synthUserContent);

      fullDocument += `## ${i + 1}. ${sectionTitle}\n\n${sectionResult}\n\n---\n\n`;
    }

    return fullDocument;
  }

  // ── СТАНДАРТНЫЙ РЕЖИМ: одна задача за один вызов ────────────────────────────
  const subjectLower = subject.toLowerCase();
  const isExactScience = /мат|физик|хим|биол|биохим|теорвер|статис|дискрет|эконометр|астроном|экол/.test(subjectLower);
  const isEngineering = /сопромат|теормех|тоэ|электротехн|термодин|детал|материалов|строит|геодез|электрон|схемотех/.test(subjectLower);
  const isProgramming = /python|java|c\+\+|c#|javascript|js|sql|базы данных|алгоритм|структуры данных|кибербез|сети|ос|machine learning|ml|ai|веб-раз|программир|информатик/.test(subjectLower);
  const isHumanities = /истори|философ|социол|политол|культурол|педагог|литерат|русский|журналист|реклам|pr/.test(subjectLower);
  const isLanguages = /английск|немецк|французск|китайск|испанск|итальянск|иностранн/.test(subjectLower);
  const isEconomics = /микроэконом|макроэконом|экономик|финанс|менедж|маркет|бухучёт|бухгалт|налог|логистик/.test(subjectLower);
  const isLaw = /право|юрид|правовед|конституц|гражданск|уголовн|административн|трудов|международн/.test(subjectLower);
  const isMedicine = /анатом|физиолог|фармакол|паталог|гигиен|эпидемиол|медицин|клиническ/.test(subjectLower);
  const isPsychology = /психолог/.test(subjectLower);
  const isExam = /егэ|огэ|подготовк/.test(subjectLower);

  function getSubjectRules(): string {
    if (isEngineering) return `
Специфика инженерных дисциплин:
- Всегда указывай единицы измерения СИ: [Па], [Н], [м], [кг], [с], [А], [В], [Ом] и т.д.
- Пиши формулы в LaTeX: $...$ (inline) и $$...$$ (block)
- Структура решения: Дано → Перевод единиц → Расчётные формулы → Подстановка → Ответ
- Для Сопромата: записывай эпюры, условия прочности и жёсткости
- Для ТОЭ/Электротехники: рисуй схемы через Markdown-текст, применяй законы Кирхгофа
- Для Теормеха: указывай систему координат, строй свободное тело
- Проверяй размерность в каждом шаге`;
    if (isProgramming) return `
Специфика программирования и IT:
- Пиши рабочий код в блоках \`\`\`язык ... \`\`\`
- Добавляй комментарии к ключевым строкам
- Объясняй алгоритм словами ДО кода
- Указывай сложность: O(n), O(log n), O(n²) и т.д.
- Для алгоритмов: показывай трассировку на конкретном примере
- Для SQL: пиши корректный синтаксис, указывай СУБД если важно
- Для кибербезопасности: объясняй вектор атаки и методы защиты
- Для ML: описывай метрики, переобучение, применяй sklearn/numpy/pandas`;
    if (isExactScience) return `
Специфика точных наук:
- Показывай пошаговое решение с пояснением каждого шага
- Все формулы — в LaTeX: $...$ inline, $$...$$ block
- Единицы измерения обязательны
- Финальный ответ выделяй через $\\boxed{...}$
- Для физики: записывай уравнения в общем виде → подставляй числа
- Для химии: показывай уравнения реакций, расставляй коэффициенты
- Для биологии/биохимии: используй биохимическую номенклатуру, схемы метаболических путей
- Проверяй знак и порядок величины ответа`;
    if (isLaw) return `
Специфика юридических дисциплин:
- Всегда ссылайся на конкретные статьи нормативных актов (ГК РФ ст. X, УК РФ ст. X и т.д.)
- Структура правового анализа: Факты → Применимые нормы → Правовая квалификация → Вывод
- Разграничивай диспозитивные и императивные нормы
- Для уголовного права: объект, объективная сторона, субъект, субъективная сторона
- Для гражданского права: состав правоотношения, основания возникновения прав
- Указывай актуальность нормы (Россия, действующая редакция)`;
    if (isMedicine) return `
Специфика медицинских дисциплин:
- Используй медицинскую латинскую номенклатуру где уместно
- Для анатомии: описывай топографию, синтопию, скелетотопию
- Для фармакологии: МНН, механизм действия, побочные эффекты, противопоказания, дозы
- Для физиологии: объясняй механизм на уровне клетки/органа/системы
- Для патологии: этиология → патогенез → морфология → клиника → лечение
- Клинические данные — строго для учебных целей`;
    if (isEconomics) return `
Специфика экономических дисциплин:
- Формулы в LaTeX, числовые расчёты — пошагово
- Для эконометрики: показывай вычисление коэффициентов, R², t-статистик
- Интерпретируй экономический смысл результатов
- Для финансов: NPV, IRR, дисконтирование — с формулами
- Для бухучёта: указывай проводки Дт/Кт, счета плана счетов
- Для налогов: ссылайся на НК РФ, указывай ставки и льготы`;
    if (isHumanities) return `
Специфика гуманитарных дисциплин:
- Давай структурированный академический ответ
- Для истории: указывай даты, причины, последствия, исторических деятелей
- Для философии: представляй позиции разных школ, аргументируй тезис
- Для социологии/политологии: опирайся на классиков (Вебер, Дюркгейм, Парсонс и др.)
- Для педагогики: ссылайся на дидактические принципы, методы и формы обучения
- Для журналистики/PR: учитывай жанровые особенности, целевую аудиторию
- Для культурологии: рассматривай контекст эпохи, стилей и направлений`;
    if (isLanguages) return `
Специфика иностранных языков:
- При переводе сохраняй стиль и тональность оригинала
- Объясняй грамматические конструкции на русском
- Для письменных заданий: соблюдай структуру (Introduction → Body → Conclusion)
- Отмечай типичные ошибки русскоязычных учащихся
- Добавляй транскрипцию для незнакомых слов если нужно
- Для эссе/сочинений: используй linking words, academic vocabulary`;
    if (isPsychology) return `
Специфика психологии:
- Ссылайся на авторитетных психологов и их концепции
- Разграничивай клиническую и общую психологию
- Для диагностики: указывай методики (тест Роршаха, MMPI, шкала Бека и др.)
- Объясняй механизмы психических процессов научно
- Для практических вопросов: давай рекомендации, основанные на доказательной базе`;
    if (isExam) return `
Специфика подготовки к ЕГЭ/ОГЭ:
- Используй формат ФИПИ: задания базового и профильного уровня
- Показывай алгоритм решения типовых задач
- Указывай типичные ошибки и как их избежать
- Для заданий с кратким ответом — давай только ответ и краткое пояснение
- Для заданий с развёрнутым ответом — полное решение с критериями проверки
- Отмечай важность: баллы ЕГЭ, частотность темы`;
    return `
Специфика предмета:
- Адаптируй глубину и стиль ответа к уровню студента
- Приводи примеры из практики
- Используй наглядные структуры: таблицы, списки, заголовки`;
  }

  let workerSystemPrompt = `Ты — профессиональный эксперт-преподаватель. Решаешь учебные задания для студентов на высоком уровне.
Предмет: ${subject}. Тип задания: ${taskType}. Уровень сложности: ${complexity}/10.

Общие правила:
- Отвечай на русском языке
- Давай полное, структурированное решение с пояснениями
- Используй Markdown: заголовки ##, списки, блоки кода \`\`\`
- Формулы СТРОГО в LaTeX: $...$ (inline), $$...$$ (block) — НЕ используй \\[...\\] или \\(...\\)
- Если прикреплено изображение с условием — внимательно прочитай и реши по нему
- Если прикреплён документ/файл — используй его содержимое
- Проверяй ответ и указывай итог

Таблицы и визуализация:
- Если задача требует сравнения, классификации или табличных данных — ОБЯЗАТЕЛЬНО используй Markdown-таблицы (| Столбец | Столбец |)
- Если нужна блок-схема, UML, ER-диаграмма, дерево решений — используй блок \`\`\`mermaid ... \`\`\`
- Если нужен график с данными (гистограмма, линейный, круговой) — используй блок \`\`\`chart ... \`\`\` с JSON:
  Линейный: {"type":"line","title":"...","data":[{"x":"A","y":10}],"xKey":"x","yKeys":["y"]}
  Столбчатый: {"type":"bar","title":"...","data":[{"name":"A","value":42}],"xKey":"name","yKeys":["value"]}
  Круговой: {"type":"pie","title":"...","labels":["A","B"],"values":[60,40]}
${getSubjectRules()}`;

  if (isPresentation) {
    workerSystemPrompt += `

ВАЖНО: Ты создаёшь ПРЕЗЕНТАЦИЮ. ОБЯЗАТЕЛЬНО структурируй весь ответ в виде слайдов строго по формату:

=== СЛАЙД 1: Название слайда ===
Краткий вводный текст (1-2 предложения)
- Ключевой пункт 1
- Ключевой пункт 2

=== СЛАЙД 2: Следующий слайд ===
...

Требования к презентации:
- 8-12 слайдов
- Первый слайд — титульный (название темы)
- Последний слайд — Выводы / Заключение
- Каждый слайд: 1 абзац текста + 3-5 коротких пунктов
- НЕ пиши ничего вне этого формата слайдов`;
  }

  let userContent = description
    ? `Задание: ${title}\n\nОписание/условие:\n${description}`
    : `Задание: ${title}`;

  if (attachmentName && !attachmentData) {
    userContent += `\n\n[Прикреплён файл: ${attachmentName}]`;
  }

  const taskMessages: ChatMessage[] = [{ role: "user", content: userContent }];
  const workers = makeWorkers(workerSystemPrompt, taskMessages);

  const settled = await Promise.allSettled(workers.map(w => w.fn()));
  const workerResults = workers.map((w, i) => ({
    name: w.name,
    result:
      settled[i].status === "fulfilled"
        ? (settled[i] as PromiseFulfilledResult<string>).value
        : "(модель недоступна)",
  }));

  const available = workerResults.filter(r => r.result !== "(модель недоступна)");

  if (available.length === 0) {
    try {
      return await callOpenRouter("google/gemini-2.0-flash-001", workerSystemPrompt, taskMessages);
    } catch {
      return `**Задание: ${title}**\n\nК сожалению, все ИИ-модели временно недоступны. Пожалуйста, попробуйте позже.`;
    }
  }

  const solutionsBlock = workerResults
    .map((r, i) => `## Решение ${i + 1} (${r.name})\n\n${r.result}`)
    .join("\n\n---\n\n");

  const synthSystemPrompt = `Ты — эксперт-верификатор и синтезатор решений. Тебе предоставлены несколько решений одного учебного задания от разных ИИ-моделей.
Твоя задача — изучить все решения, определить верное/наилучшее или объединить их в один исчерпывающий финальный ответ.

Правила:
- Отвечай ТОЛЬКО на русском языке
- Выдай ОДИН итоговый ответ — не пересказывай, что написали другие модели, не сравнивай их вслух
- Если решения совпадают — дай лучшую, наиболее полную версию
- Если решения расходятся — выбери верное, кратко укажи это в тексте, дай итог
- Используй Markdown: заголовки ##, списки, таблицы (Markdown-формат |...|), блоки кода
- Формулы СТРОГО в LaTeX: $...$ (inline), $$...$$ (block) — НЕ используй \\[...\\] или \\(...\\)
- Если задача требует таблицы — ОБЯЗАТЕЛЬНО включай Markdown-таблицу (| Столбец 1 | Столбец 2 |)
- Если в решениях есть диаграммы — воспроизводи их в блоке \`\`\`mermaid ... \`\`\`
- Если в решениях есть графики — воспроизводи их в блоке \`\`\`chart ... \`\`\` (JSON формат)
- Ответ должен быть полным, структурированным и готовым к сдаче${isPresentation ? `
- Формат СТРОГО соблюдай: === СЛАЙД N: Название === для каждого слайда` : ""}`;


  const synthUserContent = `Задание: "${title}"
Предмет: ${subject}
${description ? `Условие:\n${description}\n` : ""}
Ниже — решения от ${workerResults.length} ИИ-моделей. Синтезируй финальный ответ:

---

${solutionsBlock}`;

  const synthMessages: ChatMessage[] = [{ role: "user", content: synthUserContent }];

  try {
    if (solvingMode === "super_premium") return await callClaudeOpus(synthSystemPrompt, synthMessages);
    if (solvingMode === "premium") return await callClaude(synthSystemPrompt, synthMessages);
    return await callOpenRouter("google/gemini-2.0-flash-001", synthSystemPrompt, synthMessages);
  } catch {
    return available.reduce((best, cur) => cur.result.length > best.result.length ? cur : best).result;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Извлечение данных из изображения (Vision) — для верификации перед решением
// ──────────────────────────────────────────────────────────────────────────────
export type ImageQuality = "good" | "poor" | "unreadable";

export async function extractImageContent(
  imageBase64: string,
  mimeType: string,
  subject: string,
  hint?: string,
): Promise<{ extractedText: string; summary: string; quality: ImageQuality; qualityNote?: string }> {
  const openai = getOpenAI();

  const systemPrompt = `Ты — ассистент, который извлекает данные из фото учебных заданий.
Твоя задача: оценить качество изображения и извлечь все данные.
Предмет задания: ${subject}.

Порядок ответа — СТРОГО такой:

1. Первая строка: "Качество: good" | "Качество: poor" | "Качество: unreadable"
   - good = текст чётко виден, можно точно прочитать всё
   - poor = текст читается частично: часть размыта, обрезана или нечёткая
   - unreadable = изображение слишком тёмное/размытое/повёрнутое — текст практически не различим

2. Если poor или unreadable — вторая строка: "Проблема: <краткое описание на русском>"
   Примеры: "Проблема: изображение сильно размыто", "Проблема: текст обрезан справа", "Проблема: слишком тёмное освещение"

3. "Считано из фото:" — пронумерованный список всего, что удалось прочитать
   - Пиши ТОЧНО то, что написано — числа, формулы, условия, вопросы
   - Нечитаемые части помечай [нечётко] или [не видно]
   - Не решай задачу — только извлекай данные

4. "Резюме:" — одна строка с кратким описанием (тест/задача/условие и т.д.)`;

  const userContent: any[] = [
    {
      type: "image_url",
      image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "high" },
    },
    {
      type: "text",
      text: hint
        ? `Оцени качество и извлеки все данные из изображения. Контекст: "${hint}"`
        : "Оцени качество и извлеки все данные из изображения.",
    },
  ];

  const resp = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 1500,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  });

  const raw = resp.choices[0]?.message?.content || "Не удалось извлечь данные из изображения.";

  // Parse quality — tolerates "1. Качество: poor" or just "Качество: poor"
  const qualityMatch = raw.match(/(?:^\d+[.)]\s*)?Качество:\s*(good|poor|unreadable)/im);
  const quality: ImageQuality = (qualityMatch?.[1] as ImageQuality) ?? "good";

  // Parse problem note — tolerates numbered prefix
  const problemMatch = raw.match(/(?:^\d+[.)]\s*)?Проблема:\s*(.+)/im);
  const qualityNote = problemMatch?.[1]?.trim();

  // Parse summary
  const summaryMatch = raw.match(/Резюме[:\s]+(.+?)(?:\n|$)/i);
  const summary = summaryMatch?.[1]?.trim() || "Данные извлечены из изображения";

  // Strip the quality/problem header lines from the user-visible text
  // (handles both plain and numbered formats)
  const extractedText = raw
    .replace(/^\d+[.)]\s*Качество:\s*(good|poor|unreadable)\s*\n?/im, "")
    .replace(/^Качество:\s*(good|poor|unreadable)\s*\n?/im, "")
    .replace(/^\d+[.)]\s*Проблема:\s*.+\s*\n?/im, "")
    .replace(/^Проблема:\s*.+\s*\n?/im, "")
    .trim();

  return { extractedText, summary, quality, qualityNote };
}

// ──────────────────────────────────────────────────────────────────────────────
// Generic raw AI call — used for coursework chapter generation
// ──────────────────────────────────────────────────────────────────────────────
export async function callAIRaw(params: {
  provider: "openai" | "deepseek" | "anthropic" | "openrouter";
  model: string;
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
}): Promise<string> {
  const { provider, model, systemPrompt, userMessage, maxTokens = 4000 } = params;

  if (provider === "anthropic") {
    const client = getAnthropic();
    const resp = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });
    const block = resp.content[0];
    return block.type === "text" ? block.text : "";
  }

  const client = provider === "deepseek" ? getDeepSeek()
    : provider === "openrouter" ? getOpenRouter()
    : getOpenAI();

  const resp = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });
  return resp.choices[0]?.message?.content ?? "";
}
