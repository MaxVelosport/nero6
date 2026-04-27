import { useState, useEffect } from "react";
import { useGetMe, useGetDashboardStats, useGetSubjectStats } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import {
  CheckCircle2, Clock, AlertCircle, Wallet, TrendingUp,
  Brain, Mail, X, MessageSquare, GraduationCap, Zap,
  ArrowRight, ChevronRight, ListTodo, User, Plus,
  Sparkles, FileText, Timer, Layers, BookMarked, ClipboardList, BookOpen,
  Camera, Upload, ClipboardPaste, ShieldCheck, BarChart2,
  Lightbulb,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useTheme } from "@/lib/theme";
import { ZeroBalanceHint } from "@/components/zero-balance-hint";

// ── Email Verification Banner ──────────────────────────────────────
const BASE_URL_DASH = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
function authHeadersDash() {
  const token = localStorage.getItem("authToken");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
function EmailVerificationBanner({ email, onDismiss }: { email: string; onDismiss: () => void }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function resend() {
    setSending(true); setError("");
    try {
      const r = await fetch(`${BASE_URL_DASH}/api/auth/resend-verification`, {
        method: "POST", headers: authHeadersDash(),
      });
      const d = await r.json();
      if (r.ok) { setSent(true); }
      else { setError(d.message || "Ошибка. Попробуйте позже."); }
    } catch { setError("Ошибка сети."); }
    finally { setSending(false); }
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3.5 rounded-xl bg-amber-500/8 border border-amber-500/20">
      <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
        <Mail className="w-4 h-4 text-amber-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-600">
          Подтвердите email{" "}
          <span className="font-normal text-amber-500/80">— письмо отправлено на {email}</span>
        </p>
        {sent && <p className="text-xs text-green-500 mt-0.5">Новое письмо отправлено! Проверьте почту.</p>}
        {error && <p className="text-xs text-red-400 mt-0.5">{error}</p>}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={resend}
          disabled={sending || sent}
          className="text-xs text-amber-500 hover:text-amber-400 underline underline-offset-2 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {sending ? "Отправка…" : sent ? "Отправлено" : "Переслать письмо"}
        </button>
        <button onClick={onDismiss} className="text-amber-400/60 hover:text-amber-500 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Feature definitions ────────────────────────────────────────────
const FEATURES = [
  {
    id: "task",
    href: "/tasks/new",
    icon: Brain,
    cardBg: "from-violet-600/25 via-violet-800/10 to-violet-900/5",
    cardBgLight: "from-violet-500/15 via-violet-400/8 to-violet-300/5",
    border: "border-violet-500/25 hover:border-violet-500/50",
    glow: "hover:shadow-[0_0_40px_rgba(139,92,246,0.12)]",
    iconBg: "bg-violet-500/20 border-violet-500/30",
    iconColor: "text-violet-400",
    accentBar: "from-violet-500 to-purple-600",
    badge: "bg-violet-500/10 border-violet-500/20 text-violet-500",
    badgeText: "Популярно",
    title: "Решить задачу",
    subtitle: "Есть конкретное задание с условием?",
    desc: "Скопируйте условие, прикрепите файл Word/PDF/Excel или фото — ИИ прочитает, решит и объяснит каждый шаг. Есть тип «Презентация» — скачаете PPTX.",
    steps: [
      { n: "1", text: "Вставьте условие или прикрепите файл" },
      { n: "2", text: "Выберите предмет и уровень" },
      { n: "3", text: "Получите решение + экспорт DOCX/PPTX" },
    ],
    chips: ["Математика", "Физика", "Программирование", "ЕГЭ/ОГЭ", "Химия", "Презентации"],
    cta: "Создать задачу",
    historyHref: "/tasks",
    historyLabel: "Мои задачи",
  },
  {
    id: "chat",
    href: "/sessions/new",
    icon: MessageSquare,
    cardBg: "from-blue-600/25 via-blue-800/10 to-blue-900/5",
    cardBgLight: "from-blue-500/15 via-blue-400/8 to-blue-300/5",
    border: "border-blue-500/25 hover:border-blue-500/50",
    glow: "hover:shadow-[0_0_40px_rgba(59,130,246,0.12)]",
    iconBg: "bg-blue-500/20 border-blue-500/30",
    iconColor: "text-blue-500",
    accentBar: "from-blue-500 to-cyan-500",
    badge: "bg-blue-500/10 border-blue-500/20 text-blue-500",
    badgeText: "Безлимит вопросов",
    title: "Чат с ИИ",
    subtitle: "Нужно разобраться в теме?",
    desc: "Живой диалог с ИИ-репетитором. Задавайте любые вопросы, уточняйте, просите объяснить по-другому — без ограничений.",
    steps: [
      { n: "1", text: "Выберите время сессии" },
      { n: "2", text: "Задавайте вопросы в диалоге" },
      { n: "3", text: "Получайте объяснения и примеры" },
    ],
    chips: ["Подготовка к экзамену", "Объяснение тем", "Репетитор", "Иностранный язык"],
    cta: "Начать чат",
    historyHref: "/sessions",
    historyLabel: "Мои сессии",
  },
  {
    id: "coursework",
    href: "/coursework/new",
    icon: GraduationCap,
    cardBg: "from-emerald-600/25 via-emerald-800/10 to-emerald-900/5",
    cardBgLight: "from-emerald-500/15 via-emerald-400/8 to-emerald-300/5",
    border: "border-emerald-500/25 hover:border-emerald-500/50",
    glow: "hover:shadow-[0_0_40px_rgba(16,185,129,0.12)]",
    iconBg: "bg-emerald-500/20 border-emerald-500/30",
    iconColor: "text-emerald-600",
    accentBar: "from-emerald-500 to-teal-500",
    badge: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600",
    badgeText: "Пошаговый мастер",
    title: "Научная работа",
    subtitle: "Нужно написать курсовую или диплом?",
    desc: "4-шаговый мастер проведёт вас от темы до готовой работы. ИИ создаст план, напишет каждую главу и соберёт всё вместе.",
    steps: [
      { n: "1", text: "Задайте тему и требования" },
      { n: "2", text: "ИИ составит структуру и план" },
      { n: "3", text: "Получите готовую работу по главам" },
    ],
    chips: ["Курсовая", "Дипломная работа", "Реферат", "Эссе", "Контрольная"],
    cta: "Начать работу",
    historyHref: "/tasks",
    historyLabel: "История работ",
  },
  {
    id: "tickets",
    href: "/tickets/new",
    icon: ClipboardList,
    cardBg: "from-fuchsia-600/25 via-fuchsia-800/10 to-fuchsia-900/5",
    cardBgLight: "from-fuchsia-500/15 via-fuchsia-400/8 to-fuchsia-300/5",
    border: "border-fuchsia-500/25 hover:border-fuchsia-500/50",
    glow: "hover:shadow-[0_0_40px_rgba(217,70,239,0.12)]",
    iconBg: "bg-fuchsia-500/20 border-fuchsia-500/30",
    iconColor: "text-fuchsia-500",
    accentBar: "from-fuchsia-500 to-violet-500",
    badge: "bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-500",
    badgeText: "Учебник → Ответы",
    title: "Билеты к экзамену",
    subtitle: "Готовитесь к экзамену по билетам?",
    desc: "Загрузите учебник (PDF/Word), введите список вопросов — ИИ напишет подробный ответ на каждый билет с примерами и ключевыми терминами.",
    steps: [
      { n: "1", text: "Загрузите учебник или материалы" },
      { n: "2", text: "Введите список вопросов по одному" },
      { n: "3", text: "Скачайте готовые ответы на все билеты" },
    ],
    chips: ["Математика", "История", "Биология", "Право", "Экономика", "Философия"],
    cta: "Создать билеты",
    historyHref: "/tasks",
    historyLabel: "История работ",
  },
  {
    id: "summary",
    href: "/learn/summary",
    icon: BookOpen,
    cardBg: "from-cyan-600/25 via-cyan-800/10 to-cyan-900/5",
    cardBgLight: "from-cyan-500/15 via-cyan-400/8 to-cyan-300/5",
    border: "border-cyan-500/25 hover:border-cyan-500/50",
    glow: "hover:shadow-[0_0_40px_rgba(6,182,212,0.12)]",
    iconBg: "bg-cyan-500/20 border-cyan-500/30",
    iconColor: "text-cyan-500",
    accentBar: "from-cyan-500 to-blue-500",
    badge: "bg-cyan-500/10 border-cyan-500/20 text-cyan-500",
    badgeText: "от 5 ₽",
    title: "Конспект темы",
    subtitle: "Загрузите учебник — получите конспект",
    desc: "Загрузите PDF или Word-файл учебника — ИИ прочитает и составит структурированный конспект выбранного объёма: от краткого до максимально подробного.",
    steps: [
      { n: "1", text: "Загрузите PDF или Word-файл учебника" },
      { n: "2", text: "Выберите степень сжатия и тариф" },
      { n: "3", text: "Скачайте или скопируйте конспект" },
    ],
    chips: ["Математика", "Физика", "Биология", "Химия", "История", "Экономика"],
    cta: "Составить конспект",
    historyHref: "/learn/summary",
    historyLabel: "Открыть инструмент",
  },
  {
    id: "uniqueness",
    href: "/uniqueness",
    icon: ShieldCheck,
    cardBg: "from-amber-600/25 via-orange-700/10 to-amber-900/5",
    cardBgLight: "from-amber-500/15 via-orange-400/8 to-amber-300/5",
    border: "border-amber-500/25 hover:border-amber-500/50",
    glow: "hover:shadow-[0_0_40px_rgba(245,158,11,0.12)]",
    iconBg: "bg-amber-500/20 border-amber-500/30",
    iconColor: "text-amber-500",
    accentBar: "from-amber-500 to-orange-500",
    badge: "bg-amber-500/10 border-amber-500/20 text-amber-500",
    badgeText: "Анти-копипаст",
    title: "Антиплагиат + уникализация",
    subtitle: "Курсовая близка к сдаче?",
    desc: "Проверим текст на шаблонные обороты и заимствования, потом перепишем — три уровня глубины. Сохраняем смысл, термины, цитаты и формулы.",
    steps: [
      { n: "1", text: "Загрузите PDF/Word или вставьте текст" },
      { n: "2", text: "Получите оценку уникальности и подсветку проблем" },
      { n: "3", text: "Уникализируйте текст и скачайте .docx" },
    ],
    chips: ["Курсовая", "Реферат", "Статья", "Диплом", "Эссе"],
    cta: "Проверить текст",
    historyHref: "/uniqueness",
    historyLabel: "Открыть инструмент",
  },
];

// ── What's New Card ───────────────────────────────────────────────
const WHATS_NEW_VERSION = "2026-04-v3";
const WHATS_NEW_ITEMS: { icon: string; title: string; desc: string; href?: string }[] = [
  {
    icon: "📊",
    title: "Дашборд статистики",
    desc: "Графики активности, стрики, календарь, продуктивность по часам.",
    href: "/statistics",
  },
  {
    icon: "🛡",
    title: "Антиплагиат с уникализацией",
    desc: "Проверка готовых работ + автоматическая переписка под нужный %.",
    href: "/uniqueness",
  },
  {
    icon: "✨",
    title: "Проверка прямо из курсовой",
    desc: "В конце мастера курсовой — кнопка «Проверить уникальность» одним кликом.",
    href: "/coursework/new",
  },
];

function WhatsNewCard({ isLight, heading }: { isLight: boolean; heading: string }) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(localStorage.getItem("whatsNew:dismissed") === WHATS_NEW_VERSION);
  }, []);
  if (dismissed) return null;
  const dismiss = () => {
    try { localStorage.setItem("whatsNew:dismissed", WHATS_NEW_VERSION); } catch {}
    setDismissed(true);
  };
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 ${
      isLight
        ? "border-violet-200 bg-gradient-to-br from-violet-50 via-fuchsia-50/40 to-white"
        : "border-violet-500/25 bg-gradient-to-br from-violet-600/12 via-fuchsia-600/8 to-card/40"
    }`}>
      <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full ${isLight ? "bg-violet-300/25" : "bg-violet-500/15"} blur-3xl pointer-events-none`} />
      <div className="relative flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className={`w-4 h-4 ${isLight ? "text-violet-600" : "text-violet-300"}`} />
          <p className={`text-xs font-semibold uppercase tracking-wider ${isLight ? "text-violet-700" : "text-violet-300"}`}>Что нового</p>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${isLight ? "bg-violet-500/15 text-violet-700" : "bg-violet-500/20 text-violet-200"}`}>NEW</span>
        </div>
        <button
          onClick={dismiss}
          aria-label="Скрыть"
          className={`text-xs px-1.5 py-0.5 rounded ${isLight ? "text-slate-400 hover:text-slate-700" : "text-slate-500 hover:text-slate-200"}`}
        >
          ✕
        </button>
      </div>
      <ul className="relative space-y-2.5">
        {WHATS_NEW_ITEMS.map((it) => {
          const inner = (
            <div className={`flex gap-2.5 group ${it.href ? "cursor-pointer" : ""}`}>
              <span className="shrink-0 text-base leading-none mt-0.5">{it.icon}</span>
              <div className="min-w-0 flex-1">
                <div className={`text-xs font-semibold leading-tight ${heading} ${it.href ? "group-hover:text-primary transition-colors" : ""}`}>
                  {it.title}
                </div>
                <div className={`text-[11px] leading-snug mt-0.5 ${isLight ? "text-slate-500" : "text-slate-500"}`}>
                  {it.desc}
                </div>
              </div>
              {it.href && <ChevronRight className={`w-3 h-3 mt-1 shrink-0 transition-all ${isLight ? "text-slate-400 group-hover:text-violet-600" : "text-slate-600 group-hover:text-violet-300"} group-hover:translate-x-0.5`} />}
            </div>
          );
          return (
            <li key={it.title}>
              {it.href ? <Link href={it.href}>{inner}</Link> : inner}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed": return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
        <CheckCircle2 className="w-3 h-3" /> Готово
      </span>
    );
    case "processing": return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">
        <Clock className="w-3 h-3 animate-pulse" /> В работе
      </span>
    );
    case "pending": return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-600 border border-yellow-500/20">
        <Clock className="w-3 h-3" /> В очереди
      </span>
    );
    case "failed": return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
        <AlertCircle className="w-3 h-3" /> Ошибка
      </span>
    );
    default: return null;
  }
}

export default function DashboardPage() {
  const { data: user } = useGetMe();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: subjectStats } = useGetSubjectStats();
  const { theme } = useTheme();
  const isLight = theme === "light";

  const [emailBannerDismissed, setEmailBannerDismissed] = useState(
    () => localStorage.getItem("emailBannerDismissed") === "true"
  );

  const dismissEmailBanner = () => {
    localStorage.setItem("emailBannerDismissed", "true");
    setEmailBannerDismissed(true);
  };

  // Onboarding теперь показывается единым глобальным компонентом OnboardingModal
  // в DashboardLayout (ключ localStorage: "onboarding_v1_done"), чтобы избежать
  // дублирования и конфликтующих модалок на разных страницах.

  const [, navigate] = useLocation();

  const firstName = user?.name?.split(" ")[0] || "Пользователь";
  const hasActivity = !statsLoading && stats?.totalTasks && stats.totalTasks > 0;

  // Adaptive text classes
  const heading = isLight ? "text-foreground" : "text-white";
  const subtext = "text-muted-foreground";
  const cardText = isLight ? "text-slate-700" : "text-slate-400";
  const cardTextSm = isLight ? "text-slate-500" : "text-slate-500";

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* ── Email banner ── */}
      {user && !user.email_verified && !emailBannerDismissed && (
        <EmailVerificationBanner email={user.email} onDismiss={dismissEmailBanner} />
      )}

      {/* ── Hero header ── */}
      <div className="relative">
      <ZeroBalanceHint
        show={!!user && (user.balance ?? 0) <= 0 && !!hasActivity}
        isLight={isLight}
      />
      <div className={`relative rounded-3xl overflow-hidden border ${isLight ? "border-violet-200/60 bg-gradient-to-br from-violet-50 via-white to-blue-50/40" : "border-white/6 bg-gradient-to-br from-primary/10 via-card/60 to-card/30"} p-6 md:p-8`}>
        <div className={`absolute top-0 right-0 w-64 h-64 rounded-full ${isLight ? "bg-primary/6" : "bg-primary/10"} blur-3xl pointer-events-none`} />
        <div className={`absolute bottom-0 left-0 w-48 h-48 rounded-full ${isLight ? "bg-blue-400/6" : "bg-blue-600/8"} blur-3xl pointer-events-none`} />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-xl bg-primary flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" fill="white" />
              </div>
              <span className="text-xs font-semibold text-primary/70 uppercase tracking-wider">НейроЗачёт</span>
            </div>
            <h1 className={`text-xl sm:text-2xl md:text-3xl font-bold break-words ${heading}`}>
              Привет, {firstName}! 👋
            </h1>
            <p className={`${subtext} mt-1 text-sm`}>
              {hasActivity
                ? `Вы решили ${stats?.totalTasks} задач. Что делаем сегодня?`
                : "Выберите раздел ниже — объяснение и переход сразу внутри карточки."
              }
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex flex-col items-end">
              <span className={`text-xs ${cardTextSm}`}>Баланс</span>
              <span className={`text-xl font-bold ${heading}`}>{user?.balance || 0} ₽</span>
            </div>
            <Link href="/profile">
              <Button variant="outline" size="sm" className={`gap-1.5 ${isLight ? "border-violet-200 text-violet-700 hover:bg-violet-50" : "border-white/15 text-slate-300 hover:text-white"}`}>
                <Wallet className="w-3.5 h-3.5" /> Пополнить
              </Button>
            </Link>
          </div>
        </div>
      </div>
      </div>

      {/* ── Quick-start: «Сфотографировать задание» ──
          Большая яркая кнопка для самого популярного сценария: фото → решение.
          + 3 альтернативных способа дать ИИ условие задачи. */}
      <div className={`relative rounded-3xl overflow-hidden border ${isLight ? "border-violet-300/70 bg-gradient-to-br from-violet-100 via-fuchsia-50 to-blue-50" : "border-violet-500/30 bg-gradient-to-br from-violet-600/20 via-fuchsia-600/10 to-blue-600/15"} p-5 sm:p-6`}>
        <div className={`absolute -top-12 -right-12 w-56 h-56 rounded-full ${isLight ? "bg-violet-300/40" : "bg-violet-500/25"} blur-3xl pointer-events-none`} />
        <div className={`absolute -bottom-16 -left-12 w-56 h-56 rounded-full ${isLight ? "bg-fuchsia-300/30" : "bg-fuchsia-500/15"} blur-3xl pointer-events-none`} />

        <div className="relative z-10 grid gap-5 lg:grid-cols-[1fr_auto] items-center">
          {/* Left: title */}
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 items-center justify-center shrink-0 shadow-lg shadow-violet-500/30">
              <Camera className="w-7 h-7 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-500">
                  Самый быстрый способ
                </span>
              </div>
              <h2 className={`text-lg sm:text-2xl font-bold ${heading} leading-tight`}>
                Сфотографируйте задание — получите решение
              </h2>
              <p className={`${cardText} text-sm mt-1`}>
                ИИ распознает текст с фото или PDF, поймёт условие и решит. Можно прикрепить несколько фото, файл или просто вставить текст.
              </p>
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:flex gap-2 lg:gap-2.5 lg:flex-col xl:flex-row">
            <Link href="/tasks/new?action=camera" className="group">
              <Button
                size="lg"
                className="w-full lg:w-auto gap-2 h-12 px-5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold shadow-lg shadow-violet-500/30 border-0"
              >
                <Camera className="w-5 h-5" />
                Сфотографировать
              </Button>
            </Link>
            <Link href="/tasks/new?action=file" className="group">
              <Button
                size="lg"
                variant="outline"
                className={`w-full lg:w-auto gap-2 h-12 px-5 font-semibold ${isLight ? "border-violet-300 bg-white/70 text-violet-700 hover:bg-violet-50" : "border-white/20 bg-white/5 text-white hover:bg-white/10"}`}
              >
                <Upload className="w-5 h-5" />
                Загрузить файл
              </Button>
            </Link>
            <Link href="/tasks/new?action=paste" className="group">
              <Button
                size="lg"
                variant="outline"
                className={`w-full lg:w-auto gap-2 h-12 px-5 font-semibold ${isLight ? "border-violet-300 bg-white/70 text-violet-700 hover:bg-violet-50" : "border-white/20 bg-white/5 text-white hover:bg-white/10"}`}
              >
                <ClipboardPaste className="w-5 h-5" />
                Вставить текст
              </Button>
            </Link>
          </div>
        </div>

        {/* Footer hints — другие способы */}
        <div className={`relative z-10 mt-4 pt-4 border-t ${isLight ? "border-violet-200/70" : "border-white/10"} flex flex-col sm:flex-row sm:items-center justify-between gap-2`}>
          <p className={`text-xs ${cardTextSm}`}>
            Не задача, а вопрос или большая работа?
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Link href="/sessions/new" className={`text-xs px-2.5 py-1 rounded-lg border transition-colors inline-flex items-center gap-1 ${isLight ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100" : "border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"}`}>
              <MessageSquare className="w-3 h-3" /> Чат с ИИ
            </Link>
            <Link href="/coursework/new" className={`text-xs px-2.5 py-1 rounded-lg border transition-colors inline-flex items-center gap-1 ${isLight ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"}`}>
              <GraduationCap className="w-3 h-3" /> Курсовая / диплом
            </Link>
            <Link href="/tickets/new" className={`text-xs px-2.5 py-1 rounded-lg border transition-colors inline-flex items-center gap-1 ${isLight ? "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100" : "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-400 hover:bg-fuchsia-500/20"}`}>
              <ClipboardList className="w-3 h-3" /> Билеты
            </Link>
            <Link href="/learn/summary" className={`text-xs px-2.5 py-1 rounded-lg border transition-colors inline-flex items-center gap-1 ${isLight ? "border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100" : "border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20"}`}>
              <BookOpen className="w-3 h-3" /> Конспект
            </Link>
          </div>
        </div>
      </div>

      {/* ── Section title ── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Layers className="w-4 h-4 text-primary" />
          <h2 className={`text-sm font-semibold ${isLight ? "text-slate-500" : "text-slate-400"} uppercase tracking-wider`}>Все инструменты</h2>
        </div>
        <p className={`${cardTextSm} text-xs`}>Нажмите на карточку — она объяснит всё и сразу откроет нужный раздел</p>
      </div>

      {/* ── 5 Feature cards — mobile compact 2-col / desktop full ── */}

      {/* Mobile: 2-column compact grid */}
      <div className="sm:hidden grid grid-cols-2 gap-3">
        {FEATURES.map((f) => (
          <div
            key={f.id}
            onClick={() => navigate(f.href)}
            className={`group relative flex flex-col rounded-2xl border cursor-pointer transition-all duration-200 overflow-hidden bg-gradient-to-b ${isLight ? f.cardBgLight : f.cardBg} ${f.border} active:scale-95`}
          >
            <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${f.accentBar}`} />
            <div className="relative z-10 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${f.iconBg}`}>
                  <f.icon className={`w-4.5 h-4.5 ${f.iconColor}`} />
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${f.badge}`}>
                  {f.badgeText}
                </span>
              </div>
              <div>
                <h3 className={`text-sm font-bold ${heading} leading-tight`}>{f.title}</h3>
                <p className={`text-[11px] ${f.iconColor} font-medium mt-0.5 leading-tight`}>{f.subtitle}</p>
              </div>
              <div className={`h-8 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-gradient-to-r ${f.accentBar}`}>
                {f.cta} <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: full detail cards */}
      <div className="hidden sm:grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {FEATURES.map((f) => (
          <div
            key={f.id}
            onClick={() => navigate(f.href)}
            className={`group relative h-full flex flex-col rounded-3xl border cursor-pointer transition-all duration-300 overflow-hidden bg-gradient-to-b ${isLight ? f.cardBgLight : f.cardBg} ${f.border} ${f.glow} ${isLight ? "shadow-sm hover:shadow-md" : ""}`}
          >
              <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${f.accentBar}`} />
              <div className={`absolute top-4 right-4 w-32 h-32 rounded-full opacity-15 blur-2xl bg-gradient-to-br ${f.accentBar} pointer-events-none group-hover:opacity-25 transition-opacity`} />
              <div className="relative z-10 p-6 flex flex-col h-full gap-5">
                <div className="flex items-start justify-between gap-3">
                  <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${f.iconBg}`}>
                    <f.icon className={`w-6 h-6 ${f.iconColor}`} />
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${f.badge} shrink-0 mt-1`}>
                    {f.badgeText}
                  </span>
                </div>
                <div>
                  <h3 className={`text-xl font-bold ${heading} mb-1 flex items-center gap-2`}>
                    {f.title}
                    <ChevronRight className={`w-5 h-5 ${f.iconColor} opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all`} />
                  </h3>
                  <p className={`text-xs font-semibold mb-2 ${f.iconColor}`}>{f.subtitle}</p>
                  <p className={`text-sm ${cardText} leading-relaxed`}>{f.desc}</p>
                </div>
                <div className="space-y-2">
                  {f.steps.map((step) => (
                    <div key={step.n} className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border ${f.iconBg} ${f.iconColor}`}>
                        {step.n}
                      </div>
                      <span className={`text-xs ${cardText}`}>{step.text}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {f.chips.map(chip => (
                    <span key={chip} className={`text-[11px] px-2 py-1 rounded-lg border ${isLight ? "bg-white/60 border-slate-200/80 text-slate-500" : "bg-white/5 border-white/8 text-slate-400"}`}>
                      {chip}
                    </span>
                  ))}
                </div>
                <div className="mt-auto pt-2 flex items-center justify-between gap-3">
                  <div className={`flex-1 h-10 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold text-white bg-gradient-to-r ${f.accentBar} group-hover:opacity-90 transition-opacity`}>
                    {f.cta}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <Link
                    href={f.historyHref}
                    onClick={(e) => e.stopPropagation()}
                    className={`text-xs transition-colors whitespace-nowrap underline underline-offset-2 ${isLight ? "text-slate-400 hover:text-slate-600" : "text-slate-500 hover:text-slate-300"}`}
                  >
                    {f.historyLabel}
                  </Link>
                </div>
              </div>
          </div>
        ))}
      </div>

      {/* ── Stat row ── */}
      {!statsLoading && (
        <>
        <div className="flex items-center justify-between gap-2 -mb-1">
          <span className={`text-xs font-semibold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}>Ваша статистика</span>
          <Link href="/statistics" className={`text-xs flex items-center gap-1 transition-colors ${isLight ? "text-violet-700 hover:text-violet-900" : "text-violet-300 hover:text-violet-200"}`}>
            <BarChart2 className="w-3.5 h-3.5" /> Подробная статистика
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: "Задач решено", value: stats?.completedTasks || 0,
              icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-500/10 border-emerald-500/20",
              sub: stats?.successRate ? `${Math.round(stats.successRate)}% успех` : "Пока нет",
            },
            {
              label: "В работе", value: stats?.pendingTasks || 0,
              icon: Clock, color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20",
              sub: "Ожидают ответа",
            },
            {
              label: "На балансе", value: `${user?.balance || 0} ₽`,
              icon: Wallet, color: "text-violet-500", bg: "bg-violet-500/10 border-violet-500/20",
              sub: `≈ ${Math.floor((user?.balance || 0) / 50)} задач`,
            },
            {
              label: "Потрачено", value: `${stats?.totalSpent || 0} ₽`,
              icon: TrendingUp, color: "text-orange-500", bg: "bg-orange-500/10 border-orange-500/20",
              sub: "За всё время",
            },
          ].map(({ label, value, icon: Icon, color, bg, sub }) => (
            <div key={label} className={`flex items-center gap-3 p-4 rounded-2xl border transition-colors ${isLight ? "border-slate-200/80 bg-white/70 hover:border-slate-300/80 shadow-sm" : "border-white/6 bg-card/40 hover:border-white/12"}`}>
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${bg}`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div className="min-w-0">
                <p className={`text-xs ${cardTextSm} mb-0.5`}>{label}</p>
                <p className={`text-base font-bold ${heading} leading-tight`}>{value}</p>
                <p className={`text-[11px] ${isLight ? "text-slate-400" : "text-slate-600"}`}>{sub}</p>
              </div>
            </div>
          ))}
        </div>
        </>
      )}

      {/* ── Bottom grid: Recent tasks + Sidebar ── */}
      <div className="grid gap-5 lg:grid-cols-3">

        {/* Recent tasks */}
        <div className={`lg:col-span-2 rounded-2xl border overflow-hidden ${isLight ? "border-slate-200/80 bg-white/70 shadow-sm" : "border-white/6 bg-card/40"}`}>
          <div className={`flex items-center justify-between px-5 py-4 border-b ${isLight ? "border-slate-100" : "border-white/5"}`}>
            <div className="flex items-center gap-2">
              <ListTodo className={`w-4 h-4 ${isLight ? "text-slate-500" : "text-slate-400"}`} />
              <span className={`font-semibold ${heading} text-sm`}>Недавние задачи</span>
            </div>
            <Link href="/tasks" className="text-xs text-primary/70 hover:text-primary transition-colors flex items-center gap-1">
              Все <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {stats?.recentTasks && stats.recentTasks.length > 0 ? (
            <div className={`divide-y ${isLight ? "divide-slate-100" : "divide-white/4"}`}>
              {stats.recentTasks.map((task) => (
                <Link key={task.id} href={`/tasks/${task.id}`}>
                  <div className={`flex items-center gap-3 px-5 py-3.5 transition-colors group ${isLight ? "hover:bg-slate-50" : "hover:bg-white/3"}`}>
                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0">
                      <Brain className="w-4 h-4 text-primary/70" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${heading} group-hover:text-primary transition-colors truncate`}>{task.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[11px] px-1.5 py-0.5 rounded-md ${isLight ? "bg-slate-100 text-slate-500" : "bg-white/8 text-slate-400"}`}>{task.subject}</span>
                        <span className={`text-[11px] ${cardTextSm}`}>
                          {format(new Date(task.createdAt), "d MMM, HH:mm", { locale: ru })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-xs ${cardTextSm} hidden sm:block`}>{task.actualCost || task.estimatedCost} ₽</span>
                      <StatusBadge status={task.status} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-5 sm:px-7 py-8 sm:py-10">
              <div className="text-center mb-7">
                <div className={`inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-3 ${isLight ? "bg-violet-500/10 border border-violet-500/20" : "bg-violet-500/15 border border-violet-500/25"}`}>
                  <Sparkles className="w-7 h-7 text-violet-500" />
                </div>
                <p className={`${heading} text-lg font-bold mb-1`}>Здесь будут ваши задачи</p>
                <p className={`${subtext} text-sm leading-relaxed max-w-md mx-auto`}>
                  Это очень просто. Сделайте первый шаг — а если запутаетесь, нажмите фиолетовую кнопку «?» в правом нижнем углу.
                </p>
              </div>

              {/* 3 простых шага */}
              <div className="grid sm:grid-cols-3 gap-3 mb-6">
                {[
                  { n: 1, icon: Camera, title: "Сфотографируйте", text: "Условие задачи на фото или вставьте текст" },
                  { n: 2, icon: Sparkles, title: "Выберите режим", text: "Быстро / Стандарт / Премиум — от 5 ₽" },
                  { n: 3, icon: CheckCircle2, title: "Получите решение", text: "С пояснениями, формулами и проверкой" },
                ].map(({ n, icon: Icon, title, text }) => (
                  <div key={n} className={`relative rounded-xl border p-3.5 ${isLight ? "bg-violet-50/50 border-violet-200/60" : "bg-violet-500/5 border-violet-500/15"}`}>
                    <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white text-xs font-black flex items-center justify-center shadow-md">{n}</div>
                    <Icon className="w-5 h-5 text-violet-500 mb-2" />
                    <p className={`text-sm font-semibold ${heading} mb-0.5`}>{title}</p>
                    <p className={`text-xs ${subtext} leading-relaxed`}>{text}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Link href="/tasks/new">
                  <Button size="lg" className="w-full sm:w-auto gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white border-0 shadow-lg shadow-violet-500/30">
                    <Camera className="w-4 h-4" /> Решить первую задачу
                  </Button>
                </Link>
                <Link href="/hints">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2">
                    <Lightbulb className="w-4 h-4" /> Готовые шаблоны
                  </Button>
                </Link>
              </div>
              <p className={`text-xs ${subtext} text-center mt-4`}>
                💡 Совет: на каждой странице в правом нижнем углу есть фиолетовая кнопка «?» — нажмите её, если что-то непонятно.
              </p>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">

          {/* Quick nav */}
          <div className={`rounded-2xl border overflow-hidden ${isLight ? "border-slate-200/80 bg-white/70 shadow-sm" : "border-white/6 bg-card/40"}`}>
            <div className={`px-4 py-3.5 border-b ${isLight ? "border-slate-100" : "border-white/5"}`}>
              <p className={`text-xs font-semibold ${isLight ? "text-slate-500" : "text-slate-400"} uppercase tracking-wider`}>Быстрый переход</p>
            </div>
            <div className="p-2 space-y-0.5">
              {[
                { href: "/tasks/new",      icon: Plus,          label: "Новая задача",    color: "text-violet-500",  sub: "Решить задание" },
                { href: "/sessions/new",   icon: MessageSquare, label: "Новый чат",       color: "text-blue-500",    sub: "Открыть диалог" },
                { href: "/coursework/new", icon: FileText,      label: "Научная работа",  color: "text-emerald-600", sub: "Курсовая, диплом" },
                { href: "/tickets/new",    icon: ClipboardList, label: "Билеты к экзамену", color: "text-fuchsia-500", sub: "Учебник → ответы" },
                { href: "/learn/summary",  icon: BookOpen,      label: "Конспект темы",     color: "text-cyan-500",    sub: "Бесплатно" },
                { href: "/tasks/new?type=presentation", icon: Layers, label: "Презентация PPTX", color: "text-pink-500", sub: "Создать слайды" },
                { href: "/tasks",          icon: ListTodo,      label: "История задач",   color: isLight ? "text-slate-500" : "text-slate-400", sub: "Все решения" },
                { href: "/sessions",       icon: Timer,         label: "Мои сессии",      color: isLight ? "text-slate-500" : "text-slate-400", sub: "Чаты с ИИ" },
                { href: "/profile",        icon: User,          label: "Профиль",         color: isLight ? "text-slate-500" : "text-slate-400", sub: "Баланс и настройки" },
              ].map(({ href, icon: Icon, label, color, sub }) => (
                <Link key={href} href={href}>
                  <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group cursor-pointer ${isLight ? "hover:bg-slate-50" : "hover:bg-white/5"}`}>
                    <Icon className={`w-4 h-4 shrink-0 ${color}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${heading} leading-tight`}>{label}</p>
                      <p className={`text-[11px] ${isLight ? "text-slate-400" : "text-slate-600"}`}>{sub}</p>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 transition-all ${isLight ? "text-slate-300 group-hover:text-slate-500" : "text-slate-600 group-hover:text-slate-400"} group-hover:translate-x-0.5`} />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Subject stats */}
          {subjectStats && subjectStats.length > 0 && (
            <div className={`rounded-2xl border overflow-hidden ${isLight ? "border-slate-200/80 bg-white/70 shadow-sm" : "border-white/6 bg-card/40"}`}>
              <div className={`px-4 py-3.5 border-b ${isLight ? "border-slate-100" : "border-white/5"}`}>
                <p className={`text-xs font-semibold ${isLight ? "text-slate-500" : "text-slate-400"} uppercase tracking-wider`}>По предметам</p>
              </div>
              <div className="p-4 space-y-3">
                {subjectStats.slice(0, 5).map((stat, i) => {
                  const max = subjectStats[0]?.count || 1;
                  const pct = Math.round((stat.count / max) * 100);
                  const colors = ["bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-orange-500", "bg-pink-500"];
                  return (
                    <div key={i}>
                      <div className="flex justify-between mb-1">
                        <span className={`text-xs font-medium ${heading}`}>{stat.subject}</span>
                        <span className={`text-xs ${cardTextSm}`}>{stat.count}</span>
                      </div>
                      <div className={`h-1.5 rounded-full overflow-hidden ${isLight ? "bg-slate-100" : "bg-white/5"}`}>
                        <div className={`h-full rounded-full ${colors[i % colors.length]}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* What's new */}
          <WhatsNewCard isLight={isLight} heading={heading} />

          {/* Tips */}
          <div className={`rounded-2xl border p-4 ${isLight ? "border-slate-200/80 bg-white/70 shadow-sm" : "border-white/6 bg-card/40"}`}>
            <div className="flex items-center gap-2 mb-3">
              <BookMarked className="w-4 h-4 text-primary" />
              <p className={`text-xs font-semibold ${isLight ? "text-slate-500" : "text-slate-400"} uppercase tracking-wider`}>Советы</p>
            </div>
            <div className="space-y-3">
              {[
                { icon: "📝", tip: "Чем подробнее условие — тем точнее ответ ИИ" },
                { icon: "💬", tip: "Для сложных тем — чат: можно переспросить и уточнить" },
                { icon: "📷", tip: "Прикрепите фото задания прямо из телефона" },
                { icon: "⏱️", tip: "Сессия-чат не ограничена по вопросам — только по времени" },
              ].map(({ icon, tip }) => (
                <div key={tip} className={`flex gap-2.5 text-xs ${isLight ? "text-slate-500" : "text-slate-500"} leading-relaxed`}>
                  <span className="shrink-0 text-base leading-none mt-0.5">{icon}</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
