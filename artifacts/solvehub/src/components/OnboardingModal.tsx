import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Brain, MessageSquare, GraduationCap, Zap, ArrowRight,
  CheckCircle2, BookOpen, Lightbulb, ChevronRight, Sparkles, X
} from "lucide-react";

interface Slide {
  icon: React.ReactNode;
  title: string;
  description: string;
  tips?: string[];
  accent: string;
}

const SLIDES: Slide[] = [
  {
    accent: "from-violet-600/20 to-blue-600/10",
    icon: <Zap className="w-12 h-12 text-violet-400" fill="currentColor" />,
    title: "Добро пожаловать в НейроЗачёт!",
    description: "Это платформа, где ИИ помогает студентам и школьникам решать учебные задачи, отвечать на вопросы и писать работы. Всё быстро, понятно и по-русски.",
    tips: [
      "🎓 Работает для школьников, студентов колледжей и вузов",
      "📚 Более 30 предметов — от математики до права",
      "⚡ Ответ обычно приходит за 1–3 минуты",
    ],
  },
  {
    accent: "from-blue-600/20 to-cyan-600/10",
    icon: <div className="flex gap-3">
      <div className="w-14 h-14 rounded-2xl bg-primary/20 border border-primary/30 flex flex-col items-center justify-center">
        <Brain className="w-6 h-6 text-primary" />
        <span className="text-[9px] text-primary font-semibold mt-0.5">ЗАДАЧА</span>
      </div>
      <div className="flex items-center text-slate-500">vs</div>
      <div className="w-14 h-14 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex flex-col items-center justify-center">
        <MessageSquare className="w-6 h-6 text-blue-400" />
        <span className="text-[9px] text-blue-400 font-semibold mt-0.5">СЕССИЯ</span>
      </div>
    </div>,
    title: "Два способа получить помощь",
    description: "Выбирайте подходящий формат в зависимости от ситуации.",
    tips: [
      "🧠 Задача — скидываете задание, ИИ решает и присылает готовый ответ. Подходит для домашки, тестов, лабораторных.",
      "💬 Сессия — это чат с ИИ, как в мессенджере. Задаёте любые вопросы, ИИ отвечает в режиме диалога. Идеально для подготовки к экзамену или объяснения тем.",
      "📄 Научная работа — пошаговый мастер для курсовых и дипломов.",
    ],
  },
  {
    accent: "from-emerald-600/20 to-teal-600/10",
    icon: <div className="flex gap-2 flex-wrap justify-center max-w-[200px]">
      {["Математика 📐", "Физика ⚛️", "Python 🐍", "История 📜", "Английский 🌍"].map(s => (
        <span key={s} className="text-xs px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-slate-300">{s}</span>
      ))}
    </div>,
    title: "Готовы начинать!",
    description: "Вот что делать прямо сейчас — выберите свой сценарий:",
    tips: [
      "📝 Есть конкретная задача? → Нажмите «Новая задача» в меню слева",
      "📖 Нужно разобраться в теме? → «Сессии (чат)» → выберите предмет → задавайте вопросы",
      "🎓 Нужна курсовая или диплом? → «Научные работы» → пошаговый мастер поможет",
    ],
  },
];

export function OnboardingModal() {
  const [open, setOpen] = useState(false);
  const [slide, setSlide] = useState(0);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const done = localStorage.getItem("onboarding_v1_done");
    if (!done) {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const close = () => {
    localStorage.setItem("onboarding_v1_done", "1");
    setOpen(false);
  };

  const next = () => {
    if (slide < SLIDES.length - 1) {
      setSlide(s => s + 1);
    } else {
      close();
    }
  };

  const goToAction = (href: string) => {
    close();
    setLocation(href);
  };

  if (!open) return null;

  const s = SLIDES[slide];
  const isLast = slide === SLIDES.length - 1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={close}
    >
      <div
        className="relative w-full max-w-md bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Top gradient stripe */}
        <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${s.accent.replace('/20', '').replace('/10', '')}`} />

        {/* Close */}
        <button
          onClick={close}
          className="absolute top-4 right-4 text-slate-600 hover:text-slate-400 transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="p-8 pt-10">
          {/* Icon */}
          <div className={`flex items-center justify-center mb-6 p-5 rounded-2xl bg-gradient-to-br ${s.accent} border border-white/5`}>
            {s.icon}
          </div>

          <h2 className="text-xl font-bold text-white text-center mb-3">{s.title}</h2>
          <p className="text-sm text-slate-400 text-center leading-relaxed mb-5">{s.description}</p>

          {s.tips && (
            <div className="space-y-2.5 mb-6">
              {s.tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-white/4 border border-white/5 text-xs text-slate-300 leading-relaxed">
                  {tip}
                </div>
              ))}
            </div>
          )}

          {/* Last slide: action buttons */}
          {isLast ? (
            <div className="space-y-2">
              <button
                onClick={() => goToAction("/tasks/new")}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/25 hover:bg-primary/20 transition-all text-left group"
              >
                <Brain className="w-5 h-5 text-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">Создать задачу</p>
                  <p className="text-xs text-slate-400">Сдать домашку, контрольную, лабу</p>
                </div>
                <ChevronRight className="w-4 h-4 text-primary group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button
                onClick={() => goToAction("/sessions/new")}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/25 hover:bg-blue-500/20 transition-all text-left group"
              >
                <MessageSquare className="w-5 h-5 text-blue-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">Начать чат-сессию</p>
                  <p className="text-xs text-slate-400">Объяснение тем, подготовка к экзамену</p>
                </div>
                <ChevronRight className="w-4 h-4 text-blue-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button
                onClick={() => goToAction("/coursework/new")}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 transition-all text-left group"
              >
                <GraduationCap className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">Научная работа</p>
                  <p className="text-xs text-slate-400">Курсовая, диплом, реферат</p>
                </div>
                <ChevronRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          ) : (
            <Button onClick={next} className="w-full gap-2">
              Дальше <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Dots */}
        <div className="flex items-center justify-center gap-2 pb-5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === slide ? 'w-6 bg-primary' : 'w-1.5 bg-white/20'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
