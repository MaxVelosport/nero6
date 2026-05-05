import { useEffect, useMemo, useRef, useState } from "react";
import katex from "katex";
import { RenderMessage } from "@/lib/render-message";
import { useGetMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import { useToast } from "@/hooks/use-toast";
import { exportTaskToDocx } from "@/lib/word-export";
import { AIDisclaimer } from "@/components/ai-disclaimer";
import {
  ShieldCheck, Upload, FileText, ClipboardPaste, Sparkles,
  Loader2, AlertTriangle, CheckCircle2, ChevronRight, Copy,
  Wand2, RefreshCw, Info, Eye, FileDown, FileSearch, TrendingUp, Lightbulb,
} from "lucide-react";

const SAMPLE_TEXT = `Глобализация представляет собой процесс всемирной экономической, политической, культурной и религиозной интеграции и унификации. Основным следствием этого является мировое разделение труда, миграция в масштабах всей планеты капитала, человеческих и производственных ресурсов, стандартизация законодательства, экономических и технологических процессов, а также сближение и слияние культур разных стран. Это объективный процесс, который носит системный характер, то есть охватывает все сферы жизни общества. В результате глобализации мир становится более связанным и более зависимым от всех его субъектов. Происходит как увеличение количества общих для групп государств проблем, так и расширение числа и типов интегрирующихся субъектов, среди которых выступают не только государства, но и транснациональные корпорации, международные организации и отдельные индивиды.`;

// Очень грубая оценка времени на основе размера текста и уровня
function estimateSeconds(chars: number, kind: "check" | "rewrite", level?: string): number {
  if (kind === "check") return Math.max(8, Math.min(45, Math.ceil(chars / 600)));
  // Уникализация с чанкингом: каждый чанк ~6000 симв занимает 15-30 сек
  const chunks = Math.max(1, Math.ceil(chars / 12000));
  const perChunk = level === "deep" ? 35 : level === "medium" ? 22 : 16;
  return chunks * perChunk;
}

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("authToken");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

type Issue = { quote: string; reason: string; severity: "low" | "medium" | "high" };
type CheckResult = {
  uniqueness: number;
  verdict: string;
  summary: string;
  issues: Issue[];
  recommendations: string[];
  chars: number;
  cost: number;
  balanceAfter: number;
  truncated: boolean;
};
type RewriteResult = {
  result: string;
  level: string;
  label: string;
  changedPercent: number;
  chars: number;
  resultChars: number;
  cost: number;
  balanceAfter: number;
  truncated: boolean;
};
type Pricing = {
  check: { perK: number; min: number };
  rewrite: {
    light:  { perK: number; min: number; label: string; description: string };
    medium: { perK: number; min: number; label: string; description: string };
    deep:   { perK: number; min: number; label: string; description: string };
  };
  limits: { minChars: number; maxChars: number };
};

const ACCEPTED = ".pdf,.doc,.docx,.txt,.rtf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || "");
      resolve(s.includes(",") ? s.split(",")[1] : s);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function severityColor(s: Issue["severity"], isLight: boolean) {
  if (s === "high")   return isLight ? "bg-red-100 text-red-700 border-red-300"      : "bg-red-500/15 text-red-300 border-red-500/30";
  if (s === "medium") return isLight ? "bg-amber-100 text-amber-700 border-amber-300" : "bg-amber-500/15 text-amber-300 border-amber-500/30";
  return                isLight ? "bg-slate-100 text-slate-700 border-slate-300"     : "bg-slate-500/15 text-slate-300 border-slate-500/30";
}

function uniquenessColor(u: number) {
  if (u >= 85) return { ring: "ring-emerald-500", text: "text-emerald-500", bg: "bg-emerald-500", label: "Высокая" };
  if (u >= 70) return { ring: "ring-lime-500",    text: "text-lime-500",    bg: "bg-lime-500",    label: "Хорошая" };
  if (u >= 50) return { ring: "ring-amber-500",   text: "text-amber-500",   bg: "bg-amber-500",   label: "Средняя" };
  return         { ring: "ring-red-500",     text: "text-red-500",     bg: "bg-red-500",     label: "Низкая" };
}

export default function UniquenessPage() {
  const { data: user } = useGetMe();
  const { theme } = useTheme();
  const isLight = theme === "light";
  const { toast } = useToast();

  const [text, setText] = useState("");
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [rewriting, setRewriting] = useState<null | "light" | "medium" | "deep">(null);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [rewrite, setRewrite] = useState<RewriteResult | null>(null);
  const [showRewrite, setShowRewrite] = useState(false);
  const [preserveTerms, setPreserveTerms] = useState(true);
  const [activeIssueIdx, setActiveIssueIdx] = useState<number | null>(null);
  const [recheck, setRecheck] = useState<CheckResult | null>(null);
  const [rechecking, setRechecking] = useState(false);
  const [confirm, setConfirm] = useState<null | { cost: number; action: () => void; label: string }>(null);
  const [progress, setProgress] = useState<{ kind: "check" | "rewrite"; etaSec: number; startedAt: number } | null>(null);
  const [handoff, setHandoff] = useState<{ source: string; topic?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const highlightWrapRef = useRef<HTMLDivElement>(null);

  // Load pricing
  useEffect(() => {
    fetch(`${BASE_URL}/api/uniqueness/pricing`).then(r => r.json()).then(setPricing).catch(() => {});
  }, []);

  // Receive text handed off from other tools (coursework / etc.)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("uniqueness:handoff");
      if (!raw) return;
      const data = JSON.parse(raw);
      // Принимаем только свежие передачи (не старше 10 мин)
      if (data && typeof data.text === "string" && data.text.length > 50 && Date.now() - (data.ts || 0) < 600_000) {
        setText(data.text);
        setHandoff({ source: data.source || "external", topic: data.topic });
      }
      sessionStorage.removeItem("uniqueness:handoff");
    } catch {}
  }, []);

  // Auto-scroll to result after check
  useEffect(() => {
    if (check && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [check]);

  // Tick progress bar while AI works
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!progress) return;
    const id = setInterval(() => setTick(t => t + 1), 500);
    return () => clearInterval(id);
  }, [progress]);

  // When user clicks an issue, scroll the corresponding <mark> into view
  useEffect(() => {
    if (activeIssueIdx === null || !highlightWrapRef.current) return undefined;
    const el = highlightWrapRef.current.querySelector<HTMLElement>(`mark[data-idx="${activeIssueIdx}"]`);
    if (!el) return undefined;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("animate-pulse");
    const t = setTimeout(() => el.classList.remove("animate-pulse"), 1500);
    return () => clearTimeout(t);
  }, [activeIssueIdx, check]);

  const chars = text.trim().length;
  const minChars = pricing?.limits.minChars ?? 200;
  const maxChars = pricing?.limits.maxChars ?? 80000;
  const tooShort = chars > 0 && chars < minChars;
  const overLimit = chars > maxChars;

  const checkPrice = useMemo(() => {
    if (!pricing || chars === 0) return 0;
    const c = Math.min(chars, maxChars);
    return Math.max(pricing.check.min, Math.ceil((c / 1000) * pricing.check.perK));
  }, [pricing, chars, maxChars]);

  const rewritePrices = useMemo(() => {
    if (!pricing || chars === 0) return { light: 0, medium: 0, deep: 0 };
    const c = Math.min(chars, maxChars);
    const calc = (perK: number, min: number) => Math.max(min, Math.ceil((c / 1000) * perK));
    return {
      light:  calc(pricing.rewrite.light.perK,  pricing.rewrite.light.min),
      medium: calc(pricing.rewrite.medium.perK, pricing.rewrite.medium.min),
      deep:   calc(pricing.rewrite.deep.perK,   pricing.rewrite.deep.min),
    };
  }, [pricing, chars, maxChars]);

  const subscribed = (user as any)?.subscribed === true || ((user as any)?.subscriptionUntil && new Date((user as any).subscriptionUntil) > new Date());

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) {
      toast({ title: "Файл слишком большой", description: "Максимум 25 МБ", variant: "destructive" });
      return;
    }
    setExtracting(true);
    try {
      const base64 = await fileToBase64(f);
      const r = await fetch(`${BASE_URL}/api/uniqueness/extract`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ fileData: base64, fileType: f.type || "application/octet-stream", fileName: f.name }),
      });
      const d = await r.json();
      if (!r.ok) {
        toast({ title: "Ошибка", description: d.message || "Не удалось прочитать файл", variant: "destructive" });
      } else {
        setText(d.text);
        setCheck(null); setRewrite(null); setShowRewrite(false);
        if (d.truncated) {
          toast({ title: "Текст обрезан", description: `Использовано первые ${maxChars.toLocaleString("ru")} символов` });
        }
      }
    } catch (err: any) {
      toast({ title: "Ошибка", description: err?.message || "Не удалось загрузить файл", variant: "destructive" });
    } finally {
      setExtracting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handlePaste() {
    try {
      const t = await navigator.clipboard.readText();
      if (t) {
        setText(t);
        setCheck(null); setRewrite(null); setShowRewrite(false);
      }
    } catch {
      toast({ title: "Не удалось прочитать буфер", description: "Вставьте текст вручную (Ctrl+V)", variant: "destructive" });
    }
  }

  // Confirm dialog wrapper for expensive operations
  function maybeConfirm(cost: number, label: string, action: () => void) {
    if (cost > 30 && !subscribed) {
      setConfirm({ cost, label, action });
    } else {
      action();
    }
  }

  async function runCheck() {
    if (chars < minChars) return;
    maybeConfirm(checkPrice, `Анализ уникальности (${chars.toLocaleString("ru")} симв.)`, async () => {
      setChecking(true); setCheck(null); setRewrite(null); setShowRewrite(false); setActiveIssueIdx(null); setRecheck(null);
      setProgress({ kind: "check", etaSec: estimateSeconds(chars, "check"), startedAt: Date.now() });
      try {
        const r = await fetch(`${BASE_URL}/api/uniqueness/check`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ text }),
        });
        const d = await r.json();
        if (!r.ok) {
          if (r.status === 402) toast({ title: "Недостаточно средств", description: d.message, variant: "destructive" });
          else toast({ title: "Ошибка анализа", description: d.message || "Попробуйте позже", variant: "destructive" });
          return;
        }
        setCheck(d);
      } catch (err: any) {
        toast({ title: "Ошибка сети", description: err?.message, variant: "destructive" });
      } finally {
        setChecking(false); setProgress(null);
      }
    });
  }

  async function runRewrite(level: "light" | "medium" | "deep") {
    if (chars < minChars) return;
    const price = rewritePrices[level];
    const meta = pricing?.rewrite[level];
    maybeConfirm(price, `Уникализация (${meta?.label || level}, ${chars.toLocaleString("ru")} симв.)`, async () => {
      setRewriting(level); setRewrite(null); setRecheck(null);
      setProgress({ kind: "rewrite", etaSec: estimateSeconds(chars, "rewrite", level), startedAt: Date.now() });
      try {
        const r = await fetch(`${BASE_URL}/api/uniqueness/rewrite`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ text, level, preserveTerms }),
        });
        const d = await r.json();
        if (!r.ok) {
          if (r.status === 402) toast({ title: "Недостаточно средств", description: d.message, variant: "destructive" });
          else toast({ title: "Ошибка уникализации", description: d.message || "Попробуйте позже", variant: "destructive" });
          return;
        }
        setRewrite(d);
        setShowRewrite(true);
        toast({ title: "Готово", description: `Изменено ~${d.changedPercent}% содержимого` });
      } catch (err: any) {
        toast({ title: "Ошибка сети", description: err?.message, variant: "destructive" });
      } finally {
        setRewriting(null); setProgress(null);
      }
    });
  }

  // Re-check the rewritten text to confirm uniqueness improved
  async function runRecheck() {
    if (!rewrite) return;
    const c = rewrite.result.length;
    const cost = pricing ? Math.max(pricing.check.min, Math.ceil((c / 1000) * pricing.check.perK)) : 0;
    maybeConfirm(cost, `Проверка результата (${c.toLocaleString("ru")} симв.)`, async () => {
      setRechecking(true); setRecheck(null);
      setProgress({ kind: "check", etaSec: estimateSeconds(c, "check"), startedAt: Date.now() });
      try {
        const r = await fetch(`${BASE_URL}/api/uniqueness/check`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ text: rewrite.result }),
        });
        const d = await r.json();
        if (!r.ok) {
          if (r.status === 402) toast({ title: "Недостаточно средств", description: d.message, variant: "destructive" });
          else toast({ title: "Ошибка проверки", description: d.message || "Попробуйте позже", variant: "destructive" });
          return;
        }
        setRecheck(d);
        const delta = d.uniqueness - (check?.uniqueness ?? 0);
        toast({
          title: delta > 0 ? `Уникальность выросла на +${delta}%` : delta < 0 ? `Уникальность снизилась на ${delta}%` : "Уникальность не изменилась",
          description: `Было ${check?.uniqueness ?? 0}% → стало ${d.uniqueness}%`,
        });
      } catch (err: any) {
        toast({ title: "Ошибка сети", description: err?.message, variant: "destructive" });
      } finally {
        setRechecking(false); setProgress(null);
      }
    });
  }

  function loadSample() {
    setText(SAMPLE_TEXT);
    setCheck(null); setRewrite(null); setShowRewrite(false); setRecheck(null);
  }

  function copyRewrite() {
    if (!rewrite) return;
    navigator.clipboard.writeText(rewrite.result).then(
      () => toast({ title: "Скопировано", description: "Текст в буфере обмена" }),
      () => toast({ title: "Не удалось скопировать", variant: "destructive" })
    );
  }

  async function downloadDocx() {
    if (!rewrite) return;
    try {
      await exportTaskToDocx({
        title: "Уникализированный текст",
        subject: "Антиплагиат",
        taskType: "uniqueness",
        description: `Уровень: ${rewrite.label}. Изменено ~${rewrite.changedPercent}% содержимого.`,
        result: rewrite.result,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        solvingMode: "uniqueness",
      });
    } catch (err: any) {
      toast({ title: "Не удалось экспортировать", description: err?.message, variant: "destructive" });
    }
  }

  function downloadTxt() {
    if (!rewrite) return;
    const blob = new Blob([rewrite.result], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "uniqualized.txt"; a.click();
    URL.revokeObjectURL(url);
  }

  // Highlight issues in original text. LaTeX regions are rendered via katex.renderToString()
  // synchronously so they are never split by <mark> spans and never need a DOM post-pass.
  const highlightedText = useMemo(() => {
    if (!check || !text) return null;
    const escapeHtml = (s: string) => s.replace(/[&<>"']/g, ch => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[ch] as string));

    // 1. Find all LaTeX regions (atomic — never split by marks)
    type MathRegion = { start: number; end: number; formula: string; display: boolean };
    const mathRegions: MathRegion[] = [];
    const mathPatterns: [RegExp, boolean, number][] = [
      [/\$\$[\s\S]+?\$\$/g,     true,  2],
      [/\$[^$\n]+?\$/g,         false, 1],
      [/\\\[[\s\S]+?\\\]/g,     true,  2],
      [/\\\([\s\S]+?\\\)/g,     false, 2],
    ];
    for (const [re, display, delim] of mathPatterns) {
      for (const m of text.matchAll(re)) {
        mathRegions.push({ start: m.index!, end: m.index! + m[0].length, formula: m[0].slice(delim, -delim), display });
      }
    }
    mathRegions.sort((a, b) => a.start - b.start);
    const filteredMath: MathRegion[] = [];
    for (const r of mathRegions) {
      if (filteredMath.length === 0 || r.start >= filteredMath[filteredMath.length - 1].end) filteredMath.push(r);
    }

    // 2. Build issue highlight ranges — skip any that overlap a math region
    type MarkRegion = { start: number; end: number; idx: number; severity: Issue["severity"] };
    const markRanges: MarkRegion[] = [];
    check.issues.forEach((iss, idx) => {
      const q = iss.quote.trim();
      if (q.length < 8) return;
      const i = text.indexOf(q);
      if (i < 0) return;
      const end = i + q.length;
      if (filteredMath.some(m => i < m.end && end > m.start)) return;
      markRanges.push({ start: i, end, idx, severity: iss.severity });
    });
    markRanges.sort((a, b) => a.start - b.start);
    const filteredMarks: MarkRegion[] = [];
    for (const r of markRanges) {
      if (filteredMarks.length === 0 || r.start >= filteredMarks[filteredMarks.length - 1].end) filteredMarks.push(r);
    }

    // 3. Merge and sort all regions, then build HTML
    type Seg = ({ kind: "math" } & MathRegion) | ({ kind: "mark" } & MarkRegion);
    const segs: Seg[] = [
      ...filteredMath.map(r => ({ kind: "math" as const, ...r })),
      ...filteredMarks.map(r => ({ kind: "mark" as const, ...r })),
    ].sort((a, b) => a.start - b.start);

    let out = "";
    let pos = 0;
    for (const seg of segs) {
      if (seg.start > pos) out += escapeHtml(text.slice(pos, seg.start));
      if (seg.kind === "math") {
        try {
          out += katex.renderToString(seg.formula, { displayMode: seg.display, throwOnError: false, strict: false, output: "htmlAndMathml" });
        } catch {
          out += escapeHtml(text.slice(seg.start, seg.end));
        }
      } else {
        const cls = seg.severity === "high" ? "bg-red-500/25 text-red-200" : seg.severity === "medium" ? "bg-amber-500/25 text-amber-200" : "bg-slate-500/20";
        const clsLight = seg.severity === "high" ? "bg-red-200/70 text-red-900" : seg.severity === "medium" ? "bg-amber-200/70 text-amber-900" : "bg-slate-200/70";
        out += `<mark data-idx="${seg.idx}" class="${isLight ? clsLight : cls} rounded px-0.5 cursor-pointer transition-all ${activeIssueIdx === seg.idx ? "ring-2 ring-primary" : ""}">${escapeHtml(text.slice(seg.start, seg.end))}</mark>`;
      }
      pos = seg.end;
    }
    out += escapeHtml(text.slice(pos));
    return out;
  }, [check, text, isLight, activeIssueIdx]);

  function onHighlightClick(e: React.MouseEvent) {
    const tgt = e.target as HTMLElement;
    if (tgt.tagName === "MARK") {
      const i = Number(tgt.getAttribute("data-idx"));
      if (!Number.isNaN(i)) setActiveIssueIdx(i);
    }
  }

  const card    = isLight ? "bg-white border-slate-200"            : "bg-card border-white/10";
  const muted   = isLight ? "text-slate-500"                       : "text-muted-foreground";
  const heading = isLight ? "text-slate-900"                       : "text-white";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <AIDisclaimer variant="warning" />
      {/* Hero */}
      <div className={`relative overflow-hidden rounded-3xl border p-4 sm:p-6 md:p-8 ${isLight ? "border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50/40 to-white" : "border-amber-500/20 bg-gradient-to-br from-amber-600/15 via-orange-700/8 to-card/30"}`}>
        <div className={`absolute top-0 right-0 w-64 h-64 rounded-full ${isLight ? "bg-amber-300/20" : "bg-amber-500/15"} blur-3xl pointer-events-none`} />
        <div className="relative flex flex-col md:flex-row md:items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${isLight ? "bg-amber-500/15 border border-amber-500/30" : "bg-amber-500/20 border border-amber-500/40"}`}>
            <ShieldCheck className={`w-7 h-7 ${isLight ? "text-amber-600" : "text-amber-400"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className={`text-xl sm:text-2xl md:text-3xl font-bold tracking-tight ${heading}`}>Антиплагиат и уникализация</h1>
            <p className={`text-sm mt-1 ${muted}`}>
              Проверим текст курсовой или статьи на шаблонные обороты и заимствования, потом перепишем — сохраняя смысл, термины и формулы.
            </p>
          </div>
          {pricing && (
            <div className={`text-xs px-3 py-2 rounded-xl border ${isLight ? "bg-white/70 border-slate-200" : "bg-white/5 border-white/10"} ${muted}`}>
              <div>Анализ: <span className={isLight ? "text-amber-700 font-semibold" : "text-amber-300 font-semibold"}>{pricing.check.perK} ₽ / 1000 симв.</span></div>
              <div>Уникализация: от {pricing.rewrite.light.perK} ₽ / 1000 симв.</div>
            </div>
          )}
        </div>
      </div>

      {/* Handoff banner — текст пришёл из другого инструмента */}
      {handoff && text && (
        <div className={`rounded-xl border p-3 flex items-start gap-3 ${isLight ? "bg-emerald-50 border-emerald-200" : "bg-emerald-500/10 border-emerald-500/30"}`}>
          <CheckCircle2 className={`w-5 h-5 mt-0.5 shrink-0 ${isLight ? "text-emerald-700" : "text-emerald-300"}`} />
          <div className="flex-1 text-sm">
            <div className={`font-semibold ${heading}`}>
              Текст готовой работы загружен{handoff.topic ? ` — «${handoff.topic}»` : ""}
            </div>
            <div className={`text-xs mt-0.5 ${muted}`}>
              {chars.toLocaleString("ru")} симв. перенесено из {handoff.source === "coursework" ? "конструктора курсовой" : "инструмента"}. Можно сразу запускать проверку.
            </div>
          </div>
          <button
            onClick={() => setHandoff(null)}
            className={`text-xs px-2 py-1 rounded hover:bg-white/5 ${muted}`}
            aria-label="Закрыть"
          >✕</button>
        </div>
      )}

      {/* INPUT */}
      <div className={`rounded-2xl border ${card} p-4 sm:p-5 md:p-6 space-y-4`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className={`text-base sm:text-lg font-semibold ${heading}`}>1. Загрузите или вставьте текст</h2>
          <span className={`text-xs ${muted}`}>
            {chars > 0 ? `${chars.toLocaleString("ru")} симв.` : ""}
            {chars > 0 && pricing ? ` / макс. ${maxChars.toLocaleString("ru")}` : ""}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
          <Button variant="outline" disabled={extracting} onClick={() => fileRef.current?.click()} className="gap-2 w-full sm:w-auto justify-center">
            {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {extracting ? "Чтение файла…" : "Загрузить PDF / Word / TXT"}
          </Button>
          <Button variant="outline" onClick={handlePaste} className="gap-2 w-full sm:w-auto justify-center">
            <ClipboardPaste className="w-4 h-4" /> Вставить из буфера
          </Button>
          {!text && (
            <Button variant="ghost" onClick={loadSample} className="gap-2 w-full sm:w-auto justify-center">
              <Lightbulb className="w-4 h-4" /> Попробовать на примере
            </Button>
          )}
          {text && (
            <Button variant="ghost" onClick={() => { setText(""); setCheck(null); setRewrite(null); setShowRewrite(false); setRecheck(null); setHandoff(null); }} className="gap-2 w-full sm:w-auto justify-center sm:ml-auto">
              <RefreshCw className="w-4 h-4" /> Очистить
            </Button>
          )}
        </div>
        <input ref={fileRef} type="file" accept={ACCEPTED} className="hidden" onChange={handleFile} />

        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); if (check) { setCheck(null); setRewrite(null); setShowRewrite(false); setRecheck(null); } }}
            placeholder={`Вставьте текст курсовой, реферата или статьи. Минимум ${minChars} символов.`}
            className={`w-full min-h-[280px] p-4 pb-9 rounded-xl border text-sm leading-relaxed font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primary/40 ${isLight ? "bg-slate-50 border-slate-200 text-slate-900" : "bg-background/40 border-white/10 text-white"}`}
          />
          {chars > 0 && (
            <div className={`absolute bottom-2 right-3 text-xs px-2 py-0.5 rounded-md ${isLight ? "bg-white/80 text-slate-500" : "bg-background/70 text-white/60"}`}>
              {chars.toLocaleString("ru")} симв. · ~{Math.max(1, Math.round(chars / 1500))} мин чтения
            </div>
          )}
        </div>

        {tooShort && (
          <div className={`flex items-center gap-2 text-xs ${isLight ? "text-amber-600" : "text-amber-400"}`}>
            <Info className="w-3.5 h-3.5" /> Введите минимум {minChars} символов для анализа.
          </div>
        )}
        {overLimit && (
          <div className={`flex items-center gap-2 text-xs ${isLight ? "text-amber-600" : "text-amber-400"}`}>
            <Info className="w-3.5 h-3.5" /> Текст длиннее {maxChars.toLocaleString("ru")} символов будет обрезан при отправке.
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-white/5">
          <div className="flex-1">
            <div className={`text-sm font-medium ${heading}`}>Стоимость анализа</div>
            <div className={`text-xs ${muted}`}>
              {chars >= minChars
                ? <>~{checkPrice} ₽ {subscribed && <span className="text-emerald-500 font-semibold">(0 ₽ по подписке)</span>}</>
                : <>Цена появится после ввода текста</>}
            </div>
          </div>
          <Button
            size="lg"
            disabled={chars < minChars || checking}
            onClick={runCheck}
            className="gap-2 min-w-[220px]"
          >
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {checking ? "Анализирую…" : "Проверить уникальность"}
          </Button>
        </div>
      </div>

      {/* CHECK RESULT */}
      {check && (
        <div ref={resultRef} className={`rounded-2xl border ${card} p-5 md:p-6 space-y-5`}>
          <h2 className={`text-lg font-semibold ${heading}`}>2. Результат анализа</h2>

          <div className="grid md:grid-cols-[180px_1fr] gap-5 items-start">
            <ScoreRing score={check.uniqueness} isLight={isLight} />
            <div className="space-y-2">
              {check.verdict && <div className={`text-base font-semibold ${heading}`}>{check.verdict}</div>}
              {check.summary && <div className={`text-sm leading-relaxed ${muted}`}>{check.summary}</div>}
              <div className={`text-xs ${muted}`}>Проанализировано {check.chars.toLocaleString("ru")} симв. Списано {check.cost} ₽. Баланс: {check.balanceAfter} ₽.</div>
            </div>
          </div>

          {check.issues.length > 0 && (
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className={`text-sm font-semibold mb-2 ${heading}`}>Проблемные фрагменты ({check.issues.length})</div>
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {check.issues.map((iss, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveIssueIdx(i === activeIssueIdx ? null : i)}
                      className={`w-full text-left p-3 rounded-lg border text-xs transition-all ${severityColor(iss.severity, isLight)} ${activeIssueIdx === i ? "ring-2 ring-primary" : ""}`}
                    >
                      <div className="font-medium leading-snug mb-1">«{iss.quote}»</div>
                      <div className="opacity-80">{iss.reason}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className={`text-sm font-semibold ${heading}`}>Текст с подсветкой</div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className={`flex items-center gap-1 ${isLight ? "text-rose-700" : "text-rose-300"}`}><span className={`w-2 h-2 rounded-sm ${isLight ? "bg-rose-300" : "bg-rose-500/50"}`} />высокая</span>
                    <span className={`flex items-center gap-1 ${isLight ? "text-amber-700" : "text-amber-300"}`}><span className={`w-2 h-2 rounded-sm ${isLight ? "bg-amber-300" : "bg-amber-500/50"}`} />средняя</span>
                    <span className={`flex items-center gap-1 ${isLight ? "text-sky-700" : "text-sky-300"}`}><span className={`w-2 h-2 rounded-sm ${isLight ? "bg-sky-300" : "bg-sky-500/50"}`} />низкая</span>
                  </div>
                </div>
                <div
                  ref={highlightWrapRef}
                  onClick={onHighlightClick}
                  className={`p-3 rounded-lg border text-xs leading-relaxed font-mono whitespace-pre-wrap max-h-[420px] overflow-y-auto ${isLight ? "bg-slate-50 border-slate-200" : "bg-background/40 border-white/10"}`}
                  dangerouslySetInnerHTML={{ __html: highlightedText || "" }}
                />
              </div>
            </div>
          )}

          {check.recommendations.length > 0 && (
            <div className={`rounded-xl border p-4 ${isLight ? "bg-emerald-50 border-emerald-200" : "bg-emerald-500/8 border-emerald-500/20"}`}>
              <div className={`text-sm font-semibold flex items-center gap-2 mb-2 ${isLight ? "text-emerald-700" : "text-emerald-400"}`}>
                <CheckCircle2 className="w-4 h-4" /> Рекомендации
              </div>
              <ul className={`space-y-1 text-sm ${muted}`}>
                {check.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-2"><ChevronRight className="w-3.5 h-3.5 mt-1 shrink-0 opacity-60" /><span>{r}</span></li>
                ))}
              </ul>
            </div>
          )}

          {/* Rewrite CTA */}
          <div className="pt-4 border-t border-white/5">
            <h3 className={`text-base font-semibold mb-1 ${heading}`}>3. Уникализировать текст</h3>
            <p className={`text-xs mb-3 ${muted}`}>Перепишем выше загруженный текст с сохранением смысла, терминов, цитат и формул. Чем «глубже» уровень — тем сильнее переработка.</p>

            <label className={`flex items-center gap-2 text-xs cursor-pointer mb-3 ${muted}`}>
              <input type="checkbox" checked={preserveTerms} onChange={(e) => setPreserveTerms(e.target.checked)} className="rounded" />
              Сохранять научные термины и имена дословно
            </label>

            <div className="grid sm:grid-cols-3 gap-3">
              {(["light", "medium", "deep"] as const).map(level => {
                const meta = pricing?.rewrite[level];
                const price = rewritePrices[level];
                const accent = level === "light" ? "from-blue-500 to-cyan-500" : level === "medium" ? "from-violet-500 to-fuchsia-500" : "from-emerald-500 to-teal-500";
                return (
                  <button
                    key={level}
                    disabled={!!rewriting || chars < minChars}
                    onClick={() => runRewrite(level)}
                    className={`group p-4 rounded-xl border text-left transition-all hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed ${isLight ? "bg-white border-slate-200 hover:border-primary/40" : "bg-background/40 border-white/10 hover:border-primary/40"}`}
                  >
                    <div className={`w-8 h-1 rounded-full bg-gradient-to-r ${accent} mb-3`} />
                    <div className={`text-sm font-semibold mb-0.5 ${heading}`}>{meta?.label || level}</div>
                    <div className={`text-xs mb-3 ${muted}`}>{meta?.description}</div>
                    <div className="flex items-center justify-between">
                      <span className={`text-base font-bold ${heading}`}>
                        {subscribed ? "0 ₽" : `${price} ₽`}
                      </span>
                      {rewriting === level ? (
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      ) : (
                        <Wand2 className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* REWRITE RESULT */}
      {rewrite && showRewrite && (
        <div className={`rounded-2xl border ${card} p-5 md:p-6 space-y-4`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className={`text-lg font-semibold ${heading}`}>Готово: уникализированный текст</h2>
              <p className={`text-xs mt-1 ${muted}`}>
                Уровень: <span className={heading}>{rewrite.label}</span> · Изменено ~{rewrite.changedPercent}% · Списано {rewrite.cost} ₽ · Баланс: {rewrite.balanceAfter} ₽
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyRewrite} className="gap-2">
                <Copy className="w-3.5 h-3.5" /> Копировать
              </Button>
              <Button variant="outline" size="sm" onClick={downloadTxt} className="gap-2">
                <FileText className="w-3.5 h-3.5" /> .txt
              </Button>
              <Button variant="outline" size="sm" onClick={downloadDocx} className="gap-2">
                <FileDown className="w-3.5 h-3.5" /> .docx
              </Button>
            </div>
          </div>

          {/* Diff/result tabs */}
          <RewriteCompare original={text} rewritten={rewrite.result} isLight={isLight} />

          {/* Re-check uniqueness of the rewrite */}
          <div className={`rounded-xl border p-4 ${isLight ? "bg-violet-50 border-violet-200" : "bg-violet-500/8 border-violet-500/20"}`}>
            {!recheck ? (
              <div className="flex flex-wrap items-center gap-3">
                <FileSearch className={`w-5 h-5 ${isLight ? "text-violet-700" : "text-violet-300"}`} />
                <div className="flex-1 min-w-[200px]">
                  <div className={`text-sm font-semibold ${heading}`}>Проверить уникальность результата</div>
                  <div className={`text-xs ${muted}`}>
                    Запустим повторный анализ, чтобы убедиться, что показатель действительно вырос.
                    {!subscribed && pricing && (
                      <> Стоимость: ~{Math.max(pricing.check.min, Math.ceil((rewrite.result.length / 1000) * pricing.check.perK))} ₽.</>
                    )}
                  </div>
                </div>
                <Button onClick={runRecheck} disabled={rechecking} className="gap-2">
                  {rechecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {rechecking ? "Проверяю…" : "Перепроверить"}
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                <ScoreRing score={recheck.uniqueness} isLight={isLight} compact />
                <div className="flex-1 min-w-[200px]">
                  <div className={`text-sm font-semibold flex items-center gap-2 ${heading}`}>
                    <TrendingUp className={`w-4 h-4 ${recheck.uniqueness > (check?.uniqueness ?? 0) ? "text-emerald-500" : "text-amber-500"}`} />
                    Было {check?.uniqueness ?? 0}% → стало {recheck.uniqueness}%
                    {(() => {
                      const d = recheck.uniqueness - (check?.uniqueness ?? 0);
                      const cls = d > 0 ? (isLight ? "text-emerald-700 bg-emerald-100" : "text-emerald-300 bg-emerald-500/15") : d < 0 ? (isLight ? "text-rose-700 bg-rose-100" : "text-rose-300 bg-rose-500/15") : (isLight ? "text-slate-600 bg-slate-100" : "text-white/60 bg-white/10");
                      return <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{d > 0 ? `+${d}` : d}%</span>;
                    })()}
                  </div>
                  {recheck.verdict && <div className={`text-xs mt-1 ${muted}`}>{recheck.verdict}</div>}
                  <div className={`text-[11px] mt-1 ${muted}`}>Списано {recheck.cost} ₽ · Баланс: {recheck.balanceAfter} ₽</div>
                </div>
                <Button variant="outline" size="sm" onClick={runRecheck} disabled={rechecking} className="gap-2">
                  <RefreshCw className="w-3.5 h-3.5" /> Ещё раз
                </Button>
              </div>
            )}
          </div>

          <div className={`flex flex-wrap items-center gap-3 pt-2 ${muted} text-xs border-t border-white/5`}>
            <Sparkles className={`w-3.5 h-3.5 ${isLight ? "text-amber-600" : "text-amber-400"}`} />
            Хотите ещё раз переписать (с другого уровня)?
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto gap-2"
              onClick={() => { setText(rewrite.result); setCheck(null); setRewrite(null); setShowRewrite(false); setRecheck(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            >
              <RefreshCw className="w-3.5 h-3.5" /> Использовать как новый исходник
            </Button>
          </div>
        </div>
      )}

      {/* Progress overlay during AI work */}
      {progress && (
        <ProgressBanner
          isLight={isLight}
          kind={progress.kind}
          etaSec={progress.etaSec}
          startedAt={progress.startedAt}
        />
      )}

      {/* Confirm dialog for big charges */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setConfirm(null)}>
          <div
            className={`max-w-sm w-full rounded-2xl border p-6 ${isLight ? "bg-white border-slate-200" : "bg-zinc-900 border-white/10"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? "bg-amber-100 text-amber-700" : "bg-amber-500/15 text-amber-300"}`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className={`font-semibold ${heading}`}>Подтвердите списание</div>
                <div className={`text-xs ${muted}`}>Сумма выше обычной</div>
              </div>
            </div>
            <div className={`text-sm mb-1 ${heading}`}>{confirm.label}</div>
            <div className={`text-2xl font-bold mb-4 ${heading}`}>{confirm.cost} ₽</div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirm(null)}>Отмена</Button>
              <Button className="flex-1" onClick={() => { const a = confirm.action; setConfirm(null); a(); }}>Списать и запустить</Button>
            </div>
          </div>
        </div>
      )}

      {/* Help footer */}
      <div className={`rounded-2xl border p-4 text-xs ${muted} ${isLight ? "bg-slate-50/60 border-slate-200" : "bg-white/3 border-white/10"}`}>
        <strong className={heading}>Как это работает.</strong>{" "}
        Анализ оценивает текст лингвистически: ИИ ищет шаблонные обороты, общеизвестные формулировки и характерные «учебные» конструкции. Это не заменяет коммерческие сервисы (Antiplagiat.ru, Text.ru),
        но даёт быструю обратную связь и позволяет сразу же переписать проблемные места. Уникализация сохраняет смысл, термины, цитаты «…» и формулы $...$ — но всегда перечитайте результат перед сдачей.
      </div>
    </div>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────

function ScoreRing({ score, isLight, compact = false }: { score: number; isLight: boolean; compact?: boolean }) {
  const c = uniquenessColor(score);
  const size = compact ? 80 : 150;
  const radius = compact ? 30 : 60;
  const stroke = compact ? 7 : 10;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  const center = size / 2;
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
          <circle cx={center} cy={center} r={radius} stroke={isLight ? "#e2e8f0" : "rgba(255,255,255,0.08)"} strokeWidth={stroke} fill="none" />
          <circle
            cx={center} cy={center} r={radius}
            className={c.text}
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className={`${compact ? "text-base" : "text-3xl"} font-bold ${c.text}`}>{score}%</div>
          {!compact && <div className={`text-[10px] uppercase tracking-wider ${isLight ? "text-slate-500" : "text-muted-foreground"}`}>уникальность</div>}
        </div>
      </div>
      {!compact && <div className={`mt-2 text-xs font-medium ${c.text}`}>{c.label}</div>}
    </div>
  );
}

// ── Прогресс-баннер с обратным отсчётом ──────────────────────────────────────
function ProgressBanner({ isLight, kind, etaSec, startedAt }: { isLight: boolean; kind: "check" | "rewrite"; etaSec: number; startedAt: number }) {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const pct = Math.min(95, Math.round((elapsed / etaSec) * 100));
  const remaining = Math.max(0, etaSec - elapsed);
  const label = kind === "check" ? "Анализирую уникальность" : "Переписываю текст";
  return (
    <div className="fixed bottom-4 right-4 z-40 max-w-sm w-[calc(100vw-2rem)] sm:w-80">
      <div className={`rounded-2xl border p-4 shadow-2xl backdrop-blur ${isLight ? "bg-white/95 border-violet-200" : "bg-zinc-900/95 border-violet-500/30"}`}>
        <div className="flex items-center gap-2 mb-2">
          <Loader2 className={`w-4 h-4 animate-spin ${isLight ? "text-violet-700" : "text-violet-300"}`} />
          <div className={`text-sm font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>{label}…</div>
        </div>
        <div className={`relative h-1.5 rounded-full overflow-hidden ${isLight ? "bg-slate-200" : "bg-white/10"}`}>
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className={`text-[11px] mt-1.5 flex justify-between ${isLight ? "text-slate-500" : "text-muted-foreground"}`}>
          <span>прошло {elapsed}с</span>
          <span>{remaining > 0 ? `≈ ${remaining}с` : "почти готово…"}</span>
        </div>
      </div>
    </div>
  );
}

// ── Слово-уровневый diff: подсвечивает добавленные слова в переписанном тексте ─
function buildWordDiff(original: string, rewritten: string): { added: Set<string>; rewrittenHtml: string; originalHtml: string } {
  const tok = (s: string) => s.toLowerCase().replace(/ё/g, "е");
  const wordsOf = (s: string) => (s.match(/[a-zа-яё0-9]+/gi) || []).map(tok);
  const origSet = new Set(wordsOf(original));
  const rewrSet = new Set(wordsOf(rewritten));
  const added = new Set<string>();
  for (const w of rewrSet) if (!origSet.has(w) && w.length > 2) added.add(w);
  const removed = new Set<string>();
  for (const w of origSet) if (!rewrSet.has(w) && w.length > 2) removed.add(w);

  const escape = (s: string) => s.replace(/[&<>]/g, c => c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;");
  const wrap = (text: string, set: Set<string>, cls: string) => {
    return escape(text).replace(/[a-zа-яё0-9]+/gi, (m) => set.has(tok(m)) ? `<span class="${cls}">${m}</span>` : m);
  };
  return {
    added,
    rewrittenHtml: wrap(rewritten, added, "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded px-0.5"),
    originalHtml: wrap(original, removed, "bg-rose-500/15 text-rose-700 dark:text-rose-300 rounded px-0.5 line-through decoration-rose-500/40"),
  };
}

function RewriteCompare({ original, rewritten, isLight }: { original: string; rewritten: string; isLight: boolean }) {
  const [view, setView] = useState<"side" | "result" | "diff">("result");
  const box = isLight ? "bg-slate-50 border-slate-200 text-slate-900" : "bg-background/40 border-white/10 text-white";
  const diff = useMemo(() => buildWordDiff(original, rewritten), [original, rewritten]);

  const tabBtn = (mode: typeof view, label: string, Icon: any) => (
    <button
      onClick={() => setView(mode)}
      className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${view === mode ? "bg-primary text-primary-foreground" : isLight ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-white/5 text-muted-foreground hover:bg-white/10"}`}
    >
      <Icon className="w-3 h-3 inline mr-1.5" /> {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {tabBtn("result", "Только результат", Eye)}
        {tabBtn("side", "Бок-о-бок", AlertTriangle)}
        {tabBtn("diff", "Подсветка изменений", Sparkles)}
      </div>

      {view === "result" && (
        <div className={`p-4 rounded-xl border text-sm leading-relaxed max-h-[600px] overflow-y-auto ${box}`}>
          <RenderMessage content={rewritten} />
        </div>
      )}
      {view === "side" && (
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-semibold mb-1 opacity-60">ОРИГИНАЛ</div>
            <div className={`p-3 rounded-xl border text-xs leading-relaxed max-h-[500px] overflow-y-auto ${box}`}>
              <RenderMessage content={original} />
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold mb-1 opacity-60">УНИКАЛИЗИРОВАННЫЙ</div>
            <div className={`p-3 rounded-xl border text-xs leading-relaxed max-h-[500px] overflow-y-auto ${box}`}>
              <RenderMessage content={rewritten} />
            </div>
          </div>
        </div>
      )}
      {view === "diff" && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <span className={isLight ? "text-slate-600" : "text-muted-foreground"}>Подсветка слов:</span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">добавлено в новой версии</span>
            <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 line-through decoration-rose-500/40">удалено из оригинала</span>
            <span className={`ml-auto ${isLight ? "text-slate-500" : "text-muted-foreground"}`}>{diff.added.size} новых слов</span>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-semibold mb-1 opacity-60">ОРИГИНАЛ</div>
              <div
                className={`p-3 rounded-xl border text-xs leading-relaxed whitespace-pre-wrap max-h-[500px] overflow-y-auto ${box}`}
                dangerouslySetInnerHTML={{ __html: diff.originalHtml }}
              />
            </div>
            <div>
              <div className="text-xs font-semibold mb-1 opacity-60">УНИКАЛИЗИРОВАННЫЙ</div>
              <div
                className={`p-3 rounded-xl border text-xs leading-relaxed whitespace-pre-wrap max-h-[500px] overflow-y-auto ${box}`}
                dangerouslySetInnerHTML={{ __html: diff.rewrittenHtml }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
