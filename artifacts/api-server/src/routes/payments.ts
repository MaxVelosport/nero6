import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { getSupabaseAdmin } from "../lib/supabase.js";
import { createPayment, getPayment, isYookassaConfigured, type YookassaPayment } from "../lib/yookassa.js";
import { getPricing, getPublicPaymentPackages, type PaymentPackageConfig } from "../lib/settings.js";
import { extendSubscription } from "../lib/subscription.js";

const router = Router();

/**
 * Канонический URL фронтенда. Берём из ENV — никогда из Origin клиента.
 */
function getFrontendUrl(): string {
  const fromEnv = process.env.FRONTEND_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return "https://neurozachet.ru";
}

async function getPackage(key: string): Promise<PaymentPackageConfig | null> {
  const pricing = await getPricing();
  return pricing.payments[key] ?? null;
}

/**
 * GET /api/payments/packages
 * Возвращает текущий список пакетов для UI (без скрытых).
 */
router.get("/packages", async (_req, res) => {
  const pkgs = await getPublicPaymentPackages();
  res.json(pkgs);
});

/**
 * POST /api/payments/create
 * Создаёт платёж в ЮKassa. Сумма берётся ТОЛЬКО из server-side settings.
 */
router.post("/create", requireAuth, async (req, res) => {
  try {
    if (!isYookassaConfigured()) {
      res.status(503).json({
        error: "yookassa_not_configured",
        message: "Платёжная система ещё не подключена. Напишите на support@neurozachet.ru для ручного пополнения.",
      });
      return;
    }

    const user = (req as any).user;
    const { packageKey } = req.body as { packageKey?: string };

    const pkg = packageKey ? await getPackage(packageKey) : null;
    if (!packageKey || !pkg) {
      res.status(400).json({ error: "invalid_package", message: "Неверный пакет" });
      return;
    }

    const description = pkg.type === "subscription"
      ? `Подписка «${pkg.label}» (${pkg.durationDays ?? 30} дн.)`
      : `Пополнение баланса НейроЗачёт · Пакет «${pkg.label}»`;
    const returnUrl = `${getFrontendUrl()}/subscriptions?payment=processing`;

    const payment = await createPayment({
      amount: pkg.price,
      description,
      returnUrl,
      userId: user.id,
      packageKey,
      userEmail: user.email,
    });

    if (!payment.confirmation?.confirmation_url) {
      res.status(500).json({ error: "no_confirmation_url", message: "ЮKassa не вернула ссылку для оплаты" });
      return;
    }

    res.json({
      paymentId: payment.id,
      confirmationUrl: payment.confirmation.confirmation_url,
      status: payment.status,
    });
  } catch (e: any) {
    console.error("[payments/create] error:", e?.message || e);
    res.status(500).json({ error: "internal_error", message: e?.message || "Не удалось создать платёж" });
  }
});

/**
 * Атомарно зачисляет платёж (баланс ИЛИ подписка) с защитой от двойного зачисления.
 *
 * type=credit       → RPC credit_yookassa_payment (UNIQUE по external_payment_id).
 * type=subscription → проверяем уникальность транзакции вручную и продлеваем
 *                     subscription_until атомарно (см. extendSubscription).
 */
async function creditPayment(payment: YookassaPayment):
  Promise<{ ok: true; alreadyApplied: boolean; kind: "credit" | "subscription"; newBalance?: number; subscriptionUntil?: string } | { ok: false; reason: string }>
{
  const userId = Number(payment.metadata?.user_id);
  const packageKey = payment.metadata?.package_key;
  const pkg = packageKey ? await getPackage(packageKey) : null;
  if (!userId || !packageKey || !pkg) {
    return { ok: false, reason: `bad_metadata: user_id=${payment.metadata?.user_id} pkg=${packageKey}` };
  }

  // Проверка целостности: фактически оплаченная сумма должна совпадать с пакетом.
  const paidValue = Number(payment.amount?.value);
  if (payment.amount?.currency !== "RUB" || !Number.isFinite(paidValue) || Math.abs(paidValue - pkg.price) > 0.01) {
    return { ok: false, reason: `amount_mismatch: paid=${payment.amount?.value} ${payment.amount?.currency} expected=${pkg.price} RUB` };
  }

  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, reason: "supabase_not_configured" };

  if (pkg.type === "credit") {
    const credit = Number(pkg.credit ?? 0);
    if (credit <= 0) return { ok: false, reason: `bad_credit_amount: ${pkg.credit}` };
    const { data, error } = await sb.rpc("credit_yookassa_payment", {
      p_user_id: userId,
      p_amount: credit,
      p_description: `Оплата пакета «${pkg.label}» (${pkg.price} ₽ → ${credit} ₽)`,
      p_external_id: payment.id,
    });
    if (error) throw new Error(`RPC credit_yookassa_payment: ${error.message}`);
    const row = Array.isArray(data) ? data[0] : data;
    return {
      ok: true,
      alreadyApplied: !row?.applied,
      kind: "credit",
      newBalance: Number(row?.new_balance ?? 0),
    };
  }

  // SUBSCRIPTION: продлеваем подписку ПЕРЕД idempotency-маркером (RPC).
  // Если упадём между extendSubscription и RPC — следующий webhook повторит
  // extendSubscription (пользователь получит «лишние» дни как бонус), что
  // всегда лучше, чем потерять подписку. Если же сделать наоборот (RPC → extend),
  // то при сбое после RPC подписка вообще никогда не продлится — это P0-баг.
  const days = Number(pkg.durationDays ?? 30);
  if (!Number.isFinite(days) || days <= 0) return { ok: false, reason: `bad_duration_days: ${pkg.durationDays}` };

  // Pre-check: если RPC уже зафиксировал этот payment.id — значит подписка
  // была успешно продлена ранее. Пропускаем extendSubscription, чтобы не
  // плодить лишние дни при retry. Это lookup в transactions по external_payment_id.
  const { data: existing } = await sb
    .from("Neyrozachet_transactions")
    .select("id")
    .eq("external_payment_id", payment.id)
    .maybeSingle();
  if (existing) {
    return { ok: true, alreadyApplied: true, kind: "subscription" };
  }

  const until = await extendSubscription(userId, days);

  const { data, error } = await sb.rpc("credit_yookassa_payment", {
    p_user_id: userId,
    p_amount: 0, // подписка не пополняет баланс
    p_description: `Подписка «${pkg.label}» — ${days} дн. (${pkg.price} ₽)`,
    p_external_id: payment.id,
  });
  if (error) throw new Error(`RPC credit_yookassa_payment: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  const alreadyApplied = !row?.applied;
  return { ok: true, alreadyApplied, kind: "subscription", subscriptionUntil: until };
}

/**
 * Официальные диапазоны IP-адресов ЮKassa, с которых приходят уведомления.
 * https://yookassa.ru/developers/using-api/webhooks#ip
 * Любой запрос на /webhook извне этих сетей будет отвергнут с 403.
 * В development без CHECK_YOOKASSA_IP=1 проверка не выполняется,
 * чтобы можно было тестировать локально.
 */
const YOOKASSA_IP_RANGES = [
  "185.71.76.0/27",
  "185.71.77.0/27",
  "77.75.153.0/25",
  "77.75.156.11/32",
  "77.75.156.35/32",
  "77.75.154.128/25",
  "2a02:5180::/32",
];

function ipInCidr(ip: string, cidr: string): boolean {
  try {
    const [range, bitsStr] = cidr.split("/");
    const bits = parseInt(bitsStr, 10);
    // IPv6: грубое сравнение префикса в hex (достаточно для /32 префиксов ЮKassa)
    if (range.includes(":") || ip.includes(":")) {
      if (!ip.includes(":") || !range.includes(":")) return false;
      const norm = (s: string) => s.toLowerCase().split(":").slice(0, Math.ceil(bits / 16)).join(":");
      return norm(ip).startsWith(norm(range));
    }
    // IPv4
    const toInt = (s: string) =>
      s.split(".").reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (toInt(ip) & mask) === (toInt(range) & mask);
  } catch {
    return false;
  }
}

function isFromYookassa(req: any): boolean {
  // express вернёт первый IP из X-Forwarded-For при trust proxy
  const ip = (req.ip || "").replace(/^::ffff:/, "");
  if (!ip) return false;
  return YOOKASSA_IP_RANGES.some((cidr) => ipInCidr(ip, cidr));
}

/**
 * POST /api/payments/webhook
 *
 * ЮKassa официально не подписывает уведомления — единственный способ
 * проверить подлинность это IP-whitelist (https://yookassa.ru/developers/using-api/webhooks#ip).
 * Дополнительный слой защиты: фактическое зачисление средств идёт через
 * `creditPayment`, который перепроверяет статус платежа в API ЮKassa
 * и идемпотентен по `external_payment_id`. То есть подделать факт оплаты
 * нельзя, даже если запрос как-то пройдёт фильтр.
 */
router.post("/webhook", async (req, res) => {
  const enforce = process.env.NODE_ENV === "production" || process.env.CHECK_YOOKASSA_IP === "1";
  if (enforce && !isFromYookassa(req)) {
    const ip = (req.ip || "").replace(/^::ffff:/, "");
    console.warn(`[payments/webhook] ⛔ отклонено: IP ${ip} не из диапазона ЮKassa`);
    res.status(403).json({ error: "forbidden_source" });
    return;
  }

  const event = req.body as { event?: string; object?: { id?: string } };

  if (event?.event !== "payment.succeeded" || !event.object?.id) {
    res.status(200).json({ received: true, ignored: true });
    return;
  }

  const paymentId = event.object.id;

  try {
    const payment = await getPayment(paymentId);

    if (payment.status !== "succeeded" || !payment.paid) {
      console.log(`[payments/webhook] платёж не успешен: ${paymentId} status=${payment.status} paid=${payment.paid}`);
      res.status(200).json({ received: true, status: payment.status });
      return;
    }

    const result = await creditPayment(payment);
    if (!result.ok) {
      console.error(`[payments/webhook] отклонено: ${paymentId} ${result.reason}`);
      res.status(200).json({ received: true, rejected: true });
      return;
    }

    if (result.alreadyApplied) {
      console.log(`[payments/webhook] ⏭  уже зачислено ранее: ${paymentId}`);
    } else if (result.kind === "subscription") {
      console.log(`[payments/webhook] ✅ подписка активирована: payment=${paymentId} user=${payment.metadata?.user_id} until=${result.subscriptionUntil}`);
    } else {
      console.log(`[payments/webhook] ✅ зачислено: payment=${paymentId} user=${payment.metadata?.user_id} pkg=${payment.metadata?.package_key} new_balance=${result.newBalance}`);
    }
    res.status(200).json({ received: true });
  } catch (e: any) {
    console.error(`[payments/webhook] ошибка обработки ${paymentId}:`, e?.message || e);
    res.status(500).json({ error: "processing_failed" });
  }
});

/**
 * GET /api/payments/status/:id
 * Возвращает статус платежа. Если платёж succeeded но webhook не сработал —
 * атомарно зачисляет баланс/подписку (idempotent через external_payment_id).
 */
router.get("/status/:id", requireAuth, async (req, res) => {
  try {
    if (!isYookassaConfigured()) {
      res.status(503).json({ error: "yookassa_not_configured" });
      return;
    }
    const user = (req as any).user;
    const payment = await getPayment(String(req.params.id));

    if (Number(payment.metadata?.user_id) !== Number(user.id)) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    let credited = false;
    let alreadyApplied = false;
    let kind: "credit" | "subscription" | undefined;
    let newBalance: number | undefined;
    let subscriptionUntil: string | undefined;

    if (payment.status === "succeeded" && payment.paid) {
      try {
        const result = await creditPayment(payment);
        if (result.ok) {
          credited = !result.alreadyApplied;
          alreadyApplied = result.alreadyApplied;
          kind = result.kind;
          newBalance = result.newBalance;
          subscriptionUntil = result.subscriptionUntil;
          if (credited) {
            console.log(`[payments/status] ✅ зачислено через polling: payment=${payment.id} user=${user.id}`);
          }
        } else {
          console.error(`[payments/status] reconcile отклонён ${payment.id}: ${result.reason}`);
        }
      } catch (e: any) {
        console.error(`[payments/status] reconcile ошибка ${payment.id}:`, e?.message || e);
      }
    }

    res.json({
      id: payment.id,
      status: payment.status,
      paid: payment.paid,
      credited,
      alreadyApplied,
      kind,
      newBalance,
      subscriptionUntil,
    });
  } catch (e: any) {
    res.status(500).json({ error: "internal_error", message: e?.message });
  }
});

export default router;
