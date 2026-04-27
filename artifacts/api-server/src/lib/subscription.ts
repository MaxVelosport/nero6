import { getSupabaseAdmin } from "./supabase.js";

/**
 * «Месяц безлимит» и подобные подписки хранятся в одной колонке
 * Neyrozachet_users.subscription_until (TIMESTAMPTZ NULL).
 * Подписка активна, если NOW() < subscription_until.
 */

export function isSubscriptionActiveAt(value: string | Date | null | undefined, now: Date = new Date()): boolean {
  if (!value) return false;
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return false;
  return d.getTime() > now.getTime();
}

/** Загружает subscription_until для пользователя и возвращает признак активности. */
export async function isUserSubscribed(userId: number): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return false;
  const { data } = await sb.from("Neyrozachet_users").select("subscription_until").eq("id", userId).maybeSingle();
  return isSubscriptionActiveAt(data?.subscription_until ?? null);
}

/** Возвращает subscription_until (ISO-строка) или null. */
export async function getSubscriptionUntil(userId: number): Promise<string | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data } = await sb.from("Neyrozachet_users").select("subscription_until").eq("id", userId).maybeSingle();
  return data?.subscription_until ?? null;
}

/**
 * Продлевает подписку: если уже есть активная — добавляет dnyDays к её окончанию,
 * иначе — устанавливает NOW + dnyDays. Возвращает новый ISO-таймстамп.
 */
export async function extendSubscription(userId: number, durationDays: number): Promise<string> {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("supabase_not_configured");
  const current = await getSubscriptionUntil(userId);
  const baseTime = isSubscriptionActiveAt(current) ? new Date(current!).getTime() : Date.now();
  const next = new Date(baseTime + durationDays * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await sb.from("Neyrozachet_users").update({ subscription_until: next }).eq("id", userId);
  if (error) throw new Error(`extend_subscription_failed: ${error.message}`);
  return next;
}

/**
 * Если у пользователя активная подписка, возвращает 0 (бесплатно). Иначе — baseCost.
 * Используется в роутах с тарификацией.
 */
export async function effectiveCost(userId: number, baseCost: number): Promise<number> {
  if (baseCost <= 0) return 0;
  return (await isUserSubscribed(userId)) ? 0 : baseCost;
}
