import { Router } from "express";
import { getSupabaseAdmin } from "../lib/supabase.js";
import { orIlikeContains } from "../lib/postgrest.js";
import { requireAuth } from "../lib/auth";

const router = Router();

async function getPool() {
  const { pool } = await import("@workspace/db");
  return pool;
}

async function requireAdmin(req: any, res: any, next: any) {
  if (!req.user) { res.status(401).json({ error: "unauthorized" }); return; }
  try {
    const sb = getSupabaseAdmin();
    let isAdmin = false;
    if (sb) {
      const { data } = await sb.from("Neyrozachet_users").select("is_admin").eq("id", req.user.id).single();
      isAdmin = data?.is_admin ?? false;
    } else {
      const pool = await getPool();
      const client = await pool.connect();
      try {
        const r = await client.query(`SELECT is_admin FROM "Neyrozachet_users" WHERE id = $1`, [req.user.id]);
        isAdmin = r.rows[0]?.is_admin ?? false;
      } finally { client.release(); }
    }
    if (!isAdmin) { res.status(403).json({ error: "forbidden", message: "Admin access required" }); return; }
    next();
  } catch (err) {
    res.status(500).json({ error: "internal_error" });
  }
}

router.get("/stats", requireAuth, requireAdmin, async (req, res) => {
  try {
    const sb = getSupabaseAdmin();
    if (sb) {
      const [{ count: totalUsers }, { count: todayUsers }, tasks, { count: totalSessions }, { count: activeSessions }, txData] = await Promise.all([
        sb.from("Neyrozachet_users").select("*", { count: "exact", head: true }),
        sb.from("Neyrozachet_users").select("*", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 86400000).toISOString()),
        sb.from("Neyrozachet_tasks").select("status"),
        sb.from("Neyrozachet_sessions").select("*", { count: "exact", head: true }),
        sb.from("Neyrozachet_sessions").select("*", { count: "exact", head: true }).eq("status", "active"),
        sb.from("Neyrozachet_transactions").select("amount").eq("type", "topup"),
      ]);
      const allTasks: any[] = tasks.data ?? [];
      const totalRevenue = (txData.data ?? []).reduce((s: number, t: any) => s + (t.amount || 0), 0);
      res.json({
        users: { total: totalUsers ?? 0, today: todayUsers ?? 0 },
        tasks: { total: allTasks.length, completed: allTasks.filter((t) => t.status === "completed").length, pending: allTasks.filter((t) => ["pending", "processing"].includes(t.status)).length },
        sessions: { total: totalSessions ?? 0, active: activeSessions ?? 0 },
        revenue: { total: parseFloat(totalRevenue.toFixed(2)) },
      });
    } else {
      const pool = await getPool();
      const client = await pool.connect();
      try {
        const [users, tasks, sessions, revenue] = await Promise.all([
          client.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as today FROM "Neyrozachet_users"`),
          client.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'completed') as completed, COUNT(*) FILTER (WHERE status = 'pending' OR status = 'processing') as pending FROM "Neyrozachet_tasks"`),
          client.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM "Neyrozachet_sessions"`),
          client.query(`SELECT COALESCE(SUM(amount), 0) as total FROM "Neyrozachet_transactions" WHERE type = 'topup'`),
        ]);
        res.json({
          users: { total: parseInt(users.rows[0].total), today: parseInt(users.rows[0].today) },
          tasks: { total: parseInt(tasks.rows[0].total), completed: parseInt(tasks.rows[0].completed), pending: parseInt(tasks.rows[0].pending) },
          sessions: { total: parseInt(sessions.rows[0].total), active: parseInt(sessions.rows[0].active) },
          revenue: { total: parseFloat(revenue.rows[0].total) },
        });
      } finally { client.release(); }
    }
  } catch (err) {
    req.log.error({ err }, "AdminStats error");
    res.status(500).json({ error: "internal_error" });
  }
});

router.get("/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const search = (req.query.search as string || "").trim();
    const sb = getSupabaseAdmin();

    if (sb) {
      let query = sb.from("Neyrozachet_users").select("id, name, email, balance, is_admin, email_verified, education_level, created_at").order("created_at", { ascending: false });
      if (search) query = query.or(orIlikeContains(["name", "email"], search));
      const { data: allUsers } = await query;
      const total = allUsers?.length ?? 0;
      const paginated = (allUsers ?? []).slice((page - 1) * limit, (page - 1) * limit + limit);

      const usersWithCounts = await Promise.all(paginated.map(async (u: any) => {
        const [{ count: tc }, { count: sc }] = await Promise.all([
          sb.from("Neyrozachet_tasks").select("*", { count: "exact", head: true }).eq("user_id", u.id),
          sb.from("Neyrozachet_sessions").select("*", { count: "exact", head: true }).eq("user_id", u.id),
        ]);
        return { id: String(u.id), name: u.name, email: u.email, balance: u.balance, isAdmin: u.is_admin, emailVerified: u.email_verified, educationLevel: u.education_level, createdAt: u.created_at, tasksCount: tc ?? 0, sessionsCount: sc ?? 0 };
      }));

      res.json({ users: usersWithCounts, total, page, limit });
    } else {
      const pool = await getPool();
      const client = await pool.connect();
      try {
        const offset = (page - 1) * limit;
        const params: any[] = [];
        let where = "";
        if (search) { params.push(`%${search}%`); where = `WHERE name ILIKE $1 OR email ILIKE $1`; }
        const count = await client.query(`SELECT COUNT(*) as total FROM "Neyrozachet_users" ${where}`, params);
        const dp = [...params, limit, offset];
        const li = params.length + 1; const oi = params.length + 2;
        const users = await client.query(`SELECT id, name, email, balance, is_admin, email_verified, education_level, created_at, (SELECT COUNT(*) FROM "Neyrozachet_tasks" WHERE user_id = u.id) as tasks_count, (SELECT COUNT(*) FROM "Neyrozachet_sessions" WHERE user_id = u.id) as sessions_count FROM "Neyrozachet_users" u ${where} ORDER BY created_at DESC LIMIT $${li} OFFSET $${oi}`, dp);
        res.json({ users: users.rows.map(u => ({ id: String(u.id), name: u.name, email: u.email, balance: u.balance, isAdmin: u.is_admin, emailVerified: u.email_verified, educationLevel: u.education_level, createdAt: u.created_at, tasksCount: parseInt(u.tasks_count), sessionsCount: parseInt(u.sessions_count) })), total: parseInt(count.rows[0].total), page, limit });
      } finally { client.release(); }
    }
  } catch (err) {
    req.log.error({ err }, "AdminUsers error");
    res.status(500).json({ error: "internal_error" });
  }
});

router.post("/users/:id/topup", requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { amount, reason } = req.body;
    if (!amount || isNaN(amount) || amount <= 0 || amount > 100000) {
      res.status(400).json({ error: "validation_error", message: "Сумма должна быть от 1 до 100 000 ₽" }); return;
    }
    const sb = getSupabaseAdmin();
    if (sb) {
      const { data: u } = await sb.from("Neyrozachet_users").select("id, name, balance").eq("id", userId).single();
      if (!u) { res.status(404).json({ error: "not_found", message: "Пользователь не найден" }); return; }
      const newBalance = parseFloat(u.balance) + parseFloat(amount);
      await sb.from("Neyrozachet_users").update({ balance: newBalance, updated_at: new Date().toISOString() }).eq("id", userId);
      await sb.from("Neyrozachet_transactions").insert({ user_id: userId, type: "topup", amount: parseFloat(amount), description: reason || "Пополнение баланса администратором" });
      res.json({ success: true, userId: String(userId), addedAmount: parseFloat(amount), newBalance, message: `Баланс пользователя ${u.name} пополнен на ${amount} ₽` });
    } else {
      const pool = await getPool();
      const client = await pool.connect();
      try {
        const ur = await client.query(`SELECT id, name, balance FROM "Neyrozachet_users" WHERE id = $1`, [userId]);
        if (!ur.rows[0]) { res.status(404).json({ error: "not_found", message: "Пользователь не найден" }); return; }
        const u = ur.rows[0];
        const nb = parseFloat(u.balance) + parseFloat(amount);
        await client.query(`UPDATE "Neyrozachet_users" SET balance = $1, updated_at = NOW() WHERE id = $2`, [nb, userId]);
        await client.query(`INSERT INTO "Neyrozachet_transactions" (user_id, type, amount, description) VALUES ($1, 'topup', $2, $3)`, [userId, parseFloat(amount), reason || "Пополнение баланса администратором"]);
        res.json({ success: true, userId: String(userId), addedAmount: parseFloat(amount), newBalance: nb, message: `Баланс пользователя ${u.name} пополнен на ${amount} ₽` });
      } finally { client.release(); }
    }
  } catch (err) {
    req.log.error({ err }, "AdminTopup error");
    res.status(500).json({ error: "internal_error" });
  }
});

router.post("/users/:id/toggle-admin", requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const adminId = (req as any).user.id;
    if (userId === adminId) { res.status(400).json({ error: "forbidden", message: "Нельзя изменить права самого себя" }); return; }
    const sb = getSupabaseAdmin();
    if (sb) {
      const { data: u } = await sb.from("Neyrozachet_users").select("is_admin, name").eq("id", userId).single();
      if (!u) { res.status(404).json({ error: "not_found" }); return; }
      await sb.from("Neyrozachet_users").update({ is_admin: !u.is_admin }).eq("id", userId);
      res.json({ isAdmin: !u.is_admin, name: u.name });
    } else {
      const pool = await getPool();
      const client = await pool.connect();
      try {
        const r = await client.query(`UPDATE "Neyrozachet_users" SET is_admin = NOT is_admin WHERE id = $1 RETURNING is_admin, name`, [userId]);
        if (!r.rows[0]) { res.status(404).json({ error: "not_found" }); return; }
        res.json({ isAdmin: r.rows[0].is_admin, name: r.rows[0].name });
      } finally { client.release(); }
    }
  } catch (err) {
    req.log.error({ err }, "AdminToggleAdmin error");
    res.status(500).json({ error: "internal_error" });
  }
});

router.get("/promo", requireAuth, requireAdmin, async (req, res) => {
  try {
    const sb = getSupabaseAdmin();
    if (sb) {
      const { data } = await sb.from("Neyrozachet_promo_codes").select("*, Neyrozachet_promo_redemptions(id)").order("created_at", { ascending: false });
      res.json((data ?? []).map((p: any) => ({ ...p, redemptions: (p.Neyrozachet_promo_redemptions ?? []).length })));
    } else {
      const pool = await getPool();
      const r = await pool.query(`SELECT p.*, (SELECT COUNT(*) FROM "Neyrozachet_promo_redemptions" WHERE promo_id = p.id) as redemptions FROM "Neyrozachet_promo_codes" p ORDER BY p.created_at DESC`);
      res.json(r.rows);
    }
  } catch (err) {
    req.log.error({ err }, "GetAdminPromo error");
    res.status(500).json({ error: "internal_error" });
  }
});

router.post("/promo", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { code, amount, max_uses, description, expires_at } = req.body;
    if (!code || !amount) { res.status(400).json({ error: "validation_error", message: "Код и сумма обязательны" }); return; }
    const sb = getSupabaseAdmin();
    if (sb) {
      const { data, error } = await sb.from("Neyrozachet_promo_codes").insert({ code: code.trim().toUpperCase(), amount: parseFloat(amount), max_uses: parseInt(max_uses) || 100, description: description || null, expires_at: expires_at || null }).select().single();
      if (error?.code === "23505") { res.status(409).json({ error: "conflict", message: "Промокод с таким кодом уже существует" }); return; }
      res.status(201).json(data);
    } else {
      const pool = await getPool();
      const r = await pool.query(`INSERT INTO "Neyrozachet_promo_codes" (code, amount, max_uses, description, expires_at) VALUES (UPPER($1), $2, $3, $4, $5) RETURNING *`, [code.trim(), parseFloat(amount), parseInt(max_uses) || 100, description || null, expires_at || null]);
      res.status(201).json(r.rows[0]);
    }
  } catch (err: any) {
    if (err.code === "23505") { res.status(409).json({ error: "conflict", message: "Промокод с таким кодом уже существует" }); return; }
    req.log.error({ err }, "CreatePromo error");
    res.status(500).json({ error: "internal_error" });
  }
});

// Detail of one promo + redemptions list
router.get("/promo/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const sb = getSupabaseAdmin();
    if (sb) {
      const { data: p } = await sb.from("Neyrozachet_promo_codes").select("*").eq("id", id).single();
      if (!p) { res.status(404).json({ error: "not_found" }); return; }
      const { data: reds } = await sb.from("Neyrozachet_promo_redemptions")
        .select("id, user_id, amount, created_at, Neyrozachet_users!inner(name, email)")
        .eq("promo_id", id)
        .order("created_at", { ascending: false })
        .limit(200);
      const totalGranted = (reds ?? []).reduce((s: number, r: any) => s + parseFloat(String(r.amount || 0)), 0);
      res.json({
        promo: p,
        redemptions: (reds ?? []).map((r: any) => ({
          id: r.id, userId: String(r.user_id), amount: parseFloat(String(r.amount)),
          createdAt: r.created_at,
          userName: r.Neyrozachet_users?.name, userEmail: r.Neyrozachet_users?.email,
        })),
        totalGranted: parseFloat(totalGranted.toFixed(2)),
      });
    } else {
      const pool = await getPool();
      const [p, reds] = await Promise.all([
        pool.query(`SELECT * FROM "Neyrozachet_promo_codes" WHERE id = $1`, [id]),
        pool.query(
          `SELECT r.id, r.user_id, r.amount, r.created_at, u.name, u.email
           FROM "Neyrozachet_promo_redemptions" r LEFT JOIN "Neyrozachet_users" u ON u.id = r.user_id
           WHERE r.promo_id = $1 ORDER BY r.created_at DESC LIMIT 200`,
          [id]
        ),
      ]);
      if (!p.rows[0]) { res.status(404).json({ error: "not_found" }); return; }
      const totalGranted = reds.rows.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
      res.json({
        promo: p.rows[0],
        redemptions: reds.rows.map(r => ({ id: r.id, userId: String(r.user_id), amount: parseFloat(r.amount), createdAt: r.created_at, userName: r.name, userEmail: r.email })),
        totalGranted: parseFloat(totalGranted.toFixed(2)),
      });
    }
  } catch (err) {
    req.log.error({ err }, "AdminPromoDetail error");
    res.status(500).json({ error: "internal_error" });
  }
});

// Update promo (partial)
router.patch("/promo/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const allowed = ["amount", "max_uses", "description", "expires_at", "is_active"];
    const updates: Record<string, any> = {};
    for (const k of allowed) {
      if (k in req.body) {
        let v = req.body[k];
        if (k === "amount") v = parseFloat(v);
        else if (k === "max_uses") v = parseInt(v);
        else if (k === "expires_at" && (v === "" || v === null)) v = null;
        else if (k === "is_active") v = !!v;
        updates[k] = v;
      }
    }
    if (Object.keys(updates).length === 0) { res.status(400).json({ error: "no_updates" }); return; }
    if (updates.amount !== undefined && (isNaN(updates.amount) || updates.amount <= 0 || updates.amount > 100000)) {
      res.status(400).json({ error: "validation_error", message: "Сумма должна быть от 1 до 100000" }); return;
    }
    if (updates.max_uses !== undefined && (isNaN(updates.max_uses) || updates.max_uses < 1)) {
      res.status(400).json({ error: "validation_error", message: "Лимит активаций должен быть ≥ 1" }); return;
    }

    const sb = getSupabaseAdmin();
    if (sb) {
      const { data, error } = await sb.from("Neyrozachet_promo_codes").update(updates).eq("id", id).select().single();
      if (error || !data) { res.status(404).json({ error: "not_found", message: error?.message }); return; }
      res.json(data);
    } else {
      const pool = await getPool();
      const sets = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`).join(", ");
      const vals = [...Object.values(updates), id];
      const r = await pool.query(`UPDATE "Neyrozachet_promo_codes" SET ${sets} WHERE id = $${vals.length} RETURNING *`, vals);
      if (!r.rows[0]) { res.status(404).json({ error: "not_found" }); return; }
      res.json(r.rows[0]);
    }
  } catch (err) {
    req.log.error({ err }, "AdminPromoUpdate error");
    res.status(500).json({ error: "internal_error" });
  }
});

// Bulk-generate N unique codes
router.post("/promo/bulk", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { count, prefix, length, amount, max_uses, description, expires_at } = req.body || {};
    const n = Math.max(1, Math.min(parseInt(count) || 0, 500));
    const len = Math.max(4, Math.min(parseInt(length) || 8, 16));
    const pfx = (prefix || "").toString().toUpperCase().replace(/[^A-ZА-Я0-9]/g, "").slice(0, 8);
    const amt = parseFloat(amount);
    const maxU = parseInt(max_uses) || 1;
    if (!amt || amt <= 0 || amt > 100000) { res.status(400).json({ error: "validation_error", message: "Некорректная сумма" }); return; }

    const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const generate = () => {
      let s = "";
      for (let i = 0; i < len; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
      return pfx ? `${pfx}-${s}` : s;
    };

    const desc = description || `Bulk-генерация (${new Date().toISOString().slice(0, 10)})`;
    const expAt = expires_at || null;
    const sb = getSupabaseAdmin();

    // Insert one code; returns row on success, "duplicate" on unique conflict, throws on other errors
    async function insertOne(code: string): Promise<any | "duplicate"> {
      if (sb) {
        const { data, error } = await sb.from("Neyrozachet_promo_codes")
          .insert({ code, amount: amt, max_uses: maxU, description: desc, expires_at: expAt })
          .select().single();
        if (!error && data) return data;
        if ((error as any)?.code === "23505") return "duplicate";
        throw new Error(error?.message || "insert failed");
      }
      const pool = await getPool();
      try {
        const r = await pool.query(
          `INSERT INTO "Neyrozachet_promo_codes" (code, amount, max_uses, description, expires_at)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [code, amt, maxU, desc, expAt]
        );
        return r.rows[0];
      } catch (e: any) {
        if (e?.code === "23505") return "duplicate";
        throw e;
      }
    }

    const created: any[] = [];
    const MAX_ATTEMPTS = n * 10 + 50;
    let attempts = 0;
    while (created.length < n && attempts < MAX_ATTEMPTS) {
      attempts++;
      const code = generate();
      const result = await insertOne(code);
      if (result !== "duplicate") created.push(result);
    }

    if (created.length < n) {
      res.status(409).json({
        error: "code_space_exhausted",
        message: `Не удалось сгенерировать ${n} уникальных кодов. Создано: ${created.length}. Увеличьте длину кода или измените префикс.`,
        created: created.length,
        codes: created.map(c => ({ id: c.id, code: c.code, amount: c.amount })),
      });
      return;
    }

    res.json({ created: created.length, failed: 0, codes: created.map(c => ({ id: c.id, code: c.code, amount: c.amount })) });
  } catch (err) {
    req.log.error({ err }, "AdminPromoBulk error");
    res.status(500).json({ error: "internal_error" });
  }
});

router.delete("/promo/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const sb = getSupabaseAdmin();
    if (sb) {
      await sb.from("Neyrozachet_promo_codes").update({ is_active: false }).eq("id", id);
    } else {
      const pool = await getPool();
      await pool.query(`UPDATE "Neyrozachet_promo_codes" SET is_active = FALSE WHERE id = $1`, [id]);
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "DeletePromo error");
    res.status(500).json({ error: "internal_error" });
  }
});

router.get("/transactions", requireAuth, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
    const type = (req.query.type as string) || "";
    const offset = (page - 1) * limit;
    const sb = getSupabaseAdmin();

    if (sb) {
      let query = sb.from("Neyrozachet_transactions")
        .select("id, user_id, type, amount, description, created_at, Neyrozachet_users!inner(id, name, email)")
        .order("created_at", { ascending: false });
      if (type) query = query.eq("type", type);
      const { data: allTx } = await query;
      const total = allTx?.length ?? 0;
      const paginated = (allTx ?? []).slice(offset, offset + limit);
      res.json({
        transactions: paginated.map((t: any) => ({
          id: t.id, userId: String(t.user_id), type: t.type, amount: t.amount,
          description: t.description, createdAt: t.created_at,
          userName: t.Neyrozachet_users?.name, userEmail: t.Neyrozachet_users?.email,
        })),
        total, page, limit,
      });
    } else {
      const pool = await getPool();
      const client = await pool.connect();
      try {
        const typeFilter = type ? `AND t.type = '${type.replace(/'/g, "''")}'` : "";
        const [countRow, rows] = await Promise.all([
          client.query(`SELECT COUNT(*) as total FROM "Neyrozachet_transactions" t WHERE 1=1 ${typeFilter}`),
          client.query(
            `SELECT t.id, t.user_id, t.type, t.amount, t.description, t.created_at, u.name, u.email
             FROM "Neyrozachet_transactions" t
             LEFT JOIN "Neyrozachet_users" u ON u.id = t.user_id
             WHERE 1=1 ${typeFilter}
             ORDER BY t.created_at DESC LIMIT $1 OFFSET $2`,
            [limit, offset]
          ),
        ]);
        res.json({
          transactions: rows.rows.map(t => ({
            id: t.id, userId: String(t.user_id), type: t.type, amount: t.amount,
            description: t.description, createdAt: t.created_at, userName: t.name, userEmail: t.email,
          })),
          total: parseInt(countRow.rows[0].total), page, limit,
        });
      } finally { client.release(); }
    }
  } catch (err) {
    req.log.error({ err }, "AdminTransactions error");
    res.status(500).json({ error: "internal_error" });
  }
});

router.get("/ai-stats", requireAuth, requireAdmin, async (req, res) => {
  try {
    const sb = getSupabaseAdmin();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    if (sb) {
      const [tasks, sessions, tickets, summaries, coursework, illustrations, txPayments] = await Promise.all([
        sb.from("Neyrozachet_tasks").select("status, actual_cost, created_at").gte("created_at", since),
        sb.from("Neyrozachet_sessions").select("id, created_at").gte("created_at", since),
        sb.from("Neyrozachet_tickets").select("id, actual_cost, created_at").gte("created_at", since),
        sb.from("Neyrozachet_summaries").select("id, actual_cost, created_at").gte("created_at", since),
        sb.from("Neyrozachet_coursework").select("id, created_at").gte("created_at", since),
        sb.from("Neyrozachet_transactions").select("amount, description, created_at").eq("type", "payment").ilike("description", "%иллюстраци%").gte("created_at", since),
        sb.from("Neyrozachet_transactions").select("amount, description, created_at").eq("type", "payment").gte("created_at", since),
      ]);

      const taskData = tasks.data ?? [];
      const totalTaskCost = taskData.reduce((s, t: any) => s + (t.actual_cost || 0), 0);
      const ticketData = tickets.data ?? [];
      const totalTicketCost = ticketData.reduce((s, t: any) => s + (t.actual_cost || 0), 0);
      const summaryData = summaries.data ?? [];
      const totalSummaryCost = summaryData.reduce((s, t: any) => s + (t.actual_cost || 0), 0);
      const illData = illustrations.data ?? [];
      const totalIllCost = illData.reduce((s, t: any) => s + (t.amount || 0), 0);
      const allPayments = txPayments.data ?? [];
      const totalRevenue = allPayments.reduce((s, t: any) => s - (t.amount || 0), 0) * -1;

      const dailyMap: Record<string, { tasks: number; sessions: number; cost: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const key = d.toISOString().slice(0, 10);
        dailyMap[key] = { tasks: 0, sessions: 0, cost: 0 };
      }
      for (const t of taskData) {
        const key = (t.created_at as string).slice(0, 10);
        if (dailyMap[key]) { dailyMap[key].tasks++; dailyMap[key].cost += (t as any).actual_cost || 0; }
      }
      for (const s of (sessions.data ?? [])) {
        const key = (s.created_at as string).slice(0, 10);
        if (dailyMap[key]) dailyMap[key].sessions++;
      }

      res.json({
        tools: [
          { tool: "Задачи", count: taskData.length, cost: parseFloat(totalTaskCost.toFixed(2)), completed: taskData.filter((t: any) => t.status === "completed").length },
          { tool: "Чат-сессии", count: (sessions.data ?? []).length, cost: 0, completed: (sessions.data ?? []).length },
          { tool: "Билеты", count: ticketData.length, cost: parseFloat(totalTicketCost.toFixed(2)), completed: ticketData.length },
          { tool: "Конспекты", count: summaryData.length, cost: parseFloat(totalSummaryCost.toFixed(2)), completed: summaryData.length },
          { tool: "Курсовые", count: (coursework.data ?? []).length, cost: 0, completed: (coursework.data ?? []).length },
          { tool: "Иллюстрации", count: illData.length, cost: parseFloat(totalIllCost.toFixed(2)), completed: illData.length },
        ],
        daily: Object.entries(dailyMap).map(([date, v]) => ({ date, ...v })),
        totalRevenue30d: parseFloat(totalRevenue.toFixed(2)),
      });
    } else {
      res.json({ tools: [], daily: [], totalRevenue30d: 0 });
    }
  } catch (err) {
    req.log.error({ err }, "AdminAiStats error");
    res.status(500).json({ error: "internal_error" });
  }
});

router.post("/users/:id/adjust", requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const adminId = (req as any).user.id;
    const { amount, reason } = req.body;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount === 0 || Math.abs(numAmount) > 100000) {
      res.status(400).json({ error: "validation_error", message: "Сумма должна быть от -100000 до 100000 и не равна 0" });
      return;
    }
    const sb = getSupabaseAdmin();
    if (sb) {
      const { data: u } = await sb.from("Neyrozachet_users").select("id, name, balance").eq("id", userId).single();
      if (!u) { res.status(404).json({ error: "not_found", message: "Пользователь не найден" }); return; }
      const newBalance = Math.max(0, parseFloat(String(u.balance)) + numAmount);
      await sb.from("Neyrozachet_users").update({ balance: newBalance }).eq("id", userId);
      const txType = numAmount > 0 ? "topup" : "deduction";
      const desc = reason || (numAmount > 0 ? `Пополнение администратором (admin #${adminId})` : `Списание администратором (admin #${adminId})`);
      await sb.from("Neyrozachet_transactions").insert({ user_id: userId, type: txType, amount: Math.abs(numAmount), description: desc });
      res.json({ success: true, newBalance, addedAmount: numAmount, message: `Баланс ${u.name}: ${numAmount > 0 ? "+" : ""}${numAmount} ₽ → ${newBalance} ₽` });
    } else {
      const pool = await getPool();
      const client = await pool.connect();
      try {
        const ur = await client.query(`SELECT id, name, balance FROM "Neyrozachet_users" WHERE id = $1`, [userId]);
        if (!ur.rows[0]) { res.status(404).json({ error: "not_found" }); return; }
        const u = ur.rows[0];
        const nb = Math.max(0, parseFloat(u.balance) + numAmount);
        await client.query(`UPDATE "Neyrozachet_users" SET balance = $1 WHERE id = $2`, [nb, userId]);
        const txType = numAmount > 0 ? "topup" : "deduction";
        const desc = reason || (numAmount > 0 ? "Пополнение администратором" : "Списание администратором");
        await client.query(`INSERT INTO "Neyrozachet_transactions" (user_id, type, amount, description) VALUES ($1, $2, $3, $4)`, [userId, txType, Math.abs(numAmount), desc]);
        res.json({ success: true, newBalance: nb, addedAmount: numAmount, message: `Баланс ${u.name}: ${numAmount > 0 ? "+" : ""}${numAmount} ₽ → ${nb} ₽` });
      } finally { client.release(); }
    }
  } catch (err) {
    req.log.error({ err }, "AdminAdjust error");
    res.status(500).json({ error: "internal_error" });
  }
});

router.get("/users/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const sb = getSupabaseAdmin();
    if (sb) {
      const [userRow, txRows, taskRows] = await Promise.all([
        sb.from("Neyrozachet_users").select("id, name, email, balance, is_admin, email_verified, education_level, institution, specialty, created_at").eq("id", userId).single(),
        sb.from("Neyrozachet_transactions").select("id, type, amount, description, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
        sb.from("Neyrozachet_tasks").select("id, title, subject, status, actual_cost, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
      ]);
      if (!userRow.data) { res.status(404).json({ error: "not_found" }); return; }
      res.json({
        user: { ...userRow.data, isAdmin: userRow.data.is_admin, emailVerified: userRow.data.email_verified, educationLevel: userRow.data.education_level },
        transactions: txRows.data ?? [],
        recentTasks: taskRows.data ?? [],
      });
    } else {
      const pool = await getPool();
      const client = await pool.connect();
      try {
        const [u, tx, tasks] = await Promise.all([
          client.query(`SELECT id, name, email, balance, is_admin, email_verified, education_level, institution, specialty, created_at FROM "Neyrozachet_users" WHERE id = $1`, [userId]),
          client.query(`SELECT id, type, amount, description, created_at FROM "Neyrozachet_transactions" WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [userId]),
          client.query(`SELECT id, title, subject, status, actual_cost, created_at FROM "Neyrozachet_tasks" WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`, [userId]),
        ]);
        if (!u.rows[0]) { res.status(404).json({ error: "not_found" }); return; }
        res.json({ user: u.rows[0], transactions: tx.rows, recentTasks: tasks.rows });
      } finally { client.release(); }
    }
  } catch (err) {
    req.log.error({ err }, "AdminUserDetail error");
    res.status(500).json({ error: "internal_error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// EXTENDED ADMIN ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// ── TASKS ─────────────────────────────────────────────────────────
router.get("/tasks", requireAuth, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
    const status = (req.query.status as string) || "";
    const search = ((req.query.search as string) || "").trim();
    const offset = (page - 1) * limit;
    const sb = getSupabaseAdmin();
    if (!sb) { res.json({ tasks: [], total: 0, page, limit }); return; }

    let q = sb.from("Neyrozachet_tasks")
      .select("id, user_id, title, subject, task_type, solving_mode, status, actual_cost, estimated_cost, created_at, completed_at, Neyrozachet_users!inner(name, email)", { count: "exact" })
      .order("created_at", { ascending: false });
    if (status) q = q.eq("status", status);
    if (search) q = q.or(orIlikeContains(["title", "subject"], search));
    const { data, count } = await q.range(offset, offset + limit - 1);
    res.json({
      tasks: (data ?? []).map((t: any) => ({
        id: t.id, userId: String(t.user_id), title: t.title, subject: t.subject,
        taskType: t.task_type, solvingMode: t.solving_mode, status: t.status,
        actualCost: t.actual_cost, estimatedCost: t.estimated_cost,
        createdAt: t.created_at, completedAt: t.completed_at,
        userName: t.Neyrozachet_users?.name, userEmail: t.Neyrozachet_users?.email,
      })),
      total: count ?? 0, page, limit,
    });
  } catch (err) {
    req.log.error({ err }, "AdminTasks error");
    res.status(500).json({ error: "internal_error" });
  }
});

router.get("/tasks/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const sb = getSupabaseAdmin();
    if (!sb) { res.status(503).json({ error: "no_db" }); return; }
    const { data } = await sb.from("Neyrozachet_tasks")
      .select("*, Neyrozachet_users!inner(name, email)").eq("id", id).single();
    if (!data) { res.status(404).json({ error: "not_found" }); return; }
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "AdminTaskDetail error");
    res.status(500).json({ error: "internal_error" });
  }
});

router.post("/tasks/:id/retry", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const sb = getSupabaseAdmin();
    if (!sb) { res.status(503).json({ error: "no_db" }); return; }
    const { data: t } = await sb.from("Neyrozachet_tasks").select("*").eq("id", id).single();
    if (!t) { res.status(404).json({ error: "not_found" }); return; }

    await sb.from("Neyrozachet_tasks").update({ status: "processing", error_message: null }).eq("id", id);

    const { callAIForTask } = await import("../lib/ai.js");
    (async () => {
      try {
        const result = await callAIForTask({
          title: t.title, description: t.description || "", subject: t.subject,
          taskType: t.task_type, solvingMode: t.solving_mode, complexity: t.complexity_score || 5,
        });
        await sb.from("Neyrozachet_tasks").update({
          status: "completed", result, completed_at: new Date().toISOString(),
        }).eq("id", id);
      } catch (e: any) {
        await sb.from("Neyrozachet_tasks").update({
          status: "failed", error_message: String(e?.message || e).slice(0, 500),
        }).eq("id", id);
      }
    })();

    res.json({ success: true, message: "Задача поставлена на повтор" });
  } catch (err) {
    req.log.error({ err }, "AdminRetry error");
    res.status(500).json({ error: "internal_error" });
  }
});

router.post("/tasks/:id/refund", requireAuth, requireAdmin, async (req, res) => {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id);
    await client.query("BEGIN");
    const tr = await client.query(
      `SELECT id, user_id, actual_cost, estimated_cost, title, status FROM "Neyrozachet_tasks" WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (!tr.rows[0]) { await client.query("ROLLBACK"); res.status(404).json({ error: "not_found" }); return; }
    const t = tr.rows[0];
    if (t.status === "refunded") { await client.query("ROLLBACK"); res.status(400).json({ error: "already_refunded", message: "Уже возвращено" }); return; }
    const refundAmount = parseFloat(String(t.actual_cost || t.estimated_cost || 0));
    if (refundAmount <= 0) { await client.query("ROLLBACK"); res.status(400).json({ error: "no_amount", message: "Сумма к возврату 0 ₽" }); return; }

    const ur = await client.query(
      `UPDATE "Neyrozachet_users" SET balance = balance + $1, updated_at = NOW() WHERE id = $2 RETURNING balance, name`,
      [refundAmount, t.user_id]
    );
    if (!ur.rows[0]) { await client.query("ROLLBACK"); res.status(404).json({ error: "user_not_found" }); return; }
    await client.query(
      `INSERT INTO "Neyrozachet_transactions" (user_id, type, amount, description) VALUES ($1, 'refund', $2, $3)`,
      [t.user_id, refundAmount, `Возврат за задачу #${id}: ${t.title}`]
    );
    await client.query(`UPDATE "Neyrozachet_tasks" SET status = 'refunded' WHERE id = $1`, [id]);
    await client.query("COMMIT");
    res.json({ success: true, refunded: refundAmount, newBalance: parseFloat(ur.rows[0].balance), message: `Возвращено ${refundAmount} ₽ пользователю ${ur.rows[0].name}` });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    req.log.error({ err }, "AdminRefund error");
    res.status(500).json({ error: "internal_error" });
  } finally {
    client.release();
  }
});

// ── SESSIONS ──────────────────────────────────────────────────────
router.get("/sessions", requireAuth, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
    const status = (req.query.status as string) || "";
    const offset = (page - 1) * limit;
    const sb = getSupabaseAdmin();
    if (!sb) { res.json({ sessions: [], total: 0, page, limit }); return; }

    let q = sb.from("Neyrozachet_sessions")
      .select("id, user_id, package_type, status, created_at, expires_at, Neyrozachet_users!inner(name, email)", { count: "exact" })
      .order("created_at", { ascending: false });
    if (status) q = q.eq("status", status);
    const { data, count } = await q.range(offset, offset + limit - 1);

    const sessions = await Promise.all((data ?? []).map(async (s: any) => {
      const { count: msgCount } = await sb.from("Neyrozachet_messages").select("*", { count: "exact", head: true }).eq("session_id", s.id);
      return {
        id: s.id, userId: String(s.user_id), packageType: s.package_type, status: s.status,
        createdAt: s.created_at, expiresAt: s.expires_at,
        messagesCount: msgCount ?? 0,
        userName: s.Neyrozachet_users?.name, userEmail: s.Neyrozachet_users?.email,
      };
    }));
    res.json({ sessions, total: count ?? 0, page, limit });
  } catch (err) {
    req.log.error({ err }, "AdminSessions error");
    res.status(500).json({ error: "internal_error" });
  }
});

router.post("/sessions/:id/extend", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const hours = parseInt(req.body?.hours) || 1;
    if (hours <= 0 || hours > 720) { res.status(400).json({ error: "bad_hours" }); return; }
    const sb = getSupabaseAdmin();
    if (!sb) { res.status(503).json({ error: "no_db" }); return; }
    const { data: s } = await sb.from("Neyrozachet_sessions").select("expires_at, status").eq("id", id).single();
    if (!s) { res.status(404).json({ error: "not_found" }); return; }
    const cur = new Date(s.expires_at || new Date());
    const next = new Date(Math.max(cur.getTime(), Date.now()) + hours * 3600 * 1000);
    await sb.from("Neyrozachet_sessions").update({ expires_at: next.toISOString(), status: "active" }).eq("id", id);
    res.json({ success: true, newExpiresAt: next.toISOString(), message: `Сессия продлена на ${hours} ч` });
  } catch (err) {
    req.log.error({ err }, "AdminSessionExtend error");
    res.status(500).json({ error: "internal_error" });
  }
});

router.post("/sessions/:id/end", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const sb = getSupabaseAdmin();
    if (!sb) { res.status(503).json({ error: "no_db" }); return; }
    await sb.from("Neyrozachet_sessions").update({ status: "expired", expires_at: new Date().toISOString() }).eq("id", id);
    res.json({ success: true, message: "Сессия завершена" });
  } catch (err) {
    req.log.error({ err }, "AdminSessionEnd error");
    res.status(500).json({ error: "internal_error" });
  }
});

// ── PAYMENTS (ЮKassa via transactions) ────────────────────────────
router.get("/payments", requireAuth, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
    const offset = (page - 1) * limit;
    const sb = getSupabaseAdmin();
    if (!sb) { res.json({ payments: [], total: 0, page, limit }); return; }

    const { data, count } = await sb.from("Neyrozachet_transactions")
      .select("id, user_id, amount, description, created_at, external_payment_id, Neyrozachet_users!inner(name, email)", { count: "exact" })
      .eq("type", "topup")
      .not("external_payment_id", "is", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    res.json({
      payments: (data ?? []).map((p: any) => ({
        id: p.id, userId: String(p.user_id), amount: p.amount,
        description: p.description, createdAt: p.created_at,
        externalPaymentId: p.external_payment_id,
        userName: p.Neyrozachet_users?.name, userEmail: p.Neyrozachet_users?.email,
      })),
      total: count ?? 0, page, limit,
    });
  } catch (err) {
    req.log.error({ err }, "AdminPayments error");
    res.status(500).json({ error: "internal_error" });
  }
});

router.post("/payments/:externalId/sync", requireAuth, requireAdmin, async (req, res) => {
  try {
    const externalId = req.params.externalId;
    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secret = process.env.YOOKASSA_SECRET_KEY;
    if (!shopId || !secret) { res.status(503).json({ error: "yookassa_not_configured" }); return; }
    const auth = Buffer.from(`${shopId}:${secret}`).toString("base64");
    const r = await fetch(`https://api.yookassa.ru/v3/payments/${externalId}`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!r.ok) { res.status(r.status).json({ error: "yookassa_error", message: await r.text() }); return; }
    const data = await r.json();
    res.json({ success: true, status: (data as any).status, payment: data });
  } catch (err: any) {
    req.log.error({ err }, "AdminPaymentSync error");
    res.status(500).json({ error: "internal_error", message: String(err?.message || err) });
  }
});

// ── AI HEALTH ─────────────────────────────────────────────────────
router.get("/health", requireAuth, requireAdmin, async (_req, res) => {
  const checks: Array<{ name: string; ok: boolean; latencyMs?: number; error?: string }> = [];
  const ping = async (name: string, fn: () => Promise<void>) => {
    const t0 = Date.now();
    try { await fn(); checks.push({ name, ok: true, latencyMs: Date.now() - t0 }); }
    catch (e: any) { checks.push({ name, ok: false, error: String(e?.message || e).slice(0, 200), latencyMs: Date.now() - t0 }); }
  };

  await Promise.all([
    ping("OpenAI", async () => {
      if (!process.env.OPENAI_API_KEY) throw new Error("no_key");
      const r = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    }),
    ping("Anthropic", async () => {
      if (!process.env.ANTHROPIC_API_KEY) throw new Error("no_key");
      const r = await fetch("https://api.anthropic.com/v1/models", { headers: { "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    }),
    ping("DeepSeek", async () => {
      if (!process.env.DEEPSEEK_API_KEY) throw new Error("no_key");
      const r = await fetch("https://api.deepseek.com/v1/models", { headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    }),
    ping("OpenRouter", async () => {
      if (!process.env.OPENROUTER_API_KEY) throw new Error("no_key");
      const r = await fetch("https://openrouter.ai/api/v1/models", { headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    }),
    ping("xAI Grok", async () => {
      if (!process.env.XAI_API_KEY) throw new Error("no_key");
      const r = await fetch("https://api.x.ai/v1/models", { headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    }),
    ping("Supabase", async () => {
      const sb = getSupabaseAdmin();
      if (!sb) throw new Error("no_supabase");
      const { error } = await sb.from("Neyrozachet_users").select("id", { count: "exact", head: true });
      if (error) throw new Error(error.message);
    }),
    ping("ЮKassa", async () => {
      if (!process.env.YOOKASSA_SHOP_ID || !process.env.YOOKASSA_SECRET_KEY) throw new Error("not_configured");
      const auth = Buffer.from(`${process.env.YOOKASSA_SHOP_ID}:${process.env.YOOKASSA_SECRET_KEY}`).toString("base64");
      const r = await fetch("https://api.yookassa.ru/v3/me", { headers: { Authorization: `Basic ${auth}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    }),
  ]);

  res.json({
    checks,
    okCount: checks.filter(c => c.ok).length,
    totalCount: checks.length,
    timestamp: new Date().toISOString(),
  });
});

router.get("/recent-failed-tasks", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) { res.json([]); return; }
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data } = await sb.from("Neyrozachet_tasks")
      .select("id, title, subject, status, error_message, created_at, Neyrozachet_users!inner(name)")
      .in("status", ["failed", "needs_manual"])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20);
    res.json((data ?? []).map((t: any) => ({
      id: t.id, title: t.title, subject: t.subject, status: t.status,
      errorMessage: t.error_message, createdAt: t.created_at,
      userName: t.Neyrozachet_users?.name,
    })));
  } catch (err) {
    res.json([]);
  }
});

// ── BROADCAST ─────────────────────────────────────────────────────
router.post("/broadcast/preview", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { audience } = req.body || {};
    const sb = getSupabaseAdmin();
    if (!sb) { res.json({ count: 0 }); return; }
    let q = sb.from("Neyrozachet_users").select("*", { count: "exact", head: true }).eq("email_verified", true);
    if (audience === "low_balance") q = q.lt("balance", 50);
    else if (audience === "high_balance") q = q.gte("balance", 500);
    else if (audience === "inactive_30d") q = q.lt("updated_at", new Date(Date.now() - 30 * 86400000).toISOString());
    const { count } = await q;
    res.json({ count: count ?? 0 });
  } catch (err) {
    res.status(500).json({ error: "internal_error" });
  }
});

router.post("/broadcast", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { audience, subject, body } = req.body || {};
    if (!subject || !body || subject.length < 3 || body.length < 10) {
      res.status(400).json({ error: "validation_error", message: "Тема и текст обязательны" });
      return;
    }
    const sb = getSupabaseAdmin();
    if (!sb) { res.status(503).json({ error: "no_db" }); return; }
    let q = sb.from("Neyrozachet_users").select("email, name").eq("email_verified", true);
    if (audience === "low_balance") q = q.lt("balance", 50);
    else if (audience === "high_balance") q = q.gte("balance", 500);
    else if (audience === "inactive_30d") q = q.lt("updated_at", new Date(Date.now() - 30 * 86400000).toISOString());
    const { data: users } = await q;
    const recipients = users ?? [];

    res.json({ success: true, queued: recipients.length, message: `Отправка ${recipients.length} писем запущена в фоне` });

    (async () => {
      const nodemailer = (await import("nodemailer")).default;
      const transport = nodemailer.createTransport({
        host: "smtp.beget.com", port: 465, secure: true,
        auth: { user: "info@neurozachet.ru", pass: process.env.SMTP_INFO_PASS },
      });
      let sent = 0, failed = 0;
      for (const u of recipients) {
        try {
          await transport.sendMail({
            from: '"НейроЗачёт" <info@neurozachet.ru>',
            to: u.email,
            subject,
            html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#fff;color:#111"><p>Здравствуйте, ${u.name || "пользователь"}!</p>${body.split("\n").map((l: string) => `<p>${l}</p>`).join("")}<hr style="border:none;border-top:1px solid #eee;margin:24px 0"><p style="color:#888;font-size:12px">С уважением, команда НейроЗачёт<br><a href="https://neurozachet.ru">neurozachet.ru</a></p></div>`,
          });
          sent++;
          await new Promise(r => setTimeout(r, 200));
        } catch (e) { failed++; }
      }
      console.log(`[broadcast] sent=${sent} failed=${failed}`);
    })().catch(e => console.error("[broadcast] fatal", e));
  } catch (err) {
    req.log.error({ err }, "AdminBroadcast error");
    res.status(500).json({ error: "internal_error" });
  }
});

// ── SETTINGS ──────────────────────────────────────────────────────
async function ensureSettingsTable() {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const pool = await getPool();
  const c = await pool.connect();
  try {
    await c.query(`CREATE TABLE IF NOT EXISTS "Neyrozachet_settings" (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  } finally { c.release(); }
}

router.get("/settings", requireAuth, requireAdmin, async (_req, res) => {
  try {
    await ensureSettingsTable();
    const sb = getSupabaseAdmin();
    if (!sb) { res.json({}); return; }
    const { data } = await sb.from("Neyrozachet_settings").select("key, value");
    const obj: Record<string, any> = {};
    for (const row of (data ?? [])) obj[row.key] = row.value;
    res.json({
      welcomeBonus: obj.welcomeBonus ?? 100,
      verifyBonus: obj.verifyBonus ?? 0,
      maintenanceMode: obj.maintenanceMode ?? false,
      announcement: obj.announcement ?? "",
      ...obj,
    });
  } catch (err) {
    res.status(500).json({ error: "internal_error" });
  }
});

router.post("/settings", requireAuth, requireAdmin, async (req, res) => {
  try {
    await ensureSettingsTable();
    const sb = getSupabaseAdmin();
    if (!sb) { res.status(503).json({ error: "no_db" }); return; }
    const updates = req.body || {};
    const errors: string[] = [];
    for (const [key, value] of Object.entries(updates)) {
      const { error } = await sb.from("Neyrozachet_settings").upsert({ key, value: value as any, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (error) errors.push(`${key}: ${error.message}`);
    }
    if (errors.length > 0) {
      res.status(500).json({ error: "save_failed", message: errors.join("; "), hint: "Возможно, таблица Neyrozachet_settings не создана в Supabase. См. логи сервера для миграции." });
      return;
    }
    const { invalidateSettingsCache } = await import("../lib/settings.js");
    invalidateSettingsCache();
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "AdminSettings error");
    res.status(500).json({ error: "internal_error" });
  }
});

// ── TOP USERS ─────────────────────────────────────────────────────
router.get("/top-users", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) { res.json([]); return; }
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data } = await sb.from("Neyrozachet_transactions")
      .select("user_id, amount, type, Neyrozachet_users!inner(name, email)")
      .eq("type", "payment")
      .gte("created_at", since);
    const map = new Map<string, { userId: string; name: string; email: string; total: number; count: number }>();
    for (const t of (data ?? [])) {
      const uid = String((t as any).user_id);
      const cur = map.get(uid) ?? { userId: uid, name: (t as any).Neyrozachet_users?.name, email: (t as any).Neyrozachet_users?.email, total: 0, count: 0 };
      cur.total += parseFloat(String((t as any).amount || 0));
      cur.count++;
      map.set(uid, cur);
    }
    const top = [...map.values()].sort((a, b) => b.total - a.total).slice(0, 10).map(u => ({ ...u, total: parseFloat(u.total.toFixed(2)) }));
    res.json(top);
  } catch (err) {
    res.json([]);
  }
});

export default router;
