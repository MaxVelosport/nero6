import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import {
  ArrowRight, BrainCircuit, CheckCircle2, Clock, ShieldCheck, Sparkles,
  Star, Zap, Activity, Bot, User, BookOpen, Lightbulb, MessageSquare,
  GraduationCap, Code2, Calculator, FlaskConical, BarChart2, Scale, Globe,
  Atom, ChevronRight, Play, Terminal, Hash, Infinity, Lock, BookMarked,
  Pencil, Languages, Microscope, TrendingUp, Users, School,
  Upload, FileText, Library, CheckCircle, FileCheck2, Layers,
  Download, Search, Sigma, Cpu, FileDown, Wand2
} from "lucide-react";
import { useGetPricingPlans } from "@workspace/api-client-react";
import { RenderMessage } from "@/lib/render-message";

// ─────────────────────────────────────────────────────────────
// DEMO DATA  (Информатика, Химия, ЕГЭ, Экономика, Литература)
// ─────────────────────────────────────────────────────────────
const DEMOS = [
  {
    label: "Информатика",
    icon: Code2,
    accent: "#7c3aed",          // violet
    glow:  "shadow-violet-500/30",
    from: "from-violet-600", to: "to-purple-600",
    q: "Что такое рекурсия? Напиши факториал на Python с примером.",
    a: `**Рекурсия** — функция, которая вызывает саму себя.

\`\`\`python
def factorial(n):
    if n <= 1:          # базовый случай
        return 1
    return n * factorial(n - 1)  # рекурсивный вызов

print(factorial(5))  # → 120
\`\`\`

### Как работает:
5 → 4 → 3 → 2 → 1 → затем: 1·2·3·4·5 = 120

✓ Проверено верификатором · Сложность O(n)`,
  },
  {
    label: "Матан",
    icon: Calculator,
    accent: "#2563eb",          // blue
    glow:  "shadow-blue-500/30",
    from: "from-blue-600", to: "to-cyan-500",
    q: "Найди предел: lim(x→0) sin(x)/x",
    a: `### Первый замечательный предел

$$\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$$

### Доказательство (геометрически)
При $x \\to 0$: $\\sin x \\approx x$, поэтому $\\dfrac{\\sin x}{x} \\to 1$

### Через правило Лопиталя
Неопределённость $\\dfrac{0}{0}$, применяем:

$$\\lim_{x \\to 0} \\frac{\\sin x}{x} = \\lim_{x \\to 0} \\frac{\\cos x}{1} = \\cos 0 = 1$$

✓ Проверено · Классический результат математического анализа`,
  },
  {
    label: "Химия",
    icon: FlaskConical,
    accent: "#059669",          // emerald
    glow:  "shadow-emerald-500/30",
    from: "from-emerald-600", to: "to-teal-500",
    q: "Составь уравнение реакции горения этана C₂H₆",
    a: `### Горение этана C₂H₆

$$2C_2H_6 + 7O_2 \\to 4CO_2 + 6H_2O$$

### Расстановка коэффициентов
- C: $2 \\cdot 2 = 4$ → ✓ (4 молекулы $CO_2$)
- H: $2 \\cdot 6 = 12$ → ✓ ($6H_2O \\cdot 2H$)
- O: $7 \\cdot 2 = 14$ → $4 \\cdot 2 + 6 = 14$ ✓

Тип реакции: окислительно-восстановительная, экзотермическая

✓ Уравнение проверено и сбалансировано`,
  },
  {
    label: "ЕГЭ / ОГЭ",
    icon: BookMarked,
    accent: "#dc2626",          // red
    glow:  "shadow-red-500/30",
    from: "from-red-600", to: "to-orange-500",
    q: "ЕГЭ Задача: В треугольнике ABC угол C = 90°, BC = 5, AB = 13. Найти cos(A).",
    a: `### Решение ЕГЭ — прямоугольный треугольник

По теореме Пифагора:

$$AC = \\sqrt{AB^2 - BC^2} = \\sqrt{169 - 25} = \\sqrt{144} = 12$$

$$\\cos A = \\frac{AC}{AB} = \\frac{12}{13}$$

### Проверка
- $\\sin A = \\dfrac{BC}{AB} = \\dfrac{5}{13}$
- $\\sin^2 A + \\cos^2 A = \\dfrac{25}{169} + \\dfrac{144}{169} = 1$ ✓

📌 Типичная задача ЕГЭ: «Тригонометрия в прямоугольном треугольнике»

✓ Верифицировано · Стиль оформления по критериям ЕГЭ`,
  },
  {
    label: "Экономика",
    icon: TrendingUp,
    accent: "#d97706",          // amber
    glow:  "shadow-amber-500/30",
    from: "from-amber-500", to: "to-orange-500",
    q: "Объясни закон спроса и покажи на примере.",
    a: `### Закон спроса
При росте цены — спрос падает, при снижении — растёт (при прочих равных условиях).

### Пример
- Цена кофе 100 ₽ → покупают 500 стаканов/день
- Цена кофе 150 ₽ → покупают 300 стаканов/день
- Цена кофе 200 ₽ → покупают 100 стаканов/день

### Исключения — товары Гиффена
Хлеб, крупы: при росте цены спрос может расти, если это товар первой необходимости.

График: кривая спроса D — убывающая слева направо.

✓ Соответствует программе экономики ВУЗа`,
  },
];

// ─────────────────────────────────────────────────────────────
// LIVE DEMO
// ─────────────────────────────────────────────────────────────
function LiveDemo() {
  const [active, setActive] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const demo = DEMOS[active];

  useEffect(() => {
    setShowAnswer(false);
    const t = setTimeout(() => setShowAnswer(true), 900);
    return () => clearTimeout(t);
  }, [active]);


  return (
    <div>
      {/* Tab row */}
      <div className="flex flex-wrap gap-2 justify-center mb-6">
        {DEMOS.map((d, i) => {
          const Icon = d.icon;
          const isActive = active === i;
          return (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                isActive
                  ? `border-transparent text-white bg-gradient-to-r ${d.from} ${d.to} shadow-lg`
                  : "border-white/15 text-slate-300 bg-white/5 hover:bg-white/10 hover:text-white hover:border-white/30"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />{d.label}
            </button>
          );
        })}
      </div>

      {/* Chat window */}
      <div className="rounded-2xl border border-white/15 bg-[#0f0f1a] overflow-hidden"
           style={{ boxShadow: `0 0 60px ${demo.accent}22, 0 0 120px ${demo.accent}11` }}>

        {/* Title bar */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/8 bg-white/3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
          </div>
          <div className="flex-1 text-center text-xs text-slate-400 font-mono">
            НейроЗачёт · {demo.label}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">online</span>
          </div>
        </div>

        {/* Messages area */}
        <div className="p-6 space-y-5 min-h-[300px]">
          <AnimatePresence mode="wait">
            <motion.div key={active} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

              {/* User message */}
              <div className="flex gap-3 justify-end">
                <div className="max-w-[82%] space-y-1">
                  <div className="text-xs text-slate-400 text-right">Студент</div>
                  <div className={`bg-gradient-to-br ${demo.from} ${demo.to} rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-white font-medium`}>
                    {demo.q}
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-4">
                  <User className="w-4 h-4 text-white/70" />
                </div>
              </div>

              {/* AI response */}
              <div className="flex gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-4 bg-gradient-to-br ${demo.from} ${demo.to}`}
                  style={{ boxShadow: `0 0 16px ${demo.accent}55` }}
                >
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="max-w-[85%] space-y-1">
                  <div className="text-xs text-slate-400">НейроЗачёт ИИ</div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3">
                    {!showAnswer ? (
                      <div className="flex gap-1.5 py-1">
                        {[0, 1, 2].map(i => (
                          <div key={i} className="w-2 h-2 rounded-full bg-white/30 animate-bounce"
                               style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </div>
                    ) : <RenderMessage content={demo.a} />}
                  </div>
                  {showAnswer && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3 h-3" /> Верифицировано · 2 сек
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Locked input */}
        <div className="px-5 py-4 border-t border-white/8 bg-black/20 flex gap-3 items-center">
          <div className="flex-1 border border-white/10 bg-white/5 rounded-xl px-4 py-2.5 text-sm text-slate-400 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            Войдите, чтобы задать свой вопрос...
          </div>
          <Link href="/register">
            <Button className={`shrink-0 bg-gradient-to-r ${demo.from} ${demo.to} border-0 text-white font-semibold`}
                    style={{ boxShadow: `0 0 20px ${demo.accent}55` }}>
              Попробовать <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// POWER TOOLS SHOWCASE
// ─────────────────────────────────────────────────────────────
function PowerToolsShowcase() {
  const [active, setActive] = useState<"latex" | "pptx" | "files" | "search">("latex");

  const tabs = [
    { key: "latex"  as const, label: "LaTeX",        icon: Sigma },
    { key: "pptx"  as const,  label: "Презентации",  icon: Layers },
    { key: "files" as const,  label: "Файлы",        icon: Upload },
    { key: "search" as const, label: "Поиск",        icon: Search },
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b0c1e] overflow-hidden shadow-2xl">
      {/* Tab bar */}
      <div className="flex border-b border-white/10">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActive(key)}
            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold transition-all border-b-2 ${
              active === key
                ? "border-violet-500 text-white bg-violet-500/10"
                : "border-transparent text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
        <div className="ml-auto px-4 py-3 flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {active === "latex" && (
          <motion.div key="latex" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}
            className="p-5 space-y-4">
            {/* User question */}
            <div className="flex gap-3 justify-end">
              <div className="max-w-[80%] bg-gradient-to-br from-violet-600/30 to-fuchsia-600/20 border border-violet-500/25 rounded-2xl rounded-tr-sm px-4 py-3">
                <p className="text-sm text-white">Докажи формулу интегрирования по частям</p>
              </div>
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0 mt-auto">
                <User className="w-3.5 h-3.5 text-white" />
              </div>
            </div>

            {/* AI response with LaTeX */}
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex-1 bg-white/5 rounded-2xl rounded-tl-sm px-4 py-3 space-y-2">
                <p className="text-sm font-bold text-white">Интегрирование по частям — вывод из произведения</p>
                <p className="text-sm text-slate-300">Из формулы дифференциала произведения двух функций:</p>
                {/* Fake LaTeX block */}
                <div className="my-2 py-2 text-center font-mono text-base text-white bg-black/30 rounded-xl border border-white/10">
                  <span className="text-violet-300">d</span>(uv) = u·<span className="text-violet-300">d</span>v + v·<span className="text-violet-300">d</span>u
                </div>
                <p className="text-sm text-slate-300">Интегрируя обе части:</p>
                <div className="my-2 py-2 text-center font-mono text-base text-white bg-black/30 rounded-xl border border-white/10">
                  ∫u·<span className="text-violet-300">d</span>v = uv − ∫v·<span className="text-violet-300">d</span>u
                </div>
                <p className="text-sm text-slate-300">Это и есть <span className="text-white font-semibold">формула интегрирования по частям</span>.</p>
                {/* Code block */}
                <div className="mt-2 rounded-xl overflow-hidden border border-white/10">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 border-b border-white/10">
                    <span className="text-xs text-slate-500 font-mono">python · пример</span>
                  </div>
                  <pre className="bg-black/50 p-3 text-xs font-mono text-slate-200 leading-relaxed">
{`# ∫ x·eˣ dx — через scipy
from scipy.integrate import quad
import numpy as np
f = lambda x: x * np.exp(x)
result, _ = quad(f, 0, 1)
print(f"∫₀¹ x·eˣ dx = {result:.6f}")  # → 1.000000`}
                  </pre>
                </div>
                <div className="text-[10px] text-emerald-400 flex items-center gap-1 mt-1">
                  <CheckCircle2 className="w-3 h-3" /> Формулы отображаются напрямую в диалоге
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {active === "pptx" && (
          <motion.div key="pptx" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}
            className="p-5 space-y-3">
            {/* User request */}
            <div className="flex gap-3 justify-end">
              <div className="max-w-[80%] bg-gradient-to-br from-violet-600/30 to-fuchsia-600/20 border border-violet-500/25 rounded-2xl rounded-tr-sm px-4 py-2.5">
                <p className="text-sm text-white">Создай презентацию: Машинное обучение — основы для студентов. 10 слайдов</p>
              </div>
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0 mt-auto">
                <User className="w-3.5 h-3.5 text-white" />
              </div>
            </div>

            {/* Generated slides preview */}
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0 mt-1">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-xs text-slate-400">НейроЗачёт · генерирует 10 слайдов…</p>
                {[
                  { n: 1, title: "Введение в машинное обучение", bullets: ["Что такое МО?", "История и развитие", "Ключевые задачи"] },
                  { n: 2, title: "Типы алгоритмов", bullets: ["Обучение с учителем", "Без учителя", "С подкреплением"] },
                  { n: 3, title: "Применения МО", bullets: ["Распознавание изображений", "NLP и чат-боты", "Рекомендации"] },
                ].map((slide) => (
                  <div key={slide.n} className="rounded-xl overflow-hidden border border-violet-500/25 bg-black/20">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-600/15 border-b border-violet-500/20">
                      <div className="w-4 h-4 rounded flex items-center justify-center bg-violet-500/40 text-[9px] font-black text-violet-200">{slide.n}</div>
                      <span className="text-xs font-semibold text-white">{slide.title}</span>
                    </div>
                    <div className="px-3 py-2 flex gap-3">
                      <ul className="space-y-0.5 flex-1">
                        {slide.bullets.map((b, i) => (
                          <li key={i} className="text-xs text-slate-300 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-violet-400 shrink-0" />{b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
                {/* Download buttons */}
                <div className="flex gap-2 pt-1">
                  <div className="relative">
                    <div className="absolute -inset-1 rounded-lg bg-violet-500/25 animate-pulse" />
                    <div className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/20 border border-violet-500/50 cursor-pointer">
                      <Download className="w-3.5 h-3.5 text-violet-300" />
                      <span className="text-xs font-semibold text-violet-200">Скачать PPTX</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/8 border border-white/15 cursor-pointer">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-300">DOCX</span>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-center text-xs text-slate-500">8–12 слайдов · тёмный дизайн · 1 клик → PowerPoint</p>
          </motion.div>
        )}

        {active === "files" && (
          <motion.div key="files" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}
            className="p-5 space-y-4">
            {/* File drop zone mockup */}
            <div className="border border-dashed border-violet-500/40 rounded-xl bg-violet-500/5 p-4 flex flex-col items-center gap-2 text-center">
              <div className="flex gap-3 justify-center mb-1">
                {[
                  { ext: "PDF",  color: "bg-red-500/20 border-red-500/30 text-red-300" },
                  { ext: "DOCX", color: "bg-blue-500/20 border-blue-500/30 text-blue-300" },
                  { ext: "XLSX", color: "bg-emerald-500/20 border-emerald-500/30 text-emerald-300" },
                  { ext: "PPTX", color: "bg-orange-500/20 border-orange-500/30 text-orange-300" },
                  { ext: "TXT",  color: "bg-slate-500/20 border-slate-500/30 text-slate-300" },
                ].map(({ ext, color }) => (
                  <div key={ext} className={`w-10 h-12 rounded border flex flex-col items-center justify-end pb-1.5 ${color}`}>
                    <span className="text-[8px] font-black">{ext}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm font-semibold text-white">Перетащите любой файл</p>
              <p className="text-xs text-slate-400">PDF · Word · Excel · PowerPoint · TXT · CSV · код — до 50 МБ</p>
            </div>

            {/* Processing step */}
            <div className="flex gap-3 items-start">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3 space-y-2">
                <p className="text-sm font-semibold text-white">ИИ читает файл и решает задачу</p>
                {[
                  { label: "Извлечение текста", done: true },
                  { label: "Анализ содержимого", done: true },
                  { label: "Формирование решения", done: false },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {step.done
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      : <div className="w-3.5 h-3.5 rounded-full border border-violet-400/50 animate-pulse shrink-0" />}
                    <span className={step.done ? "text-slate-300" : "text-slate-400"}>{step.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-center text-xs text-slate-500">ИИ извлекает текст из файла · поддерживает таблицы и формулы</p>
          </motion.div>
        )}

        {active === "search" && (
          <motion.div key="search" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}
            className="p-5 space-y-4">
            {/* Search bar mockup */}
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <Search className="w-4 h-4 text-violet-400" />
              </div>
              <div className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-violet-500/40 text-sm text-white font-mono flex items-center gap-1">
                интеграл<span className="inline-block w-0.5 h-4 bg-violet-400 animate-pulse ml-0.5 rounded" />
              </div>
            </div>

            {/* Search results */}
            <div className="space-y-2">
              {[
                { cat: "Математический анализ", title: "Вычислить определённый интеграл", tags: ["интеграл", "LaTeX", "матанализ"], match: true },
                { cat: "Математический анализ", title: "Несобственный интеграл", tags: ["несобственный", "интеграл", "∞"], match: true },
                { cat: "Физика", title: "Интегральные задачи по механике", tags: ["интеграл", "механика", "физика"], match: true },
              ].map((r, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                  className="rounded-xl border border-white/10 bg-white/4 hover:bg-white/7 transition-all p-3 cursor-pointer">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-violet-400 font-semibold">{r.cat}</span>
                    {r.match && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">совпадение</span>}
                  </div>
                  <p className="text-sm font-semibold text-white mb-2">{r.title}</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {r.tags.map(t => (
                      <span key={t} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${t === "интеграл" ? "bg-violet-500/30 text-violet-200 border-violet-500/40" : "bg-white/8 text-slate-300 border-white/15"}`}>{t}</span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
            <p className="text-center text-xs text-slate-400">Поиск по предмету, названию, тегу и тексту шаблона — мгновенно</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { data: pricingPlans } = useGetPricingPlans();
  const [tab, setTab] = useState<"student" | "school">("student");
  const [welcomeBonus, setWelcomeBonus] = useState<number>(100);
  const [announcement, setAnnouncement] = useState<string>("");
  useEffect(() => {
    const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
    fetch(`${base}/api/public/settings`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          if (typeof d.welcomeBonus === "number") setWelcomeBonus(d.welcomeBonus);
          if (typeof d.announcement === "string") setAnnouncement(d.announcement);
        }
      })
      .catch(() => {});
  }, []);
  const bonusLabel = welcomeBonus > 0 ? `${welcomeBonus} ₽` : null;

  return (
    <div className="min-h-screen bg-[#09091a] text-white">

      {/* ── BACKGROUND ── */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Fine grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:50px_50px]" />
        {/* Glows */}
        <div className="absolute -top-32 left-[15%] w-[600px] h-[600px] rounded-full bg-violet-600/20 blur-[130px]" />
        <div className="absolute top-[50%] right-[-5%] w-[450px] h-[450px] rounded-full bg-blue-600/15 blur-[100px]" />
        <div className="absolute bottom-0 left-[40%] w-[400px] h-[400px] rounded-full bg-indigo-600/10 blur-[100px]" />
      </div>

      <PublicNavbar />

      <main className="relative z-10">

        {/* ═══════════════ HERO ═══════════════ */}
        <section className="min-h-screen flex flex-col items-center justify-center text-center px-4 pt-20 sm:pt-28 pb-12 sm:pb-16">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto w-full">

            {/* Pill */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/40 bg-violet-500/10 text-violet-300 text-xs sm:text-sm font-semibold mb-6 sm:mb-8">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Новое поколение ИИ-помощника для учёбы
            </motion.div>

            {/* Headline */}
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="text-[2.4rem] leading-[1.05] sm:text-7xl md:text-8xl font-black tracking-tight mb-5 sm:mb-6">
              Реши{" "}
              <span className="relative">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400">любое</span>
                <svg className="absolute -bottom-1 sm:-bottom-2 left-0 w-full" height="6" viewBox="0 0 200 6" fill="none">
                  <path d="M0 3 Q50 0 100 3 Q150 6 200 3" stroke="url(#g)" strokeWidth="2.5" fill="none" />
                  <defs><linearGradient id="g" x1="0" y1="0" x2="200" y2="0">
                    <stop offset="0%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#ec4899" />
                  </linearGradient></defs>
                </svg>
              </span>
              <br />
              <span className="text-white">учебное задание</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="text-base sm:text-xl text-slate-300 mb-4 max-w-2xl mx-auto leading-relaxed px-2 sm:px-0">
              НейроЗачёт — AI-платформа для студентов и школьников. Математика, физика, химия, информатика, ЕГЭ — пошаговые объяснения и мгновенные ответы.
            </motion.p>

            {/* Audience badges */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
              className="flex flex-wrap gap-1.5 sm:gap-2 justify-center mb-7 sm:mb-10">
              {[
                { text: "Студенты ВУЗов", icon: GraduationCap, color: "text-violet-300 border-violet-500/30 bg-violet-500/10" },
                { text: "Школьники ЕГЭ/ОГЭ", icon: School, color: "text-blue-300 border-blue-500/30 bg-blue-500/10" },
                { text: "Аспиранты", icon: BookOpen, color: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" },
              ].map(({ text, icon: Icon, color }) => (
                <span key={text} className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full border text-[11px] sm:text-xs font-semibold ${color}`}>
                  <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />{text}
                </span>
              ))}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-4 px-0 sm:px-0">
              <Link href="/register" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-10 text-sm sm:text-base font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 text-white shadow-[0_0_40px_rgba(139,92,246,0.5)] hover:shadow-[0_0_60px_rgba(139,92,246,0.6)] transition-all">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  <span className="sm:hidden">{bonusLabel ? `Начать бесплатно · ${bonusLabel} бонус` : "Начать бесплатно"}</span>
                  <span className="hidden sm:inline">{bonusLabel ? `Начать бесплатно — ${bonusLabel} в подарок` : "Начать бесплатно"}</span>
                </Button>
              </Link>
              <Link href="/hints" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-8 text-sm sm:text-base font-semibold border-white/25 bg-white/8 hover:bg-white/14 text-white hover:text-white">
                  <Lightbulb className="w-4 h-4 mr-2 text-amber-400" />
                  Примеры заданий
                </Button>
              </Link>
            </motion.div>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
              className="text-xs sm:text-sm text-slate-400 px-4 sm:px-0">
              {`Без подписки · Платите только за использование${bonusLabel ? ` · ${bonusLabel} бонус при регистрации` : ""}`}
            </motion.p>

            {/* Stats row */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
              className="mt-10 sm:mt-16 pt-6 sm:pt-8 border-t border-white/8 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
              {[
                { val: "12,000+", sub: "задач решено", color: "text-violet-300" },
                { val: "95%", sub: "точность ответов", color: "text-fuchsia-300" },
                { val: "< 30 сек", sub: "среднее время", color: "text-blue-300" },
                { val: "24/7", sub: "работает всегда", color: "text-emerald-300" },
              ].map((s, i) => (
                <div key={i}>
                  <div className={`text-2xl sm:text-4xl font-black ${s.color}`}>{s.val}</div>
                  <div className="text-xs sm:text-sm text-slate-400 mt-0.5">{s.sub}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </section>

        {/* ═══════════════ WHAT'S NEW STRIP ═══════════════ */}
        <section className="py-4 px-4 border-y border-violet-500/20 bg-violet-500/5 overflow-hidden">
          <div className="container mx-auto max-w-6xl">
            <div className="flex items-center gap-4 overflow-x-auto scrollbar-none py-1 sm:justify-center sm:flex-wrap">
              <span className="shrink-0 text-xs font-black text-violet-300 uppercase tracking-wider border border-violet-500/40 bg-violet-500/15 px-2.5 py-1 rounded-full">Новое</span>
              {[
                { icon: Sigma,    text: "LaTeX-формулы в диалоге",       color: "text-violet-300 border-violet-500/30 bg-violet-500/10" },
                { icon: Layers,   text: "PPTX-презентации за 1 запрос",  color: "text-pink-300 border-pink-500/30 bg-pink-500/10" },
                { icon: Upload,   text: "Word · PDF · Excel → ИИ читает", color: "text-cyan-300 border-cyan-500/30 bg-cyan-500/10" },
                { icon: FileDown, text: "Экспорт DOCX одной кнопкой",    color: "text-fuchsia-300 border-fuchsia-500/30 bg-fuchsia-500/10" },
                { icon: Search,   text: "Поиск по 12 предметам",          color: "text-amber-300 border-amber-500/30 bg-amber-500/10" },
                { icon: Cpu,      text: "5 моделей ИИ на выбор",          color: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" },
                { icon: Library,  text: "Загрузка учебника PDF",          color: "text-blue-300 border-blue-500/30 bg-blue-500/10" },
                { icon: Lock,     text: "Восстановление пароля",          color: "text-slate-300 border-slate-500/30 bg-slate-500/10" },
              ].map(({ icon: Icon, text, color }, i) => (
                <div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap shrink-0 ${color}`}>
                  <Icon className="w-3.5 h-3.5" />
                  {text}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════ FOR WHOM ═══════════════ */}
        <section className="py-20 px-4 border-y border-white/8 bg-white/2">
          <div className="container mx-auto max-w-5xl">
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl font-black mb-3 text-white">Для кого НейроЗачёт?</h2>
              <p className="text-slate-300 text-lg">Нажмите на карточку, чтобы узнать больше</p>
            </div>

            {/* Toggle */}
            <div className="flex justify-center gap-2 mb-10">
              {(["student", "school"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all border ${
                    tab === t
                      ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 border-transparent text-white shadow-[0_0_20px_rgba(139,92,246,0.4)]"
                      : "border-white/20 text-slate-300 bg-white/5 hover:bg-white/10 hover:text-white"
                  }`}>
                  {t === "student" ? "🎓 Студенты ВУЗов" : "📚 Школьники"}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {tab === "student" ? (
                <motion.div key="student" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { icon: Hash, title: "Онлайн-тест из 30 вопр.", desc: "Купили пакет на 30 вопросов — вводите по одному и получаете мгновенный ответ в чате.", color: "from-violet-500/20 to-violet-500/5 border-violet-500/30" },
                    { icon: Code2, title: "Лабораторные по программированию", desc: "Объяснение кода, поиск ошибок, написание алгоритмов — с разбором каждого шага.", color: "from-blue-500/20 to-blue-500/5 border-blue-500/30" },
                    { icon: Calculator, title: "Высшая математика", desc: "Пределы, интегралы, дифференциальные уравнения, линейная алгебра — пошаговые решения.", color: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/30" },
                    { icon: Atom, title: "Физика и техника", desc: "Задачи по механике, термодинамике, электромагнетизму с проверкой размерностей.", color: "from-amber-500/20 to-amber-500/5 border-amber-500/30" },
                    { icon: BarChart2, title: "Экономика и статистика", desc: "Микро/макроэкономика, эконометрика, расчёты, графики — всё с теорией.", color: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30" },
                    { icon: Scale, title: "Право и гуманитарные", desc: "Эссе, рефераты, правовой анализ, исторические факты — точно и по источникам.", color: "from-rose-500/20 to-rose-500/5 border-rose-500/30" },
                  ].map((c, i) => (
                    <div key={i} className={`bg-gradient-to-br ${c.color} border rounded-2xl p-5`}>
                      <c.icon className="w-6 h-6 text-white mb-3 opacity-80" />
                      <h3 className="font-bold text-white mb-2">{c.title}</h3>
                      <p className="text-sm text-slate-300 leading-relaxed">{c.desc}</p>
                    </div>
                  ))}
                </motion.div>
              ) : (
                <motion.div key="school" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { icon: BookMarked, title: "Подготовка к ЕГЭ", desc: "Задачи профильной и базовой математики, физики, химии — оформленные по критериям ЕГЭ.", color: "from-red-500/20 to-red-500/5 border-red-500/30" },
                    { icon: Pencil, title: "Подготовка к ОГЭ", desc: "9 класс — алгебра, геометрия, информатика, обществознание. Разбор типовых вариантов.", color: "from-orange-500/20 to-orange-500/5 border-orange-500/30" },
                    { icon: Calculator, title: "Алгебра и геометрия", desc: "Уравнения, функции, планиметрия, стереометрия — всё с чертежами (текстом).", color: "from-yellow-500/20 to-yellow-500/5 border-yellow-500/30" },
                    { icon: FlaskConical, title: "Химия и биология", desc: "Уравнения реакций, органика, клетки и ткани — школьный курс под контроль.", color: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30" },
                    { icon: Languages, title: "Русский и английский", desc: "Сочинения, изложения, перевод, грамматика. Стиль по критериям ЕГЭ/ОГЭ.", color: "from-blue-500/20 to-blue-500/5 border-blue-500/30" },
                    { icon: Code2, title: "Информатика", desc: "Алгоритмы, Pascal/Python, системы счисления, базы данных — школьный курс.", color: "from-violet-500/20 to-violet-500/5 border-violet-500/30" },
                  ].map((c, i) => (
                    <div key={i} className={`bg-gradient-to-br ${c.color} border rounded-2xl p-5`}>
                      <c.icon className="w-6 h-6 text-white mb-3 opacity-80" />
                      <h3 className="font-bold text-white mb-2">{c.title}</h3>
                      <p className="text-sm text-slate-300 leading-relaxed">{c.desc}</p>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* ═══════════════ DEMO ═══════════════ */}
        <section id="demo" className="py-24 px-4">
          <div className="container mx-auto max-w-4xl">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="text-center mb-12">
              <Badge className="border-violet-500/40 bg-violet-500/10 text-violet-300 mb-4 font-semibold">
                <Terminal className="w-3.5 h-3.5 mr-1.5" /> Живое демо
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Посмотрите, как это работает</h2>
              <p className="text-slate-300 text-lg max-w-xl mx-auto">Выберите предмет — без регистрации, прямо здесь.</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}>
              <LiveDemo />
            </motion.div>
            <div className="text-center mt-8">
              <p className="text-slate-400 mb-5">{`Хотите задать свой вопрос? Регистрация — 30 секунд${bonusLabel ? `, ${bonusLabel} сразу на счёт` : ""}.`}</p>
              <Link href="/register">
                <Button className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 text-white font-bold shadow-[0_0_30px_rgba(139,92,246,0.4)]">
                  Задать свой вопрос <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ═══════════════ SESSION PACKAGES ═══════════════ */}
        <section className="py-24 px-4 border-y border-white/8 bg-white/2">
          <div className="container mx-auto max-w-5xl">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="text-center mb-14">
              <Badge className="border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300 mb-4 font-semibold">
                <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Режим чата
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Онлайн-тест из 30 вопросов?<br/>Просто купите пакет</h2>
              <p className="text-slate-300 text-lg max-w-2xl mx-auto">Не надо делать 30 отдельных заказов. Купите пакет вопросов и решайте тест в режиме чата — по одному вопросу, сразу получаете ответ.</p>
            </motion.div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
              {[
                { label: "Мини", q: "5 вопросов", price: "59 ₽", color: "border-blue-500/30 bg-blue-500/8 text-blue-300" },
                { label: "ДЗ", q: "10 вопросов", price: "99 ₽", color: "border-emerald-500/30 bg-emerald-500/8 text-emerald-300" },
                { label: "Стандарт", q: "15 вопросов", price: "149 ₽", color: "border-violet-500/30 bg-violet-500/8 text-violet-300", badge: "★" },
                { label: "Тест", q: "30 вопросов", price: "249 ₽", color: "border-orange-500/30 bg-orange-500/8 text-orange-300" },
                { label: "Экзамен", q: "50 вопросов", price: "349 ₽", color: "border-rose-500/30 bg-rose-500/8 text-rose-300" },
                { label: "Безлимит", q: "∞ / 3 часа", price: "399 ₽", color: "border-cyan-500/30 bg-cyan-500/8 text-cyan-300" },
              ].map((p, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                  className={`relative border rounded-xl p-4 text-center ${p.color}`}>
                  {p.badge && <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-violet-500 text-white text-[10px] flex items-center justify-center font-bold">★</div>}
                  <div className="font-black text-base mb-1">{p.label}</div>
                  <div className="text-xs font-semibold opacity-80 mb-2">{p.q}</div>
                  <div className="text-lg font-black">{p.price}</div>
                </motion.div>
              ))}
            </div>

            {/* How it works steps */}
            <div className="bg-white/4 border border-white/10 rounded-2xl p-6 md:p-8">
              <h3 className="font-black text-white text-lg text-center mb-6">Как это работает — за 4 шага</h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {[
                  { n: "01", text: "Выберите предмет и название сессии" },
                  { n: "02", text: "Купите пакет — баланс спишется автоматически" },
                  { n: "03", text: "Откроется чат — вводите вопросы по одному" },
                  { n: "04", text: "Получаете ответ мгновенно, счётчик уменьшается" },
                ].map((s, i) => (
                  <div key={i} className="flex flex-col items-center text-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center font-black text-white text-sm">
                      {s.n}
                    </div>
                    <p className="text-sm text-slate-300 font-medium leading-snug">{s.text}</p>
                    {i < 3 && <ChevronRight className="hidden sm:block text-slate-600 rotate-0 mt-[-2rem] ml-auto -mr-5" />}
                  </div>
                ))}
              </div>
            </div>

            <div className="text-center mt-8">
              <Link href="/register">
                <Button size="lg" className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 text-white font-bold shadow-[0_0_30px_rgba(139,92,246,0.35)]">
                  <MessageSquare className="w-5 h-5 mr-2" /> Начать сессию
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ═══════════════ FEATURES ═══════════════ */}
        <section id="how-it-works" className="py-24 px-4">
          <div className="container mx-auto max-w-5xl">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Всё включено</h2>
              <p className="text-slate-300 text-lg">Не просто ответ — полноценный инструмент для учёбы.</p>
            </motion.div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                { icon: Sigma,        color: "text-violet-400 bg-violet-500/15 border-violet-500/25", title: "LaTeX-формулы в чате",         desc: "Математические формулы, матрицы, интегралы рендерятся прямо в диалоге. Красиво и читаемо.",                       badge: "✨ Новое" },
                { icon: Layers,       color: "text-pink-400 bg-pink-500/15 border-pink-500/25",       title: "Презентации PPTX за 1 запрос", desc: "ИИ генерирует 8–12 слайдов с тёмным дизайном. Скачайте в PowerPoint или Word одной кнопкой.",                  badge: "🎉 Новое" },
                { icon: Upload,       color: "text-cyan-400 bg-cyan-500/15 border-cyan-500/25",       title: "Загрузка файлов: Word · PDF · Excel", desc: "Прикрепите учебник, задание или таблицу — ИИ прочитает и решит с учётом содержимого документа.", badge: "🔥 Новое" },
                { icon: FileDown,     color: "text-fuchsia-400 bg-fuchsia-500/15 border-fuchsia-500/25", title: "Экспорт DOCX одной кнопкой", desc: "Сохраните решение задачи или переписку сессии в Word-документ с форматированием.",                       badge: "✨ Новое" },
                { icon: MessageSquare, color: "text-blue-400 bg-blue-500/15 border-blue-500/25",     title: "Режим чата",                   desc: "Пакеты вопросов для онлайн-тестов и ДЗ. Вопрос → ответ → следующий, без лишних шагов.",                       badge: "Хит" },
                { icon: Search,       color: "text-amber-400 bg-amber-500/15 border-amber-500/25",    title: "Умный поиск по шаблонам",     desc: "Мгновенный поиск среди 12+ предметов и десятков шаблонов по тегам, названию и содержанию.",                   badge: "✨ Обновлено" },
                { icon: Cpu,          color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/25", title: "5 моделей ИИ на выбор",    desc: "GPT-4o, Claude 3.5 Sonnet, Gemini 2.0 Flash, DeepSeek-V3, Grok. Каждая с уникальными сильными сторонами." },
                { icon: BookMarked,   color: "text-orange-400 bg-orange-500/15 border-orange-500/25", title: "Экзаменационный режим",       desc: "Отметьте сессию как «Экзамен». Таймер, строгий режим без подсказок — готовьтесь эффективно.",              badge: "🆕 Обновлено" },
                { icon: Users,        color: "text-teal-400 bg-teal-500/15 border-teal-500/25",       title: "Реферальная программа",       desc: "Приглашайте друзей и получайте бонусы на баланс. Ваша персональная ссылка — в профиле.",                    badge: "🎁 Новое" },
              ].map((f, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                  className="group bg-white/4 border border-white/10 rounded-2xl p-5 hover:bg-white/7 hover:border-white/20 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${f.color}`}>
                      <f.icon className="w-5 h-5" />
                    </div>
                    {f.badge && (
                      <Badge className={`text-xs border ${f.badge.includes("Новое") || f.badge.includes("Обновлено") ? "bg-violet-500/15 border-violet-500/30 text-violet-300" : "bg-white/10 border-white/15 text-slate-300"}`}>
                        {f.badge}
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-bold text-white text-base mb-2 group-hover:text-violet-300 transition-colors">{f.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════ POWER TOOLS ═══════════════ */}
        <section className="py-24 px-4 border-y border-white/8 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-[20%] top-[-10%] w-[600px] h-[600px] bg-violet-600/6 blur-[120px] rounded-full" />
            <div className="absolute right-[10%] bottom-[-10%] w-[400px] h-[400px] bg-fuchsia-600/6 blur-[100px] rounded-full" />
          </div>
          <div className="container mx-auto max-w-6xl relative">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

              {/* Left: text */}
              <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
                <Badge className="border-violet-500/40 bg-violet-500/10 text-violet-300 mb-5 font-semibold text-sm">
                  <Wand2 className="w-3.5 h-3.5 mr-1.5" /> Профессиональные инструменты
                </Badge>
                <h2 className="text-3xl sm:text-4xl font-black text-white mb-5 leading-tight">
                  Инструменты, которых<br/>
                  <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">нет у конкурентов</span>
                </h2>
                <p className="text-slate-300 text-lg leading-relaxed mb-8">
                  Инструменты, которые выводят учёбу на новый уровень: формулы в диалоге, презентации PPTX, загрузка документов Word/PDF/Excel и экспорт DOCX.
                </p>

                <div className="space-y-4">
                  {[
                    {
                      icon: Sigma, color: "text-violet-400 bg-violet-500/15 border-violet-500/25",
                      title: "LaTeX и код в чате",
                      desc: "Формулы, матрицы, интегралы рендерятся прямо в переписке — не нужно открывать LaTeX-редактор."
                    },
                    {
                      icon: Layers, color: "text-pink-400 bg-pink-500/15 border-pink-500/25",
                      title: "Презентации PPTX",
                      desc: "Тип задачи «Презентация» → ИИ генерирует 8–12 слайдов → скачать PowerPoint одним кликом."
                    },
                    {
                      icon: Upload, color: "text-cyan-400 bg-cyan-500/15 border-cyan-500/25",
                      title: "Загрузка Word · PDF · Excel",
                      desc: "Прикрепите учебник, задание или таблицу — ИИ читает файл и учитывает его при решении."
                    },
                    {
                      icon: FileDown, color: "text-fuchsia-400 bg-fuchsia-500/15 border-fuchsia-500/25",
                      title: "Экспорт DOCX за 1 клик",
                      desc: "Решение задачи или переписка сессии — в Word-документ с форматированием и структурой."
                    },
                  ].map((item, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -15 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }}
                      className="flex items-start gap-4 group">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${item.color}`}>
                        <item.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm mb-1 group-hover:text-violet-300 transition-colors">{item.title}</h4>
                        <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-8">
                  <Link href="/register">
                    <Button size="lg" className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 text-white font-bold shadow-[0_0_30px_rgba(139,92,246,0.35)]">
                      <Sparkles className="w-5 h-5 mr-2" /> Попробовать бесплатно
                    </Button>
                  </Link>
                </div>
              </motion.div>

              {/* Right: interactive demo */}
              <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }}>
                <PowerToolsShowcase />
              </motion.div>
            </div>
          </div>
        </section>

        {/* ═══════════════ KNOWLEDGE BASE / TEXTBOOK UPLOAD ═══════════════ */}
        <section className="py-28 px-4 relative overflow-hidden">
          {/* Background glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-blue-600/8 blur-[120px] rounded-full" />
          </div>
          <div className="container mx-auto max-w-6xl relative">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

              {/* Left: description */}
              <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
                <Badge className="border-blue-500/40 bg-blue-500/10 text-blue-300 mb-5 font-semibold text-sm">
                  <Library className="w-3.5 h-3.5 mr-1.5" /> Загрузка учебника
                </Badge>
                <h2 className="text-3xl sm:text-4xl font-black text-white mb-5 leading-tight">
                  Решай расчётки<br/>
                  <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">точно по учебнику</span><br/>
                  своего преподавателя
                </h2>
                <p className="text-slate-300 text-lg leading-relaxed mb-6">
                  Каждый профессор требует определённый формат оформления. Загрузите PDF рекомендованной литературы — ИИ изучит нотацию, стиль и структуру задач именно этого учебника и оформит решение <span className="text-white font-semibold">так, как ожидает ваш преподаватель.</span>
                </p>
                <div className="space-y-3 mb-8">
                  {[
                    { icon: CheckCircle2, color: "text-emerald-400", text: "Контекст учебника — для всей сессии, не только одного вопроса" },
                    { icon: CheckCircle2, color: "text-emerald-400", text: "Нотация, обозначения и стиль оформления из вашего учебника" },
                    { icon: CheckCircle2, color: "text-emerald-400", text: "ИИ ссылается на нужные теоремы и формулы из вашей книги" },
                    { icon: CheckCircle2, color: "text-emerald-400", text: "Поддержка PDF до 50 МБ — учебники, методички, лекции" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <item.icon className={`w-5 h-5 ${item.color} shrink-0 mt-0.5`} />
                      <span className="text-slate-300 text-base">{item.text}</span>
                    </div>
                  ))}
                </div>
                <Link href="/register">
                  <Button size="lg" className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 border-0 text-white font-bold shadow-[0_0_30px_rgba(37,99,235,0.35)]">
                    <Upload className="w-5 h-5 mr-2" /> Попробовать бесплатно
                  </Button>
                </Link>
              </motion.div>

              {/* Right: UI mockup */}
              <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }}>
                <div className="rounded-2xl bg-[#0d0f1f] border border-white/10 overflow-hidden shadow-2xl shadow-blue-900/20">
                  {/* Window chrome */}
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8 bg-white/3">
                    <div className="w-3 h-3 rounded-full bg-red-500/70" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                    <div className="w-3 h-3 rounded-full bg-green-500/70" />
                    <span className="ml-3 text-xs text-slate-500 font-mono">НейроЗачёт — Сессия: Термодинамика</span>
                  </div>

                  {/* Session header with document badge */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-white/2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">Физика. Термодинамика. Расчётка №3</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30">
                      <FileCheck2 className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-xs text-blue-300 font-medium">Нащокин — Учебник.pdf</span>
                    </div>
                  </div>

                  <div className="p-5 space-y-4">
                    {/* Upload zone */}
                    <div className="rounded-xl border-2 border-dashed border-blue-500/40 bg-blue-500/5 p-5 text-center">
                      <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-3">
                        <Upload className="w-5 h-5 text-blue-400" />
                      </div>
                      <p className="text-sm font-semibold text-white mb-1">Перетащите PDF учебника или методички</p>
                      <p className="text-xs text-slate-400 mb-3">Нащокин, Кириллин, Сонин, Алексеев — любой рекомендованный учебник</p>
                      <div className="flex items-center gap-1.5 justify-center px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 w-fit mx-auto">
                        <FileCheck2 className="w-3.5 h-3.5 text-green-400" />
                        <span className="text-xs text-green-300 font-medium">Нащокин_Техническая_Термодинамика.pdf · 8.2 МБ</span>
                      </div>
                    </div>

                    {/* Context message from AI */}
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shrink-0 mt-0.5">
                        <BrainCircuit className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="flex-1 bg-white/5 rounded-2xl rounded-tl-sm px-4 py-3">
                        <p className="text-xs text-blue-300 font-semibold mb-1.5">НейроЗачёт · Контекст учебника загружен</p>
                        <p className="text-sm text-slate-200 leading-relaxed">
                          Учебник Нащокина «Техническая термодинамика» загружен как контекст сессии. Все решения будут оформлены в нотации этого учебника: обозначения величин, стиль записи формул и структура решения.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {["Гл. 4: Процессы идеального газа", "Прил. A: Таблицы свойств", "§12: Цикл Карно"].map(t => (
                            <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/25 text-blue-300">{t}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* User question */}
                    <div className="flex gap-3 justify-end">
                      <div className="max-w-[80%] bg-gradient-to-br from-blue-600/30 to-cyan-600/20 border border-blue-500/25 rounded-2xl rounded-tr-sm px-4 py-3">
                        <p className="text-sm text-white leading-relaxed">Задача 4.12 из учебника — изобарный процесс. m = 2 кг воздуха, T₁ = 300 К, T₂ = 600 К. Найти Q, A, ΔU по формулам Нащокина.</p>
                      </div>
                    </div>

                    {/* AI answer */}
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shrink-0 mt-0.5">
                        <BrainCircuit className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="flex-1 bg-white/5 rounded-2xl rounded-tl-sm px-4 py-3">
                        <p className="text-xs text-slate-400 font-medium mb-1.5">Решение в формате Нащокина (§4.3)</p>
                        <p className="text-sm text-slate-200 leading-relaxed">
                          <span className="text-blue-300 font-semibold">Дано:</span> m = 2 кг, T₁ = 300 К, T₂ = 600 К, p = const<br/>
                          <span className="text-blue-300 font-semibold">По формуле (4.18):</span> Q = m·cₚ·(T₂−T₁) = 2 · 1,005 · 300 = <span className="text-white font-bold">603 кДж</span>
                        </p>
                        <div className="mt-2 text-[10px] text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Формат соответствует стилю учебника
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ═══════════════ SUBJECTS ═══════════════ */}
        <section id="subjects" className="py-24 px-4 border-y border-white/8 bg-white/2">
          <div className="container mx-auto max-w-5xl">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">12 предметов и дисциплин</h2>
              <p className="text-slate-300 text-lg">От точных наук до гуманитарных. Школа и ВУЗ.</p>
            </motion.div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {[
                { n: "Математика", icon: Calculator, bg: "from-blue-600/25 to-blue-600/5", border: "border-blue-500/30", text: "text-blue-200" },
                { n: "Информатика", icon: Code2, bg: "from-violet-600/25 to-violet-600/5", border: "border-violet-500/30", text: "text-violet-200" },
                { n: "Физика", icon: Atom, bg: "from-amber-600/25 to-amber-600/5", border: "border-amber-500/30", text: "text-amber-200" },
                { n: "Химия", icon: FlaskConical, bg: "from-emerald-600/25 to-emerald-600/5", border: "border-emerald-500/30", text: "text-emerald-200" },
                { n: "Экономика", icon: TrendingUp, bg: "from-cyan-600/25 to-cyan-600/5", border: "border-cyan-500/30", text: "text-cyan-200" },
                { n: "Право", icon: Scale, bg: "from-rose-600/25 to-rose-600/5", border: "border-rose-500/30", text: "text-rose-200" },
                { n: "Английский", icon: Globe, bg: "from-indigo-600/25 to-indigo-600/5", border: "border-indigo-500/30", text: "text-indigo-200" },
                { n: "История", icon: BookOpen, bg: "from-yellow-600/25 to-yellow-600/5", border: "border-yellow-500/30", text: "text-yellow-200" },
                { n: "Биология", icon: Microscope, bg: "from-lime-600/25 to-lime-600/5", border: "border-lime-500/30", text: "text-lime-200" },
                { n: "Статистика", icon: BarChart2, bg: "from-fuchsia-600/25 to-fuchsia-600/5", border: "border-fuchsia-500/30", text: "text-fuchsia-200" },
                { n: "Русский язык", icon: Pencil, bg: "from-orange-600/25 to-orange-600/5", border: "border-orange-500/30", text: "text-orange-200" },
                { n: "Литература", icon: BookMarked, bg: "from-pink-600/25 to-pink-600/5", border: "border-pink-500/30", text: "text-pink-200" },
              ].map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}
                  whileHover={{ scale: 1.05 }}
                  className={`bg-gradient-to-br ${s.bg} border ${s.border} rounded-xl p-4 flex flex-col items-center gap-2 group cursor-default`}>
                  <s.icon className={`w-5 h-5 ${s.text} group-hover:scale-110 transition-transform`} />
                  <span className={`text-xs text-center font-semibold leading-tight ${s.text}`}>{s.n}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════ PUBLIC ACCESS ═══════════════ */}
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-4xl">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">Бесплатно и без регистрации</h2>
              <p className="text-slate-300">Загляните в раздел подсказок прямо сейчас — без регистрации.</p>
            </motion.div>
            <div className="grid grid-cols-1 max-w-xl mx-auto gap-5">
              <Link href="/hints">
                <motion.div whileHover={{ y: -4 }} className="group border border-violet-500/30 bg-gradient-to-br from-violet-600/15 to-violet-600/5 rounded-2xl p-6 cursor-pointer">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
                      <Lightbulb className="w-6 h-6 text-violet-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-black text-white text-lg">Подсказки</h3>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Бесплатно</span>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">Шаблоны запросов, советы и конструктор вопросов.</p>
                      <div className="flex items-center gap-1 text-violet-300 text-sm font-bold mt-3 group-hover:gap-2 transition-all">
                        Открыть <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              </Link>
            </div>
          </div>
        </section>

        {/* ═══════════════ PRICING ═══════════════ */}
        <section id="pricing" className="py-24 px-4 border-y border-white/8 bg-white/2">
          <div className="container mx-auto max-w-5xl">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
              <Badge className="border-violet-500/40 bg-violet-500/10 text-violet-300 mb-4 font-semibold">Тарифы</Badge>
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Никаких подписок</h2>
              <p className="text-slate-300 text-lg max-w-xl mx-auto">Пополните баланс и платите только за то, что используете.</p>
            </motion.div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {pricingPlans ? (
                Object.entries(pricingPlans).map(([key, plan]: any, i) => (
                  <motion.div key={key} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                    className={`relative rounded-2xl p-6 flex flex-col ${plan.recommended
                      ? "border border-violet-500/50 bg-gradient-to-b from-violet-500/15 to-violet-500/5 shadow-[0_0_40px_rgba(139,92,246,0.2)]"
                      : "border border-white/10 bg-white/4"}`}>
                    {plan.recommended && (
                      <div className="absolute -top-3 inset-x-0 flex justify-center">
                        <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-xs font-black px-4 py-1 rounded-full">⭐ Рекомендуем</span>
                      </div>
                    )}
                    <h3 className="text-xl font-black text-white mb-1">{plan.name}</h3>
                    <p className="text-sm text-slate-400 mb-4">{plan.description}</p>
                    <div className="text-4xl font-black text-white mb-1">от {plan.priceFrom} ₽</div>
                    <div className="flex items-center gap-1.5 text-sm text-slate-400 mb-5">
                      <Clock className="w-4 h-4" />{plan.timeFrom}–{plan.timeTo} мин.
                    </div>
                    <ul className="space-y-2.5 flex-1 mb-6">
                      {plan.features.map((f: string, fi: number) => (
                        <li key={fi} className="flex items-start gap-2 text-sm text-slate-300">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />{f}
                        </li>
                      ))}
                    </ul>
                    <Link href="/register">
                      <Button className={`w-full font-bold ${plan.recommended
                        ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 text-white shadow-[0_0_20px_rgba(139,92,246,0.4)]"
                        : "bg-white/10 hover:bg-white/15 text-white border-white/15"}`}>
                        Попробовать
                      </Button>
                    </Link>
                  </motion.div>
                ))
              ) : [1,2,3].map(i => <div key={i} className="rounded-2xl h-96 bg-white/5 animate-pulse" />)}
            </div>
          </div>
        </section>

        {/* ═══════════════ TESTIMONIALS ═══════════════ */}
        <section className="py-24 px-4">
          <div className="container mx-auto max-w-5xl">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-black text-white">Что говорят пользователи</h2>
            </motion.div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                { name: "Александр В.", role: "ВШЭ · Информатика", stars: 5, text: "Онлайн-тест из 30 вопросов по алгоритмам решил за 25 минут. Купил пакет, открыл чат — и просто вводил вопросы. Никакой мороки.", color: "border-violet-500/20 from-violet-900/20" },
                { name: "Маша К.", role: "11 класс · ЕГЭ Математика", stars: 5, text: "Готовлюсь к ЕГЭ — все задачи разобраны пошагово, прямо как в учебнике, только быстрее. Балл на пробнике вырос с 62 до 78!", color: "border-red-500/20 from-red-900/20" },
                { name: "Денис Р.", role: "Магистрант · Экономика", stars: 5, text: "Эконометрика — боль. Но с НейроЗачётом даже расчёты регрессий стали понятными. Отличное объяснение каждого шага.", color: "border-amber-500/20 from-amber-900/20" },
              ].map((t, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className={`bg-gradient-to-b ${t.color} to-transparent border ${t.color.split(' ')[0]} rounded-2xl p-6`}>
                  <div className="flex text-yellow-400 mb-3">
                    {Array.from({ length: t.stars }).map((_, s) => <Star key={s} className="w-4 h-4 fill-current" />)}
                  </div>
                  <p className="text-sm text-slate-200 italic mb-5 leading-relaxed">"{t.text}"</p>
                  <div>
                    <div className="font-black text-white text-sm">{t.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{t.role}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════ FAQ ═══════════════ */}
        <section id="faq" className="py-24 px-4 border-t border-white/8 bg-white/2">
          <div className="container mx-auto max-w-2xl">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-black text-white">Частые вопросы</h2>
            </motion.div>
            <Accordion type="single" collapsible>
              {[
                { q: "Что такое режим сессии?", a: "Вы покупаете пакет вопросов (5, 10, 15, 30, 50 или безлимит на 3 часа) и общаетесь с ИИ в чате — задаёте вопросы по одному. Идеально для онлайн-тестов или ДЗ из нескольких задач." },
                { q: "Нужна ли подписка?", a: `Нет. Пополняете баланс — тратите только на то, что используете.${bonusLabel ? ` При регистрации сразу начисляется ${bonusLabel} на баланс.` : ""}` },
                { q: "Работает для ЕГЭ и ОГЭ?", a: "Да. Система знает формат ЕГЭ/ОГЭ и оформляет ответы с пояснениями в стиле критериев оценивания. Математика, физика, химия, информатика, русский язык." },
                { q: "Чем Стандарт отличается от Быстрого?", a: "Быстрый (от 9 ₽) — лёгкие модели, для простых тестов. Стандарт (от 15 ₽) — более точные модели с разбором. Премиум (от 25 ₽) — ансамбль моделей с кросс-верификацией." },
                { q: "Что если ответ будет неверным?", a: "Нажмите «Сообщить об ошибке» — проверим. При подтверждении — вернём средства на баланс." },
              ].map((item, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="border-white/10">
                  <AccordionTrigger className="text-left text-white hover:text-violet-300 font-semibold transition-colors">{item.q}</AccordionTrigger>
                  <AccordionContent className="text-slate-300 leading-relaxed">{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* ═══════════════ FINAL CTA ═══════════════ */}
        <section className="py-32 px-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-violet-900/20 to-fuchsia-900/10" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-violet-600/15 blur-[120px] rounded-full" />
          <div className="container mx-auto max-w-3xl relative z-10 text-center">
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <div className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight mb-6 text-white">
                Начни учиться{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400">умнее</span>
              </div>
              <p className="text-xl text-slate-300 mb-10">
                {`Регистрируйтесь за 30 секунд${bonusLabel ? ` — ${bonusLabel} уже на балансе.` : "."}`}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/register">
                  <Button size="lg" className="h-14 px-10 text-lg font-black bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 text-white shadow-[0_0_50px_rgba(139,92,246,0.5)]">
                    <Sparkles className="w-5 h-5 mr-2" /> Создать аккаунт
                  </Button>
                </Link>
                <Link href="/hints">
                  <Button size="lg" variant="outline" className="h-14 px-8 border-white/25 bg-white/8 hover:bg-white/12 text-white font-bold">
                    <Lightbulb className="w-4 h-4 mr-2 text-amber-400" /> Примеры заданий
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

      </main>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer className="border-t border-white/8 bg-black/60">
        <div className="container mx-auto px-4 py-12 max-w-5xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-[0_0_16px_rgba(139,92,246,0.5)]">
                <Zap className="w-5 h-5 text-white" fill="currentColor" />
              </div>
              <span className="text-lg font-black text-white tracking-tight">НейроЗачёт</span>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-400">
              <Link href="/hints" className="hover:text-white transition-colors font-medium">Подсказки</Link>
              <a href="#pricing" className="hover:text-white transition-colors font-medium">Тарифы</a>
              <a href="#faq" className="hover:text-white transition-colors font-medium">FAQ</a>
              <Link href="/register" className="hover:text-white transition-colors font-medium">Регистрация</Link>
            </div>
          </div>
          <div className="border-t border-white/8 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} НейроЗачёт. Все права защищены.</p>
            <div className="flex flex-wrap gap-4 justify-center sm:justify-end">
              <a href="/offer" className="hover:text-slate-300 transition-colors">Оферта</a>
              <a href="/privacy" className="hover:text-slate-300 transition-colors">Конфиденциальность</a>
              <a href="/refund" className="hover:text-slate-300 transition-colors">Возврат</a>
              <a href="/cookies" className="hover:text-slate-300 transition-colors">Cookies</a>
              <a href="/ai-disclaimer" className="hover:text-slate-300 transition-colors">Об ИИ</a>
              <a href="mailto:support@neurozachet.ru" className="hover:text-slate-300 transition-colors">Поддержка</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
