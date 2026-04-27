import { Router } from "express";
import { getSupabaseAdmin } from "../lib/supabase.js";
import { UpdateProfileBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/profile", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const sb = getSupabaseAdmin();

    let totalTasksCount = 0;
    let completedTasksCount = 0;

    if (sb) {
      const { data: tasks } = await sb.from("Neyrozachet_tasks").select("id, status").eq("user_id", user.id);
      totalTasksCount = tasks?.length ?? 0;
      completedTasksCount = tasks?.filter((t: any) => t.status === "completed").length ?? 0;
    } else {
      const { db, tasksTable } = await import("@workspace/db");
      const { eq } = await import("drizzle-orm");
      const tasks = await db.select({ id: tasksTable.id, status: tasksTable.status }).from(tasksTable).where(eq(tasksTable.userId, user.id));
      totalTasksCount = tasks.length;
      completedTasksCount = tasks.filter((t) => t.status === "completed").length;
    }

    res.json({
      id: String(user.id),
      name: user.name,
      email: user.email,
      educationLevel: user.educationLevel,
      institution: user.institution ?? null,
      specialty: user.specialty ?? null,
      balance: user.balance,
      totalTasksCount,
      completedTasksCount,
      createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "GetProfile error");
    res.status(500).json({ error: "internal_error", message: "Internal server error" });
  }
});

router.patch("/profile", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const parsed = UpdateProfileBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_error", message: "Invalid request data" });
      return;
    }
    const { name, educationLevel, institution, specialty } = parsed.data;
    const sb = getSupabaseAdmin();

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (educationLevel !== undefined) updateData.education_level = educationLevel;
    if (institution !== undefined) updateData.institution = institution;
    if (specialty !== undefined) updateData.specialty = specialty;

    let updated: any;
    if (sb) {
      const { data } = await sb.from("Neyrozachet_users").update(updateData).eq("id", user.id).select().single();
      updated = data;
      const { data: tasks } = await sb.from("Neyrozachet_tasks").select("id, status").eq("user_id", user.id);
      const totalTasksCount = tasks?.length ?? 0;
      const completedTasksCount = tasks?.filter((t: any) => t.status === "completed").length ?? 0;
      res.json({
        id: String(updated.id), name: updated.name, email: updated.email,
        educationLevel: updated.education_level, institution: updated.institution ?? null,
        specialty: updated.specialty ?? null, balance: updated.balance,
        totalTasksCount, completedTasksCount,
        createdAt: updated.created_at,
      });
    } else {
      const { db, usersTable, tasksTable } = await import("@workspace/db");
      const { eq } = await import("drizzle-orm");
      const pgUpdateData: Record<string, any> = { updatedAt: new Date() };
      if (name !== undefined) pgUpdateData.name = name;
      if (educationLevel !== undefined) pgUpdateData.educationLevel = educationLevel;
      if (institution !== undefined) pgUpdateData.institution = institution;
      if (specialty !== undefined) pgUpdateData.specialty = specialty;
      const [u] = await db.update(usersTable).set(pgUpdateData).where(eq(usersTable.id, user.id)).returning();
      const tasks = await db.select({ id: tasksTable.id, status: tasksTable.status }).from(tasksTable).where(eq(tasksTable.userId, user.id));
      res.json({
        id: String(u.id), name: u.name, email: u.email,
        educationLevel: u.educationLevel, institution: u.institution ?? null,
        specialty: u.specialty ?? null, balance: u.balance,
        totalTasksCount: tasks.length,
        completedTasksCount: tasks.filter((t) => t.status === "completed").length,
        createdAt: u.createdAt.toISOString(),
      });
    }
  } catch (err) {
    req.log.error({ err }, "UpdateProfile error");
    res.status(500).json({ error: "internal_error", message: "Internal server error" });
  }
});

router.get("/balance", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const sb = getSupabaseAdmin();

    let balance = user.balance;
    let transactions: any[] = [];

    if (sb) {
      const { data: u } = await sb.from("Neyrozachet_users").select("balance").eq("id", user.id).single();
      balance = u?.balance ?? user.balance;
      const { data: txs } = await sb.from("Neyrozachet_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
      transactions = (txs ?? []).map((t: any) => ({ id: String(t.id), type: t.type, amount: t.amount, description: t.description, createdAt: t.created_at }));
    } else {
      const { db, transactionsTable } = await import("@workspace/db");
      const { eq } = await import("drizzle-orm");
      const txs = await db.select().from(transactionsTable).where(eq(transactionsTable.userId, user.id));
      transactions = txs.map((t) => ({ id: String(t.id), type: t.type, amount: t.amount, description: t.description, createdAt: t.createdAt.toISOString() }));
    }

    res.json({ balance, transactions });
  } catch (err) {
    req.log.error({ err }, "GetBalance error");
    res.status(500).json({ error: "internal_error", message: "Internal server error" });
  }
});

// POST /api/users/charge — generic service fee deduction
router.post("/charge", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { amount, description } = req.body;
    if (!amount || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "invalid_amount" });
    }
    const sb = getSupabaseAdmin();
    if (sb) {
      const { data: u } = await sb.from("Neyrozachet_users").select("balance").eq("id", user.id).single();
      const balance = u?.balance ?? 0;
      if (balance < amount) return res.status(402).json({ error: "insufficient_balance", balance });
      await sb.from("Neyrozachet_users").update({ balance: balance - amount }).eq("id", user.id);
      await sb.from("Neyrozachet_transactions").insert({ user_id: user.id, type: "service", amount: -amount, description: description ?? "Сервис" });
      return res.json({ success: true, balance: balance - amount });
    } else {
      const { db, usersTable, transactionsTable } = await import("@workspace/db");
      const { eq } = await import("drizzle-orm");
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
      if (!u || u.balance < amount) return res.status(402).json({ error: "insufficient_balance", balance: u?.balance ?? 0 });
      await db.update(usersTable).set({ balance: u.balance - amount }).where(eq(usersTable.id, user.id));
      await db.insert(transactionsTable).values({ userId: user.id, type: "service", amount: -amount, description: description ?? "Сервис" });
      return res.json({ success: true, balance: u.balance - amount });
    }
  } catch (err) {
    req.log.error({ err }, "Charge error");
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;
