import { Router } from "express";
import { getSupabaseAdmin } from "../lib/supabase.js";
import { requireAuth } from "../lib/auth";
import { APP_URL } from "../lib/config.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const sb = getSupabaseAdmin();

    if (sb) {
      let { data: u } = await sb.from("Neyrozachet_users").select("referral_code").eq("id", user.id).single();
      if (!u?.referral_code) {
        const code = "NZ-" + Math.random().toString(36).substring(2, 10).toUpperCase();
        await sb.from("Neyrozachet_users").update({ referral_code: code }).eq("id", user.id);
        const { data: updated } = await sb.from("Neyrozachet_users").select("referral_code").eq("id", user.id).single();
        u = updated;
      }
      const { data: stats } = await sb.from("Neyrozachet_referrals").select("id").eq("referrer_id", user.id).eq("reward_given", true);
      res.json({
        referralCode: u?.referral_code,
        referralLink: `${APP_URL}/register?ref=${u?.referral_code}`,
        referredCount: stats?.length ?? 0,
        totalEarned: (stats?.length ?? 0) * 100,
      });
    } else {
      const { pool } = await import("@workspace/db");
      const client = await pool.connect();
      try {
        const ref = await client.query(`SELECT referral_code FROM "Neyrozachet_users" WHERE id = $1`, [user.id]);
        let referralCode = ref.rows[0]?.referral_code;
        if (!referralCode) {
          referralCode = "NZ-" + Math.random().toString(36).substring(2, 10).toUpperCase();
          await client.query(`UPDATE "Neyrozachet_users" SET referral_code = $1 WHERE id = $2`, [referralCode, user.id]);
        }
        const stats = await client.query(`SELECT COUNT(*) as count FROM "Neyrozachet_referrals" WHERE referrer_id = $1 AND reward_given = TRUE`, [user.id]);
        const count = parseInt(stats.rows[0].count) || 0;
        res.json({ referralCode, referralLink: `${APP_URL}/register?ref=${referralCode}`, referredCount: count, totalEarned: count * 100 });
      } finally {
        client.release();
      }
    }
  } catch (err) {
    req.log.error({ err }, "GetReferral error");
    res.status(500).json({ error: "internal_error", message: "Internal server error" });
  }
});

export default router;
