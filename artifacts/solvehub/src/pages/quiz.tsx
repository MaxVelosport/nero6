import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { useUpdateBalance } from "@/hooks/useUpdateBalance";
import {
  Brain, Loader2, Check, X as XIcon, RefreshCw, Trophy,
  ChevronRight, AlertCircle, Wallet, Zap, Star, Crown,
  ArrowLeft, ArrowRight,
} from "lucide-react";
import { Link } from "wouter";

const TIERS = [
  { key: "short",  count: 5,  price: 8,  label: "Короткий",  sub: "5 вопросов",  icon: Zap,   estSecs: 25, color: "from-slate-500 to-slate-600",   border: "border-slate-500/30 hover:border-slate-500/60",   activeBorder: "border-slate-400/70",   activeBg: "bg-slate-500/10",   iconColor: "text-slate-300" },
  { key: "medium", count: 10, price: 15, label: "Средний",   sub: "10 вопросов", icon: Star,  estSecs: 40, color: "from-blue-500 to-cyan-600",     border: "border-blue-500/30 hover:border-blue-500/60",     activeBorder: "border-blue-400/70",     activeBg: "bg-blue-500/10",    iconColor: "text-blue-400" },
  { key: "long",   count: 20, price: 25, label: "Большой",   sub: "20 вопросов", icon: Crown, estSecs: 70, color: "from-violet-500 to-fuchsia-600", border: "border-violet-500/30 hover:border-violet-500/60", activeBorder: "border-violet-400/70", activeBg: "bg-violet-500/10", iconColor: "text-violet-400" },
] as const;

const DIFFICULTIES = [
  { key: "easy",   label: "Лёгкий",  sub: "Базовые понятия" },
  { key: "medium", label: "Средний", sub: "Понимание и применение" },
  { key: "hard",   label: "Сложный", sub: "Каверзные вопросы" },
] as const;

const EDU_LEVELS = [
  { key: "school",    label: "Школа" },
  { key: "bachelor",  label: "Бакалавриат" },
  { key: "master",    label: "Магистратура" },
  { key: "phd",       label: "Аспирантура" },
] as const;

type Question = { id: number; q: string; options: string[]; correctIndex: number; explanation: string };
type Quiz = { title: string; topic: string; subject: string; difficulty: string; questions: Question[] };
type Phase = "setup" | "playing" | "result";

export default function QuizPage() {
  const { toast } = useToast();
  const { data: user, refetch: refetchMe } = useGetMe();
  const updateBalance = useUpdateBalance();

  // ── Setup state ──
  const [tier, setTier] = useState<typeof TIERS[number]["key"]>("short");
  const [difficulty, setDifficulty] = useState<typeof DIFFICULTIES[number]["key"]>("medium");
  const [educationLevel, setEducationLevel] = useState<typeof EDU_LEVELS[number]["key"]>("bachelor");
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Playing state ──
  const [phase, setPhase] = useState<Phase>("setup");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({}); // questionId -> chosen index
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  const tierCfg = useMemo(() => TIERS.find(t => t.key === tier)!, [tier]);
  const balance = (user as any)?.balance ?? 0;
  const subscribed = !!(user as any)?.subscriptionActive;
  const effectivePrice = subscribed ? 0 : tierCfg.price;
  const insufficient = !subscribed && balance < tierCfg.price;

  const handleGenerate = async () => {
    if (topic.trim().length < 3) {
      toast({ title: "Укажите тему", description: "Минимум 3 символа", variant: "destructive" });
      return;
    }
    setError(null);
    setGenerating(true);
    try {
      const token = localStorage.getItem("authToken");
      const r = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tier, subject: subject.trim() || undefined, topic: topic.trim(), difficulty, educationLevel }),
      });
      const data = await r.json();
      if (!r.ok) {
        if (r.status === 402) {
          setError(`Недостаточно средств. Нужно ${data.required} ₽, на балансе ${data.balance} ₽.`);
        } else {
          setError(data.message || "Не удалось сгенерировать тест");
        }
        return;
      }
      setQuiz(data.quiz);
      if (typeof data.balanceAfter === "number") updateBalance(data.balanceAfter);
      setAnswers({});
      setRevealed({});
      setCurrentIdx(0);
      setPhase("playing");
    } catch (e: any) {
      setError(e?.message || "Ошибка соединения с сервером");
    } finally {
      setGenerating(false);
    }
  };

  const choose = (qId: number, optIdx: number) => {
    if (revealed[qId]) return;
    setAnswers(prev => ({ ...prev, [qId]: optIdx }));
    setRevealed(prev => ({ ...prev, [qId]: true }));
  };

  const next = () => {
    if (!quiz) return;
    if (currentIdx < quiz.questions.length - 1) {
      setCurrentIdx(i => i + 1);
    } else {
      setPhase("result");
    }
  };

  const prev = () => {
    if (currentIdx > 0) setCurrentIdx(i => i - 1);
  };

  const restart = () => {
    setPhase("setup");
    setQuiz(null);
    setAnswers({});
    setRevealed({});
    setCurrentIdx(0);
    refetchMe();
  };

  const score = useMemo(() => {
    if (!quiz) return { correct: 0, total: 0, pct: 0 };
    let correct = 0;
    for (const q of quiz.questions) if (answers[q.id] === q.correctIndex) correct++;
    const total = quiz.questions.length;
    return { correct, total, pct: total ? Math.round((correct / total) * 100) : 0 };
  }, [quiz, answers]);

  // ─── SETUP PHASE ───────────────────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <div className="container max-w-3xl mx-auto px-4 py-6 sm:py-10 animate-fade-up">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Тренажёр-тесты</h1>
            <p className="text-sm text-muted-foreground">ИИ создаст тест по любой теме — проверь себя перед экзаменом</p>
          </div>
        </div>

        {/* Tier picker */}
        <div className="mb-5">
          <Label className="mb-2 block text-sm font-medium">Длина теста</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 stagger">
            {TIERS.map(t => {
              const Icon = t.icon;
              const active = tier === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTier(t.key)}
                  className={`tap text-left rounded-2xl border-2 transition-all p-4 ${
                    active ? `${t.activeBorder} ${t.activeBg}` : `${t.border} bg-card/40`
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${t.color} flex items-center justify-center`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold">{t.label}</div>
                      <div className="text-xs text-muted-foreground">{t.sub}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">~{t.estSecs} сек</span>
                    <span className="font-semibold text-foreground">{t.price} ₽</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Difficulty */}
        <div className="mb-5">
          <Label className="mb-2 block text-sm font-medium">Сложность</Label>
          <div className="grid grid-cols-3 gap-2">
            {DIFFICULTIES.map(d => {
              const active = difficulty === d.key;
              return (
                <button
                  key={d.key}
                  onClick={() => setDifficulty(d.key)}
                  className={`tap rounded-xl border px-3 py-2 text-center transition-all ${
                    active ? "border-primary/70 bg-primary/10" : "border-border/60 bg-card/40 hover:border-border"
                  }`}
                >
                  <div className="text-sm font-medium">{d.label}</div>
                  <div className="text-[11px] text-muted-foreground">{d.sub}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Education level */}
        <div className="mb-5">
          <Label className="mb-2 block text-sm font-medium">Уровень образования</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {EDU_LEVELS.map(l => {
              const active = educationLevel === l.key;
              return (
                <button
                  key={l.key}
                  onClick={() => setEducationLevel(l.key)}
                  className={`tap rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
                    active ? "border-primary/70 bg-primary/10" : "border-border/60 bg-card/40 hover:border-border"
                  }`}
                >
                  {l.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Topic + subject */}
        <div className="mb-5 space-y-3">
          <div>
            <Label htmlFor="topic" className="mb-1.5 block text-sm font-medium">Тема теста <span className="text-destructive">*</span></Label>
            <Input
              id="topic"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="Например: производные функций одной переменной"
              maxLength={200}
            />
          </div>
          <div>
            <Label htmlFor="subject" className="mb-1.5 block text-sm font-medium">Предмет (необязательно)</Label>
            <Input
              id="subject"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Например: высшая математика"
              maxLength={120}
            />
          </div>
        </div>

        {/* Balance + CTA */}
        <div className="rounded-xl border border-border/60 bg-card/40 p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Wallet className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Баланс:</span>
            <span className="font-semibold">{balance} ₽</span>
          </div>
          <div className="text-sm">
            Стоимость:{" "}
            {subscribed ? (
              <span className="font-semibold text-emerald-400">0 ₽ (по подписке)</span>
            ) : (
              <span className="font-semibold">{tierCfg.price} ₽</span>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 flex items-start gap-2 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 text-destructive shrink-0" />
            <div className="flex-1">
              <div className="text-destructive font-medium">{error}</div>
              {insufficient && (
                <Link href="/subscriptions">
                  <Button variant="link" className="px-0 h-auto text-sm">Пополнить баланс →</Button>
                </Link>
              )}
            </div>
          </div>
        )}

        <Button
          onClick={handleGenerate}
          disabled={generating || topic.trim().length < 3 || insufficient}
          className="w-full gloss h-12 text-base"
        >
          {generating ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Генерация теста… (~{tierCfg.estSecs} сек)</>
          ) : (
            <><Brain className="w-4 h-4 mr-2" /> {effectivePrice === 0 ? "Сгенерировать тест (бесплатно по подписке)" : `Сгенерировать тест за ${effectivePrice} ₽`}</>
          )}
        </Button>
      </div>
    );
  }

  // ─── PLAYING PHASE ─────────────────────────────────────────────────────────
  if (phase === "playing" && quiz) {
    const q = quiz.questions[currentIdx];
    const isRevealed = !!revealed[q.id];
    const chosen = answers[q.id];
    const total = quiz.questions.length;

    return (
      <div className="container max-w-2xl mx-auto px-4 py-6 sm:py-10 animate-fade-in">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
            <span className="font-medium">{quiz.title}</span>
            <span>Вопрос {currentIdx + 1} из {total}</span>
          </div>
          <div className="h-1.5 rounded-full bg-card/60 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300"
              style={{ width: `${((currentIdx + 1) / total) * 100}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <div key={q.id} className="rounded-2xl border border-border/60 bg-card/60 p-5 mb-4 animate-fade-up">
          <div className="text-base sm:text-lg font-medium mb-4 leading-snug">{q.q}</div>

          <div className="space-y-2">
            {q.options.map((opt, idx) => {
              const isCorrect = idx === q.correctIndex;
              const isChosen = chosen === idx;
              let cls = "border-border/60 bg-card/40 hover:border-border";
              if (isRevealed) {
                if (isCorrect) cls = "border-emerald-500/60 bg-emerald-500/10";
                else if (isChosen) cls = "border-rose-500/60 bg-rose-500/10";
                else cls = "border-border/40 bg-card/20 opacity-60";
              } else if (isChosen) {
                cls = "border-primary/60 bg-primary/10";
              }
              return (
                <button
                  key={idx}
                  onClick={() => choose(q.id, idx)}
                  disabled={isRevealed}
                  className={`tap w-full text-left rounded-xl border-2 p-3 transition-all flex items-center gap-3 ${cls}`}
                >
                  <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm font-semibold ${
                    isRevealed && isCorrect ? "bg-emerald-500 text-white" :
                    isRevealed && isChosen ? "bg-rose-500 text-white" :
                    "bg-card/60 text-muted-foreground"
                  }`}>
                    {isRevealed && isCorrect ? <Check className="w-4 h-4" /> :
                     isRevealed && isChosen ? <XIcon className="w-4 h-4" /> :
                     String.fromCharCode(65 + idx)}
                  </span>
                  <span className="flex-1 text-sm">{opt}</span>
                </button>
              );
            })}
          </div>

          {isRevealed && q.explanation && (
            <div className="mt-4 rounded-xl bg-card/40 border border-border/40 p-3 text-sm text-muted-foreground animate-fade-in">
              <span className="font-medium text-foreground">Пояснение: </span>{q.explanation}
            </div>
          )}
        </div>

        {/* Nav */}
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={prev} disabled={currentIdx === 0} className="flex-1">
            <ArrowLeft className="w-4 h-4 mr-1" /> Назад
          </Button>
          <Button
            onClick={next}
            disabled={!isRevealed}
            className="flex-1 gloss"
          >
            {currentIdx < total - 1 ? (<>Дальше <ArrowRight className="w-4 h-4 ml-1" /></>) : (<>Завершить <Trophy className="w-4 h-4 ml-1" /></>)}
          </Button>
        </div>
      </div>
    );
  }

  // ─── RESULT PHASE ──────────────────────────────────────────────────────────
  if (phase === "result" && quiz) {
    const grade =
      score.pct >= 90 ? { label: "Отлично", color: "from-emerald-500 to-green-600", emoji: "🏆" } :
      score.pct >= 70 ? { label: "Хорошо",  color: "from-blue-500 to-cyan-600",     emoji: "👍" } :
      score.pct >= 50 ? { label: "Удовлетворительно", color: "from-amber-500 to-orange-600", emoji: "📚" } :
                        { label: "Нужно повторить",   color: "from-rose-500 to-red-600", emoji: "💡" };

    return (
      <div className="container max-w-2xl mx-auto px-4 py-6 sm:py-10 animate-fade-up">
        {/* Score card */}
        <div className={`rounded-2xl bg-gradient-to-br ${grade.color} p-6 sm:p-8 text-white text-center shadow-xl mb-6 ring-pop`}>
          <div className="text-5xl mb-3">{grade.emoji}</div>
          <div className="text-sm opacity-90 mb-1">{grade.label}</div>
          <div className="text-5xl sm:text-6xl font-bold tabular-nums leading-none">{score.pct}%</div>
          <div className="mt-2 text-sm opacity-90">
            Правильно: {score.correct} из {score.total}
          </div>
        </div>

        {/* Review */}
        <h2 className="text-lg font-semibold mb-3">Разбор ответов</h2>
        <div className="space-y-2 mb-6 stagger">
          {quiz.questions.map((q, i) => {
            const ok = answers[q.id] === q.correctIndex;
            return (
              <div key={q.id} className={`rounded-xl border p-3 ${ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5"}`}>
                <div className="flex items-start gap-2">
                  <div className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${ok ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}>
                    {ok ? <Check className="w-3.5 h-3.5" /> : <XIcon className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 text-sm">
                    <div className="font-medium mb-1">{i + 1}. {q.q}</div>
                    {!ok && answers[q.id] !== undefined && (
                      <div className="text-xs text-rose-400 mb-0.5">
                        Ваш ответ: {q.options[answers[q.id]]}
                      </div>
                    )}
                    <div className="text-xs text-emerald-400">
                      Правильно: {q.options[q.correctIndex]}
                    </div>
                    {q.explanation && (
                      <div className="text-xs text-muted-foreground mt-1">{q.explanation}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={restart} className="flex-1 gloss">
            <RefreshCw className="w-4 h-4 mr-2" /> Новый тест
          </Button>
          <Link href="/dashboard" className="flex-1">
            <Button variant="outline" className="w-full">
              <ChevronRight className="w-4 h-4 mr-2" /> На главную
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
