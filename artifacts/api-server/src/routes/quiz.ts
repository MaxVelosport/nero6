import { Router } from "express";
import OpenAI from "openai";
import { requireAuth } from "../lib/auth";
import { getSupabaseAdmin } from "../lib/supabase.js";
import { isUserSubscribed } from "../lib/subscription.js";

const router = Router();

// ──────────────────────────────────────────────────────────────────────────────
// ТРЕНАЖЁР-ТЕСТЫ (Quiz)
// Генерирует набор вопросов с 4 вариантами и автопроверкой.
// Стоимость зависит от количества вопросов.
// ──────────────────────────────────────────────────────────────────────────────

const QUIZ_TIERS: Record<string, { count: number; price: number; label: string; model: string }> = {
  short: { count: 5, price: 8, label: "Короткий тест (5 вопросов)", model: "gpt-4o-mini" },
  medium: { count: 10, price: 15, label: "Средний тест (10 вопросов)", model: "gpt-4o-mini" },
  long: { count: 20, price: 25, label: "Большой тест (20 вопросов)", model: "gpt-4o-mini" },
};

const DIFFICULTIES: Record<string, string> = {
  easy:   "лёгкий уровень — простые формулировки, проверка базовых понятий",
  medium: "средний уровень — требует понимания темы и применения знаний",
  hard:   "сложный уровень — каверзные формулировки, проверка глубокого понимания и нюансов",
};

router.get("/tiers", (_req, res) => {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(QUIZ_TIERS)) {
    out[k] = { count: v.count, price: v.price, label: v.label };
  }
  res.json({ tiers: out, difficulties: ["easy", "medium", "hard"] });
});

router.post("/generate", requireAuth, async (req, res) => {
  let refund: (reason: string) => Promise<void> = async () => {};
  try {
    const user = (req as any).user;
    const { tier, subject, topic, difficulty, educationLevel } = req.body || {};

    if (!tier || !QUIZ_TIERS[tier]) {
      res.status(400).json({ error: "validation_error", message: "Выберите длину теста" });
      return;
    }
    if (!topic || typeof topic !== "string" || topic.trim().length < 3) {
      res.status(400).json({ error: "validation_error", message: "Укажите тему теста (минимум 3 символа)" });
      return;
    }
    const diffKey = (difficulty && DIFFICULTIES[difficulty]) ? difficulty : "medium";

    const cfg = QUIZ_TIERS[tier];
    const subscribed = await isUserSubscribed(user.id);
    const cost = subscribed ? 0 : cfg.price;

    // ── АТОМАРНОЕ списание ДО вызова ИИ ─────────────────────────────────────
    // Раньше тут была race condition: select-balance → AI-call → update-balance.
    // Параллельные запросы успевали оба пройти precheck и сделать overdraw.
    // Теперь: одним conditional-update вычитаем баланс, и только если получилось
    // — идём в ИИ. Если ИИ упадёт — возвращаем деньги отдельной транзакцией.
    const sb = getSupabaseAdmin();
    let balanceAfter = 0;

    if (cost > 0) {
      if (sb) {
        // Supabase JS не поддерживает «balance = balance - cost» без RPC.
        // Эмулируем атомарность через compare-and-set: читаем, потом
        // .update().eq("balance", старое_значение). При конфликте — повтор.
        let attempts = 0;
        let casOk = false;
        while (attempts < 5) {
          attempts++;
          const { data: u, error: selErr } = await sb
            .from("Neyrozachet_users")
            .select("balance")
            .eq("id", user.id)
            .single();
          if (selErr || !u) {
            res.status(500).json({ error: "db_error", message: "Не удалось прочитать баланс" });
            return;
          }
          const cur = (u as any).balance ?? 0;
          if (cur < cost) {
            res.status(402).json({
              error: "insufficient_balance",
              message: `Недостаточно средств. Нужно ${cost} ₽, на балансе ${cur} ₽`,
              required: cost,
              balance: cur,
            });
            return;
          }
          const next = cur - cost;
          // Compare-and-set: апдейт пройдёт только если balance не изменился.
          const { data: row, error: casErr } = await sb
            .from("Neyrozachet_users")
            .update({ balance: next })
            .eq("id", user.id)
            .eq("balance", cur)
            .select("balance")
            .maybeSingle();
          if (casErr) {
            res.status(500).json({ error: "db_error", message: "Не удалось списать средства" });
            return;
          }
          if (row) {
            balanceAfter = next;
            casOk = true;
            break;
          }
          // Иначе — конфликт, кто-то нас опередил. Повторяем чтение.
        }
        if (!casOk) {
          res.status(409).json({ error: "concurrency", message: "Слишком много одновременных операций. Попробуйте снова." });
          return;
        }
      } else {
        const { db, usersTable } = await import("@workspace/db");
        const { eq, sql, and, gte } = await import("drizzle-orm");
        const updRows = await db
          .update(usersTable)
          .set({ balance: sql`${usersTable.balance} - ${cost}` })
          .where(and(eq(usersTable.id, user.id), gte(usersTable.balance, cost)))
          .returning({ balance: usersTable.balance });
        if (!updRows.length) {
          // Узнаем текущий баланс для ошибки
          const [u] = await db.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, user.id));
          res.status(402).json({
            error: "insufficient_balance",
            message: `Недостаточно средств. Нужно ${cost} ₽, на балансе ${u?.balance ?? 0} ₽`,
            required: cost,
            balance: u?.balance ?? 0,
          });
          return;
        }
        balanceAfter = updRows[0].balance ?? 0;
      }
    } else {
      // Подписка: ничего не списываем, но текущий баланс показываем как есть.
      if (sb) {
        const { data: u } = await sb.from("Neyrozachet_users").select("balance").eq("id", user.id).single();
        balanceAfter = (u as any)?.balance ?? 0;
      } else {
        const { db, usersTable } = await import("@workspace/db");
        const { eq } = await import("drizzle-orm");
        const [u] = await db.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, user.id));
        balanceAfter = u?.balance ?? 0;
      }
    }

    // Хелпер на возврат денег при ошибке после списания.
    refund = async (reason: string) => {
      if (cost <= 0) return;
      try {
        if (sb) {
          const { data: u } = await sb.from("Neyrozachet_users").select("balance").eq("id", user.id).single();
          const cur = (u as any)?.balance ?? 0;
          await sb.from("Neyrozachet_users").update({ balance: cur + cost }).eq("id", user.id);
          await sb.from("Neyrozachet_transactions").insert({
            user_id: user.id, type: "refund", amount: cost, description: `Возврат: тренажёр-тест (${reason})`,
          });
        } else {
          const { db, usersTable, transactionsTable } = await import("@workspace/db");
          const { eq, sql } = await import("drizzle-orm");
          await db.update(usersTable).set({ balance: sql`${usersTable.balance} + ${cost}` }).where(eq(usersTable.id, user.id));
          await db.insert(transactionsTable).values({
            userId: user.id, type: "refund", amount: cost, description: `Возврат: тренажёр-тест (${reason})`,
          });
        }
      } catch (e) {
        req.log?.error({ err: e }, "Quiz refund failed");
      }
    };

    const subj = (subject && subject.trim()) || "общий предмет";
    const eduStr =
      educationLevel === "school" ? "школьный уровень" :
      educationLevel === "master" ? "уровень магистратуры" :
      educationLevel === "phd"    ? "уровень аспирантуры" : "уровень бакалавриата";

    const prompt = `Ты — опытный преподаватель. Составь тренировочный тест по теме.

Тема: ${topic.trim()}
Предмет: ${subj}
Уровень: ${eduStr}
Сложность: ${DIFFICULTIES[diffKey]}
Количество вопросов: ровно ${cfg.count}

Требования к каждому вопросу:
- Чёткая, однозначная формулировка
- Ровно 4 варианта ответа, ровно один правильный
- Варианты должны быть правдоподобными (не очевидно неправильные)
- В поле explanation — короткое (1–3 предложения) пояснение почему правильный ответ верный
- Все вопросы — на русском языке
- Не повторяй вопросы

Верни СТРОГО валидный JSON без обёрток в формате:
{
  "title": "краткое название теста на русском",
  "questions": [
    { "q": "текст вопроса", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "пояснение" }
  ]
}`;

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    });

    const aiResp = await openai.chat.completions.create({
      model: cfg.model,
      max_tokens: 3500,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });

    const raw = aiResp.choices[0]?.message?.content;
    if (!raw) {
      await refund("empty_ai_response");
      res.status(500).json({ error: "ai_error", message: "ИИ не вернул результат. Деньги возвращены, попробуйте снова." });
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      await refund("json_parse_failed");
      res.status(500).json({ error: "ai_error", message: "ИИ вернул некорректный JSON. Деньги возвращены, попробуйте снова." });
      return;
    }

    const questions: any[] = Array.isArray(parsed?.questions) ? parsed.questions : [];
    const cleaned = questions
      .filter(q =>
        q && typeof q.q === "string" &&
        Array.isArray(q.options) && q.options.length === 4 &&
        Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < 4
      )
      .map((q, i) => ({
        id: i + 1,
        q: String(q.q).trim(),
        options: q.options.map((o: any) => String(o).trim()),
        correctIndex: q.correctIndex,
        explanation: typeof q.explanation === "string" ? q.explanation.trim() : "",
      }));

    if (cleaned.length < Math.max(3, Math.floor(cfg.count * 0.7))) {
      await refund("too_few_questions");
      res.status(500).json({
        error: "ai_error",
        message: "ИИ вернул слишком мало валидных вопросов. Деньги возвращены, попробуйте снова или измените тему.",
      });
      return;
    }

    // Списание уже произошло атомарно выше. Здесь только пишем транзакцию.
    const txDescr = `Тренажёр-тест: «${topic.trim()}» (${cfg.label})${subscribed ? " (по подписке)" : ""}`;
    try {
      if (sb) {
        await sb.from("Neyrozachet_transactions").insert({
          user_id: user.id, type: "payment", amount: cost, description: txDescr,
        });
      } else {
        const { db, transactionsTable } = await import("@workspace/db");
        await db.insert(transactionsTable).values({
          userId: user.id, type: "payment", amount: cost, description: txDescr,
        });
      }
    } catch (e) {
      // Транзакция не критична — продолжаем, только логируем.
      req.log?.error({ err: e }, "Quiz transaction log failed");
    }

    res.json({
      quiz: {
        title: typeof parsed.title === "string" ? parsed.title.trim() : `Тест по теме «${topic.trim()}»`,
        topic: topic.trim(),
        subject: subj,
        difficulty: diffKey,
        questions: cleaned,
      },
      tier,
      cost,
      balanceAfter,
    });
    return;
  } catch (err: any) {
    req.log?.error({ err }, "Quiz generate error");
    // На случай если упали уже после списания — возвращаем деньги.
    try { await refund("internal_error"); } catch {}
    if (!res.headersSent) {
      res.status(500).json({ error: "internal_error", message: err?.message || "Внутренняя ошибка сервера" });
    }
  }
});

export default router;
