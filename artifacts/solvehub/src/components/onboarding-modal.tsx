import { useState } from "react";
import { useLocation } from "wouter";
import {
  Brain, MessageSquare, GraduationCap, BookOpen, Ticket, Image, FileText,
  Sparkles, ArrowRight, Check, X, Wallet, Zap, ChevronRight, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const GOALS = [
  {
    id: "task",
    icon: Brain,
    color: "violet",
    label: "Решить задачу / домашку",
    desc: "Условие, файл или фото — ИИ решит и объяснит",
    href: "/tasks/new",
    cta: "Создать задачу",
    estimatedCost: "от 5 ₽",
  },
  {
    id: "chat",
    icon: MessageSquare,
    color: "blue",
    label: "Поговорить с репетитором",
    desc: "Задавайте любые вопросы — объясним понятно",
    href: "/sessions/new",
    cta: "Начать чат",
    estimatedCost: "от 59 ₽/час",
  },
  {
    id: "coursework",
    icon: GraduationCap,
    color: "emerald",
    label: "Написать курсовую / реферат",
    desc: "ИИ пишет разделы по вашему плану с экспортом в Word",
    href: "/coursework/new",
    cta: "Начать работу",
    estimatedCost: "от 15 ₽/раздел",
  },
  {
    id: "summary",
    icon: BookOpen,
    color: "cyan",
    label: "Сделать конспект",
    desc: "По теме или загруженному файлу — краткий или подробный",
    href: "/learn/summary",
    cta: "Создать конспект",
    estimatedCost: "от 5 ₽",
  },
  {
    id: "tickets",
    icon: Ticket,
    color: "amber",
    label: "Подготовить билеты к экзамену",
    desc: "Вопросы → развёрнутые ответы за секунды",
    href: "/tickets/new",
    cta: "Подготовить билеты",
    estimatedCost: "от 15 ₽",
  },
  {
    id: "illustrations",
    icon: Image,
    color: "rose",
    label: "Создать иллюстрации",
    desc: "Схемы, диаграммы, инфографика для любой работы",
    href: "/illustrations",
    cta: "Создать иллюстрации",
    estimatedCost: "от 10 ₽",
  },
];

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; iconBg: string; ring: string }> = {
  violet: { bg: "bg-violet-500/10", border: "border-violet-500/30", text: "text-violet-400", iconBg: "bg-violet-500/20", ring: "ring-violet-500/40" },
  blue:   { bg: "bg-blue-500/10",   border: "border-blue-500/30",   text: "text-blue-400",   iconBg: "bg-blue-500/20",   ring: "ring-blue-500/40" },
  emerald:{ bg: "bg-emerald-500/10",border: "border-emerald-500/30",text: "text-emerald-400",iconBg: "bg-emerald-500/20",ring: "ring-emerald-500/40" },
  cyan:   { bg: "bg-cyan-500/10",   border: "border-cyan-500/30",   text: "text-cyan-400",   iconBg: "bg-cyan-500/20",   ring: "ring-cyan-500/40" },
  amber:  { bg: "bg-amber-500/10",  border: "border-amber-500/30",  text: "text-amber-400",  iconBg: "bg-amber-500/20",  ring: "ring-amber-500/40" },
  rose:   { bg: "bg-rose-500/10",   border: "border-rose-500/30",   text: "text-rose-400",   iconBg: "bg-rose-500/20",   ring: "ring-rose-500/40" },
};

interface OnboardingModalProps {
  userName?: string;
  balance?: number;
  onClose: () => void;
}

export function OnboardingModal({ userName, balance = 100, onClose }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  const goal = GOALS.find(g => g.id === selectedGoal);
  const TOTAL_STEPS = 3;

  const handleFinish = (href?: string) => {
    localStorage.setItem("nz_onboarding_done", "1");
    onClose();
    if (href) setLocation(href);
  };

  const handleSkip = () => {
    localStorage.setItem("nz_onboarding_done", "1");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleSkip} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg bg-[#0f0f1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">

        {/* Progress bar */}
        <div className="h-1 bg-white/5">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-500"
            style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        {/* Skip button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5 pt-5 pb-1">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === step
                  ? "w-5 h-1.5 bg-primary"
                  : i < step
                    ? "w-1.5 h-1.5 bg-primary/50"
                    : "w-1.5 h-1.5 bg-white/15"
              }`}
            />
          ))}
        </div>

        <div className="px-6 pb-6 pt-3">

          {/* ─── STEP 0: Welcome ─── */}
          {step === 0 && (
            <div className="text-center space-y-5">
              {/* Celebration icon */}
              <div className="flex items-center justify-center">
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/30 to-blue-500/30 border border-violet-500/30 flex items-center justify-center">
                    <Sparkles className="w-9 h-9 text-violet-400" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center border-2 border-[#0f0f1a]">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-bold mb-2">
                  Добро пожаловать{userName ? `, ${userName.split(" ")[0]}` : ""}! 🎓
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  НейроЗачёт — ИИ-помощник для учёбы. Решаем задачи, пишем курсовые, отвечаем на билеты — быстро и качественно.
                </p>
              </div>

              {/* Balance card */}
              <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3 text-left">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <Wallet className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-300">{balance} ₽ уже на балансе</p>
                  <p className="text-xs text-muted-foreground">Подарок за регистрацию — пробуйте бесплатно</p>
                </div>
              </div>

              {/* Quick facts */}
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { icon: "⚡", label: "Ответ за", sub: "1–3 мин" },
                  { icon: "🧠", label: "Моделей", sub: "GPT, Claude, Gemini" },
                  { icon: "📄", label: "Экспорт", sub: "DOCX / PPTX" },
                ].map(f => (
                  <div key={f.sub} className="bg-white/4 rounded-xl py-2.5 px-2 border border-white/8">
                    <div className="text-lg">{f.icon}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{f.label}</div>
                    <div className="text-xs font-medium text-foreground">{f.sub}</div>
                  </div>
                ))}
              </div>

              <Button onClick={() => setStep(1)} size="lg" className="w-full gap-2">
                Начать знакомство <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* ─── STEP 1: Choose goal ─── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-xl font-bold">Что нужно сделать прямо сейчас?</h2>
                <p className="text-muted-foreground text-sm mt-1">Выберите — покажем с чего начать</p>
              </div>

              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {GOALS.map(g => {
                  const c = COLOR_MAP[g.color];
                  const Icon = g.icon;
                  const isSelected = selectedGoal === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setSelectedGoal(g.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150 ${
                        isSelected
                          ? `${c.bg} ${c.border} ring-1 ${c.ring}`
                          : "bg-white/3 border-white/8 hover:bg-white/6 hover:border-white/15"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg ${isSelected ? c.iconBg : "bg-white/8"} flex items-center justify-center shrink-0 transition-all`}>
                        <Icon className={`w-4 h-4 ${isSelected ? c.text : "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${isSelected ? "text-foreground" : "text-foreground/80"}`}>{g.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{g.desc}</p>
                      </div>
                      <div className="shrink-0">
                        {isSelected
                          ? <Check className={`w-4 h-4 ${c.text}`} />
                          : <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                        }
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setStep(0)} className="flex-1">
                  Назад
                </Button>
                <Button
                  onClick={() => setStep(2)}
                  disabled={!selectedGoal}
                  className="flex-1 gap-2"
                >
                  Далее <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ─── STEP 2: Launch ─── */}
          {step === 2 && goal && (() => {
            const c = COLOR_MAP[goal.color];
            const Icon = goal.icon;
            return (
              <div className="space-y-5 text-center">
                {/* Tool showcase */}
                <div className={`rounded-2xl border ${c.border} ${c.bg} px-5 py-6 space-y-3`}>
                  <div className={`w-14 h-14 rounded-2xl ${c.iconBg} border ${c.border} flex items-center justify-center mx-auto`}>
                    <Icon className={`w-7 h-7 ${c.text}`} />
                  </div>
                  <h3 className="font-bold text-lg">{goal.label}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{goal.desc}</p>
                  <div className={`inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full border ${c.border} ${c.text} bg-white/5`}>
                    <Zap className="w-3 h-3" /> {goal.estimatedCost}
                  </div>
                </div>

                {/* How it works */}
                <div className="text-left space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Как это работает</p>
                  {goal.id === "task" && [
                    "Вставьте условие задачи или прикрепите файл",
                    "Укажите предмет и выберите качество решения",
                    "Скачайте готовое решение в DOCX / PPTX",
                  ].map((s, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className={`w-5 h-5 rounded-full ${c.iconBg} flex items-center justify-center text-[11px] font-bold ${c.text} shrink-0 mt-0.5`}>{i + 1}</div>
                      <p className="text-sm text-foreground/80">{s}</p>
                    </div>
                  ))}
                  {goal.id === "chat" && [
                    "Назовите тему и выберите пакет по времени",
                    "Задавайте вопросы в свободном формате",
                    "Уточняйте, просите примеры — без лимита",
                  ].map((s, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className={`w-5 h-5 rounded-full ${c.iconBg} flex items-center justify-center text-[11px] font-bold ${c.text} shrink-0 mt-0.5`}>{i + 1}</div>
                      <p className="text-sm text-foreground/80">{s}</p>
                    </div>
                  ))}
                  {goal.id === "coursework" && [
                    "Введите тему и тип работы",
                    "ИИ предложит план — вы редактируете разделы",
                    "Генерируйте главы и скачивайте готовый DOCX",
                  ].map((s, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className={`w-5 h-5 rounded-full ${c.iconBg} flex items-center justify-center text-[11px] font-bold ${c.text} shrink-0 mt-0.5`}>{i + 1}</div>
                      <p className="text-sm text-foreground/80">{s}</p>
                    </div>
                  ))}
                  {goal.id === "summary" && [
                    "Введите тему или загрузите файл с материалом",
                    "Выберите объём конспекта (краткий/подробный)",
                    "Получите структурированный конспект + DOCX",
                  ].map((s, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className={`w-5 h-5 rounded-full ${c.iconBg} flex items-center justify-center text-[11px] font-bold ${c.text} shrink-0 mt-0.5`}>{i + 1}</div>
                      <p className="text-sm text-foreground/80">{s}</p>
                    </div>
                  ))}
                  {goal.id === "tickets" && [
                    "Вставьте список вопросов к билетам",
                    "Выберите уровень детализации ответов",
                    "Скачайте готовые ответы в DOCX",
                  ].map((s, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className={`w-5 h-5 rounded-full ${c.iconBg} flex items-center justify-center text-[11px] font-bold ${c.text} shrink-0 mt-0.5`}>{i + 1}</div>
                      <p className="text-sm text-foreground/80">{s}</p>
                    </div>
                  ))}
                  {goal.id === "illustrations" && [
                    "Введите тему — ИИ подберёт нужный тип схемы",
                    "Выберите стиль и количество иллюстраций",
                    "Скачайте изображения для вставки в работу",
                  ].map((s, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className={`w-5 h-5 rounded-full ${c.iconBg} flex items-center justify-center text-[11px] font-bold ${c.text} shrink-0 mt-0.5`}>{i + 1}</div>
                      <p className="text-sm text-foreground/80">{s}</p>
                    </div>
                  ))}
                </div>

                {/* Balance reminder */}
                <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/8 border border-emerald-500/20 rounded-lg px-3 py-2">
                  <Star className="w-3 h-3 shrink-0" />
                  У вас {balance} ₽ на балансе — {goal.estimatedCost} для первой попытки
                </div>

                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setStep(1)} className="flex-1">
                    Назад
                  </Button>
                  <Button onClick={() => handleFinish(goal.href)} className="flex-[2] gap-2">
                    {goal.cta} <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>

                <button
                  type="button"
                  onClick={() => handleFinish()}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Перейти на главную →
                </button>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
