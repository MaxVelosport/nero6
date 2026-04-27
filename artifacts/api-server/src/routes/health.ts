import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getSupabaseAdmin } from "../lib/supabase";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Подробный health-check: проверяет Supabase REST + прямое подключение к Postgres
router.get("/healthz/full", async (_req, res) => {
  const out: any = { status: "ok", checks: {} };

  // Supabase REST
  try {
    const sb = getSupabaseAdmin();
    if (!sb) {
      out.checks.supabase = { ok: false, reason: "not_configured" };
    } else {
      const { error } = await sb.from("Neyrozachet_users").select("id", { count: "exact", head: true });
      out.checks.supabase = error ? { ok: false, error: error.message } : { ok: true };
    }
  } catch (e: any) {
    out.checks.supabase = { ok: false, error: e?.message || String(e) };
  }

  // Postgres напрямую
  try {
    const { pool } = await import("@workspace/db");
    const r = await pool.query("select 1 as ok");
    out.checks.postgres = { ok: r.rows?.[0]?.ok === 1 };
  } catch (e: any) {
    out.checks.postgres = { ok: false, error: e?.message || String(e) };
  }

  const allOk = Object.values(out.checks).every((c: any) => c?.ok);
  out.status = allOk ? "ok" : "degraded";
  res.status(allOk ? 200 : 503).json(out);
});

export default router;
