import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { useUpdateBalance } from "@/hooks/useUpdateBalance";
import { RenderMessage } from "@/lib/render-message";
import { AIDisclaimer } from "@/components/ai-disclaimer";
import {
  BookOpen, Loader2, Copy, Download, CheckCheck,
  Upload, FileText, X, Sparkles, Zap, Star, Crown, Gem,
  Wallet, AlertCircle, RefreshCw, ChevronRight, PenLine,
} from "lucide-react";
import { AILoadingState } from "@/components/ai-loading-state";
import { Link, useLocation } from "wouter";

const MODES = [
  {
    key: "brief",
    icon: Zap,
    label: "Краткий",
    description: "Только ключевые тезисы и определения",
    price: 5,
    wordTarget: "300–500 слов",
    model: "gpt-4o-mini",
    estSecs: 25,
    color: "from-slate-500 to-slate-600",
    border: "border-slate-500/30 hover:border-slate-500/60",
    activeBorder: "border-slate-400/70",
    activeBg: "bg-slate-500/10",
    badge: "bg-slate-500/15 text-slate-300",
    iconColor: "text-slate-300",
  },
  {
    key: "standard",
    icon: Star,
    label: "Стандарт",
    description: "Полный конспект с примерами и пояснениями",
    price: 10,
    wordTarget: "800–1200 слов",
    model: "gpt-4o-mini",
    estSecs: 45,
    color: "from-blue-500 to-cyan-600",
    border: "border-blue-500/30 hover:border-blue-500/60",
    activeBorder: "border-blue-400/70",
    activeBg: "bg-blue-500/10",
    badge: "bg-blue-500/15 text-blue-300",
    iconColor: "text-blue-400",
  },
  {
    key: "detailed",
    icon: Crown,
    label: "Подробный",
    description: "Детальный разбор с формулами и связями",
    price: 20,
    wordTarget: "1500–2500 слов",
    model: "gpt-4o",
    estSecs: 35,
    color: "from-violet-500 to-purple-600",
    border: "border-violet-500/30 hover:border-violet-500/60",
    activeBorder: "border-violet-400/70",
    activeBg: "bg-violet-500/10",
    badge: "bg-violet-500/15 text-violet-300",
    iconColor: "text-violet-400",
    popular: true,
  },
  {
    key: "maximum",
    icon: Gem,
    label: "Максимальный",
    description: "Исчерпывающий академический конспект",
    price: 35,
    wordTarget: "2500–4000 слов",
    model: "gpt-4o",
    estSecs: 50,
    color: "from-amber-500 to-orange-500",
    border: "border-amber-500/30 hover:border-amber-500/60",
    activeBorder: "border-amber-400/70",
    activeBg: "bg-amber-500/10",
    badge: "bg-amber-500/15 text-amber-300",
    iconColor: "text-amber-400",
  },
];

const EDU_LEVELS = [
  { key: "school", label: "Школа / ЕГЭ" },
  { key: "bachelor", label: "Бакалавриат" },
  { key: "master", label: "Магистратура" },
  { key: "phd", label: "Аспирантура" },
];

const ACCEPT = ".pdf,.doc,.docx,.txt,.odt";
const MAX_MB = 20;

type InputMode = "topic" | "file";

export default function SummaryPage() {
  const { toast } = useToast();
  const { data: user, isLoading: userLoading } = useGetMe({ query: { retry: false } });
  const updateBalance = useUpdateBalance();
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userLoading && !user) navigate("/login");
  }, [user, userLoading, navigate]);

  const [inputMode, setInputMode] = useState<InputMode>("topic");
  const [topic, setTopic] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [mode, setMode] = useState("standard");
  const [subject, setSubject] = useState("");
  const [eduLevel, setEduLevel] = useState("bachelor");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [result, setResult] = useState<{
    text: string;
    cost: number;
    balanceAfter: number;
    label: string;
    subject: string;
    topic?: string;
    fileName?: string;
    sourceMode: string;
    model: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedMode = MODES.find(m => m.key === mode) ?? MODES[1];
  const balance = (user as any)?.balance ?? 0;
  const canAfford = balance >= selectedMode.price;

  const processFile = useCallback((f: File) => {
    setFileError(null);
    if (f.size > MAX_MB * 1024 * 1024) {
      setFileError(`Файл слишком большой (максимум ${MAX_MB} МБ)`);
      return;
    }
    const ext = f.name.split(".").pop()?.toLowerCase() || "";
    if (!["pdf", "doc", "docx", "txt", "odt"].includes(ext)) {
      setFileError("Поддерживаются: PDF, Word (.doc/.docx), TXT, ODT");
      return;
    }
    setFile(f);
    setResult(null);
  }, []);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  };

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      if (inputMode !== "file") return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f) { e.preventDefault(); processFile(f); break; }
        }
      }
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, [processFile, inputMode]);

  const handleGenerate = async (modeOverride?: string) => {
    const activeMode = modeOverride ?? mode;
    const activeModeMeta = MODES.find(m => m.key === activeMode) ?? selectedMode;
    const activeCost = activeModeMeta.price;

    if (inputMode === "topic" && !topic.trim()) {
      toast({ title: "Введите тему конспекта", variant: "destructive" });
      return;
    }
    if (inputMode === "file" && !file) {
      toast({ title: "Загрузите файл учебника", variant: "destructive" });
      return;
    }
    if (!(user as any)?.subscriptionActive && balance < activeCost) {
      toast({ title: `Недостаточно средств. Нужно ${activeCost} ₽`, variant: "destructive" });
      return;
    }

    if (modeOverride) setMode(modeOverride);
    setLoading(true);
    setLoadingSeconds(0);
    setResult(null);
    timerRef.current = setInterval(() => setLoadingSeconds(s => s + 1), 1000);

    try {
      const token = localStorage.getItem("authToken");

      let body: Record<string, any> = {
        mode: activeMode,
        subject,
        educationLevel: eduLevel,
        additionalInstructions: additionalInstructions.trim() || undefined,
      };

      if (inputMode === "topic") {
        body.topic = topic.trim();
      } else if (file) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = () => reject(new Error("Ошибка чтения файла"));
          reader.readAsDataURL(file);
        });
        body.fileData = base64;
        body.fileType = file.type || "application/octet-stream";
        body.fileName = file.name;
      }

      const resp = await fetch("/api/summaries/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      const data = await resp.json();
      if (!resp.ok) {
        if (resp.status === 402) {
          toast({ title: "Недостаточно средств", description: data.message, variant: "destructive" });
        } else {
          toast({ title: "Ошибка", description: data.message || "Что-то пошло не так", variant: "destructive" });
        }
        return;
      }

      setResult({
        text: data.result,
        cost: data.cost,
        balanceAfter: data.balanceAfter,
        label: data.label,
        subject: data.subject,
        topic: data.topic,
        fileName: data.fileName,
        sourceMode: data.sourceMode,
        model: data.model,
      });
      updateBalance(data.balanceAfter);
      toast({ title: `Конспект готов! (${data.label})`, description: `Списано ${data.cost} ₽` });
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    } finally {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (result?.text) {
      navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([result.text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `конспект-${result.topic || result.fileName || result.subject || "учебник"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto">
        <AILoadingState
          visible={true}
          title="Составляю конспект"
          stages={
            inputMode === "topic"
              ? [
                  "Изучаю тему и формирую структуру…",
                  "Пишу введение и ключевые понятия…",
                  "Добавляю формулы и определения…",
                  "Составляю примеры и пояснения…",
                  "Оформляю финальный конспект…",
                ]
              : [
                  "Читаю загруженный файл…",
                  "Анализирую структуру материала…",
                  "Выделяю ключевые тезисы…",
                  "Формирую конспект по разделам…",
                  "Оформляю финальный результат…",
                ]
          }
          elapsed={loadingSeconds}
          estimated={selectedMode.estSecs}
          color="cyan"
        />
      </div>
    );
  }

  const sourceLabel = result
    ? (result.sourceMode === "topic" ? `Тема: «${result.topic || result.subject}»` : result.fileName)
    : "";

  // ── РЕЗУЛЬТАТ ────────────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                <BookOpen className="w-3.5 h-3.5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Конспект готов</h1>
            </div>
            <p className="text-xs text-muted-foreground">
              {sourceLabel} · {result.label} · {result.model} · −{result.cost} ₽
              {result.balanceAfter !== undefined && (
                <> · <Wallet className="inline w-3 h-3 mb-0.5" /> {result.balanceAfter} ₽</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleCopy} className="border-border/50 gap-1.5 text-muted-foreground hover:text-foreground">
              {copied ? <><CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> Скопировано</> : <><Copy className="w-3.5 h-3.5" /> Копировать</>}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} className="border-border/50 gap-1.5 text-muted-foreground hover:text-foreground">
              <Download className="w-3.5 h-3.5" /> Скачать TXT
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (!result) return;
                try {
                  const { exportSummaryToPdf } = await import("@/lib/pdf-export");
                  await exportSummaryToPdf({
                    topic: result.topic || result.fileName || result.subject || "Конспект",
                    subject: result.subject,
                    type: result.label,
                    content: result.text,
                    createdAt: new Date().toISOString(),
                  });
                } catch (e: any) {
                  toast({ title: "Ошибка экспорта", description: e?.message || "Не удалось создать PDF", variant: "destructive" });
                }
              }}
              className="border-rose-500/30 text-rose-300 hover:bg-rose-500/10 gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" /> Скачать PDF
            </Button>
            <Button size="sm" onClick={() => setResult(null)}
              className="bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Новый конспект
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/50 p-6 md:p-8">
          <RenderMessage content={result.text} />
        </div>
        <AIDisclaimer variant="result" />

        <div className="rounded-xl border border-border/50 bg-card/30 p-4">
          <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
            <ChevronRight className="w-3.5 h-3.5" />
            Попробовать другой режим
          </p>
          <div className="flex flex-wrap gap-2">
            {MODES.filter(m => m.key !== mode).map(m => {
              const Icon = m.icon;
              const affordable = balance >= m.price;
              return (
                <button
                  key={m.key}
                  onClick={() => handleGenerate(m.key)}
                  disabled={!affordable || loading}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${m.activeBg} ${m.activeBorder} ${m.iconColor}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {m.label} ({m.price} ₽)
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── ФОРМА ────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-7 animate-in fade-in duration-300">

      {/* Заголовок */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Конспект</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Напишите тему или загрузите учебник — ИИ создаст структурированный конспект нужного объёма
        </p>
      </div>

      {/* Баланс */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card/40">
        <div className="flex items-center gap-2 text-sm">
          <Wallet className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">Ваш баланс:</span>
          <span className="font-bold text-foreground">{balance} ₽</span>
        </div>
        {!canAfford && (
          <Link href="/subscriptions">
            <Button size="sm" variant="outline" className="text-xs gap-1.5 border-amber-500/40 text-amber-400 hover:bg-amber-500/10">
              <Sparkles className="w-3 h-3" /> Пополнить
            </Button>
          </Link>
        )}
      </div>

      {/* Шаг 1: Источник */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-xs font-bold text-primary">1</div>
          <Label className="text-sm font-semibold">Источник материала</Label>
        </div>

        {/* Переключатель режима ввода */}
        <div className="flex rounded-xl overflow-hidden border border-border/50 bg-card/30 p-1 gap-1">
          <button
            onClick={() => setInputMode("topic")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              inputMode === "topic"
                ? "bg-primary/20 text-primary border border-primary/40"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <PenLine className="w-4 h-4" />
            По теме
          </button>
          <button
            onClick={() => setInputMode("file")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              inputMode === "file"
                ? "bg-primary/20 text-primary border border-primary/40"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Upload className="w-4 h-4" />
            Из файла
          </button>
        </div>

        {/* Ввод темы */}
        {inputMode === "topic" ? (
          <div className="space-y-2">
            <Textarea
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="Например: Законы Ньютона и их применение, Квантовая механика — базовые принципы, Нормальное распределение в статистике..."
              className="bg-background/50 min-h-[100px] resize-none text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Опишите тему подробнее — ИИ сгенерирует конспект на основе своих знаний
            </p>
          </div>
        ) : (
          <>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={onDrop}
              onDragOver={e => e.preventDefault()}
              className={`relative rounded-2xl border-2 border-dashed transition-all cursor-pointer p-8 text-center ${
                file ? "border-primary/50 bg-primary/5" : fileError ? "border-red-500/50 bg-red-500/5" : "border-border/50 bg-card/30 hover:border-primary/40 hover:bg-primary/3"
              }`}
            >
              <input ref={fileInputRef} type="file" accept={ACCEPT} className="hidden" onChange={onFileInput} />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-foreground text-sm">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} МБ</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setFile(null); }}
                    className="ml-2 text-muted-foreground hover:text-red-400 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground">Перетащите, нажмите или вставьте</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, Word (.doc/.docx), TXT · до {MAX_MB} МБ ·{" "}
                    <kbd className="px-1 py-0.5 rounded text-[10px] bg-muted/80 border border-border/60 font-mono">Ctrl+V</kbd>
                  </p>
                </>
              )}
            </div>
            {fileError && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" /> {fileError}
              </div>
            )}
          </>
        )}
      </div>

      {/* Шаг 2: Параметры */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-xs font-bold text-primary">2</div>
          <Label className="text-sm font-semibold">Параметры конспекта</Label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Предмет {inputMode === "topic" ? "(необязательно)" : ""}</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="Математика, Физика, История..." className="bg-background/50" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Уровень образования</Label>
            <div className="flex flex-wrap gap-1.5">
              {EDU_LEVELS.map(l => (
                <button key={l.key} onClick={() => setEduLevel(l.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    eduLevel === l.key
                      ? "bg-primary/20 border-primary/50 text-primary"
                      : "border-border/50 text-muted-foreground hover:text-foreground"
                  }`}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Дополнительные инструкции (необязательно)</Label>
          <Textarea
            value={additionalInstructions}
            onChange={e => setAdditionalInstructions(e.target.value)}
            placeholder="Например: сделать акцент на практических примерах, включить все формулы, упростить язык..."
            className="bg-background/50 min-h-[70px] resize-none text-sm"
          />
        </div>
      </div>

      {/* Шаг 3: Режим */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-xs font-bold text-primary">3</div>
          <Label className="text-sm font-semibold">Степень детализации и стоимость</Label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MODES.map(m => {
            const Icon = m.icon;
            const active = mode === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`relative text-left rounded-2xl border p-4 transition-all duration-200 ${
                  active ? `${m.activeBorder} ${m.activeBg}` : m.border + " bg-card/30"
                }`}
              >
                {m.popular && (
                  <span className="absolute top-2.5 right-2.5 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                    Популярно
                  </span>
                )}
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center shrink-0`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground text-sm">{m.label}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${m.badge}`}>
                        {m.model === "gpt-4o" ? "GPT-4o" : "GPT-4o mini"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{m.description}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px] text-muted-foreground">{m.wordTarget}</span>
                      <span className={`font-black text-base ${active ? m.iconColor : "text-foreground"}`}>{m.price} ₽</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Итог и кнопка */}
      <div className="rounded-2xl border border-border/50 bg-card/40 p-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Будет списано:</span>
            <span className="text-xl font-black text-foreground">{selectedMode.price} ₽</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selectedMode.label} · {selectedMode.wordTarget} · {selectedMode.model}
          </p>
        </div>
        <Button
          onClick={() => handleGenerate()}
          disabled={loading || !canAfford || (inputMode === "topic" ? !topic.trim() : !file)}
          className={`gap-2 h-11 px-6 text-white border-0 bg-gradient-to-r ${selectedMode.color} hover:opacity-90`}
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Составляю конспект… {loadingSeconds > 0 && `(${loadingSeconds}с)`}</>
          ) : (
            <><BookOpen className="w-4 h-4" /> Создать конспект</>
          )}
        </Button>
      </div>

      {!canAfford && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-sm">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <p className="text-amber-300 font-medium">Недостаточно средств</p>
            <p className="text-muted-foreground text-xs">Нужно {selectedMode.price} ₽, на балансе {balance} ₽</p>
          </div>
          <Link href="/subscriptions" className="ml-auto">
            <Button size="sm" variant="outline" className="text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10">
              Пополнить
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
