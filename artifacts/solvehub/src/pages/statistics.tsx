import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar, RadialBarChart, RadialBar, Legend,
} from "recharts";
import {
  TrendingUp, Flame, Target, Wallet, Zap, CheckCircle2, Clock,
  AlertCircle, Activity, Calendar, Sparkles, ArrowUpRight, ArrowDownRight,
  Trophy, BarChart3, PieChart as PieIcon, Layers, ArrowLeft,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useGetMe, useGetDashboardStats, useGetSubjectStats } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type Daily = { date: string; count: number; spent: number; completed: number };
type TimelineData = {
  days: number;
  daily: Daily[];
  taskTypes: { type: string; count: number }[];
  currentStreak: number;
  longestStreak: number;
  week: { tasks: number; spent: number };
  month: { tasks: number; spent: number };
  prevMonth: { tasks: number; spent: number };
  avgCompletionMs: number;
  productivity: { dayOfWeek: number[]; partsOfDay: number[] };
};

function authHeaders() {
  const token = localStorage.getItem("authToken");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// ─── helpers ──────────────────────────────────────────────────────────
function fmtNum(n: number) { return n.toLocaleString("ru"); }
function fmtMoney(n: number) { return `${n.toLocaleString("ru", { maximumFractionDigits: 0 })} ₽`; }
function fmtDuration(ms: number) {
  if (!ms) return "—";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec} сек`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}
function pctDelta(curr: number, prev: number) {
  if (prev === 0 && curr === 0) return 0;
  if (prev === 0) return 100;
  return Math.round(((curr - prev) / prev) * 100);
}
const TYPE_LABELS: Record<string, string> = {
  task: "Задачи",
  presentation: "Презентации",
  coursework: "Курсовые",
  ticket: "Билеты",
  summary: "Конспекты",
  session: "Сессии",
  uniqueness: "Уникализация",
  other: "Прочее",
};

// ─── small UI bits ───────────────────────────────────────────────────
function KpiCard({
  icon: Icon, label, value, sub, delta, accent, isLight,
}: {
  icon: any; label: string; value: string | number; sub?: string;
  delta?: number; accent: string; isLight: boolean;
}) {
  const positive = (delta ?? 0) >= 0;
  return (
    <div className={`relative rounded-2xl border p-3.5 sm:p-5 overflow-hidden transition-all hover:scale-[1.01] ${
      isLight ? "border-slate-200 bg-white shadow-sm" : "border-white/8 bg-card/50"
    }`}>
      <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full ${accent} opacity-30 blur-3xl pointer-events-none`} />
      <div className="relative flex items-start justify-between gap-2">
        <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center ${accent}`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>
        {delta !== undefined && (
          <div className={`text-[10px] sm:text-xs font-semibold flex items-center gap-0.5 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-lg ${
            positive
              ? (isLight ? "bg-emerald-50 text-emerald-700" : "bg-emerald-500/15 text-emerald-300")
              : (isLight ? "bg-rose-50 text-rose-700" : "bg-rose-500/15 text-rose-300")
          }`}>
            {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(delta)}%
          </div>
        )}
      </div>
      <div className="relative mt-3 sm:mt-4">
        <div className={`text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight break-words ${isLight ? "text-slate-900" : "text-white"}`}>{value}</div>
        <div className={`text-[11px] sm:text-xs mt-1 ${isLight ? "text-slate-500" : "text-slate-400"}`}>{label}</div>
        {sub && <div className={`text-[10px] sm:text-[11px] mt-0.5 ${isLight ? "text-slate-400" : "text-slate-500"}`}>{sub}</div>}
      </div>
    </div>
  );
}

function SectionCard({
  title, subtitle, icon: Icon, children, action, isLight,
}: any) {
  return (
    <div className={`rounded-2xl border overflow-hidden ${
      isLight ? "border-slate-200 bg-white shadow-sm" : "border-white/8 bg-card/50"
    }`}>
      <div className={`flex items-start justify-between gap-3 px-5 py-4 border-b ${isLight ? "border-slate-100" : "border-white/5"}`}>
        <div className="flex items-start gap-2.5">
          {Icon && (
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isLight ? "bg-slate-100" : "bg-white/5"}`}>
              <Icon className={`w-4 h-4 ${isLight ? "text-slate-600" : "text-slate-300"}`} />
            </div>
          )}
          <div>
            <div className={`font-semibold text-sm ${isLight ? "text-slate-900" : "text-white"}`}>{title}</div>
            {subtitle && <div className={`text-xs mt-0.5 ${isLight ? "text-slate-500" : "text-slate-500"}`}>{subtitle}</div>}
          </div>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Activity heatmap (GitHub-style, last N weeks) ─────────────────────
function ActivityHeatmap({ daily, isLight }: { daily: Daily[]; isLight: boolean }) {
  const weeks = useMemo(() => {
    if (!daily.length) return [];
    // выравниваем сетку — последний столбец = текущая неделя, заполняем по дням недели (пн=0)
    const arr = [...daily];
    const first = new Date(arr[0].date);
    const dow = (first.getDay() + 6) % 7; // пн=0..вс=6
    const padded: (Daily | null)[] = [...Array(dow).fill(null), ...arr];
    while (padded.length % 7 !== 0) padded.push(null);
    const cols: (Daily | null)[][] = [];
    for (let i = 0; i < padded.length; i += 7) cols.push(padded.slice(i, i + 7));
    return cols;
  }, [daily]);

  const max = Math.max(1, ...daily.map((d) => d.count));
  const colorFor = (count: number) => {
    if (!count) return isLight ? "bg-slate-100" : "bg-white/5";
    const ratio = count / max;
    if (ratio > 0.75) return isLight ? "bg-violet-600" : "bg-violet-400";
    if (ratio > 0.5)  return isLight ? "bg-violet-500" : "bg-violet-500";
    if (ratio > 0.25) return isLight ? "bg-violet-400" : "bg-violet-600";
    return isLight ? "bg-violet-200" : "bg-violet-700/60";
  };
  const dayLabels = ["Пн", "", "Ср", "", "Пт", "", "Вс"];
  return (
    <div className="overflow-x-auto -mx-2 px-2">
      <div className="flex gap-1 items-start min-w-max">
        <div className="flex flex-col gap-1 mr-1 pt-0.5">
          {dayLabels.map((l, i) => (
            <div key={i} className={`h-3 text-[9px] leading-3 ${isLight ? "text-slate-400" : "text-slate-500"}`}>{l}</div>
          ))}
        </div>
        {weeks.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-1">
            {col.map((d, di) => (
              <div
                key={di}
                title={d ? `${d.date}: ${d.count} задач${d.count === 1 ? "а" : ""}` : ""}
                className={`w-3 h-3 rounded-[3px] transition-all hover:scale-125 hover:ring-1 hover:ring-primary ${
                  d ? colorFor(d.count) : "opacity-0"
                }`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-3 justify-end">
        <span className={`text-[10px] ${isLight ? "text-slate-500" : "text-slate-500"}`}>Меньше</span>
        {[0, 0.2, 0.5, 0.8, 1].map((r, i) => (
          <div key={i} className={`w-3 h-3 rounded-[3px] ${colorFor(r * max)}`} />
        ))}
        <span className={`text-[10px] ${isLight ? "text-slate-500" : "text-slate-500"}`}>Больше</span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────
export default function StatisticsPage() {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const { data: user } = useGetMe();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: subjectStats } = useGetSubjectStats();
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [tlLoading, setTlLoading] = useState(true);
  const [range, setRange] = useState<30 | 90 | 180>(90);

  useEffect(() => {
    setTlLoading(true);
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${BASE_URL}/api/stats/timeline?days=${range}`, { headers: authHeaders() });
        if (!r.ok) {
          if (r.status === 401) window.dispatchEvent(new CustomEvent("auth:expired"));
          if (!cancelled) setTimeline(null);
          return;
        }
        const d = await r.json();
        // shape guard — accept only well-formed payloads
        if (!cancelled && d && Array.isArray(d.daily) && d.productivity && Array.isArray(d.productivity.dayOfWeek)) {
          setTimeline(d as TimelineData);
        } else if (!cancelled) {
          setTimeline(null);
        }
      } catch {
        if (!cancelled) setTimeline(null);
      } finally {
        if (!cancelled) setTlLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [range]);

  const heading = isLight ? "text-slate-900" : "text-white";
  const muted = isLight ? "text-slate-500" : "text-slate-400";

  // ─── derived ───
  const totalTasks = stats?.totalTasks || 0;
  const completedTasks = stats?.completedTasks || 0;
  const successRate = stats?.successRate || 0;
  const totalSpent = stats?.totalSpent || 0;
  const balance = user?.balance || 0;

  const monthDelta = timeline ? pctDelta(timeline.month.tasks, timeline.prevMonth.tasks) : undefined;
  const monthSpentDelta = timeline ? pctDelta(timeline.month.spent, timeline.prevMonth.spent) : undefined;

  // chart data (formatted dates)
  const dailyChart = useMemo(() => {
    if (!timeline) return [];
    return timeline.daily.map((d) => {
      const dt = new Date(d.date);
      return {
        ...d,
        label: `${dt.getDate()}.${String(dt.getMonth() + 1).padStart(2, "0")}`,
      };
    });
  }, [timeline]);

  const subjectChart = useMemo(() => {
    if (!subjectStats) return [];
    return subjectStats.slice(0, 8).map((s) => ({ name: s.subject, value: s.count }));
  }, [subjectStats]);
  const SUBJECT_COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#06b6d4", "#f97316", "#a855f7"];

  const taskTypeChart = useMemo(() => {
    if (!timeline) return [];
    return timeline.taskTypes.slice(0, 6).map((t) => ({
      name: TYPE_LABELS[t.type] || t.type,
      value: t.count,
    }));
  }, [timeline]);

  const statusData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: "Готово", value: stats.completedTasks || 0, color: "#10b981" },
      { name: "В работе", value: stats.processingTasks || 0, color: "#3b82f6" },
      { name: "Ожидание", value: stats.pendingTasks || 0, color: "#f59e0b" },
      { name: "Ошибка", value: stats.failedTasks || 0, color: "#ef4444" },
    ].filter((s) => s.value > 0);
  }, [stats]);

  const dowChart = useMemo(() => {
    if (!timeline) return [];
    const labels = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
    return labels.map((name, i) => ({ name, value: timeline.productivity.dayOfWeek[i] || 0 }));
  }, [timeline]);

  const bestDow = useMemo(() => {
    if (!dowChart.length) return null;
    const m = dowChart.reduce((a, b) => (b.value > a.value ? b : a));
    return m.value > 0 ? m.name : null;
  }, [dowChart]);

  const partsOfDay = useMemo(() => {
    if (!timeline) return [];
    const labels = ["Ночь", "Утро", "День", "Вечер"];
    const colors = ["#6366f1", "#f59e0b", "#10b981", "#8b5cf6"];
    return labels.map((name, i) => ({ name, value: timeline.productivity.partsOfDay[i] || 0, fill: colors[i] }));
  }, [timeline]);

  const tooltipStyle = {
    backgroundColor: isLight ? "#ffffff" : "#0f172a",
    border: `1px solid ${isLight ? "#e2e8f0" : "rgba(255,255,255,0.1)"}`,
    borderRadius: "10px",
    fontSize: "12px",
    color: isLight ? "#0f172a" : "#fff",
  };
  const axisColor = isLight ? "#94a3b8" : "#64748b";

  const isEmpty = !statsLoading && !tlLoading && totalTasks === 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Hero */}
      <div className={`relative overflow-hidden rounded-3xl border p-4 sm:p-6 md:p-8 ${
        isLight
          ? "border-violet-200 bg-gradient-to-br from-violet-50 via-indigo-50/40 to-white"
          : "border-violet-500/20 bg-gradient-to-br from-violet-600/15 via-indigo-700/8 to-card/30"
      }`}>
        <div className={`absolute top-0 right-0 w-72 h-72 rounded-full ${isLight ? "bg-violet-300/25" : "bg-violet-500/15"} blur-3xl pointer-events-none`} />
        <div className={`absolute bottom-0 left-1/3 w-56 h-56 rounded-full ${isLight ? "bg-indigo-300/20" : "bg-indigo-500/10"} blur-3xl pointer-events-none`} />
        <div className="relative flex flex-col md:flex-row md:items-center gap-4">
          <Link href="/dashboard" className={`shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl border transition-colors ${isLight ? "border-slate-200 hover:bg-white" : "border-white/10 hover:bg-white/5"}`}>
            <ArrowLeft className={`w-4 h-4 ${muted}`} />
          </Link>
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${isLight ? "bg-violet-500/15 border border-violet-500/30" : "bg-violet-500/20 border border-violet-500/40"}`}>
            <BarChart3 className={`w-7 h-7 ${isLight ? "text-violet-600" : "text-violet-300"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className={`text-2xl md:text-3xl font-bold tracking-tight ${heading}`}>Статистика</h1>
            <p className={`text-sm mt-1 ${muted}`}>
              Полная картина вашей работы: динамика, предметы, продуктивность и стрики.
            </p>
          </div>
          <div className={`flex items-center gap-1 p-1 rounded-xl border self-start md:self-auto ${isLight ? "border-slate-200 bg-white/70" : "border-white/10 bg-white/5"}`}>
            {([30, 90, 180] as const).map((d) => (
              <button
                key={d}
                onClick={() => setRange(d)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  range === d
                    ? (isLight ? "bg-violet-600 text-white" : "bg-violet-500 text-white")
                    : (isLight ? "text-slate-600 hover:bg-slate-100" : "text-slate-400 hover:bg-white/5")
                }`}
              >
                {d} дн.
              </button>
            ))}
          </div>
        </div>
      </div>

      {isEmpty ? (
        <div className={`rounded-2xl border p-12 text-center ${isLight ? "border-slate-200 bg-white" : "border-white/8 bg-card/40"}`}>
          <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center ${isLight ? "bg-violet-100" : "bg-violet-500/15"}`}>
            <Sparkles className={`w-8 h-8 ${isLight ? "text-violet-600" : "text-violet-300"}`} />
          </div>
          <h3 className={`text-lg font-semibold mb-2 ${heading}`}>Пока нет данных</h3>
          <p className={`text-sm mb-5 ${muted}`}>Решите первую задачу — и здесь появится подробная аналитика.</p>
          <Link href="/tasks/new"><Button>Создать задачу</Button></Link>
        </div>
      ) : (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <KpiCard
              icon={CheckCircle2}
              label="Всего задач решено"
              value={fmtNum(completedTasks)}
              sub={`из ${fmtNum(totalTasks)} созданных`}
              accent="bg-gradient-to-br from-emerald-500 to-teal-600"
              isLight={isLight}
            />
            <KpiCard
              icon={Target}
              label="Успешность"
              value={`${Math.round(successRate)}%`}
              sub="доля выполненных"
              accent="bg-gradient-to-br from-violet-500 to-purple-600"
              isLight={isLight}
            />
            <KpiCard
              icon={TrendingUp}
              label="За 30 дней"
              value={fmtNum(timeline?.month.tasks || 0)}
              sub={`пред. месяц: ${fmtNum(timeline?.prevMonth.tasks || 0)}`}
              delta={monthDelta}
              accent="bg-gradient-to-br from-blue-500 to-indigo-600"
              isLight={isLight}
            />
            <KpiCard
              icon={Wallet}
              label="Потрачено всего"
              value={fmtMoney(totalSpent)}
              sub={`за 30 дн: ${fmtMoney(timeline?.month.spent || 0)}`}
              delta={monthSpentDelta !== undefined ? -monthSpentDelta : undefined}
              accent="bg-gradient-to-br from-orange-500 to-rose-600"
              isLight={isLight}
            />
          </div>

          {/* Streak + balance + speed strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`relative overflow-hidden rounded-2xl border p-5 ${
              isLight ? "border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50" : "border-orange-500/25 bg-gradient-to-br from-orange-600/15 to-amber-600/5"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isLight ? "bg-orange-500/15" : "bg-orange-500/20"}`}>
                  <Flame className={`w-6 h-6 ${isLight ? "text-orange-600" : "text-orange-300"}`} />
                </div>
                <div>
                  <div className={`text-xs uppercase tracking-wider font-semibold ${isLight ? "text-orange-700" : "text-orange-300"}`}>Текущий стрик</div>
                  <div className={`text-2xl font-bold ${heading}`}>{timeline?.currentStreak || 0} <span className="text-sm font-normal opacity-70">дн.</span></div>
                </div>
              </div>
              <div className={`text-xs mt-3 ${muted}`}>
                Лучший стрик: <span className="font-semibold">{timeline?.longestStreak || 0} дн.</span>
              </div>
            </div>

            <div className={`relative overflow-hidden rounded-2xl border p-5 ${
              isLight ? "border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50" : "border-violet-500/25 bg-gradient-to-br from-violet-600/15 to-fuchsia-600/5"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isLight ? "bg-violet-500/15" : "bg-violet-500/20"}`}>
                  <Wallet className={`w-6 h-6 ${isLight ? "text-violet-600" : "text-violet-300"}`} />
                </div>
                <div>
                  <div className={`text-xs uppercase tracking-wider font-semibold ${isLight ? "text-violet-700" : "text-violet-300"}`}>Баланс</div>
                  <div className={`text-2xl font-bold ${heading}`}>{fmtMoney(balance)}</div>
                </div>
              </div>
              <div className={`text-xs mt-3 flex items-center gap-2 ${muted}`}>
                ≈ {Math.floor(balance / 50)} задач&nbsp;
                <Link href="/profile" className={`underline underline-offset-2 ${isLight ? "text-violet-700" : "text-violet-300"}`}>пополнить</Link>
              </div>
            </div>

            <div className={`relative overflow-hidden rounded-2xl border p-5 ${
              isLight ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50" : "border-emerald-500/25 bg-gradient-to-br from-emerald-600/15 to-teal-600/5"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isLight ? "bg-emerald-500/15" : "bg-emerald-500/20"}`}>
                  <Zap className={`w-6 h-6 ${isLight ? "text-emerald-600" : "text-emerald-300"}`} />
                </div>
                <div>
                  <div className={`text-xs uppercase tracking-wider font-semibold ${isLight ? "text-emerald-700" : "text-emerald-300"}`}>Среднее время решения</div>
                  <div className={`text-2xl font-bold ${heading}`}>{fmtDuration(timeline?.avgCompletionMs || 0)}</div>
                </div>
              </div>
              <div className={`text-xs mt-3 ${muted}`}>От создания до готового результата</div>
            </div>
          </div>

          {/* Activity area chart */}
          <SectionCard
            title="Активность"
            subtitle={`Задачи и расходы за последние ${range} дней`}
            icon={Activity}
            isLight={isLight}
          >
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyChart} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradTasks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradSpent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isLight ? "#e2e8f0" : "rgba(255,255,255,0.05)"} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 11 }} interval="preserveStartEnd" minTickGap={20} />
                  <YAxis yAxisId="left" tick={{ fill: axisColor, fontSize: 11 }} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: axisColor, fontSize: 11 }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(l) => `Дата: ${l}`}
                    formatter={(v: any, n: any) => {
                      if (n === "Задачи") return [v, "Задачи"];
                      if (n === "Расход, ₽") return [`${v} ₽`, "Расход"];
                      return [v, n];
                    }}
                  />
                  <Area yAxisId="left" type="monotone" dataKey="count" name="Задачи" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#gradTasks)" />
                  <Area yAxisId="right" type="monotone" dataKey="spent" name="Расход, ₽" stroke="#f59e0b" strokeWidth={2} fill="url(#gradSpent)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          {/* Two-column: Subjects donut + Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <SectionCard title="По предметам" subtitle="Распределение всех задач" icon={PieIcon} isLight={isLight}>
              {subjectChart.length === 0 ? (
                <div className={`text-sm py-10 text-center ${muted}`}>Данных пока нет</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={subjectChart} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={3}>
                          {subjectChart.map((_, i) => (
                            <Cell key={i} fill={SUBJECT_COLORS[i % SUBJECT_COLORS.length]} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {subjectChart.map((s, i) => (
                      <div key={s.name} className="flex items-center gap-2.5 text-sm">
                        <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: SUBJECT_COLORS[i % SUBJECT_COLORS.length] }} />
                        <span className={`flex-1 truncate ${heading}`}>{s.name}</span>
                        <span className={`text-xs font-semibold ${muted}`}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Статус задач" subtitle="Где сейчас всё находится" icon={Layers} isLight={isLight}>
              {statusData.length === 0 ? (
                <div className={`text-sm py-10 text-center ${muted}`}>Данных пока нет</div>
              ) : (
                <div className="space-y-4">
                  {statusData.map((s) => {
                    const total = statusData.reduce((a, b) => a + b.value, 0);
                    const pct = Math.round((s.value / total) * 100);
                    return (
                      <div key={s.name}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                            <span className={`text-sm font-medium ${heading}`}>{s.name}</span>
                          </div>
                          <span className={`text-sm font-semibold ${muted}`}>{s.value} <span className="text-xs opacity-70">({pct}%)</span></span>
                        </div>
                        <div className={`h-2 rounded-full overflow-hidden ${isLight ? "bg-slate-100" : "bg-white/5"}`}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: s.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>

          {/* Heatmap */}
          <SectionCard
            title="Календарь активности"
            subtitle={`Каждый квадрат — день. Последние ${range} дн.`}
            icon={Calendar}
            isLight={isLight}
            action={bestDow && (
              <div className={`text-xs px-2.5 py-1 rounded-lg ${isLight ? "bg-violet-50 text-violet-700" : "bg-violet-500/15 text-violet-300"}`}>
                Самый продуктивный день: <b>{bestDow}</b>
              </div>
            )}
          >
            {tlLoading ? (
              <div className={`h-32 animate-pulse rounded-xl ${isLight ? "bg-slate-100" : "bg-white/5"}`} />
            ) : (
              <ActivityHeatmap daily={timeline?.daily || []} isLight={isLight} />
            )}
          </SectionCard>

          {/* Two-column: Task types bar + Productivity radial */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            <div className="lg:col-span-3">
              <SectionCard title="По типам инструментов" subtitle="Что используете чаще" icon={Layers} isLight={isLight}>
                {taskTypeChart.length === 0 ? (
                  <div className={`text-sm py-10 text-center ${muted}`}>Данных пока нет</div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={taskTypeChart} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isLight ? "#e2e8f0" : "rgba(255,255,255,0.05)"} horizontal={false} />
                        <XAxis type="number" tick={{ fill: axisColor, fontSize: 11 }} allowDecimals={false} />
                        <YAxis type="category" dataKey="name" tick={{ fill: axisColor, fontSize: 12 }} width={100} />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: isLight ? "rgba(139,92,246,0.05)" : "rgba(139,92,246,0.1)" }} />
                        <Bar dataKey="value" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </SectionCard>
            </div>
            <div className="lg:col-span-2">
              <SectionCard title="Время суток" subtitle="Когда вы работаете" icon={Clock} isLight={isLight}>
                {partsOfDay.every((p) => p.value === 0) ? (
                  <div className={`text-sm py-10 text-center ${muted}`}>Данных пока нет</div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadialBarChart innerRadius="30%" outerRadius="100%" data={partsOfDay} startAngle={90} endAngle={-270}>
                        <RadialBar background dataKey="value" cornerRadius={6} />
                        <Legend
                          iconSize={10}
                          layout="vertical"
                          verticalAlign="middle"
                          align="right"
                          wrapperStyle={{ fontSize: 11, color: isLight ? "#475569" : "#cbd5e1" }}
                        />
                        <Tooltip contentStyle={tooltipStyle} />
                      </RadialBarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </SectionCard>
            </div>
          </div>

          {/* Achievements */}
          <SectionCard title="Личные рекорды" subtitle="Ваши достижения за всё время" icon={Trophy} isLight={isLight}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: CheckCircle2, label: "Решено задач", value: fmtNum(completedTasks), color: "text-emerald-500" },
                { icon: Flame, label: "Лучший стрик", value: `${timeline?.longestStreak || 0} дн.`, color: "text-orange-500" },
                { icon: Target, label: "Лучшая успешность", value: `${Math.round(successRate)}%`, color: "text-violet-500" },
                { icon: Wallet, label: "Всего вложено", value: fmtMoney(totalSpent), color: "text-blue-500" },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className={`rounded-xl p-3 border ${isLight ? "border-slate-200 bg-slate-50/50" : "border-white/5 bg-white/3"}`}>
                  <Icon className={`w-5 h-5 mb-2 ${color}`} />
                  <div className={`text-lg font-bold ${heading}`}>{value}</div>
                  <div className={`text-[11px] ${muted}`}>{label}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
