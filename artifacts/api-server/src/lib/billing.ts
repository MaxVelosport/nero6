import type { Logger } from "pino";
import { getSupabaseAdmin } from "./supabase.js";
import { isUserSubscribed } from "./subscription.js";

/**
 * Атомарная тарификация платных операций.
 *
 * Главная задача — закрыть race condition вида
 *   select balance → AI-call (10 сек) → update balance.
 *
 * Параллельные запросы на этот паттерн пробивают precheck одновременно
 * и пишут одинаковое новое значение, теряя списание (а на drizzle-ветке
 * могут уйти в минус).
 *
 * Здесь мы:
 *   1. Учитываем подписку (если активна — cost = 0).
 *   2. Атомарно списываем баланс через compare-and-set (Supabase) или
 *      conditional UPDATE с WHERE balance >= cost (Drizzle).
 *   3. Пишем транзакцию-payment.
 *   4. Отдаём наружу хелпер refund() — вызывайте его при ошибке AI/etc.
 */

export type ChargeResult =
  | { ok: true; cost: number; balanceAfter: number; subscribed: boolean; refund: (reason: string) => Promise<void> }
  | { ok: false; status: number; error: string; message: string; required?: number; balance?: number };

export async function chargeAtomic(args: {
  userId: number;
  baseCost: number;
  description: string;
  logger?: Logger | { error: (...a: any[]) => void };
}): Promise<ChargeResult> {
  const { userId, baseCost, description } = args;
  const log = args.logger;

  const subscribed = baseCost > 0 ? await isUserSubscribed(userId) : false;
  const cost = subscribed ? 0 : baseCost;
  const sb = getSupabaseAdmin();

  let balanceAfter = 0;

  if (cost > 0) {
    if (sb) {
      // Compare-and-set цикл (Supabase JS не умеет «balance = balance - cost»).
      let casOk = false;
      for (let attempt = 0; attempt < 5 && !casOk; attempt++) {
        const { data: u, error: selErr } = await sb
          .from("Neyrozachet_users").select("balance").eq("id", userId).single();
        if (selErr || !u) {
          return { ok: false, status: 500, error: "db_error", message: "Не удалось прочитать баланс" };
        }
        const cur = (u as any).balance ?? 0;
        if (cur < cost) {
          return {
            ok: false, status: 402, error: "insufficient_balance",
            message: `Недостаточно средств. Нужно ${cost} ₽, на балансе ${cur} ₽`,
            required: cost, balance: cur,
          };
        }
        const next = cur - cost;
        const { data: row, error: casErr } = await sb
          .from("Neyrozachet_users")
          .update({ balance: next })
          .eq("id", userId)
          .eq("balance", cur)
          .select("balance")
          .maybeSingle();
        if (casErr) {
          return { ok: false, status: 500, error: "db_error", message: "Не удалось списать средства" };
        }
        if (row) {
          balanceAfter = next;
          casOk = true;
        }
        // иначе — конфликт, повторяем
      }
      if (!casOk) {
        return { ok: false, status: 409, error: "concurrency", message: "Слишком много одновременных операций. Попробуйте снова." };
      }
    } else {
      const { db, usersTable } = await import("@workspace/db");
      const { eq, sql, and, gte } = await import("drizzle-orm");
      const updRows = await db
        .update(usersTable)
        .set({ balance: sql`${usersTable.balance} - ${cost}` })
        .where(and(eq(usersTable.id, userId), gte(usersTable.balance, cost)))
        .returning({ balance: usersTable.balance });
      if (!updRows.length) {
        const [u] = await db.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, userId));
        return {
          ok: false, status: 402, error: "insufficient_balance",
          message: `Недостаточно средств. Нужно ${cost} ₽, на балансе ${u?.balance ?? 0} ₽`,
          required: cost, balance: u?.balance ?? 0,
        };
      }
      balanceAfter = updRows[0].balance ?? 0;
    }
  } else {
    // Подписчик / бесплатная операция — баланс не трогаем, читаем для ответа.
    if (sb) {
      const { data: u } = await sb.from("Neyrozachet_users").select("balance").eq("id", userId).single();
      balanceAfter = (u as any)?.balance ?? 0;
    } else {
      const { db, usersTable } = await import("@workspace/db");
      const { eq } = await import("drizzle-orm");
      const [u] = await db.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, userId));
      balanceAfter = u?.balance ?? 0;
    }
  }

  // Пишем транзакцию-payment (даже если cost=0 — для истории по подписке).
  const txDescr = subscribed ? `${description} (по подписке)` : description;
  try {
    if (sb) {
      await sb.from("Neyrozachet_transactions").insert({
        user_id: userId, type: "payment", amount: cost, description: txDescr,
      });
    } else {
      const { db, transactionsTable } = await import("@workspace/db");
      await db.insert(transactionsTable).values({
        userId, type: "payment", amount: cost, description: txDescr,
      });
    }
  } catch (e) {
    log?.error?.({ err: e }, "billing: transaction insert failed (non-fatal)");
  }

  const refund = async (reason: string) => {
    if (cost <= 0) return;
    try {
      if (sb) {
        // Атомарное возмещение через CAS-loop, чтобы concurrent списание/возврат
        // не затёрли друг друга.
        let casOk = false;
        for (let attempt = 0; attempt < 5 && !casOk; attempt++) {
          const { data: u } = await sb.from("Neyrozachet_users").select("balance").eq("id", userId).single();
          const cur = (u as any)?.balance ?? 0;
          const { data: row } = await sb.from("Neyrozachet_users")
            .update({ balance: cur + cost }).eq("id", userId).eq("balance", cur)
            .select("balance").maybeSingle();
          if (row) casOk = true;
        }
        await sb.from("Neyrozachet_transactions").insert({
          user_id: userId, type: "refund", amount: cost, description: `Возврат: ${description} (${reason})`,
        });
      } else {
        const { db, usersTable, transactionsTable } = await import("@workspace/db");
        const { eq, sql } = await import("drizzle-orm");
        await db.update(usersTable).set({ balance: sql`${usersTable.balance} + ${cost}` }).where(eq(usersTable.id, userId));
        await db.insert(transactionsTable).values({
          userId, type: "refund", amount: cost, description: `Возврат: ${description} (${reason})`,
        });
      }
    } catch (e) {
      log?.error?.({ err: e }, "billing: refund failed");
    }
  };

  return { ok: true, cost, balanceAfter, subscribed, refund };
}
