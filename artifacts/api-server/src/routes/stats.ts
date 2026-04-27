import { Router } from "express";
import { getSupabaseAdmin } from "../lib/supabase.js";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/dashboard", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const sb = getSupabaseAdmin();

    let allTasks: any[] = [];
    if (sb) {
      const { data } = await sb.from("Neyrozachet_tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      allTasks = data ?? [];
    } else {
      const { db, tasksTable } = await import("@workspace/db");
      const { eq, desc } = await import("drizzle-orm");
      const tasks = await db.select().from(tasksTable).where(eq(tasksTable.userId, user.id)).orderBy(desc(tasksTable.createdAt));
      allTasks = tasks.map((t) => ({ ...t, user_id: t.userId, task_type: t.taskType, solving_mode: t.solvingMode, complexity_score: t.complexityScore, estimated_cost: t.estimatedCost, actual_cost: t.actualCost, estimated_time: t.estimatedTime, created_at: t.createdAt, completed_at: t.completedAt }));
    }

    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter((t) => t.status === "completed").length;
    const pendingTasks = allTasks.filter((t) => t.status === "pending").length;
    const processingTasks = allTasks.filter((t) => t.status === "processing").length;
    const failedTasks = allTasks.filter((t) => t.status === "failed").length;
    const totalSpent = allTasks.filter((t) => t.actual_cost != null).reduce((s, t) => s + (t.actual_cost || 0), 0);
    const recentTasks = allTasks.slice(0, 5).map((t) => ({
      id: String(t.id), title: t.title, description: t.description ?? null,
      subject: t.subject, taskType: t.task_type, educationLevel: t.education_level ?? null,
      solvingMode: t.solving_mode, status: t.status,
      complexityScore: t.complexity_score ?? null, estimatedCost: t.estimated_cost,
      actualCost: t.actual_cost ?? null, estimatedTime: t.estimated_time ?? null,
      result: t.result ?? null,
      createdAt: t.created_at instanceof Date ? t.created_at.toISOString() : t.created_at,
      completedAt: t.completed_at ? (t.completed_at instanceof Date ? t.completed_at.toISOString() : t.completed_at) : null,
    }));
    const complexities = allTasks.filter((t) => t.complexity_score != null).map((t) => t.complexity_score as number);
    const averageComplexity = complexities.length > 0 ? complexities.reduce((s, v) => s + v, 0) / complexities.length : 0;
    const successRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    let balance = user.balance;
    if (sb) {
      const { data: u } = await sb.from("Neyrozachet_users").select("balance").eq("id", user.id).single();
      balance = u?.balance ?? user.balance;
    }

    res.json({ totalTasks, completedTasks, pendingTasks, processingTasks, failedTasks, totalSpent: parseFloat(totalSpent.toFixed(2)), balance, recentTasks, averageComplexity: parseFloat(averageComplexity.toFixed(1)), successRate: parseFloat(successRate.toFixed(1)) });
  } catch (err) {
    req.log.error({ err }, "GetDashboardStats error");
    res.status(500).json({ error: "internal_error", message: "Internal server error" });
  }
});

router.get("/timeline", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const sb = getSupabaseAdmin();
    const days = Math.min(Math.max(parseInt(String(req.query.days || "90"), 10) || 90, 7), 365);
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    let allTasks: any[] = [];
    if (sb) {
      const { data } = await sb
        .from("Neyrozachet_tasks")
        .select("status, subject, task_type, complexity_score, actual_cost, estimated_cost, created_at, completed_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      allTasks = data ?? [];
    } else {
      const { db, tasksTable } = await import("@workspace/db");
      const { eq, desc } = await import("drizzle-orm");
      const tasks = await db.select().from(tasksTable).where(eq(tasksTable.userId, user.id)).orderBy(desc(tasksTable.createdAt));
      allTasks = tasks.map((t) => ({
        status: t.status, subject: t.subject, task_type: t.taskType, complexity_score: t.complexityScore,
        actual_cost: t.actualCost, estimated_cost: t.estimatedCost,
        created_at: t.createdAt, completed_at: t.completedAt,
      }));
    }

    // ─── daily aggregation (last N days) ───
    const dayKey = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    const dailyMap = new Map<string, { count: number; spent: number; completed: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      dailyMap.set(dayKey(d), { count: 0, spent: 0, completed: 0 });
    }
    let totalCompletedTime = 0;
    let totalCompletedCount = 0;
    for (const t of allTasks) {
      const created = new Date(t.created_at);
      if (created < sinceDate) continue;
      const k = dayKey(created);
      const slot = dailyMap.get(k);
      if (slot) {
        slot.count++;
        slot.spent += t.actual_cost || 0;
        if (t.status === "completed") slot.completed++;
      }
      if (t.status === "completed" && t.completed_at) {
        const ms = new Date(t.completed_at).getTime() - new Date(t.created_at).getTime();
        if (ms > 0 && ms < 7 * 24 * 60 * 60 * 1000) {
          totalCompletedTime += ms;
          totalCompletedCount++;
        }
      }
    }
    const daily = Array.from(dailyMap.entries())
      .map(([date, v]) => ({ date, count: v.count, spent: parseFloat(v.spent.toFixed(2)), completed: v.completed }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // ─── task type distribution ───
    const typeMap = new Map<string, number>();
    for (const t of allTasks) {
      const k = (t.task_type as string) || "other";
      typeMap.set(k, (typeMap.get(k) || 0) + 1);
    }
    const taskTypes = Array.from(typeMap.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    // ─── streak (consecutive days with ≥1 task, ending today/yesterday) ───
    const todayKey = dayKey(new Date());
    const yKey = dayKey(new Date(Date.now() - 86400000));
    let currentStreak = 0;
    {
      const cursor = new Date();
      cursor.setHours(0, 0, 0, 0);
      // если сегодня нет задач — стартуем со вчера, чтобы не сбрасывать стрик до полуночи
      const startKey = dailyMap.get(todayKey)?.count ? todayKey : yKey;
      if (startKey === yKey) cursor.setDate(cursor.getDate() - 1);
      while (true) {
        const k = dayKey(cursor);
        const slot = dailyMap.get(k);
        if (!slot || slot.count === 0) break;
        currentStreak++;
        cursor.setDate(cursor.getDate() - 1);
      }
    }
    let longestStreak = 0;
    let runningStreak = 0;
    for (const d of daily) {
      if (d.count > 0) {
        runningStreak++;
        if (runningStreak > longestStreak) longestStreak = runningStreak;
      } else {
        runningStreak = 0;
      }
    }

    // ─── period totals (week / month) ───
    const weekStart = new Date(); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(weekStart.getDate() - 6);
    const monthStart = new Date(); monthStart.setHours(0, 0, 0, 0); monthStart.setDate(monthStart.getDate() - 29);
    const prevMonthStart = new Date(); prevMonthStart.setHours(0, 0, 0, 0); prevMonthStart.setDate(prevMonthStart.getDate() - 59);

    let weekTasks = 0, weekSpent = 0;
    let monthTasks = 0, monthSpent = 0;
    let prevMonthTasks = 0, prevMonthSpent = 0;
    for (const t of allTasks) {
      const c = new Date(t.created_at);
      if (c >= weekStart) { weekTasks++; weekSpent += t.actual_cost || 0; }
      if (c >= monthStart) { monthTasks++; monthSpent += t.actual_cost || 0; }
      else if (c >= prevMonthStart) { prevMonthTasks++; prevMonthSpent += t.actual_cost || 0; }
    }

    // ─── productivity heatmap (day-of-week × hour buckets simplified) ───
    const dowCounts = [0, 0, 0, 0, 0, 0, 0]; // вс..сб (JS getDay: 0=вс)
    const hourBuckets = [0, 0, 0, 0]; // ночь, утро, день, вечер
    for (const t of allTasks) {
      const c = new Date(t.created_at);
      dowCounts[c.getDay()]++;
      const h = c.getHours();
      if (h < 6) hourBuckets[0]++;
      else if (h < 12) hourBuckets[1]++;
      else if (h < 18) hourBuckets[2]++;
      else hourBuckets[3]++;
    }

    res.json({
      days,
      daily,
      taskTypes,
      currentStreak,
      longestStreak,
      week: { tasks: weekTasks, spent: parseFloat(weekSpent.toFixed(2)) },
      month: { tasks: monthTasks, spent: parseFloat(monthSpent.toFixed(2)) },
      prevMonth: { tasks: prevMonthTasks, spent: parseFloat(prevMonthSpent.toFixed(2)) },
      avgCompletionMs: totalCompletedCount > 0 ? Math.round(totalCompletedTime / totalCompletedCount) : 0,
      productivity: {
        dayOfWeek: dowCounts, // 0=вс..6=сб
        partsOfDay: hourBuckets, // ночь/утро/день/вечер
      },
    });
  } catch (err) {
    req.log.error({ err }, "GetStatsTimeline error");
    res.status(500).json({ error: "internal_error", message: "Internal server error" });
  }
});

router.get("/subjects", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const sb = getSupabaseAdmin();

    let tasks: any[] = [];
    if (sb) {
      const { data } = await sb.from("Neyrozachet_tasks").select("subject, complexity_score").eq("user_id", user.id);
      tasks = data ?? [];
    } else {
      const { db, tasksTable } = await import("@workspace/db");
      const { eq } = await import("drizzle-orm");
      const raw = await db.select({ subject: tasksTable.subject, complexityScore: tasksTable.complexityScore }).from(tasksTable).where(eq(tasksTable.userId, user.id));
      tasks = raw.map((t) => ({ subject: t.subject, complexity_score: t.complexityScore }));
    }

    const subjectMap = new Map<string, { count: number; totalComplexity: number }>();
    for (const task of tasks) {
      const existing = subjectMap.get(task.subject) || { count: 0, totalComplexity: 0 };
      existing.count++;
      if (task.complexity_score) existing.totalComplexity += task.complexity_score;
      subjectMap.set(task.subject, existing);
    }

    res.json(Array.from(subjectMap.entries()).map(([subject, data]) => ({
      subject, count: data.count,
      avgComplexity: data.count > 0 ? parseFloat((data.totalComplexity / data.count).toFixed(1)) : 0,
    })));
  } catch (err) {
    req.log.error({ err }, "GetSubjectStats error");
    res.status(500).json({ error: "internal_error", message: "Internal server error" });
  }
});

export default router;
