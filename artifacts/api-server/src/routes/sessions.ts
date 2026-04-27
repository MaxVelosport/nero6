import { Router } from "express";
import { requireAuth } from "../lib/auth";
import { getSupabaseAdmin } from "../lib/supabase.js";
import { logger } from "../lib/logger";
import { callAI, type ChatMessage } from "../lib/ai";
import { getPricing } from "../lib/settings.js";
import { isUserSubscribed } from "../lib/subscription.js";

const router = Router();

async function getSessionPackages() {
  return (await getPricing()).sessionPackages;
}
async function getSessionSurcharges() {
  return (await getPricing()).sessionModelSurcharges;
}
async function getAttachmentExtraCost(sizeBytes: number): Promise<number> {
  const tiers = (await getPricing()).sessionAttachmentTiers;
  // Сортируем по убыванию sizeBytes, чтобы вернуть наибольший подходящий тариф
  const sorted = [...tiers].sort((a, b) => b.sizeBytes - a.sizeBytes);
  for (const t of sorted) if (sizeBytes >= t.sizeBytes) return t.extraCost;
  return 0;
}

// Себестоимость на сообщение (~2000 вход, ~800 вых токенов, $1=90₽):
//   Gemini Flash: (2000×0.075 + 800×0.30)/1M×90 = 0.035₽/msg  → margin ~94% на hour1(59₽)
//   GPT-4o:       (2000×2.50 + 800×10.00)/1M×90 = 1.17₽/msg   → break-even week1 = (479+40)/1.17 = 444 msgs
//   Claude:       (2000×3.00 + 800×15.00)/1M×90 = 1.62₽/msg   → break-even week1 = (479+30)/1.62 = 314 msgs
//   Grok:         ≈ Claude (~$3+$15/1M)                          → 314 msgs break-even
const AI_MODELS = {
  "gemini-2-flash": { id: "gemini-2-flash", name: "Gemini 2.0 Flash", provider: "Google", badge: "Быстрый", description: "Быстрый и точный. Идеален для тестов и домашних заданий.", contextWindow: "1M токенов", priceMultiplier: 1.0, priceSurcharge: 0, supportsImages: true, supportsFiles: true, recommended: true, color: "blue", strengths: ["Скорость", "Многоязычность", "Длинный контекст", "Изображения"], avgResponseSec: 3 },
  "gpt-4o": { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", badge: "Умный", description: "Самая мощная модель OpenAI. Лучший выбор для сложных задач.", contextWindow: "128K токенов", priceMultiplier: 1.6, priceSurcharge: 40, supportsImages: true, supportsFiles: true, recommended: false, color: "emerald", strengths: ["Точность", "Программирование", "Математика", "Анализ"], avgResponseSec: 6 },
  "claude-sonnet": { id: "claude-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic", badge: "Глубокий", description: "Сильный в рассуждениях и написании текстов. Отлично для гуманитарных наук.", contextWindow: "200K токенов", priceMultiplier: 1.4, priceSurcharge: 30, supportsImages: true, supportsFiles: false, recommended: false, color: "orange", strengths: ["Рассуждения", "Сочинения", "Анализ текстов", "Право"], avgResponseSec: 8 },
  "deepseek-v3": { id: "deepseek-v3", name: "DeepSeek-V3", provider: "DeepSeek", badge: "Экономный", description: "Мощная модель с отличной математикой. Внимание: отвечает ~20–30 сек (без стриминга).", contextWindow: "128K токенов", priceMultiplier: 0.65, priceSurcharge: 0, supportsImages: false, supportsFiles: false, recommended: false, color: "violet", strengths: ["Математика", "Физика", "Экономность", "Код"], avgResponseSec: 25, slowWarning: true },
  "grok": { id: "grok", name: "Grok 3", provider: "xAI", badge: "Дерзкий", description: "Флагманская модель от xAI (Илон Маск). Мощные рассуждения и актуальные знания.", contextWindow: "131K токенов", priceMultiplier: 1.2, priceSurcharge: 15, supportsImages: false, supportsFiles: false, recommended: false, color: "cyan", strengths: ["Логика", "Рассуждения", "Актуальность", "Факты"], avgResponseSec: 8 },
};

// PACKAGES и MODEL_SURCHARGE теперь читаются из settings (lib/settings.ts).

router.get("/packages", async (_req, res) => { res.json(await getSessionPackages()); });
router.get("/models", (_req, res) => { res.json(AI_MODELS); });

router.get("/", requireAuth, async (req, res) => {
  const userId = (req as any).user.id;
  try {
    const sb = getSupabaseAdmin();
    let sessions: any[] = [];

    if (sb) {
      const { data } = await sb.from("Neyrozachet_sessions").select("*, Neyrozachet_messages(id, role)").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
      sessions = (data ?? []).map((s: any) => {
        const msgs = s.Neyrozachet_messages ?? [];
        const count = msgs.filter((m: any) => m.role === "user").length;
        const { Neyrozachet_messages: _, ...rest } = s;
        return { ...rest, messages_count: count };
      });
    } else {
      const { pool } = await import("@workspace/db");
      const client = await pool.connect();
      try {
        const result = await client.query(`SELECT s.*, (SELECT COUNT(*) FROM "Neyrozachet_messages" m WHERE m.session_id = s.id AND m.role = 'user') as messages_count FROM "Neyrozachet_sessions" s WHERE s.user_id = $1 ORDER BY s.created_at DESC LIMIT 50`, [userId]);
        sessions = result.rows;
      } finally { client.release(); }
    }

    const now = new Date();
    sessions = sessions.map((s: any) => {
      if (s.status === "active" && s.expires_at && new Date(s.expires_at) < now) {
        return { ...s, status: "expired" };
      }
      return s;
    });

    res.json({ sessions, total: sessions.length });
  } catch (err) {
    logger.error({ err }, "Failed to list sessions");
    res.status(500).json({ message: "Ошибка при получении сессий" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  const userId = (req as any).user.id;
  const { title, subject, purpose, packageType, modelId } = req.body;

  if (!title || !subject || !packageType) {
    return res.status(400).json({ message: "Укажите тему, предмет и пакет" });
  }
  const PACKAGES = await getSessionPackages();
  const pkg = PACKAGES[packageType];
  if (!pkg) return res.status(400).json({ message: "Неверный тип пакета" });

  const sb = getSupabaseAdmin();

  try {
    let currentBalance: number;
    if (sb) {
      const { data: u } = await sb.from("Neyrozachet_users").select("balance").eq("id", userId).single();
      currentBalance = u?.balance ?? 0;
    } else {
      const { pool } = await import("@workspace/db");
      const client = await pool.connect();
      try {
        const r = await client.query(`SELECT balance FROM "Neyrozachet_users" WHERE id = $1`, [userId]);
        currentBalance = r.rows[0]?.balance ?? 0;
      } finally { client.release(); }
    }

    const expiresAt = pkg.durationHours ? new Date(Date.now() + pkg.durationHours * 60 * 60 * 1000).toISOString() : null;
    const chosenModelId = (modelId && AI_MODELS[modelId as keyof typeof AI_MODELS]) ? modelId : "gemini-2-flash";
    const chosenModel = AI_MODELS[chosenModelId as keyof typeof AI_MODELS];

    // Apply per-model surcharge on top of base package price
    const SURCHARGES = await getSessionSurcharges();
    const surcharge = SURCHARGES[chosenModelId] ?? 0;
    const basePrice = pkg.price + surcharge;
    const subscribed = await isUserSubscribed(userId);
    const finalPrice = subscribed ? 0 : basePrice;

    if (!subscribed && currentBalance < finalPrice) {
      return res.status(402).json({ message: `Недостаточно средств. Нужно ${finalPrice} ₽, у вас ${currentBalance} ₽`, required: finalPrice, balance: currentBalance });
    }

    const txDescr = `Сессия "${title}" — ${chosenModel.name}, ${pkg.name} (${pkg.durationHours}ч)${subscribed ? " (по подписке)" : ""}`;
    let session: any;
    if (sb) {
      if (!subscribed) {
        await sb.from("Neyrozachet_users").update({ balance: currentBalance - finalPrice, updated_at: new Date().toISOString() }).eq("id", userId);
      }
      await sb.from("Neyrozachet_transactions").insert({ user_id: userId, type: "payment", amount: finalPrice, description: txDescr });

      const { data } = await sb.from("Neyrozachet_sessions").insert({
        user_id: userId, title, subject, purpose: purpose || "general",
        package_type: packageType, questions_total: 9999,
        total_cost: finalPrice, expires_at: expiresAt, model_id: chosenModelId,
      }).select().single();
      session = data;

      await sb.from("Neyrozachet_messages").insert({
        session_id: session.id, role: "system",
        content: `Сессия по предмету "${subject}" начата. Пакет: ${pkg.name} (∞ вопросов, ${pkg.durationHours}ч). Модель ИИ: ${chosenModel.name}${chosenModel.supportsImages ? " (поддерживает изображения)" : ""}. Вопросы не ограничены — задавайте до истечения времени сессии.`,
      });
    } else {
      const { pool } = await import("@workspace/db");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        if (!subscribed) {
          await client.query(`UPDATE "Neyrozachet_users" SET balance = balance - $1, updated_at = NOW() WHERE id = $2`, [finalPrice, userId]);
        }
        await client.query(`INSERT INTO "Neyrozachet_transactions" (user_id, type, amount, description) VALUES ($1, 'payment', $2, $3)`, [userId, finalPrice, txDescr]);
        const sr = await client.query(`INSERT INTO "Neyrozachet_sessions" (user_id, title, subject, purpose, package_type, questions_total, total_cost, expires_at, model_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [userId, title, subject, purpose || "general", packageType, 9999, finalPrice, expiresAt, chosenModelId]);
        session = sr.rows[0];
        await client.query(`INSERT INTO "Neyrozachet_messages" (session_id, role, content) VALUES ($1, 'system', $2)`, [session.id, `Сессия по предмету "${subject}" начата.`]);
        await client.query("COMMIT");
      } catch (e) { await client.query("ROLLBACK"); throw e; }
      finally { client.release(); }
    }

    res.status(201).json({ ...session, package: { ...pkg, price: finalPrice, basePkgPrice: pkg.price, modelSurcharge: surcharge } });
  } catch (err) {
    logger.error({ err }, "Failed to create session");
    res.status(500).json({ message: "Ошибка при создании сессии" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  const userId = (req as any).user.id;
  const sessionId = parseInt(req.params.id);
  if (isNaN(sessionId)) return res.status(400).json({ message: "Неверный ID сессии" });

  try {
    const sb = getSupabaseAdmin();
    let session: any;
    let messages: any[] = [];

    if (sb) {
      const { data } = await sb.from("Neyrozachet_sessions").select("*").eq("id", sessionId).eq("user_id", userId).single();
      if (!data) return res.status(404).json({ message: "Сессия не найдена" });
      session = data;
      if (session.status === "active" && session.expires_at && new Date(session.expires_at) < new Date()) {
        await sb.from("Neyrozachet_sessions").update({ status: "expired" }).eq("id", sessionId);
        session.status = "expired";
      }
      // Fetch last 500 messages (DESC then reverse) to avoid Supabase 1000-row default cap
      const { data: msgs } = await sb.from("Neyrozachet_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(500);
      messages = (msgs ?? []).reverse();
    } else {
      const { pool } = await import("@workspace/db");
      const client = await pool.connect();
      try {
        const sr = await client.query(`SELECT * FROM "Neyrozachet_sessions" WHERE id = $1 AND user_id = $2`, [sessionId, userId]);
        if (!sr.rows[0]) return res.status(404).json({ message: "Сессия не найдена" });
        session = sr.rows[0];
        if (session.status === "active" && session.expires_at && new Date(session.expires_at) < new Date()) {
          await client.query(`UPDATE "Neyrozachet_sessions" SET status = 'expired' WHERE id = $1`, [sessionId]);
          session.status = "expired";
        }
        const mr = await client.query(`SELECT * FROM (SELECT * FROM "Neyrozachet_messages" WHERE session_id = $1 ORDER BY created_at DESC LIMIT 500) sub ORDER BY created_at ASC`, [sessionId]);
        messages = mr.rows;
      } finally { client.release(); }
    }

    res.json({ ...session, messages });
  } catch (err) {
    logger.error({ err }, "Failed to get session");
    res.status(500).json({ message: "Ошибка при получении сессии" });
  }
});

router.post("/:id/messages", requireAuth, async (req, res) => {
  const userId = (req as any).user.id;
  const sessionId = parseInt(req.params.id);
  const { content, attachmentData, attachmentName, attachmentType, attachmentSizeBytes } = req.body;

  if (!content || content.trim().length < 2) return res.status(400).json({ message: "Вопрос не может быть пустым" });
  const MAX_ATTACHMENT = 50 * 1024 * 1024;
  if (attachmentSizeBytes && attachmentSizeBytes > MAX_ATTACHMENT) return res.status(400).json({ message: "Файл превышает максимальный размер 50 МБ" });

  const subscribedForMsg = await isUserSubscribed(userId);
  const attachmentExtraCost = (attachmentData && attachmentSizeBytes && !subscribedForMsg) ? await getAttachmentExtraCost(attachmentSizeBytes) : 0;

  try {
    const sb = getSupabaseAdmin();

    // Fetch session
    let session: any;
    if (sb) {
      const { data } = await sb.from("Neyrozachet_sessions").select("*").eq("id", sessionId).eq("user_id", userId).single();
      session = data;
    } else {
      const { pool } = await import("@workspace/db");
      const client = await pool.connect();
      try {
        const r = await client.query(`SELECT * FROM "Neyrozachet_sessions" WHERE id = $1 AND user_id = $2`, [sessionId, userId]);
        session = r.rows[0];
      } finally { client.release(); }
    }

    if (!session) return res.status(404).json({ message: "Сессия не найдена" });
    if (session.status !== "active") return res.status(400).json({ message: session.status === "expired" ? "Время сессии истекло. Начните новую." : "Сессия завершена. Начните новую." });
    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      if (sb) await sb.from("Neyrozachet_sessions").update({ status: "expired" }).eq("id", sessionId);
      return res.status(400).json({ message: "Время сессии истекло. Начните новую." });
    }

    const isUnlimited = session.questions_total >= 9999;
    if (!isUnlimited && session.questions_used >= session.questions_total) {
      return res.status(400).json({ message: "Вопросы закончились. Купите ещё пакет или начните новую сессию.", questionsUsed: session.questions_used, questionsTotal: session.questions_total });
    }

    // Handle extra cost for large attachment
    if (attachmentExtraCost > 0) {
      let bal: number;
      if (sb) {
        const { data: u } = await sb.from("Neyrozachet_users").select("balance").eq("id", userId).single();
        bal = u?.balance ?? 0;
      } else {
        const { pool } = await import("@workspace/db");
        const client = await pool.connect();
        try { const r = await client.query(`SELECT balance FROM "Neyrozachet_users" WHERE id = $1`, [userId]); bal = r.rows[0]?.balance ?? 0; }
        finally { client.release(); }
      }
      if (bal < attachmentExtraCost) {
        return res.status(402).json({ message: `Недостаточно средств для большого файла. Нужно ${attachmentExtraCost} ₽, на балансе ${bal} ₽`, required: attachmentExtraCost, balance: bal });
      }
      if (sb) {
        await sb.from("Neyrozachet_users").update({ balance: bal - attachmentExtraCost, updated_at: new Date().toISOString() }).eq("id", userId);
      } else {
        const { pool } = await import("@workspace/db");
        const client = await pool.connect();
        try { await client.query(`UPDATE "Neyrozachet_users" SET balance = balance - $1, updated_at = NOW() WHERE id = $2`, [attachmentExtraCost, userId]); }
        finally { client.release(); }
      }
    }

    const questionNumber = session.questions_used + 1;
    const newUsed = questionNumber;
    const isComplete = !isUnlimited && newUsed >= session.questions_total;

    // Fetch conversation history for AI — sliding window to prevent context overflow
    // Always include system messages + last MAX_CONTEXT non-system messages
    const MAX_CONTEXT = 40; // max 40 messages (20 Q+A pairs) sent to AI
    let historyRows: any[] = [];
    if (sb) {
      const { data: sysRows } = await sb.from("Neyrozachet_messages")
        .select("role, content")
        .eq("session_id", sessionId)
        .eq("role", "system")
        .limit(1);
      const { data: recentRows } = await sb.from("Neyrozachet_messages")
        .select("role, content")
        .eq("session_id", sessionId)
        .neq("role", "system")
        .order("created_at", { ascending: false })
        .limit(MAX_CONTEXT);
      historyRows = [...(sysRows ?? []), ...(recentRows ?? []).reverse()];
    } else {
      const { pool } = await import("@workspace/db");
      const client = await pool.connect();
      try {
        const sysR = await client.query(`SELECT role, content FROM "Neyrozachet_messages" WHERE session_id = $1 AND role = 'system' LIMIT 1`, [sessionId]);
        const recR = await client.query(`SELECT role, content FROM (SELECT role, content, created_at FROM "Neyrozachet_messages" WHERE session_id = $1 AND role != 'system' ORDER BY created_at DESC LIMIT $2) sub ORDER BY created_at ASC`, [sessionId, MAX_CONTEXT]);
        historyRows = [...sysR.rows, ...recR.rows];
      } finally { client.release(); }
    }

    let sessionContext: string | undefined;
    const dbMessages: ChatMessage[] = [];
    for (const row of historyRows) {
      if (row.role === "system") {
        if (row.content?.includes("[КОНТЕКСТ СЕССИИ]")) sessionContext = row.content;
      } else {
        dbMessages.push({ role: row.role as "user" | "assistant", content: row.content });
      }
    }

    // For non-image attachments: extract text so the AI can read the content
    let userContent = content.trim();
    if (attachmentData && attachmentName && attachmentType) {
      const { isImageMime, extractTextFromFile } = await import("../lib/file-extract");
      if (!isImageMime(attachmentType)) {
        try {
          const extracted = await extractTextFromFile(attachmentData, attachmentType, attachmentName);
          userContent = `${content.trim()}\n\n${extracted}`;
        } catch {
          userContent = `${content.trim()}\n\n[Прикреплён файл: ${attachmentName}]`;
        }
      } else {
        userContent = `${content.trim()}\n\n[Прикреплено изображение: ${attachmentName}]`;
      }
    }
    dbMessages.push({ role: "user", content: userContent });

    // Save user message
    let userMessage: any;
    if (sb) {
      const { data } = await sb.from("Neyrozachet_messages").insert({ session_id: sessionId, role: "user", content: content.trim(), question_number: questionNumber, attachment_data: attachmentData || null, attachment_name: attachmentName || null, attachment_type: attachmentType || null }).select().single();
      userMessage = data;
      await sb.from("Neyrozachet_sessions").update({ questions_used: newUsed, status: isComplete ? "completed" : "active", updated_at: new Date().toISOString() }).eq("id", sessionId);
    } else {
      const { pool } = await import("@workspace/db");
      const client = await pool.connect();
      try {
        const r = await client.query(`INSERT INTO "Neyrozachet_messages" (session_id, role, content, question_number, attachment_data, attachment_name, attachment_type) VALUES ($1,'user',$2,$3,$4,$5,$6) RETURNING *`, [sessionId, content.trim(), questionNumber, attachmentData || null, attachmentName || null, attachmentType || null]);
        userMessage = r.rows[0];
        await client.query(`UPDATE "Neyrozachet_sessions" SET questions_used = $1, status = $2, updated_at = NOW() WHERE id = $3`, [newUsed, isComplete ? "completed" : "active", sessionId]);
      } finally { client.release(); }
    }

    // AI call
    const modelId = session.model_id || "gemini-2-flash";
    const startTime = Date.now();
    let aiContent: string;
    let actualModelUsed: string = modelId;
    try {
      const aiResult = await callAI({ modelId, messages: dbMessages, subject: session.subject, attachmentData: attachmentData || null, attachmentType: attachmentType || null, attachmentName: attachmentName || null, sessionContext });
      aiContent = aiResult.content;
      actualModelUsed = aiResult.modelUsed;
    } catch (aiErr: any) {
      logger.error({ modelId, errMessage: aiErr?.message }, "AI call failed");
      aiContent = "⚠️ **Все нейросети временно недоступны.** Пожалуйста, попробуйте ещё раз через несколько секунд.";
    }
    const processingTime = Date.now() - startTime;

    let assistantMessage: any;
    if (sb) {
      const { data } = await sb.from("Neyrozachet_messages").insert({ session_id: sessionId, role: "assistant", content: aiContent, question_number: questionNumber, processing_time_ms: processingTime }).select().single();
      assistantMessage = data;
    } else {
      const { pool } = await import("@workspace/db");
      const client = await pool.connect();
      try {
        const r = await client.query(`INSERT INTO "Neyrozachet_messages" (session_id, role, content, question_number, processing_time_ms) VALUES ($1,'assistant',$2,$3,$4) RETURNING *`, [sessionId, aiContent, questionNumber, processingTime]);
        assistantMessage = r.rows[0];
      } finally { client.release(); }
    }

    res.json({ userMessage, assistantMessage, questionsUsed: newUsed, questionsTotal: session.questions_total, questionsRemaining: isUnlimited ? null : session.questions_total - newUsed, sessionCompleted: isComplete, attachmentExtraCost, actualModelUsed: actualModelUsed !== modelId ? actualModelUsed : undefined });
  } catch (err) {
    logger.error({ err }, "Failed to send message");
    res.status(500).json({ message: "Ошибка при отправке вопроса" });
  }
});

router.patch("/:id", requireAuth, async (req, res) => {
  const userId = (req as any).user.id;
  const sessionId = parseInt(req.params.id);
  const { status } = req.body;
  if (!["completed", "paused"].includes(status)) return res.status(400).json({ message: "Недопустимый статус" });

  try {
    const sb = getSupabaseAdmin();
    if (sb) {
      const { data } = await sb.from("Neyrozachet_sessions").update({ status, updated_at: new Date().toISOString() }).eq("id", sessionId).eq("user_id", userId).select().single();
      if (!data) return res.status(404).json({ message: "Сессия не найдена" });
      res.json(data);
    } else {
      const { pool } = await import("@workspace/db");
      const client = await pool.connect();
      try {
        const r = await client.query(`UPDATE "Neyrozachet_sessions" SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *`, [status, sessionId, userId]);
        if (!r.rows[0]) return res.status(404).json({ message: "Сессия не найдена" });
        res.json(r.rows[0]);
      } finally { client.release(); }
    }
  } catch (err) {
    logger.error({ err }, "Failed to update session");
    res.status(500).json({ message: "Ошибка при обновлении сессии" });
  }
});

export default router;
