import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { useUpdateBalance } from "@/hooks/useUpdateBalance";
import { RenderMessage } from "@/lib/render-message";
import { exportTicketsToDocx } from "@/lib/word-export";
import { exportTicketsToPdf } from "@/lib/pdf-export";
import {
  BookOpen, Upload, X, FileText, Zap, Star, Crown,
  Sparkles, ChevronDown, ChevronUp, Loader2, AlertTriangle,
  ListOrdered, Download, Copy, CheckCheck, GraduationCap,
  ClipboardList, Hash, Timer, ChevronRight, Brain, ChevronLeft,
  RotateCcw, Eye, ThumbsUp, ThumbsDown, BarChart2,
} from "lucide-react";
import { AILoadingState } from "@/components/ai-loading-state";
import { AIDisclaimer } from "@/components/ai-disclaimer";

const MODES = [
  {
    key: "fast",
    label: "Быстрый",
    icon: Zap,
    color: "from-slate-500 to-slate-600",
    border: "border-slate-500/40",
    bg: "bg-slate-500/10",
    badge: "bg-slate-500/20 text-slate-300",
    pricePerTicket: 3,
    minCharge: 15,
    model: "GPT-4o mini",
    modelColor: "text-slate-400",
    secsPerTicket: 3,
    desc: "Краткие ответы, основные определения",
    detail: "Оптимально для быстрой подготовки: чёткие определения и ключевые тезисы",
  },
  {
    key: "standard",
    label: "Стандарт",
    icon: Star,
    color: "from-blue-500 to-cyan-500",
    border: "border-blue-500/40",
    bg: "bg-blue-500/10",
    badge: "bg-blue-500/20 text-blue-300",
    pricePerTicket: 7,
    minCharge: 25,
    model: "GPT-4o mini",
    modelColor: "text-blue-400",
    secsPerTicket: 4,
    desc: "Развёрнутые ответы с примерами",
    detail: "Подходит для большинства экзаменов: полные ответы с примерами и объяснениями",
  },
  {
    key: "premium",
    label: "Премиум",
    icon: Crown,
    color: "from-violet-500 to-fuchsia-500",
    border: "border-violet-500/40",
    bg: "bg-violet-500/10",
    badge: "bg-violet-500/20 text-violet-300",
    pricePerTicket: 15,
    minCharge: 45,
    model: "GPT-4o",
    modelColor: "text-violet-400",
    secsPerTicket: 12,
    desc: "Подробные ответы, схемы, связи",
    detail: "GPT-4o: академически глубокие ответы, ключевые термины, связи между темами, LaTeX формулы",
  },
  {
    key: "super_premium",
    label: "Супер Премиум",
    icon: Sparkles,
    color: "from-amber-500 to-orange-500",
    border: "border-amber-500/40",
    bg: "bg-amber-500/10",
    badge: "bg-amber-500/20 text-amber-300",
    pricePerTicket: 40,
    minCharge: 120,
    model: "GPT-4o",
    modelColor: "text-amber-400",
    secsPerTicket: 20,
    desc: "Академические ответы экзаменационного уровня",
    detail: "GPT-4o с максимальным контекстом: полный разбор, дополнительные вопросы, возможные ловушки",
  },
];

const EDU_LEVELS = [
  { key: "school", label: "Школа / ЕГЭ" },
  { key: "bachelor", label: "Бакалавриат" },
  { key: "master", label: "Магистратура" },
  { key: "phd", label: "Аспирантура" },
];

const ACCEPTED = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res((r.result as string).split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function formatSeconds(s: number): string {
  if (s < 60) return `${s}с`;
  return `${Math.floor(s / 60)}м ${s % 60}с`;
}

// Извлечь заголовки билетов из Markdown для TOC
function extractTicketTitles(text: string): Array<{ num: number; title: string }> {
  const matches = [...text.matchAll(/^## Билет (\d+)\. (.+)$/gm)];
  return matches.map(m => ({ num: parseInt(m[1]), title: m[2].trim() }));
}

// Парсить билеты для режима флеш-карт
type FlashCard = { num: number; title: string; question: string; answer: string };

function parseFlashCards(text: string): FlashCard[] {
  const sections = text.split(/(?=^## Билет \d+\.)/m);
  return sections
    .filter(s => /^## Билет \d+\./.test(s))
    .map(s => {
      const firstNl = s.indexOf("\n");
      const header = s.substring(0, firstNl).replace(/^## /, "").trim();
      const numMatch = header.match(/^Билет (\d+)\. (.+)$/);
      const num = numMatch ? parseInt(numMatch[1]) : 0;
      const title = numMatch ? numMatch[2].trim() : header;
      const body = s.substring(firstNl + 1).trim();
      const answerIdx = body.search(/\*\*Ответ[:\*]/i);
      if (answerIdx > 10) {
        return { num, title, question: body.substring(0, answerIdx).trim(), answer: body.substring(answerIdx).trim() };
      }
      const paras = body.split(/\n\n+/);
      return { num, title, question: paras[0] || title, answer: paras.slice(1).join("\n\n") || body };
    });
}

export default function NewTicketsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading } = useGetMe({ query: { retry: false } });
  const updateBalance = useUpdateBalance();

  // ── Auth redirect ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userLoading && !user) {
      setLocation("/login");
    }
  }, [user, userLoading, setLocation]);

  const [subject, setSubject] = useState("");
  const [eduLevel, setEduLevel] = useState("bachelor");
  const [mode, setMode] = useState("standard");
  const [questions, setQuestions] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileLoading, setFileLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [result, setResult] = useState<string | null>(null);
  const [ticketCount, setTicketCount] = useState(0);
  const [cost, setCost] = useState(0);
  const [balanceAfter, setBalanceAfter] = useState<number | null>(null);
  const [taskId, setTaskId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [detailOpen, setDetailOpen] = useState<string | null>(null);
  const [tocOpen, setTocOpen] = useState(false);

  // Flashcard mode
  const [flashcardMode, setFlashcardMode] = useState(false);
  const [fcIndex, setFcIndex] = useState(0);
  const [fcAnswerVisible, setFcAnswerVisible] = useState(false);
  const [fcKnown, setFcKnown] = useState<Set<number>>(new Set());
  const [fcUnknown, setFcUnknown] = useState<Set<number>>(new Set());

  const resultRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsedQuestions = questions
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .map(l => l.replace(/^[\d]+[.):\s]+/, "").trim())
    .filter(q => q.length > 0);

  const selectedMode = MODES.find(m => m.key === mode)!;
  const estimatedCost = Math.max(
    selectedMode.minCharge,
    selectedMode.pricePerTicket * Math.max(1, parsedQuestions.length)
  );
  const estimatedSecs = Math.max(15, parsedQuestions.length * selectedMode.secsPerTicket);

  const handleFile = useCallback(async (f: File) => {
    if (f.size > 20 * 1024 * 1024) {
      toast({ title: "Файл слишком большой", description: "Максимум 20 МБ", variant: "destructive" });
      return;
    }
    setFileLoading(true);
    setFile(f);
    setFileLoading(false);
  }, [toast]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  // ── Ctrl+V / Cmd+V — вставка файла из буфера (работает и в textarea) ────
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f) { e.preventDefault(); handleFile(f); break; }
        }
      }
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, [handleFile]);

  const handleSubmit = async () => {
    if (parsedQuestions.length === 0) {
      toast({ title: "Введите вопросы", description: "По одному вопросу на строку", variant: "destructive" });
      return;
    }
    if (!subject.trim()) {
      toast({ title: "Укажите предмет", variant: "destructive" });
      return;
    }

    setLoading(true);
    setResult(null);
    setLoadingSeconds(0);
    timerRef.current = setInterval(() => setLoadingSeconds(s => s + 1), 1000);

    try {
      let fileData: string | undefined;
      let fileType: string | undefined;
      let fileName: string | undefined;

      if (file) {
        fileData = await fileToBase64(file);
        fileType = file.type;
        fileName = file.name;
      }

      const token = localStorage.getItem("authToken");
      const resp = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject, questions, mode, educationLevel: eduLevel, fileData, fileType, fileName }),
      });
      const data = await resp.json();

      if (!resp.ok) {
        toast({ title: "Ошибка", description: data.message || "Что-то пошло не так", variant: "destructive" });
        return;
      }

      setResult(data.result);
      setTicketCount(data.ticketCount);
      setCost(data.cost);
      setBalanceAfter(data.balanceAfter ?? null);
      setTaskId(data.taskId);
      updateBalance(data.balanceAfter);
      toast({ title: `Готово! ${data.ticketCount} билетов`, description: `Списано ${data.cost} ₽` });
    } catch (e: any) {
      toast({ title: "Ошибка сети", description: e.message, variant: "destructive" });
    } finally {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([result], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `билеты-${subject || "экзамен"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadDocx = async () => {
    if (!result) return;
    try {
      await exportTicketsToDocx({
        subject: subject || "Экзаменационные билеты",
        mode,
        ticketCount,
        result,
        createdAt: new Date().toISOString(),
      });
    } catch (e: any) {
      toast({ title: "Ошибка экспорта", description: e.message, variant: "destructive" });
    }
  };

  const scrollToTicket = (num: number) => {
    const el = resultRef.current;
    if (!el) return;
    const headings = el.querySelectorAll("h2");
    for (const h of headings) {
      if (h.textContent?.includes(`Билет ${num}.`)) {
        h.scrollIntoView({ behavior: "smooth", block: "start" });
        break;
      }
    }
    setTocOpen(false);
  };

  const ticketTitles = result ? extractTicketTitles(result) : [];

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
              <ClipboardList className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Экзаменационные билеты</h1>
          </div>
          <p className="text-muted-foreground text-sm">Загрузите учебник, введите вопросы — ИИ распишет ответы на каждый билет</p>
        </div>
        {user && (
          <div className="text-sm font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-3 py-1.5 rounded-lg">
            Баланс: {(user as any).balance} ₽
          </div>
        )}
      </div>

      {!result ? (
        <div className="space-y-6">

          <AIDisclaimer variant="warning" />

          {/* Step 1: Subject & level */}
          <div className="rounded-2xl border border-border/50 bg-card/50 p-6 space-y-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">1</span>
              Предмет и уровень
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground">Предмет</Label>
                <Input
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Математический анализ, Физика, История..."
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground">Уровень образования</Label>
                <div className="flex flex-wrap gap-1.5">
                  {EDU_LEVELS.map(l => (
                    <button key={l.key} onClick={() => setEduLevel(l.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        eduLevel === l.key
                          ? "bg-primary/20 border-primary/50 text-primary"
                          : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
                      }`}>
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: File upload */}
          <div className="rounded-2xl border border-border/50 bg-card/50 p-6 space-y-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">2</span>
              Учебник или материалы <span className="text-muted-foreground font-normal text-xs">(необязательно)</span>
            </h2>
            {!file ? (
              <div
                onDrop={onDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border/50 rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/40 hover:bg-primary/3 transition-all group"
              >
                <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <Upload className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">Перетащите, нажмите или вставьте</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, Word, TXT — до 20 МБ ·{" "}
                    <kbd className="px-1 py-0.5 rounded text-[10px] bg-muted/80 border border-border/60 font-mono">Ctrl+V</kbd>
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {["PDF", "DOCX", "TXT"].map(e => (
                    <span key={e} className="px-2 py-0.5 rounded bg-muted/60 font-mono">{e}</span>
                  ))}
                </div>
                {fileLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/8">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} КБ · ИИ прочитает содержимое</p>
                </div>
                <button onClick={() => setFile(null)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc,.txt" className="hidden" onChange={onFileChange} />
            <p className="text-xs text-muted-foreground">
              ИИ извлечёт текст и использует его для точных ответов по вашему курсу.
              Если учебника нет — ИИ ответит на основе общих знаний.
            </p>
          </div>

          {/* Step 3: Questions */}
          <div className="rounded-2xl border border-border/50 bg-card/50 p-6 space-y-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">3</span>
              Вопросы / темы билетов
            </h2>
            <Textarea
              value={questions}
              onChange={e => setQuestions(e.target.value)}
              placeholder={"1. Что такое производная функции?\n2. Теорема Ролля\n3. Методы нахождения первообразной\n..."}
              className="min-h-[200px] font-mono text-sm bg-background/50 resize-y"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <ListOrdered className="w-3.5 h-3.5" />
                <span>
                  {parsedQuestions.length === 0
                    ? "Введите вопросы — по одному на строку"
                    : `Распознано ${parsedQuestions.length} вопрос${parsedQuestions.length === 1 ? "" : parsedQuestions.length < 5 ? "а" : "ов"}`}
                </span>
              </div>
              <span>Максимум 100 билетов</span>
            </div>
          </div>

          {/* Step 4: Mode */}
          <div className="rounded-2xl border border-border/50 bg-card/50 p-6 space-y-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">4</span>
              Режим и стоимость
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MODES.map(m => {
                const Icon = m.icon;
                const mCost = Math.max(m.minCharge, m.pricePerTicket * Math.max(1, parsedQuestions.length));
                const isSelected = mode === m.key;
                const isOpen = detailOpen === m.key;
                return (
                  <div key={m.key}
                    onClick={() => { setMode(m.key); }}
                    className={`rounded-xl border cursor-pointer transition-all ${
                      isSelected ? `${m.border} ${m.bg}` : "border-border/40 hover:border-border bg-card/30"
                    }`}
                  >
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${m.color} flex items-center justify-center`}>
                            <Icon className="w-3.5 h-3.5 text-white" />
                          </div>
                          <span className="font-semibold text-sm text-foreground">{m.label}</span>
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border border-current/20 bg-current/5 ${m.modelColor}`}>
                            {m.model}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-foreground">~{mCost} ₽</div>
                          <div className="text-[10px] text-muted-foreground">{m.pricePerTicket} ₽/билет</div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{m.desc}</p>
                      {isSelected && (
                        <button
                          onClick={e => { e.stopPropagation(); setDetailOpen(isOpen ? null : m.key); }}
                          className="mt-2 flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors"
                        >
                          {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {isOpen ? "Скрыть" : "Подробнее"}
                        </button>
                      )}
                      {isOpen && isSelected && (
                        <p className="mt-2 text-xs text-muted-foreground border-t border-border/30 pt-2 leading-relaxed">
                          {m.detail}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {parsedQuestions.length > 0 && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm text-foreground">
                    <span className="font-semibold">{parsedQuestions.length}</span> вопросов ×{" "}
                    <span className="font-semibold">{selectedMode.pricePerTicket} ₽</span> = {selectedMode.pricePerTicket * parsedQuestions.length} ₽
                    {estimatedCost > selectedMode.pricePerTicket * parsedQuestions.length && (
                      <span className="text-muted-foreground ml-1">(мин. {selectedMode.minCharge} ₽)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Timer className="w-3 h-3" />
                    <span>Ожидаемое время: ~{formatSeconds(estimatedSecs)}</span>
                  </div>
                </div>
                <div className="text-lg font-black text-primary">~{estimatedCost} ₽</div>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              Цена приблизительная. Итог может незначительно отличаться.
            </div>
            <Button
              onClick={handleSubmit}
              disabled={loading || parsedQuestions.length === 0 || !subject.trim()}
              className="h-12 px-8 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 text-white font-bold shadow-[0_0_20px_rgba(139,92,246,0.35)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Генерирую... {formatSeconds(loadingSeconds)}</>
              ) : (
                <><ClipboardList className="w-4 h-4 mr-2" /> Сгенерировать билеты (~{estimatedCost} ₽)</>
              )}
            </Button>
          </div>

          {/* Progress bar */}
          <AILoadingState
            visible={loading}
            title={`Генерирую ${parsedQuestions.length} билет${parsedQuestions.length === 1 ? "" : parsedQuestions.length < 5 ? "а" : "ов"}`}
            stages={[
              "Изучаю программу курса…",
              "Формирую вопросы по билетам…",
              "Прорабатываю теоретическую часть…",
              "Добавляю практические задания…",
              "Оформляю финальные билеты…",
            ]}
            elapsed={loadingSeconds}
            estimated={estimatedSecs}
            color="violet"
          />
        </div>
      ) : (

        /* ── RESULT ── */
        (() => {
          const flashCards = result ? parseFlashCards(result) : [];
          const fcCard = flashCards[fcIndex];
          const fcRemaining = flashCards.length - fcKnown.size - fcUnknown.size;

          const goNext = () => { setFcAnswerVisible(false); setFcIndex(i => Math.min(i + 1, flashCards.length - 1)); };
          const goPrev = () => { setFcAnswerVisible(false); setFcIndex(i => Math.max(i - 1, 0)); };
          const markKnown = () => {
            setFcKnown(s => new Set([...s, fcIndex]));
            setFcUnknown(s => { const n = new Set(s); n.delete(fcIndex); return n; });
            if (fcIndex < flashCards.length - 1) goNext();
          };
          const markUnknown = () => {
            setFcUnknown(s => new Set([...s, fcIndex]));
            setFcKnown(s => { const n = new Set(s); n.delete(fcIndex); return n; });
            if (fcIndex < flashCards.length - 1) goNext();
          };

          return (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Stats bar */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-4 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <ClipboardList className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-foreground">{ticketCount} билетов готово</div>
                    <div className="text-xs text-muted-foreground">
                      Режим: {selectedMode.label} · {selectedMode.model} · Списано {cost} ₽
                      {balanceAfter !== null && ` · Баланс: ${balanceAfter} ₽`}
                    </div>
                  </div>
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  {flashCards.length > 0 && (
                    <Button
                      variant={flashcardMode ? "default" : "outline"}
                      size="sm"
                      onClick={() => { setFlashcardMode(v => !v); setFcIndex(0); setFcAnswerVisible(false); setFcKnown(new Set()); setFcUnknown(new Set()); }}
                      className={flashcardMode ? "bg-violet-600 hover:bg-violet-500 text-white border-0" : "border-border/50 text-muted-foreground hover:text-foreground"}
                    >
                      <Brain className="w-3.5 h-3.5 mr-1.5" />
                      {flashcardMode ? "Документ" : "Флеш-карты"}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={handleCopy}
                    className="border-border/50 text-muted-foreground hover:text-foreground">
                    {copied ? <><CheckCheck className="w-3.5 h-3.5 mr-1.5 text-emerald-400" /> Скопировано</> : <><Copy className="w-3.5 h-3.5 mr-1.5" /> Копировать</>}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload}
                    className="border-border/50 text-muted-foreground hover:text-foreground">
                    <Download className="w-3.5 h-3.5 mr-1.5" /> TXT
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadDocx}
                    className="border-border/50 text-muted-foreground hover:text-foreground">
                    <Download className="w-3.5 h-3.5 mr-1.5" /> DOCX
                  </Button>
                  <Button variant="outline" size="sm"
                    onClick={async () => {
                      if (!result) return;
                      try {
                        await exportTicketsToPdf({
                          subject: subject || "Экзаменационные билеты",
                          mode, ticketCount, result,
                          createdAt: new Date().toISOString(),
                        });
                      } catch (e: any) {
                        toast({ title: "Ошибка экспорта", description: e?.message || "Не удалось создать PDF", variant: "destructive" });
                      }
                    }}
                    className="border-rose-500/30 text-rose-300 hover:bg-rose-500/10">
                    <FileText className="w-3.5 h-3.5 mr-1.5" /> PDF
                  </Button>
                  <Button size="sm"
                    onClick={() => { setResult(null); setTaskId(null); setBalanceAfter(null); setFlashcardMode(false); }}
                    className="bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30">
                    Новый набор
                  </Button>
                </div>
              </div>

              {/* ── FLASHCARD MODE ── */}
              {flashcardMode && fcCard ? (
                <div className="space-y-4">
                  {/* Progress row */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 text-emerald-400"><ThumbsUp className="w-3 h-3" />{fcKnown.size} знаю</span>
                    <span className="flex items-center gap-1 text-red-400"><ThumbsDown className="w-3 h-3" />{fcUnknown.size} не знаю</span>
                    <span>{fcRemaining} осталось</span>
                    <div className="flex-1 h-1.5 bg-border/30 rounded-full overflow-hidden ml-2">
                      <div className="h-full flex">
                        <div className="bg-emerald-500 transition-all" style={{ width: `${(fcKnown.size / flashCards.length) * 100}%` }} />
                        <div className="bg-red-500 transition-all" style={{ width: `${(fcUnknown.size / flashCards.length) * 100}%` }} />
                      </div>
                    </div>
                    <span className="shrink-0">{fcIndex + 1}/{flashCards.length}</span>
                  </div>

                  {/* Card */}
                  <div className={`rounded-2xl border-2 p-6 md:p-8 transition-all ${fcKnown.has(fcIndex) ? "border-emerald-500/50 bg-emerald-500/5" : fcUnknown.has(fcIndex) ? "border-red-500/50 bg-red-500/5" : "border-border/50 bg-card/50"}`}>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-mono text-muted-foreground">Билет {fcCard.num}</span>
                      {fcKnown.has(fcIndex) && <span className="text-xs text-emerald-400 flex items-center gap-1"><ThumbsUp className="w-3 h-3" />Знаю</span>}
                      {fcUnknown.has(fcIndex) && <span className="text-xs text-red-400 flex items-center gap-1"><ThumbsDown className="w-3 h-3" />Не знаю</span>}
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-4">{fcCard.title}</h3>
                    <div className="text-sm text-foreground/90 leading-relaxed">
                      <RenderMessage content={fcCard.question} />
                    </div>

                    {!fcAnswerVisible ? (
                      <Button onClick={() => setFcAnswerVisible(true)} className="mt-6 gap-2" variant="outline">
                        <Eye className="w-4 h-4" /> Показать ответ
                      </Button>
                    ) : (
                      <div className="mt-6 pt-6 border-t border-border/40">
                        <p className="text-xs font-semibold text-primary mb-3 uppercase tracking-wide">Ответ</p>
                        <div className="text-sm text-foreground/90 leading-relaxed">
                          <RenderMessage content={fcCard.answer} />
                        </div>
                        <div className="flex gap-3 mt-6">
                          <Button onClick={markKnown} className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white border-0">
                            <ThumbsUp className="w-4 h-4" /> Знаю
                          </Button>
                          <Button onClick={markUnknown} variant="outline" className="gap-2 border-red-500/40 text-red-400 hover:bg-red-500/10">
                            <ThumbsDown className="w-4 h-4" /> Не знаю
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Navigation */}
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={goPrev} disabled={fcIndex === 0} className="gap-1.5">
                      <ChevronLeft className="w-4 h-4" /> Назад
                    </Button>
                    {fcKnown.size + fcUnknown.size === flashCards.length && (
                      <div className="text-center text-sm text-muted-foreground">
                        ✓ Все пройдены ·{" "}
                        <button onClick={() => { setFcIndex(0); setFcAnswerVisible(false); setFcKnown(new Set()); setFcUnknown(new Set()); }} className="text-primary hover:underline flex items-center gap-1 inline-flex">
                          <RotateCcw className="w-3 h-3" /> Сначала
                        </button>
                        {fcUnknown.size > 0 && (
                          <button
                            onClick={() => {
                              const firstUnknown = [...fcUnknown][0];
                              setFcIndex(firstUnknown);
                              setFcAnswerVisible(false);
                            }}
                            className="text-amber-400 hover:underline ml-3"
                          >
                            Повторить «Не знаю» ({fcUnknown.size})
                          </button>
                        )}
                      </div>
                    )}
                    <Button variant="ghost" size="sm" onClick={goNext} disabled={fcIndex === flashCards.length - 1} className="gap-1.5">
                      Вперёд <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Table of Contents */}
                  {ticketTitles.length > 1 && (
                    <div className="rounded-xl border border-border/50 bg-card/30 overflow-hidden">
                      <button
                        onClick={() => setTocOpen(!tocOpen)}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Hash className="w-4 h-4 text-primary" />
                          Содержание — {ticketTitles.length} билетов
                        </div>
                        {tocOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </button>
                      {tocOpen && (
                        <div className="border-t border-border/50 max-h-64 overflow-y-auto">
                          {ticketTitles.map(({ num, title }) => (
                            <button
                              key={num}
                              onClick={() => scrollToTicket(num)}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-muted/30 transition-colors border-b border-border/20 last:border-0"
                            >
                              <span className="text-xs text-muted-foreground w-10 shrink-0 font-mono">№{num}</span>
                              <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                              <span className="text-foreground/80 truncate">{title}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Rendered tickets */}
                  <div ref={resultRef} className="rounded-2xl border border-border/50 bg-card/50 p-6 md:p-8 space-y-2">
                    <RenderMessage content={result} />
                  </div>

                  {taskId && (
                    <p className="text-xs text-muted-foreground text-center">
                      Сохранено в истории задач ·{" "}
                      <button onClick={() => setLocation(`/tasks/${taskId}`)}
                        className="text-primary hover:underline">открыть</button>
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })()
      )}
    </div>
  );
}
