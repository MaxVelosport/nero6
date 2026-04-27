import { Router } from "express";
import { sendRefundRequestEmail } from "../lib/email";
import { extractToken, getUserFromToken } from "../lib/auth";

const router = Router();

const ALLOWED_CATEGORIES = new Set([
  "tech_failure",      // ИИ не ответил / зависло / ошибка системы
  "double_charge",     // Двойное списание
  "payment_failed",    // Деньги списались, баланс не пополнился
  "balance_unused",    // Возврат неизрасходованного остатка
  "other",             // Иное (рассмотрим вручную)
]);

const CATEGORY_LABELS: Record<string, string> = {
  tech_failure: "Техническая неполадка (ИИ не ответил / ошибка системы)",
  double_charge: "Двойное списание",
  payment_failed: "Оплата прошла, баланс не пополнился",
  balance_unused: "Возврат неизрасходованного остатка",
  other: "Иное",
};

// Простейший in-memory rate limit на email — 3 заявки в час
const RATE: Map<string, number[]> = new Map();
function rateLimited(email: string): boolean {
  const now = Date.now();
  const arr = (RATE.get(email) || []).filter((t) => now - t < 60 * 60 * 1000);
  if (arr.length >= 3) return true;
  arr.push(now);
  RATE.set(email, arr);
  return false;
}

router.post("/", async (req, res) => {
  try {
    const body = req.body || {};
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim().slice(0, 100) || undefined;
    const category = String(body.category || "").trim();
    const reason = String(body.reason || "").trim().slice(0, 200);
    const details = String(body.details || "").trim().slice(0, 5000);
    const taskId = String(body.taskId || "").trim().slice(0, 100) || undefined;
    const amount = String(body.amount || "").trim().slice(0, 50) || undefined;
    const paymentDate = String(body.paymentDate || "").trim().slice(0, 50) || undefined;
    const consent = body.consent === true;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Укажите корректный email" });
    }
    if (!ALLOWED_CATEGORIES.has(category)) {
      return res.status(400).json({ error: "Выберите категорию заявки" });
    }
    if (!reason || reason.length < 5) {
      return res.status(400).json({ error: "Опишите причину (минимум 5 символов)" });
    }
    if (!details || details.length < 20) {
      return res.status(400).json({ error: "Опишите подробности (минимум 20 символов)" });
    }
    if (!consent) {
      return res.status(400).json({ error: "Подтвердите согласие на обработку заявки" });
    }
    if (rateLimited(email)) {
      return res.status(429).json({ error: "Слишком много заявок с этого email. Попробуйте через час." });
    }

    let userId: number | null = null;
    try {
      const token = extractToken(req);
      const user = token ? await getUserFromToken(token) : null;
      if (user) userId = (user as any).id ?? null;
    } catch {}

    const requestId = `RF-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 9999).toString(36).toUpperCase()}`;

    await sendRefundRequestEmail({
      email,
      name,
      reason,
      category: CATEGORY_LABELS[category] || category,
      taskId,
      amount,
      paymentDate,
      details,
      requestId,
      userId,
    });

    res.json({ ok: true, requestId });
  } catch (e: any) {
    console.error("[refund]", e?.message || e);
    res.status(500).json({ error: "Не удалось отправить заявку. Попробуйте ещё раз или напишите на support@neurozachet.ru." });
  }
});

export default router;
