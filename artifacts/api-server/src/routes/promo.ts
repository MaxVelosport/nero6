import { Router } from "express";
import { getSupabaseAdmin } from "../lib/supabase.js";
import { requireAuth } from "../lib/auth";

const router = Router();

router.post("/redeem", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { code } = req.body;
    if (!code || typeof code !== "string") {
      res.status(400).json({ error: "validation_error", message: "Код промокода обязателен" });
      return;
    }

    const sb = getSupabaseAdmin();
    if (sb) {
      const { data: promos } = await sb.from("Neyrozachet_promo_codes")
        .select("*")
        .eq("is_active", true);

      const found = promos?.find((p: any) => p.code.toLowerCase() === code.trim().toLowerCase() && p.uses_count < p.max_uses && (!p.expires_at || new Date(p.expires_at) > new Date()));
      if (!found) {
        res.status(404).json({ error: "not_found", message: "Промокод не найден, истёк или уже использован до лимита" });
        return;
      }

      const { data: used } = await sb.from("Neyrozachet_promo_redemptions").select("id").eq("user_id", user.id).eq("promo_id", found.id).single();
      if (used) {
        res.status(409).json({ error: "already_used", message: "Вы уже использовали этот промокод" });
        return;
      }

      await sb.from("Neyrozachet_promo_redemptions").insert({ user_id: user.id, promo_id: found.id, amount: found.amount });
      await sb.from("Neyrozachet_promo_codes").update({ uses_count: found.uses_count + 1 }).eq("id", found.id);

      const { data: currentUser } = await sb.from("Neyrozachet_users").select("balance").eq("id", user.id).single();
      const newBalance = (currentUser?.balance ?? 0) + found.amount;
      await sb.from("Neyrozachet_users").update({ balance: newBalance }).eq("id", user.id);
      await sb.from("Neyrozachet_transactions").insert({ user_id: user.id, type: "topup", amount: found.amount, description: `Промокод: ${found.code}` });

      res.json({ success: true, amount: found.amount, newBalance, message: `Промокод активирован! Начислено ${found.amount} ₽` });
      return;
    }

    // pg fallback
    const { pool } = await import("@workspace/db");
    const client = await pool.connect();
    try {
      const promoResult = await client.query(
        `SELECT * FROM "Neyrozachet_promo_codes" WHERE UPPER(code) = UPPER($1) AND is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW()) AND uses_count < max_uses`,
        [code.trim()]
      );
      if (!promoResult.rows[0]) {
        res.status(404).json({ error: "not_found", message: "Промокод не найден, истёк или уже использован до лимита" });
        return;
      }
      const p = promoResult.rows[0];
      const alreadyUsed = await client.query(`SELECT id FROM "Neyrozachet_promo_redemptions" WHERE user_id = $1 AND promo_id = $2`, [user.id, p.id]);
      if (alreadyUsed.rows.length > 0) {
        res.status(409).json({ error: "already_used", message: "Вы уже использовали этот промокод" });
        return;
      }
      await client.query("BEGIN");
      await client.query(`INSERT INTO "Neyrozachet_promo_redemptions" (user_id, promo_id, amount) VALUES ($1, $2, $3)`, [user.id, p.id, p.amount]);
      await client.query(`UPDATE "Neyrozachet_promo_codes" SET uses_count = uses_count + 1 WHERE id = $1`, [p.id]);
      await client.query(`UPDATE "Neyrozachet_users" SET balance = balance + $1 WHERE id = $2`, [p.amount, user.id]);
      await client.query(`INSERT INTO "Neyrozachet_transactions" (user_id, type, amount, description) VALUES ($1, 'topup', $2, $3)`, [user.id, p.amount, `Промокод: ${p.code}`]);
      await client.query("COMMIT");
      const nb = await client.query(`SELECT balance FROM "Neyrozachet_users" WHERE id = $1`, [user.id]);
      res.json({ success: true, amount: p.amount, newBalance: nb.rows[0]?.balance, message: `Промокод активирован! Начислено ${p.amount} ₽` });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    req.log.error({ err }, "RedeemPromo error");
    res.status(500).json({ error: "internal_error", message: "Internal server error" });
  }
});

export default router;
