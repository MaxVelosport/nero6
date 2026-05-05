import { useState, useRef, useEffect } from "react";
import { AIDisclaimer } from "@/components/ai-disclaimer";
import { Link, useLocation } from "wouter";
import { useGetTask, useGetMe } from "@workspace/api-client-react";
import { useUpdateBalance } from "@/hooks/useUpdateBalance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  ArrowLeft, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Brain,
  FileText,
  Copy,
  RefreshCw,
  Download,
  Layers,
  PenLine,
  ChevronDown,
  ChevronUp,
  Share2,
  ShieldCheck,
  Link2,
  Cpu,
  Zap,
  Sparkles,
  GitMerge,
  UserCheck,
  HandHelping,
  ImagePlus,
  Wand2,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { exportTaskToDocx } from "@/lib/word-export";
import { exportToPptx } from "@/lib/pptx-export";
import { exportTaskToPdf } from "@/lib/pdf-export";
import { RenderMessage } from "@/lib/render-message";

export default function TaskDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  useGetMe();
  const updateBalance = useUpdateBalance();
  const prevStatusRef = useRef<string | null>(null);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [revisionLoading, setRevisionLoading] = useState(false);

  const [imageGenOpen, setImageGenOpen] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageLoading, setImageLoading] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<{ url: string; prompt: string }[]>([]);

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  const [origChecking, setOrigChecking] = useState(false);
  const [origResult, setOrigResult] = useState<{
    aiScore: number; humanScore: number; verdict: string; tips: string[];
  } | null>(null);

  const [manualRequesting, setManualRequesting] = useState(false);

  // ── Прогресс решения ────────────────────────────────────────────────────
  const [solveProgress, setSolveProgress] = useState(0);

  const { data: task, isLoading, refetch } = useGetTask(id, {
    query: {
      refetchInterval: (query) => {
        const data = query.state.data as { status?: string } | undefined;
        if (data && (data.status === 'pending' || data.status === 'processing')) return 3000;
        return false;
      }
    }
  });

  // Toast when task transitions to completed or failed
  useEffect(() => {
    if (!task) return;
    const prev = prevStatusRef.current;
    if (prev && prev !== task.status) {
      if (task.status === 'completed') {
        toast({
          title: "✅ Задача решена!",
          description: `Нейросеть завершила работу над "${task.title}". Решение готово.`,
        });
      } else if (task.status === 'failed') {
        toast({
          variant: "destructive",
          title: "Ошибка решения",
          description: "Не удалось решить задачу. Попробуйте ещё раз.",
        });
      } else if (task.status === 'needs_manual') {
        toast({
          title: "⚠️ ИИ не справился",
          description: "Средства возвращены. Вы можете запросить ручное решение от специалиста.",
        });
      }
    }
    prevStatusRef.current = task.status;
  }, [task?.status]);

  // Анимация прогресса при решении
  useEffect(() => {
    if (!task) return;
    if (task.status === "completed") { setSolveProgress(100); return; }
    if (task.status !== "pending" && task.status !== "processing") return;

    // Ожидаемое время в секундах по режиму (с запасом, чтобы бар не застревал)
    const expectedSec: Record<string, number> = {
      fast: 100, standard: 220, premium: 420, super_premium: 600,
    };
    const total = expectedSec[task.solvingMode] ?? 220;

    const startTime = task.createdAt ? new Date(task.createdAt).getTime() : Date.now();

    const tick = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      // Логистическая кривая: медленнее растёт, кап 88% — дальше спиннер вместо числа
      const raw = elapsed / total;
      const p = Math.min(88, Math.round(100 * (1 - Math.exp(-2.0 * raw))));
      setSolveProgress(p);
    };
    tick();
    const id = setInterval(tick, 800);
    return () => clearInterval(id);
  }, [task?.status, task?.solvingMode, task?.createdAt]);

  const copyToClipboard = () => {
    if (task?.result) {
      navigator.clipboard.writeText(task.result);
      toast({ title: "Скопировано", description: "Решение скопировано в буфер обмена" });
    }
  };

  const handleShare = () => {
    if (!task) return;
    const url = `${window.location.origin}/tasks/shared/${task.id}`;
    setShareUrl(url);
    navigator.clipboard.writeText(url);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 3000);
    toast({ title: "Ссылка скопирована", description: "Любой, у кого есть ссылка, сможет просмотреть решение" });
  };

  const handleCheckOriginality = async () => {
    if (!task) return;
    setOrigChecking(true);
    setOrigResult(null);
    try {
      const token = localStorage.getItem("authToken");
      const resp = await fetch(`/api/tasks/${task.id}/check-originality`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || "Ошибка проверки");
      setOrigResult(data);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    } finally {
      setOrigChecking(false);
    }
  };

  const handleExportDocx = async () => {
    if (!task) return;
    try {
      await exportTaskToDocx({
        title: task.title,
        subject: task.subject,
        taskType: task.taskType,
        description: task.description,
        result: task.result,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
        solvingMode: task.solvingMode,
      });
    } catch {
      toast({ variant: "destructive", title: "Ошибка экспорта", description: "Не удалось создать DOCX файл" });
    }
  };

  const submitRevision = async () => {
    if (!task || revisionNotes.trim().length < 5) return;
    setRevisionLoading(true);
    try {
      const token = localStorage.getItem("authToken");
      const resp = await fetch(`/api/tasks/${task.id}/revision`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ revisionNotes }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.message || "Ошибка запроса доработки");
      toast({ title: "Доработка запущена", description: `Списано ~${json.revisionCost} ₽. Перенаправляем...` });
      updateBalance();
      setLocation(`/tasks/${json.id}`);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    } finally {
      setRevisionLoading(false);
    }
  };

  const handleRequestManual = async () => {
    if (!task) return;
    setManualRequesting(true);
    try {
      const token = localStorage.getItem("authToken");
      const resp = await fetch(`/api/tasks/${task.id}/request-manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || "Ошибка запроса");
      toast({ title: "✅ Запрос отправлен", description: "Специалист свяжется с вами в ближайшее время." });
      refetch();
      updateBalance();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    } finally {
      setManualRequesting(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim() || !task) return;
    setImageLoading(true);
    try {
      const token = localStorage.getItem("authToken");
      const resp = await fetch("/api/tasks/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: imagePrompt.trim(), taskId: task.id }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        if (resp.status === 402) {
          toast({ variant: "destructive", title: "Недостаточно средств", description: `Нужно ${data.required} ₽` });
        } else {
          throw new Error(data.message || "Ошибка генерации");
        }
        return;
      }
      setGeneratedImages(prev => [{ url: data.url, prompt: imagePrompt.trim() }, ...prev]);
      setImagePrompt("");
      updateBalance();
      toast({ title: "Изображение создано", description: `Списано ${data.cost} ₽` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    } finally {
      setImageLoading(false);
    }
  };

  const handleDownloadImage = async (url: string, filename: string) => {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, "_blank");
    }
  };

  const hasSlides = task?.result ? /===\s*СЛАЙД\s*\d+/i.test(task.result) : false;

  const handleExportPptx = async () => {
    if (!task?.result) return;
    try {
      await exportToPptx(task.title, task.subject, task.result);
    } catch {
      toast({ variant: "destructive", title: "Ошибка экспорта", description: "Не удалось создать PPTX файл" });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 bg-card rounded-full animate-pulse"></div>
          <div className="h-8 w-64 bg-card rounded animate-pulse"></div>
        </div>
        <Card className="bg-card/40 border-white/5 h-96 animate-pulse"></Card>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold mb-2">Задача не найдена</h2>
        <p className="text-muted-foreground mb-6">Возможно она была удалена или вы перешли по неверной ссылке.</p>
        <Link href="/tasks">
          <Button variant="outline">Вернуться к списку</Button>
        </Link>
      </div>
    );
  }

  // Текущий этап по прогрессу
  const getSolveStage = (p: number, mode: string) => {
    const stages = [
      { from: 0,  icon: Cpu,      label: "Подготовка и анализ задания..." },
      { from: 20, icon: Zap,      label: "ИИ-воркеры параллельно решают..." },
      { from: 48, icon: Brain,    label: "Синтезатор обрабатывает ответы..." },
      { from: 68, icon: GitMerge, label: "Финальная проверка и форматирование..." },
      { from: 75, icon: Sparkles, label: "Финализирую решение..." },
    ];
    for (let i = stages.length - 1; i >= 0; i--) {
      if (p >= stages[i].from) return stages[i];
    }
    return stages[0];
  };

  const getStatusDisplay = () => {
    switch (task.status) {
      case 'completed': 
        return (
          <div className="flex items-center gap-2 text-green-500 bg-green-500/10 px-4 py-2 rounded-lg border border-green-500/20">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-semibold">Выполнено успешно</span>
          </div>
        );
      case 'processing': 
        return (
          <div className="flex items-center gap-2 text-blue-500 bg-blue-500/10 px-4 py-2 rounded-lg border border-blue-500/20">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="font-semibold">ИИ решает задачу...</span>
          </div>
        );
      case 'pending': 
        return (
          <div className="flex items-center gap-2 text-yellow-500 bg-yellow-500/10 px-4 py-2 rounded-lg border border-yellow-500/20">
            <Clock className="w-5 h-5" />
            <span className="font-semibold">В очереди на обработку</span>
          </div>
        );
      case 'failed': 
        return (
          <div className="flex items-center gap-2 text-red-500 bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/20">
            <AlertCircle className="w-5 h-5" />
            <span className="font-semibold">Ошибка решения</span>
          </div>
        );
      case 'needs_manual':
        return (
          <div className="flex items-center gap-2 text-amber-500 bg-amber-500/10 px-4 py-2 rounded-lg border border-amber-500/20">
            <HandHelping className="w-5 h-5" />
            <span className="font-semibold">ИИ не справился — нужно ручное решение</span>
          </div>
        );
      case 'manual_requested':
        return (
          <div className="flex items-center gap-2 text-sky-500 bg-sky-500/10 px-4 py-2 rounded-lg border border-sky-500/20">
            <UserCheck className="w-5 h-5" />
            <span className="font-semibold">Передано специалисту</span>
          </div>
        );
    }
  };

  // Convert task mode to ru
  const modeDisplay = {
    fast: "Быстрый режим",
    standard: "Стандартный",
    premium: "Премиум (Reasoning)"
  }[task.solvingMode] || task.solvingMode;

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Link href="/tasks">
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{task.title}</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <span className="font-mono">{task.id}</span>
            <span>•</span>
            <span>{format(new Date(task.createdAt), "d MMMM yyyy, HH:mm", { locale: ru })}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          {/* Status Banner */}
          {(task.status === 'pending' || task.status === 'processing') ? (() => {
            const stage = getSolveStage(solveProgress, task.solvingMode);
            const StageIcon = stage.icon;
            return (
              <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/8 to-blue-500/5 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-violet-500/10">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
                        <Brain className="w-4.5 h-4.5 text-violet-400 animate-pulse" />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {task.status === 'pending' ? 'В очереди — скоро начнём' : 'ИИ решает задачу'}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <StageIcon className="w-3 h-3 text-violet-400" />
                        <p className="text-xs text-violet-300/80">{stage.label}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {solveProgress >= 75 ? (
                      <RefreshCw className="h-6 w-6 text-violet-400 animate-spin" />
                    ) : (
                      <span className="text-2xl font-bold text-violet-300 tabular-nums">{solveProgress}%</span>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-8 w-8 p-0 rounded-lg hover:bg-white/8">
                      <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="px-5 py-3.5 space-y-3">
                  <div className="h-2 rounded-full bg-violet-500/10 border border-violet-500/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-blue-500 transition-all duration-700 ease-out ${solveProgress >= 75 ? "animate-pulse" : ""}`}
                      style={{ width: `${solveProgress}%` }}
                    />
                  </div>

                  {/* Этапы */}
                  <div className="flex justify-between gap-1">
                    {[
                      { p: 0,  icon: Cpu,      tip: "Анализ" },
                      { p: 25, icon: Zap,      tip: "Воркеры" },
                      { p: 48, icon: Brain,    tip: "Синтез" },
                      { p: 68, icon: GitMerge, tip: "Проверка" },
                      { p: 75, icon: Sparkles, tip: "Готово" },
                    ].map(({ p, icon: Icon, tip }) => (
                      <div key={p} className="flex flex-col items-center gap-1 min-w-0" aria-label={tip}>
                        <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all duration-500 ${
                          solveProgress >= p
                            ? "bg-violet-500/30 border-violet-500/60"
                            : "bg-muted/20 border-border/30"
                        }`}>
                          <Icon className={`w-3 h-3 transition-colors ${solveProgress >= p ? "text-violet-300" : "text-muted-foreground/40"}`} />
                        </div>
                        <span className="sr-only">{tip}</span>
                        <span className={`hidden sm:inline text-[10px] transition-colors ${solveProgress >= p ? "text-violet-300/70" : "text-muted-foreground/30"}`} aria-hidden="true">{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })() : (
            <div className="flex justify-between items-center bg-card/60 border border-white/10 p-4 rounded-xl backdrop-blur-sm">
              {getStatusDisplay()}
            </div>
          )}

          {/* Condition */}
          <Card className="bg-card/40 border-white/5 shadow-none">
            <CardHeader className="pb-3 border-b border-white/5">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" /> 
                Условие
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 whitespace-pre-wrap text-sm leading-relaxed">
              {task.description || task.title}
            </CardContent>
          </Card>

          {/* Result */}
          {task.status === 'completed' && task.result && (
            <Card className="bg-gradient-to-b from-card/80 to-card/40 border-primary/20 shadow-[0_0_30px_rgba(124,58,237,0.05)]">
              <CardHeader className="pb-3 border-b border-white/5 flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" /> 
                  Решение
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  {hasSlides && (
                    <Button variant="ghost" size="sm" onClick={handleExportPptx} className="text-violet-400 hover:text-white hover:bg-violet-500/10 gap-2">
                      <Layers className="h-4 w-4" /> PPTX
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={handleExportDocx} className="text-muted-foreground hover:text-white gap-2">
                    <Download className="h-4 w-4" /> DOCX
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (!task) return;
                      try {
                        await exportTaskToPdf({
                          title: task.title,
                          subject: task.subject,
                          taskType: task.taskType,
                          description: task.description,
                          result: task.result,
                          createdAt: task.createdAt,
                          completedAt: task.completedAt,
                          solvingMode: task.solvingMode,
                        });
                      } catch (e) {
                        toast({ variant: "destructive", title: "Ошибка экспорта", description: "Не удалось создать PDF файл" });
                      }
                    }}
                    className="text-rose-400 hover:text-white hover:bg-rose-500/10 gap-2"
                  >
                    <FileText className="h-4 w-4" /> PDF
                  </Button>
                  <Button variant="ghost" size="sm" onClick={copyToClipboard} className="text-muted-foreground hover:text-white gap-2">
                    <Copy className="h-4 w-4" /> Копировать
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleShare}
                    className={`gap-2 ${shareCopied ? "text-emerald-400 hover:text-emerald-300" : "text-muted-foreground hover:text-white"}`}>
                    {shareCopied ? <><Link2 className="h-4 w-4" /> Ссылка скопирована!</> : <><Share2 className="h-4 w-4" /> Поделиться</>}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleCheckOriginality}
                    disabled={origChecking}
                    className="text-muted-foreground hover:text-white gap-2">
                    {origChecking ? <><RefreshCw className="h-4 w-4 animate-spin" /> Проверяю…</> : <><ShieldCheck className="h-4 w-4" /> Оригинальность</>}
                  </Button>
                  <Button variant="ghost" size="sm"
                    onClick={() => {
                      sessionStorage.setItem("uniqueness:handoff", JSON.stringify({
                        text: task.result,
                        source: "task",
                        topic: task.title,
                        ts: Date.now(),
                      }));
                      setLocation("/uniqueness");
                    }}
                    className="text-violet-400 hover:text-white hover:bg-violet-500/10 gap-2">
                    <Wand2 className="h-4 w-4" /> Улучшить
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="p-4 bg-black/30 rounded-lg border border-white/5">
                  <RenderMessage content={task.result || ""} />
                </div>
                <AIDisclaimer variant="result" />

                {/* Share URL display */}
                {shareUrl && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <Link2 className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-xs text-muted-foreground flex-1 truncate">{shareUrl}</span>
                    <button onClick={() => { navigator.clipboard.writeText(shareUrl); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); }}
                      className="text-xs text-primary hover:text-primary/80 shrink-0">
                      {shareCopied ? "✓" : "Копировать"}
                    </button>
                  </div>
                )}

                {/* Originality check result */}
                {origResult && (
                  <div className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">Проверка оригинальности</span>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="text-center">
                        <div className={`text-2xl font-black ${origResult.humanScore >= 70 ? "text-emerald-400" : origResult.humanScore >= 50 ? "text-amber-400" : "text-red-400"}`}>
                          {origResult.humanScore}%
                        </div>
                        <div className="text-xs text-muted-foreground">Человеческий текст</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-2xl font-black ${origResult.aiScore <= 30 ? "text-emerald-400" : origResult.aiScore <= 50 ? "text-amber-400" : "text-red-400"}`}>
                          {origResult.aiScore}%
                        </div>
                        <div className="text-xs text-muted-foreground">ИИ-признаки</div>
                      </div>
                      <div className={`flex-1 text-sm font-semibold px-3 py-1.5 rounded-lg ${
                        origResult.humanScore >= 70 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                        origResult.humanScore >= 50 ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                        "bg-red-500/10 text-red-400 border border-red-500/20"
                      }`}>
                        {origResult.verdict}
                      </div>
                    </div>
                    {origResult.tips?.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground">Как улучшить оригинальность:</p>
                        <ul className="space-y-1">
                          {origResult.tips.map((tip, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                              <span className="text-primary shrink-0">•</span> {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {task.status === 'failed' && (
            <Card className="bg-destructive/10 border-destructive/20">
              <CardContent className="pt-6">
                <p className="text-destructive font-medium mb-2">Не удалось решить задачу</p>
                <p className="text-sm text-muted-foreground">Система не смогла найти точное решение. Пожалуйста, проверьте правильность условия или попробуйте использовать более мощную модель (Премиум).</p>
                <Button variant="outline" onClick={handleRequestManual} disabled={manualRequesting} className="mt-4 border-amber-500/40 text-amber-400 hover:bg-amber-500/10 gap-2">
                  {manualRequesting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <HandHelping className="h-4 w-4" />}
                  Запросить ручное решение
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ИИ не справился — баннер с возвратом средств и предложением ручного решения */}
          {task.status === 'needs_manual' && (
            <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/8 to-orange-500/5 shadow-none">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0 mt-0.5">
                    <HandHelping className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-amber-300 mb-1">ИИ не смог решить эту задачу</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Нейросеть определила, что не в состоянии дать корректный ответ — возможно, задание требует специализированной программы (MATLAB, AutoCAD и т.д.), изображение плохого качества или данных недостаточно.
                    </p>
                    <p className="text-sm text-emerald-400 font-medium mt-2">✓ Оплата возвращена на ваш баланс</p>
                  </div>
                </div>
                {task.result && (
                  <div className="p-3 rounded-lg bg-black/20 border border-amber-500/10">
                    <p className="text-xs text-muted-foreground mb-1 font-medium">Пояснение от ИИ:</p>
                    <p className="text-sm text-foreground/80 leading-relaxed">{task.result}</p>
                  </div>
                )}
                <div className="flex items-center gap-3 flex-wrap pt-1">
                  <Button onClick={handleRequestManual} disabled={manualRequesting} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-2">
                    {manualRequesting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                    Запросить решение у специалиста
                  </Button>
                  <span className="text-xs text-muted-foreground">Специалист свяжется с вами в течение нескольких часов</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Запрос передан специалисту */}
          {task.status === 'manual_requested' && (
            <Card className="border-sky-500/30 bg-gradient-to-br from-sky-500/8 to-blue-500/5 shadow-none">
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center shrink-0 mt-0.5">
                    <UserCheck className="w-5 h-5 text-sky-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-sky-300 mb-1">Задача передана специалисту</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Ваш запрос принят и будет рассмотрен специалистом. Решение появится в ближайшее время. Мы уведомим вас, когда оно будет готово.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Генерация изображений через DALL-E 3 */}
          {task.status === 'completed' && (
            <Card className="bg-card/40 border-white/10">
              <CardHeader className="pb-3">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setImageGenOpen(o => !o)}
                >
                  <CardTitle className="text-base flex items-center gap-2">
                    <ImagePlus className="h-4 w-4 text-violet-400" />
                    Сгенерировать изображение
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">15 ₽/изображение</span>
                    {imageGenOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
                {!imageGenOpen && (
                  <p className="text-xs text-muted-foreground mt-1">Добавьте иллюстрацию к работе — схема, график, диаграмма или учебное изображение через ИИ.</p>
                )}
              </CardHeader>
              {imageGenOpen && (
                <CardContent className="space-y-3 pt-0">
                  <p className="text-xs text-muted-foreground">Опишите изображение на русском или английском. Например: «схема нейронной сети», «график зависимости давления от температуры», «блок-схема алгоритма сортировки».</p>
                  <Textarea
                    placeholder="Опишите изображение для ИИ..."
                    className="min-h-[80px] bg-background/50 text-sm resize-y"
                    value={imagePrompt}
                    onChange={e => setImagePrompt(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleGenerateImage(); }}
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">Создаётся ~15–30 секунд · DALL-E 3 (1024×1024)</p>
                    <Button
                      size="sm"
                      onClick={handleGenerateImage}
                      disabled={imageLoading || imagePrompt.trim().length < 3}
                      className="gap-2 bg-violet-600 hover:bg-violet-500"
                    >
                      {imageLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      {imageLoading ? "Генерирую..." : "Создать изображение"}
                    </Button>
                  </div>
                  {generatedImages.length > 0 && (
                    <div className="space-y-4 pt-2">
                      {generatedImages.map((img, i) => (
                        <div key={i} className="rounded-xl overflow-hidden border border-white/10 bg-black/20">
                          <img src={img.url} alt={img.prompt} className="w-full h-auto" />
                          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-black/30">
                            <p className="text-xs text-slate-400 truncate flex-1">{img.prompt}</p>
                            <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs text-slate-400 hover:text-white"
                              onClick={() => handleDownloadImage(img.url, `image-${i + 1}.png`)}>
                              <Download className="h-3.5 w-3.5" /> Скачать
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )}

          {/* Кнопка иллюстраций */}
          {task.status === 'completed' && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="border-violet-500/40 text-violet-300 hover:bg-violet-500/10 gap-2"
                onClick={() => { window.location.href = "/illustrations"; }}
              >
                <ImagePlus className="w-4 h-4" /> Создать иллюстрации к работе
              </Button>
            </div>
          )}

          {/* Доработка — показываем только для выполненных задач */}
          {task.status === 'completed' && (
            <Card className="bg-card/40 border-white/10">
              <CardHeader className="pb-3 border-b border-white/5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">Не устраивает качество решения?</p>
                  <Button variant="ghost" size="sm" onClick={handleRequestManual} disabled={manualRequesting} className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 gap-1.5 h-7 text-xs">
                    {manualRequesting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <HandHelping className="h-3 w-3" />}
                    Запросить решение у специалиста
                  </Button>
                </div>
              </CardHeader>
              <CardHeader className="pb-3 pt-3">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setRevisionOpen(o => !o)}
                >
                  <CardTitle className="text-base flex items-center gap-2">
                    <PenLine className="h-4 w-4 text-primary" />
                    Запросить доработку
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">от { { fast: 5, standard: 7, premium: 9, super_premium: 44 }[task.solvingMode] ?? 7 } ₽</span>
                    {revisionOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
                {!revisionOpen && (
                  <p className="text-xs text-muted-foreground mt-1">Не устраивает решение? Укажите замечания — ИИ доработает с учётом ваших правок.</p>
                )}
              </CardHeader>
              {revisionOpen && (
                <CardContent className="space-y-3 pt-0">
                  <p className="text-xs text-muted-foreground">Опишите, что именно нужно исправить или добавить. ИИ получит исходное решение и ваши замечания.</p>
                  <Textarea
                    placeholder="Например: &quot;Добавь расчёт погрешностей&quot;, &quot;В 3 пункте неверная формула&quot;, &quot;Нужен вывод с рекомендациями&quot;..."
                    className="min-h-[100px] bg-background/50 text-sm resize-y"
                    value={revisionNotes}
                    onChange={e => setRevisionNotes(e.target.value)}
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">Цена по объёму замечаний — краткая правка от { { fast: 5, standard: 7, premium: 9, super_premium: 44 }[task.solvingMode] ?? 7 } ₽</p>
                    <Button
                      size="sm"
                      onClick={submitRevision}
                      disabled={revisionLoading || revisionNotes.trim().length < 5}
                      className="gap-2"
                    >
                      {revisionLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
                      Запустить доработку
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="bg-card/40 border-white/5">
            <CardHeader>
              <CardTitle className="text-base">Детали задачи</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-sm text-muted-foreground">Предмет</span>
                <Badge variant="secondary" className="bg-white/10 hover:bg-white/20">{task.subject}</Badge>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-sm text-muted-foreground">Тип</span>
                <span className="text-sm font-medium capitalize">{task.taskType}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-sm text-muted-foreground">Режим</span>
                <span className="text-sm font-medium text-primary">{modeDisplay}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-sm text-muted-foreground">Сложность</span>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium">{task.complexityScore}/10</span>
                  <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden ml-2">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-primary" 
                      style={{ width: `${(task.complexityScore || 5) * 10}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-sm text-muted-foreground">Стоимость</span>
                <span className="text-sm font-bold">{task.actualCost || task.estimatedCost} ₽</span>
              </div>
              {task.completedAt && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-muted-foreground">Время решения</span>
                  <span className="text-sm font-medium">
                    {Math.round((new Date(task.completedAt).getTime() - new Date(task.createdAt).getTime()) / 60000) || '< 1'} мин
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
