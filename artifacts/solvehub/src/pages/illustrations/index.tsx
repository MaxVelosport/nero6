import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { useUpdateBalance } from "@/hooks/useUpdateBalance";
import { AILoadingState } from "@/components/ai-loading-state";
import { AIDisclaimer } from "@/components/ai-disclaimer";
import {
  Image as ImageIcon, Upload, X, Wand2, FileText, Download,
  Loader2, Sparkles, BookImage, AlertTriangle, CheckCircle2,
  RefreshCw, ZoomIn, ChevronRight, Edit2, Check, ArrowLeft,
  Lightbulb,
} from "lucide-react";

type Mode = "prompt" | "restyle" | "by-paper";

interface Suggestion {
  caption: string;
  prompt: string;
  reason: string;
}

interface GeneratedImage {
  url: string;
  caption: string;
}

interface ApiResponse {
  images: GeneratedImage[];
  cost: number;
  newBalance: number;
}

type ByPaperStep = "input" | "review" | "results";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const MODES: { key: Mode; label: string; sub: string; icon: any; price: number; color: string }[] = [
  {
    key: "prompt",
    label: "По описанию",
    sub: "Опишите рисунок — ИИ нарисует в академическом стиле",
    icon: Wand2,
    price: 10,
    color: "from-violet-500 to-purple-600",
  },
  {
    key: "restyle",
    label: "Переработать рисунок",
    sub: "Загрузите рисунок — ИИ адаптирует под ГОСТ-стиль",
    icon: RefreshCw,
    price: 15,
    color: "from-blue-500 to-cyan-600",
  },
  {
    key: "by-paper",
    label: "По тексту работы",
    sub: "Вставьте текст — ИИ подберёт и нарисует 4 иллюстрации",
    icon: BookImage,
    price: 49,
    color: "from-amber-500 to-orange-600",
  },
];

// ── Suggestion card with editable caption ─────────────────────────────────────
function SuggestionCard({
  s, index, onChange,
}: {
  s: Suggestion; index: number; onChange: (caption: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(s.caption);

  const save = () => { onChange(draft); setEditing(false); };

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 p-4 space-y-2">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
                className="text-sm h-7 py-0"
              />
              <button onClick={save} className="text-green-400 hover:text-green-300"><Check className="w-4 h-4" /></button>
              <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-1 group/cap">
              <span className="text-sm font-medium text-foreground leading-snug">{s.caption}</span>
              <button
                onClick={() => { setDraft(s.caption); setEditing(true); }}
                className="opacity-0 group-hover/cap:opacity-100 transition-opacity ml-1 text-muted-foreground hover:text-foreground"
                title="Изменить подпись"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
            <Lightbulb className="w-3 h-3 mt-0.5 shrink-0 text-amber-400/60" />
            {s.reason}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function IllustrationsPage() {
  const { data: user } = useGetMe();
  const updateBalance = useUpdateBalance();
  const { toast } = useToast();

  const [mode, setMode] = useState<Mode>("prompt");
  const [prompt, setPrompt] = useState("");
  const [paperText, setPaperText] = useState("");
  const [paperTitle, setPaperTitle] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);

  // by-paper multi-step state
  const [byPaperStep, setByPaperStep] = useState<ByPaperStep>("input");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeSeconds, setAnalyzeSeconds] = useState(0);

  const [loading, setLoading] = useState(false);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const [results, setResults] = useState<GeneratedImage[]>([]);
  const [lastCost, setLastCost] = useState<number | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer for loading states
  useEffect(() => {
    const active = loading || analyzing;
    if (active) {
      if (loading) setLoadingSeconds(0);
      if (analyzing) setAnalyzeSeconds(0);
      timerRef.current = setInterval(() => {
        if (loading) setLoadingSeconds(s => s + 1);
        if (analyzing) setAnalyzeSeconds(s => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loading, analyzing]);

  const balance = (user as any)?.balance ?? 0;
  const currentMode = MODES.find((m) => m.key === mode)!;

  const resetByPaper = () => {
    setByPaperStep("input");
    setSuggestions([]);
    setResults([]);
  };

  // ── File upload ──────────────────────────────────────────────────────────────
  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Только изображения", description: "JPG, PNG, WebP", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Файл слишком большой", description: "Максимум 10 МБ", variant: "destructive" });
      return;
    }
    setUploadedFile(file);
    setUploadPreview(URL.createObjectURL(file));
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  // ── Step 1: Analyze text (free) ──────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (paperText.trim().length < 200) {
      toast({ title: "Текст слишком короткий", description: "Нужно не менее 200 символов", variant: "destructive" });
      return;
    }
    setAnalyzing(true);
    try {
      const token = localStorage.getItem("authToken");
      const resp = await fetch(`/api/illustrations/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ paperText: paperText.trim(), paperTitle: paperTitle.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        toast({ title: "Ошибка анализа", description: data.message ?? "Попробуйте ещё раз", variant: "destructive" });
        return;
      }
      setSuggestions(data.suggestions ?? []);
      setByPaperStep("review");
    } catch (err: any) {
      toast({ title: "Ошибка сети", description: err?.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Step 2: Generate images (paid) ──────────────────────────────────────────
  const handleGenerate = async () => {
    if (!(user as any)?.subscriptionActive && balance < currentMode.price) {
      toast({ title: "Недостаточно средств", description: `Нужно ${currentMode.price} ₽`, variant: "destructive" });
      return;
    }

    if (mode === "prompt" && !prompt.trim()) {
      toast({ title: "Введите описание", variant: "destructive" });
      return;
    }
    if (mode === "restyle" && !uploadedFile) {
      toast({ title: "Загрузите изображение", variant: "destructive" });
      return;
    }

    setLoading(true);
    setResults([]);
    try {
      const token = localStorage.getItem("authToken");
      const body: Record<string, any> = { mode };

      if (mode === "prompt") {
        body.prompt = prompt.trim();
      } else if (mode === "restyle") {
        body.imageBase64 = await fileToBase64(uploadedFile!);
        body.imageMime = uploadedFile!.type;
        if (prompt.trim()) body.prompt = prompt.trim();
      } else if (mode === "by-paper") {
        // Pass pre-computed suggestions to skip Claude on the backend
        body.suggestions = suggestions.map(s => ({ caption: s.caption, prompt: s.prompt }));
      }

      const resp = await fetch(`/api/illustrations/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const data: ApiResponse | { error: string; message: string } = await resp.json();
      if (!resp.ok) {
        toast({ title: "Ошибка", description: (data as any).message ?? "Не удалось сгенерировать", variant: "destructive" });
        return;
      }

      const ok = data as ApiResponse;
      setResults(ok.images);
      setLastCost(ok.cost);
      if (mode === "by-paper") setByPaperStep("results");
      updateBalance();
      toast({ title: `Готово! ${ok.images.length} иллюстраций создано`, description: `Списано ${ok.cost} ₽` });
    } catch (err: any) {
      toast({ title: "Ошибка сети", description: err?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (url: string, caption: string) => {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${caption.replace(/[^а-яёa-z0-9]/gi, "_").slice(0, 40)}.png`;
      a.click();
    } catch {
      window.open(url, "_blank");
    }
  };

  const charCount = paperText.length;

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightboxUrl(null)}
        >
          <img src={lightboxUrl} alt="Просмотр" className="max-w-full max-h-full rounded-2xl shadow-2xl" />
          <button className="absolute top-4 right-4 text-white/60 hover:text-white" onClick={() => setLightboxUrl(null)}>
            <X className="w-8 h-8" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-pink-600 flex items-center justify-center shrink-0">
            <ImageIcon className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold leading-tight">Генератор иллюстраций</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Академические рисунки по ГОСТ — DALL-E 3 + Claude</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] sm:text-xs text-muted-foreground">Баланс</p>
            <p className="text-base sm:text-lg font-bold text-primary">{balance} ₽</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 space-y-6">
        <AIDisclaimer variant="warning" />
        {/* Mode selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = mode === m.key;
            return (
              <button
                key={m.key}
                onClick={() => { setMode(m.key); setResults([]); resetByPaper(); }}
                className={`relative text-left rounded-2xl border p-4 transition-all ${
                  active
                    ? "border-primary/60 bg-primary/8 ring-1 ring-primary/30"
                    : "border-border/40 bg-card/50 hover:border-border hover:bg-card"
                }`}
              >
                <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br ${m.color} mb-3`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div className="font-semibold text-sm mb-1">{m.label}</div>
                <div className="text-xs text-muted-foreground leading-relaxed">{m.sub}</div>
                <div className={`absolute top-3 right-3 text-xs font-bold px-2 py-0.5 rounded-full bg-gradient-to-r ${m.color} text-white`}>
                  {m.price} ₽
                </div>
              </button>
            );
          })}
        </div>

        {/* ═══ BY-PAPER: Multi-step wizard ═══ */}
        {mode === "by-paper" && (
          <div className="space-y-4">

            {/* Step indicator */}
            <div className="flex items-center gap-2 text-sm">
              {[
                { key: "input", label: "Текст работы" },
                { key: "review", label: "Подтвердите иллюстрации" },
                { key: "results", label: "Готово" },
              ].map((step, i) => {
                const stepOrder: ByPaperStep[] = ["input", "review", "results"];
                const currentIdx = stepOrder.indexOf(byPaperStep);
                const stepIdx = stepOrder.indexOf(step.key as ByPaperStep);
                const done = stepIdx < currentIdx;
                const active = step.key === byPaperStep;
                return (
                  <div key={step.key} className="flex items-center gap-2">
                    {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />}
                    <span className={`flex items-center gap-1.5 transition-colors ${
                      active ? "text-amber-400 font-medium" : done ? "text-green-400" : "text-muted-foreground/50"
                    }`}>
                      {done
                        ? <CheckCircle2 className="w-3.5 h-3.5" />
                        : <span className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center border ${
                            active ? "border-amber-400 text-amber-400" : "border-muted-foreground/30 text-muted-foreground/40"
                          }`}>{i + 1}</span>
                      }
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* ── STEP 1: Input ── */}
            {byPaperStep === "input" && (
              <div className="rounded-2xl border border-border/40 bg-card/50 p-6 space-y-4">
                <div className="space-y-2">
                  <Label>Название работы <span className="text-muted-foreground/60 font-normal">(необязательно)</span></Label>
                  <Input
                    value={paperTitle}
                    onChange={(e) => setPaperTitle(e.target.value)}
                    placeholder="Например: Разработка ПИС поддержки принятия решений при приёме автомобиля в трейд-ин"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Текст работы <span className="text-red-400">*</span></Label>
                    <span className={`text-xs ${charCount < 200 ? "text-red-400" : "text-muted-foreground"}`}>
                      {charCount} / мин. 200 символов
                    </span>
                  </div>
                  <Textarea
                    value={paperText}
                    onChange={(e) => setPaperText(e.target.value)}
                    placeholder="Вставьте введение, главу или любой фрагмент курсовой, диплома или реферата. Можно копировать прямо из Word. Чем больше текста — тем точнее подберём иллюстрации."
                    className="min-h-[180px] resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Рекомендуем вставить 500–2000 символов: введение + одну главу.
                  </p>
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-amber-500/8 border border-amber-500/20 p-3">
                  <Sparkles className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-300/90 space-y-0.5">
                    <p className="font-medium">Как это работает:</p>
                    <p>1. Claude прочитает текст и предложит 4 рисунка <span className="text-amber-400">бесплатно</span></p>
                    <p>2. Вы увидите список и подтвердите (или измените подписи)</p>
                    <p>3. Только после этого DALL-E 3 нарисует и спишется <strong>49 ₽</strong></p>
                  </div>
                </div>

                <Button
                  onClick={handleAnalyze}
                  disabled={analyzing || charCount < 200}
                  className="bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0 hover:opacity-90 w-full"
                >
                  {analyzing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Анализирую работу…</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" />Проанализировать и подобрать иллюстрации</>
                  )}
                </Button>

                {/* Analyze loading state */}
                <AILoadingState
                  visible={analyzing}
                  title="Claude читает вашу работу"
                  stages={[
                    "Читаю текст работы…",
                    "Выделяю ключевые концепции…",
                    "Придумываю подходящие иллюстрации…",
                    "Формирую список предложений…",
                  ]}
                  elapsed={analyzeSeconds}
                  estimated={12}
                  color="rose"
                />
              </div>
            )}

            {/* ── STEP 2: Review suggestions ── */}
            {byPaperStep === "review" && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border/40 bg-card/50 p-6 space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-0.5">Claude подобрал 4 иллюстрации для вашей работы</p>
                    <p className="text-xs text-muted-foreground">Нажмите на карандаш рядом с подписью, чтобы изменить её перед генерацией.</p>
                  </div>

                  <div className="space-y-3">
                    {suggestions.map((s, i) => (
                      <SuggestionCard
                        key={i}
                        s={s}
                        index={i}
                        onChange={(caption) =>
                          setSuggestions(prev => prev.map((x, xi) => xi === i ? { ...x, caption } : x))
                        }
                      />
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button
                      variant="outline"
                      onClick={resetByPaper}
                      className="flex-1"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Изменить текст
                    </Button>
                    <Button
                      onClick={handleGenerate}
                      disabled={loading || (!(user as any)?.subscriptionActive && balance < 49)}
                      className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0 hover:opacity-90"
                    >
                      {loading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Рисую…</>
                      ) : (
                        <><Sparkles className="w-4 h-4 mr-2" />{(user as any)?.subscriptionActive ? "Нарисовать 4 иллюстрации (по подписке)" : "Нарисовать 4 иллюстрации — 49 ₽"}</>
                      )}
                    </Button>
                  </div>

                  {!(user as any)?.subscriptionActive && balance < 49 && (
                    <p className="flex items-center gap-1 text-xs text-red-400">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Недостаточно средств. Пополните баланс.
                    </p>
                  )}
                </div>

                {/* Generate loading state */}
                <AILoadingState
                  visible={loading}
                  title="DALL-E 3 рисует иллюстрации"
                  stages={[
                    "Готовлю академический стиль ГОСТ…",
                    "DALL-E 3 рисует рисунок 1…",
                    "DALL-E 3 рисует рисунок 2…",
                    "DALL-E 3 рисует рисунок 3…",
                    "DALL-E 3 рисует рисунок 4…",
                    "Финальная обработка…",
                  ]}
                  elapsed={loadingSeconds}
                  estimated={55}
                  color="rose"
                />
              </div>
            )}

            {/* ── STEP 3: Results ── */}
            {byPaperStep === "results" && results.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                    {results.length} иллюстрации готовы
                  </h2>
                  <div className="flex items-center gap-2">
                    {lastCost && <span className="text-xs text-muted-foreground">Списано {lastCost} ₽</span>}
                    <Button size="sm" variant="outline" onClick={resetByPaper}>
                      Создать ещё
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                  {results.map((img, i) => (
                    <div key={i} className="rounded-2xl border border-border/40 bg-card/50 overflow-hidden group">
                      <div className="relative cursor-zoom-in" onClick={() => setLightboxUrl(img.url)}>
                        <img
                          src={img.url}
                          alt={img.caption}
                          className="w-full object-contain bg-white/5 max-h-80"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <ZoomIn className="w-8 h-8 text-white drop-shadow-lg" />
                        </div>
                      </div>
                      <div className="p-4 flex items-start justify-between gap-3">
                        <p className="text-sm text-muted-foreground italic flex-1">{img.caption}</p>
                        <Button size="sm" variant="outline" onClick={() => handleDownload(img.url, img.caption)} className="shrink-0">
                          <Download className="w-3.5 h-3.5 mr-1" />
                          Скачать
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-primary/6 border border-primary/20 p-3">
                  <FileText className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Вставьте изображения в работу: Word → Вставка → Рисунок. Подписи уже готовы по ГОСТ.
                    Ссылки активны <span className="font-medium text-foreground">~1 час</span> — скачайте сразу.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ PROMPT / RESTYLE: Single-step form ═══ */}
        {mode !== "by-paper" && (
          <div className="rounded-2xl border border-border/40 bg-card/50 p-6 space-y-4">
            {/* Prompt mode */}
            {mode === "prompt" && (
              <div className="space-y-2">
                <Label>Описание иллюстрации</Label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Например: блок-схема алгоритма обработки данных торговой системы с этапами ввода, валидации и вывода"
                  className="min-h-[100px] resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Опишите что должно быть на рисунке. ИИ автоматически адаптирует под академический ГОСТ-стиль.
                </p>
              </div>
            )}

            {/* Restyle mode */}
            {mode === "restyle" && (
              <div className="space-y-4">
                <div>
                  <Label className="mb-2 block">Загрузите ваш рисунок</Label>
                  {uploadedFile ? (
                    <div className="relative rounded-xl border border-border/40 overflow-hidden">
                      <img src={uploadPreview!} alt="Загруженный" className="w-full max-h-64 object-contain bg-black/20" />
                      <button
                        className="absolute top-2 right-2 bg-black/60 rounded-full p-1 hover:bg-black/80"
                        onClick={() => { setUploadedFile(null); setUploadPreview(null); }}
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white/80 text-xs px-3 py-2">
                        {uploadedFile.name}
                      </div>
                    </div>
                  ) : (
                    <div
                      className="border-2 border-dashed border-border/50 rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/4 transition-colors"
                      onDrop={handleDrop}
                      onDragOver={(e) => e.preventDefault()}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Перетащите изображение или нажмите для выбора</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">JPG, PNG, WebP до 10 МБ</p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Дополнительные пожелания <span className="text-muted-foreground/60 font-normal">(необязательно)</span></Label>
                  <Input
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Например: добавь подписи на русском, сделай более детальным…"
                  />
                </div>
              </div>
            )}

            {/* Generate button */}
            <div className="flex items-center gap-4 pt-2">
              <Button
                onClick={handleGenerate}
                disabled={loading || (!(user as any)?.subscriptionActive && balance < currentMode.price)}
                className={`bg-gradient-to-r ${currentMode.color} text-white border-0 hover:opacity-90 px-8`}
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Генерирую…</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" />Создать иллюстрацию</>
                )}
              </Button>
              <span className="text-sm text-muted-foreground">
                Стоимость: <span className="font-semibold text-foreground">{(user as any)?.subscriptionActive ? "по подписке" : `${currentMode.price} ₽`}</span>
              </span>
              {!(user as any)?.subscriptionActive && balance < currentMode.price && (
                <span className="flex items-center gap-1 text-xs text-red-400">
                  <AlertTriangle className="w-3.5 h-3.5" />Недостаточно средств
                </span>
              )}
            </div>

            {/* Loading state */}
            <AILoadingState
              visible={loading}
              title={mode === "restyle" ? "Переадаптирую рисунок под ГОСТ" : "Создаю иллюстрацию"}
              stages={
                mode === "restyle"
                  ? [
                      "Анализирую загруженный рисунок…",
                      "Определяю академический стиль…",
                      "DALL-E 3 переадаптирует изображение…",
                      "Наношу финальные штрихи…",
                    ]
                  : [
                      "Интерпретирую описание…",
                      "Формирую академическую концепцию…",
                      "DALL-E 3 рисует иллюстрацию…",
                      "Финальная обработка…",
                    ]
              }
              elapsed={loadingSeconds}
              estimated={22}
              color="rose"
            />
          </div>
        )}

        {/* Results for prompt/restyle modes */}
        {mode !== "by-paper" && results.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                Иллюстрация готова
              </h2>
              {lastCost && <span className="text-xs text-muted-foreground">Списано {lastCost} ₽</span>}
            </div>
            <div className="grid gap-4 grid-cols-1">
              {results.map((img, i) => (
                <div key={i} className="rounded-2xl border border-border/40 bg-card/50 overflow-hidden group">
                  <div className="relative cursor-zoom-in" onClick={() => setLightboxUrl(img.url)}>
                    <img
                      src={img.url}
                      alt={img.caption}
                      className="w-full object-contain bg-white/5 max-h-96"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <ZoomIn className="w-8 h-8 text-white drop-shadow-lg" />
                    </div>
                  </div>
                  <div className="p-4 flex items-start justify-between gap-3">
                    <p className="text-sm text-muted-foreground italic flex-1">{img.caption}</p>
                    <Button size="sm" variant="outline" onClick={() => handleDownload(img.url, img.caption)} className="shrink-0">
                      <Download className="w-3.5 h-3.5 mr-1" />
                      Скачать
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-start gap-3 rounded-xl bg-primary/6 border border-primary/20 p-3">
              <FileText className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Вставьте изображение в работу: Word → Вставка → Рисунок. Подписи готовы по ГОСТ.
                Ссылка активна <span className="font-medium text-foreground">~1 час</span> — скачайте сразу.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
