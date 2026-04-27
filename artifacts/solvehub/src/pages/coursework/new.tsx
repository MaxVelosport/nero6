import { useState, useRef, useCallback, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { useUpdateBalance } from "@/hooks/useUpdateBalance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AILoadingState } from "@/components/ai-loading-state";
import {
  GraduationCap, BookOpen, FileText, Loader2, ArrowRight, ArrowLeft,
  CheckCircle2, Clock, RefreshCw, PenLine, ChevronDown, ChevronUp,
  Copy, Sparkles, List, ChevronRight, PlusCircle, Trash2,
  BookMarked, AlertCircle, LayoutList, BarChart2, Gift, Coins,
  Upload, X, ImageIcon, Paperclip, Download, FileTextIcon, ShieldCheck,
  ImagePlus, Wand2,
} from "lucide-react";
import { exportCourseworkToDocx } from "@/lib/word-export";
import { exportCourseworkToPdf } from "@/lib/pdf-export";
import { RenderMessage } from "@/lib/render-message";
import { AIDisclaimer } from "@/components/ai-disclaimer";

interface AttachedFile {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function getFileIconCw(type: string) {
  if (type.startsWith("image/")) return ImageIcon;
  if (type === "application/pdf") return FileText;
  if (type.includes("word") || type.includes("document")) return FileTextIcon;
  return Paperclip;
}

type WorkType = "coursework" | "diploma" | "master" | "phd_thesis" | "essay" | "report";

interface Chapter {
  id: number;
  title: string;
  estimatedPages: number;
}

type ChapterStatus = "pending" | "generating" | "generated" | "approved" | "revising";

const FREE_REVISIONS_PER_CHAPTER = 2;

interface CourseworkState {
  step: 1 | 2 | 3 | 4;
  workType: WorkType;
  topic: string;
  subject: string;
  requirements: string;
  targetPages: number;
  chapters: Chapter[];
  chapterStatuses: Record<number, ChapterStatus>;
  chapterContents: Record<number, string>;
  // Track free revisions remaining per chapter (2 per chapter by default)
  freeRevisionsLeft: Record<number, number>;
  currentChapterIdx: number;
  gost: boolean;
}

const WORK_TYPE_LABELS: Record<WorkType, string> = {
  coursework: "Курсовая работа",
  diploma:    "Дипломная (ВКР)",
  master:     "Магистерская диссертация",
  phd_thesis: "Кандидатская диссертация",
  essay:      "Реферат",
  report:     "Отчёт по практике",
};

const CHAPTER_COSTS: Record<WorkType, number> = {
  essay:     25,
  report:    30,
  coursework: 45,
  diploma:   65,
  master:    90,
  phd_thesis: 120,
};

const WORK_TYPE_PAGES: Record<WorkType, number> = {
  essay: 20, report: 30, coursework: 40, diploma: 60, master: 80, phd_thesis: 120,
};

const STORAGE_KEY = "coursework_wizard_v2_draft";

function loadDraft(): Partial<CourseworkState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveDraft(state: CourseworkState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

const getAuthHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` });

export default function CourseworkWizardPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: authUser, isLoading: authLoading } = useGetMe({ query: { retry: false } });
  const updateBalance = useUpdateBalance();

  // ── Redirect to login if not authenticated ──────────────────────────────
  useEffect(() => {
    if (!authLoading && !authUser) {
      setLocation("/login");
    }
  }, [authUser, authLoading, setLocation]);

  const [state, setState] = useState<CourseworkState>(() => {
    const defaults: CourseworkState = {
      step: 1, workType: "coursework", topic: "", subject: "",
      requirements: "", targetPages: 40, chapters: [],
      chapterStatuses: {}, chapterContents: {}, freeRevisionsLeft: {},
      currentChapterIdx: 0, gost: false,
    };
    const draft = loadDraft();
    if (draft?.step && draft.step > 1) {
      // Мёрджим черновик с дефолтами — защита от старых версий без freeRevisionsLeft
      const merged = { ...defaults, ...draft } as CourseworkState;
      // Если freeRevisionsLeft пустой но главы есть — инициализируем счётчики
      if (Object.keys(merged.freeRevisionsLeft).length === 0 && merged.chapters.length > 0) {
        merged.freeRevisionsLeft = Object.fromEntries(
          merged.chapters.map(c => [c.id, FREE_REVISIONS_PER_CHAPTER])
        );
      }
      return merged;
    }
    return defaults;
  });

  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [imagePromptCw, setImagePromptCw] = useState("");
  const [imageLoadingCw, setImageLoadingCw] = useState(false);
  const [generatedImagesCw, setGeneratedImagesCw] = useState<{ url: string; prompt: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback((files: File[]) => {
    const MAX_SIZE = 50 * 1024 * 1024;
    files.forEach(file => {
      if (file.size > MAX_SIZE) {
        toast({ variant: "destructive", title: `Файл слишком большой`, description: `${file.name}: максимум 50 МБ` });
        return;
      }
      if (attachments.length >= 10) {
        toast({ variant: "destructive", title: "Максимум 10 файлов" });
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setAttachments(prev => {
          if (prev.some(a => a.name === file.name && a.size === file.size)) return prev;
          if (prev.length >= 10) return prev;
          return [...prev, { name: file.name, type: file.type, size: file.size, dataUrl }];
        });
      };
      reader.readAsDataURL(file);
    });
  }, [attachments.length, toast]);

  const [generating, setGenerating] = useState(false);
  const [generatingSeconds, setGeneratingSeconds] = useState(0);
  const genTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [assembling, setAssembling] = useState(false);
  const [assembled, setAssembled] = useState(state.step === 4);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const stopAllRef = useRef(false);
  const [revisionNote, setRevisionNote] = useState("");
  const [showRevisionInput, setShowRevisionInput] = useState(false);
  const [editingChapterIdx, setEditingChapterIdx] = useState<number | null>(null);
  const [editingChapterTitle, setEditingChapterTitle] = useState("");
  const [userBalance, setUserBalance] = useState<number | null>(null);

  const nextIdRef = useRef(100);

  const update = useCallback((patch: Partial<CourseworkState>) => {
    setState(prev => {
      const next = { ...prev, ...patch };
      saveDraft(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (generating) {
      setGeneratingSeconds(0);
      genTimerRef.current = setInterval(() => setGeneratingSeconds(s => s + 1), 1000);
    } else {
      if (genTimerRef.current) { clearInterval(genTimerRef.current); genTimerRef.current = null; }
    }
    return () => { if (genTimerRef.current) clearInterval(genTimerRef.current); };
  }, [generating]);

  const approvedCount = state.chapters.filter(c => state.chapterStatuses[c.id] === "approved").length;
  const totalChapters = state.chapters.length;
  const allApproved = totalChapters > 0 && approvedCount === totalChapters;
  const totalPages = state.chapters.reduce((s, c) => s + c.estimatedPages, 0);
  const totalWords = approvedCount > 0
    ? Object.values(state.chapterContents).join(" ").split(/\s+/).filter(Boolean).length
    : 0;

  // Load user balance
  useEffect(() => {
    fetch("/api/users/profile", { headers: getAuthHeader() })
      .then(r => r.json())
      .then(d => { if (d.balance != null) setUserBalance(d.balance); })
      .catch(() => {});
  }, []);

  // ── Step 1 → 2: generate plan with AI ──────────────────────────────────────
  // Собираем краткое описание вложений для передачи в API
  const buildAttachmentSummary = () => {
    if (attachments.length === 0) return "";
    return `\n\nПриложенные материалы студента:\n${attachments.map(a => `  • ${a.name} (${formatFileSize(a.size)})`).join("\n")}\nПожалуйста, учти эти материалы при написании работы.`;
  };

  const handleGeneratePlan = async () => {
    if (!state.topic.trim() || !state.subject.trim()) return;
    setGeneratingPlan(true);
    try {
      const resp = await fetch("/api/coursework/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          topic: state.topic, subject: state.subject,
          workType: state.workType,
          requirements: (state.requirements || "") + buildAttachmentSummary(),
          targetPages: state.targetPages,
        }),
      });
      if (!resp.ok) throw new Error((await resp.json()).message || "Ошибка");
      const { chapters } = await resp.json();
      const statuses: Record<number, ChapterStatus> = {};
      const freeRevs: Record<number, number> = {};
      let id = 1;
      const mapped = chapters.map((c: { title: string; estimatedPages: number }) => {
        const cid = id++;
        statuses[cid] = "pending";
        freeRevs[cid] = FREE_REVISIONS_PER_CHAPTER;
        return { id: cid, title: c.title, estimatedPages: c.estimatedPages };
      });
      nextIdRef.current = id + 50;
      update({ step: 2, chapters: mapped, chapterStatuses: statuses, chapterContents: {}, freeRevisionsLeft: freeRevs, currentChapterIdx: 0 });
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingPlan(false);
    }
  };

  const handleRegeneratePlan = async () => {
    setGeneratingPlan(true);
    try {
      const resp = await fetch("/api/coursework/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          topic: state.topic, subject: state.subject,
          workType: state.workType,
          requirements: (state.requirements || "") + buildAttachmentSummary(),
          targetPages: state.targetPages,
        }),
      });
      if (!resp.ok) throw new Error((await resp.json()).message || "Ошибка");
      const { chapters } = await resp.json();
      const statuses: Record<number, ChapterStatus> = {};
      const freeRevs: Record<number, number> = {};
      let id = 1;
      const mapped = chapters.map((c: { title: string; estimatedPages: number }) => {
        const cid = id++;
        statuses[cid] = "pending";
        freeRevs[cid] = FREE_REVISIONS_PER_CHAPTER;
        return { id: cid, title: c.title, estimatedPages: c.estimatedPages };
      });
      nextIdRef.current = id + 50;
      update({ chapters: mapped, chapterStatuses: statuses, chapterContents: {}, freeRevisionsLeft: freeRevs });
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingPlan(false);
    }
  };

  const handleApprovePlan = () => update({ step: 3, currentChapterIdx: 0 });

  // ── Step 3: generate chapter with real AI ─────────────────────────────────
  const handleGenerateChapter = async () => {
    const chapter = state.chapters[state.currentChapterIdx];
    if (!chapter) return;
    setGenerating(true);
    update({ chapterStatuses: { ...state.chapterStatuses, [chapter.id]: "generating" } });
    setShowRevisionInput(false);
    setRevisionNote("");
    try {
      const resp = await fetch("/api/coursework/generate-chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          topic: state.topic, subject: state.subject,
          workType: state.workType,
          requirements: (state.requirements || "") + buildAttachmentSummary(),
          chapter: { title: chapter.title, estimatedPages: chapter.estimatedPages },
          allChapters: state.chapters.map(c => ({ title: c.title, estimatedPages: c.estimatedPages })),
          chapterIndex: state.currentChapterIdx,
        }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        if (resp.status === 402) {
          toast({ title: "Недостаточно средств", description: `Нужно ${json.required} ₽, на балансе ${json.balance} ₽. Пополните баланс.`, variant: "destructive" });
          update({ chapterStatuses: { ...state.chapterStatuses, [chapter.id]: "pending" } });
          return;
        }
        throw new Error(json.message || "Ошибка генерации");
      }
      // Синхронизируем freeRevisionsLeft с сервером (сервер вернул актуальное значение)
      const serverFreeRevs = typeof json.freeRevisionsLeft === "number"
        ? json.freeRevisionsLeft
        : FREE_REVISIONS_PER_CHAPTER;
      update({
        chapterStatuses: { ...state.chapterStatuses, [chapter.id]: "generated" },
        chapterContents: { ...state.chapterContents, [chapter.id]: json.content },
        freeRevisionsLeft: { ...state.freeRevisionsLeft, [chapter.id]: serverFreeRevs },
      });
      if (json.balanceAfter != null) setUserBalance(json.balanceAfter);
      updateBalance(json.balanceAfter);
      toast({
        title: `Раздел написан`,
        description: `Списано ${json.cost} ₽ · Баланс: ${json.balanceAfter} ₽ · ${serverFreeRevs} бесплатных доработки`,
      });
    } catch (err: any) {
      update({ chapterStatuses: { ...state.chapterStatuses, [chapter.id]: "pending" } });
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleApproveChapter = () => {
    const chapter = state.chapters[state.currentChapterIdx];
    if (!chapter) return;
    update({ chapterStatuses: { ...state.chapterStatuses, [chapter.id]: "approved" } });
    const nextIdx = state.currentChapterIdx + 1;
    if (nextIdx < state.chapters.length) {
      update({ currentChapterIdx: nextIdx });
    }
    toast({ title: "Раздел согласован ✓" });
  };

  // ── Revision (free or paid) ───────────────────────────────────────────────
  const handleReviseChapter = async () => {
    const chapter = state.chapters[state.currentChapterIdx];
    if (!chapter || !revisionNote.trim()) return;

    const freeLeft = state.freeRevisionsLeft[chapter.id] ?? 0;
    const isFree = freeLeft > 0;
    const cost = isFree ? 0 : Math.round(CHAPTER_COSTS[state.workType] * 0.7);

    if (!isFree && userBalance != null && userBalance < cost) {
      toast({ title: "Недостаточно средств", description: `Нужно ${cost} ₽ для платной доработки. Пополните баланс.`, variant: "destructive" });
      return;
    }

    setGenerating(true);
    setShowRevisionInput(false);
    update({ chapterStatuses: { ...state.chapterStatuses, [chapter.id]: "revising" } });

    try {
      const resp = await fetch("/api/coursework/revise-chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          topic: state.topic, subject: state.subject,
          workType: state.workType,
          requirements: (state.requirements || "") + buildAttachmentSummary(),
          chapter: { title: chapter.title, estimatedPages: chapter.estimatedPages },
          allChapters: state.chapters.map(c => ({ title: c.title, estimatedPages: c.estimatedPages })),
          chapterIndex: state.currentChapterIdx,
          currentContent: state.chapterContents[chapter.id] || "",
          revisionNotes: revisionNote.trim(),
          // isFree теперь определяет сервер — не передаём
        }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        if (resp.status === 402) {
          toast({ title: "Недостаточно средств", description: `Нужно ${json.required} ₽. Пополните баланс.`, variant: "destructive" });
          update({ chapterStatuses: { ...state.chapterStatuses, [chapter.id]: "generated" } });
          return;
        }
        throw new Error(json.message || "Ошибка доработки");
      }

      // Используем freeRevisionsLeft от сервера — он авторитетный источник
      const newFreeLeft = typeof json.freeRevisionsLeft === "number"
        ? json.freeRevisionsLeft
        : (json.isFree ? Math.max(0, freeLeft - 1) : freeLeft);

      update({
        chapterStatuses: { ...state.chapterStatuses, [chapter.id]: "generated" },
        chapterContents: { ...state.chapterContents, [chapter.id]: json.content },
        freeRevisionsLeft: { ...state.freeRevisionsLeft, [chapter.id]: newFreeLeft },
      });
      setRevisionNote("");

      if (json.isFree) {
        toast({
          title: "Раздел доработан бесплатно ✓",
          description: newFreeLeft > 0
            ? `Осталось ${newFreeLeft} бесплатных ${newFreeLeft === 1 ? "доработка" : "доработки"}`
            : "Бесплатные доработки исчерпаны — следующая будет платной",
        });
      } else {
        if (json.cost != null) setUserBalance(b => b != null ? b - json.cost : b);
        updateBalance();
        toast({ title: "Раздел доработан", description: `Списано ${json.cost} ₽` });
      }
    } catch (err: any) {
      update({ chapterStatuses: { ...state.chapterStatuses, [chapter.id]: "generated" } });
      toast({ title: "Ошибка доработки", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  // ── Generate All chapters sequentially ───────────────────────────────────
  const handleGenerateAll = async () => {
    if (isGeneratingAll || generating) return;
    stopAllRef.current = false;
    setIsGeneratingAll(true);
    setGenerating(true);

    const toProcess = state.chapters
      .map((c, idx) => ({ chapter: c, idx }))
      .filter(({ chapter }) => state.chapterStatuses[chapter.id] === "pending");

    for (const { chapter, idx } of toProcess) {
      if (stopAllRef.current) break;

      setState(prev => {
        const next = { ...prev, currentChapterIdx: idx, chapterStatuses: { ...prev.chapterStatuses, [chapter.id]: "generating" as ChapterStatus } };
        saveDraft(next);
        return next;
      });

      try {
        const resp = await fetch("/api/coursework/generate-chapter", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({
            topic: state.topic, subject: state.subject,
            workType: state.workType,
            requirements: (state.requirements || "") + buildAttachmentSummary(),
            chapter: { title: chapter.title, estimatedPages: chapter.estimatedPages },
            allChapters: state.chapters.map(c => ({ title: c.title, estimatedPages: c.estimatedPages })),
            chapterIndex: idx,
          }),
        });
        const json = await resp.json();
        if (!resp.ok) {
          if (resp.status === 402) {
            toast({ title: "Недостаточно средств", description: `Нужно ${json.required} ₽, на балансе ${json.balance} ₽. Пополните баланс.`, variant: "destructive" });
            setState(prev => { const next = { ...prev, chapterStatuses: { ...prev.chapterStatuses, [chapter.id]: "pending" as ChapterStatus } }; saveDraft(next); return next; });
            break;
          }
          throw new Error(json.message || "Ошибка генерации");
        }
        const serverFreeRevs = typeof json.freeRevisionsLeft === "number" ? json.freeRevisionsLeft : FREE_REVISIONS_PER_CHAPTER;
        setState(prev => {
          const next = {
            ...prev,
            chapterStatuses: { ...prev.chapterStatuses, [chapter.id]: "generated" as ChapterStatus },
            chapterContents: { ...prev.chapterContents, [chapter.id]: json.content },
            freeRevisionsLeft: { ...prev.freeRevisionsLeft, [chapter.id]: serverFreeRevs },
          };
          saveDraft(next);
          return next;
        });
        if (json.balanceAfter != null) setUserBalance(json.balanceAfter);
        updateBalance(json.balanceAfter);
      } catch (err: any) {
        setState(prev => { const next = { ...prev, chapterStatuses: { ...prev.chapterStatuses, [chapter.id]: "pending" as ChapterStatus } }; saveDraft(next); return next; });
        toast({ title: "Ошибка", description: err.message, variant: "destructive" });
        break;
      }
    }

    setIsGeneratingAll(false);
    setGenerating(false);
  };

  // ── Step 4: assemble ──────────────────────────────────────────────────────
  const handleAssemble = async () => {
    setAssembling(true);
    update({ step: 4 });
    await new Promise(r => setTimeout(r, 1800));
    setAssembling(false);
    setAssembled(true);
  };

  const assembledText = state.chapters.map(c => {
    const content = state.chapterContents[c.id] || "";
    return `${c.title}\n${"─".repeat(40)}\n\n${content}`;
  }).join("\n\n\n");

  const handleCopyAll = () => {
    navigator.clipboard.writeText(assembledText);
    toast({ title: "Скопировано в буфер обмена" });
  };

  const handleNewWork = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState({
      step: 1, workType: "coursework", topic: "", subject: "", requirements: "",
      targetPages: 40, chapters: [], chapterStatuses: {}, chapterContents: {},
      freeRevisionsLeft: {}, currentChapterIdx: 0, gost: false,
    });
    setAssembled(false);
  };

  const handleGenerateImageCw = async () => {
    if (!imagePromptCw.trim()) return;
    setImageLoadingCw(true);
    try {
      const token = localStorage.getItem("authToken");
      const resp = await fetch("/api/tasks/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: imagePromptCw.trim() }),
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
      setGeneratedImagesCw(prev => [{ url: data.url, prompt: imagePromptCw.trim() }, ...prev]);
      setImagePromptCw("");
      updateBalance();
      toast({ title: "Изображение создано", description: `Списано ${data.cost} ₽` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    } finally {
      setImageLoadingCw(false);
    }
  };

  const MAX_CHAPTERS: Record<string, number> = {
    essay: 5, report: 6, coursework: 6, diploma: 7, master: 8, phd_thesis: 8,
  };
  const maxChapters = MAX_CHAPTERS[state.workType] ?? 6;

  const addChapter = () => {
    if (state.chapters.length >= maxChapters) {
      toast({
        title: "Нестандартное количество разделов",
        description: `Стандарт для «${WORK_TYPE_LABELS[state.workType] ?? "этого типа"}» — ${maxChapters} разделов. Раздел добавлен, но уточните у преподавателя.`,
      });
    }
    const id = nextIdRef.current++;
    const newChapter: Chapter = { id, title: "Новый раздел", estimatedPages: 8 };
    update({
      chapters: [...state.chapters, newChapter],
      chapterStatuses: { ...state.chapterStatuses, [id]: "pending" },
      freeRevisionsLeft: { ...state.freeRevisionsLeft, [id]: FREE_REVISIONS_PER_CHAPTER },
    });
  };

  const removeChapter = (id: number) => {
    const chapters = state.chapters.filter(c => c.id !== id);
    const statuses = { ...state.chapterStatuses }; delete statuses[id];
    const contents = { ...state.chapterContents }; delete contents[id];
    const freeRevs = { ...state.freeRevisionsLeft }; delete freeRevs[id];
    update({ chapters, chapterStatuses: statuses, chapterContents: contents, freeRevisionsLeft: freeRevs });
  };

  const saveChapterEdit = () => {
    if (editingChapterIdx === null) return;
    const chapters = [...state.chapters];
    chapters[editingChapterIdx] = { ...chapters[editingChapterIdx], title: editingChapterTitle };
    update({ chapters });
    setEditingChapterIdx(null);
  };

  const currentChapter = state.chapters[state.currentChapterIdx];
  const currentStatus = currentChapter ? state.chapterStatuses[currentChapter.id] : null;
  const currentContent = currentChapter ? state.chapterContents[currentChapter.id] : null;
  const currentFreeLeft = currentChapter ? (state.freeRevisionsLeft[currentChapter.id] ?? FREE_REVISIONS_PER_CHAPTER) : 0;

  const WORK_TYPES: WorkType[] = ["essay", "report", "coursework", "diploma", "master", "phd_thesis"];
  const WORK_ICONS: Record<WorkType, typeof BookOpen> = {
    essay: FileText, report: LayoutList, coursework: BookOpen,
    diploma: GraduationCap, master: BookMarked, phd_thesis: BarChart2,
  };

  const perChapterCost = CHAPTER_COSTS[state.workType];

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Научные работы</h1>
          <p className="text-slate-300 mt-1">Пошаговое написание с ИИ: план → главы → финальная сборка</p>
        </div>
        {userBalance != null && (
          <div className="flex items-center gap-1.5 text-sm text-slate-400 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
            <Coins className="w-3.5 h-3.5 text-yellow-400" />
            Баланс: <span className="text-white font-semibold">{userBalance} ₽</span>
          </div>
        )}
      </div>

      {/* Progress stepper */}
      <div className="relative flex items-center justify-between">
        <div className="absolute inset-x-0 top-5 h-0.5 bg-white/10 -z-10" />
        <div
          className="absolute left-0 top-5 h-0.5 bg-primary transition-all duration-500 -z-10"
          style={{ width: `${((state.step - 1) / 3) * 100}%` }}
        />
        {[
          { n: 1, label: "Тип и тема" },
          { n: 2, label: "План" },
          { n: 3, label: "Написание" },
          { n: 4, label: "Сборка" },
        ].map(({ n, label }) => (
          <div key={n} className={`flex flex-col items-center gap-2 ${state.step >= n ? "text-primary" : "text-slate-500"}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold bg-background border-2 transition-colors ${state.step >= n ? "border-primary" : "border-white/20"}`}>
              {state.step > n ? <CheckCircle2 className="w-5 h-5" /> : n}
            </div>
            <span className="text-xs font-medium bg-background px-1">{label}</span>
          </div>
        ))}
      </div>

      {/* ─── STEP 1 ─── */}
      {state.step === 1 && (
        <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
          <CardContent className="pt-6 space-y-5">
            {/* Work type */}
            <div>
              <p className="text-sm font-medium text-white mb-2">Тип работы</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {WORK_TYPES.map(wt => {
                  const Icon = WORK_ICONS[wt];
                  return (
                    <button
                      key={wt}
                      type="button"
                      onClick={() => update({ workType: wt, targetPages: WORK_TYPE_PAGES[wt] })}
                      className={`flex items-center gap-2 p-3 rounded-lg border text-sm transition-all text-left ${state.workType === wt ? "border-primary bg-primary/10 text-primary" : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20"}`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {WORK_TYPE_LABELS[wt]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Topic */}
            <div>
              <label className="text-sm font-medium text-white block mb-1.5">Тема работы <span className="text-red-400">*</span></label>
              <Input
                value={state.topic}
                onChange={e => update({ topic: e.target.value })}
                placeholder="Например: Анализ методов машинного обучения в задачах классификации текстов"
                className="bg-background/50"
              />
            </div>

            {/* Subject */}
            <div>
              <label className="text-sm font-medium text-white block mb-1.5">Дисциплина / Направление <span className="text-red-400">*</span></label>
              <Input
                value={state.subject}
                onChange={e => update({ subject: e.target.value })}
                placeholder="Например: Информатика, Экономика, Психология..."
                className="bg-background/50"
              />
            </div>

            {/* Requirements */}
            <div>
              <label className="text-sm font-medium text-white block mb-1.5">Требования преподавателя <span className="text-slate-500">(необязательно)</span></label>
              <Textarea
                value={state.requirements}
                onChange={e => update({ requirements: e.target.value })}
                placeholder="Методические указания, ограничения, особые требования к структуре..."
                className="bg-background/50 min-h-[80px] resize-none"
              />
            </div>

            {/* GOST formatting */}
            <div className="flex items-start gap-3 p-3 rounded-lg border border-white/10 bg-white/3 hover:bg-white/5 transition-colors cursor-pointer"
              onClick={() => update({ gost: !state.gost })}>
              <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${state.gost ? "border-primary bg-primary" : "border-white/30 bg-transparent"}`}>
                {state.gost && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-white">Оформить по ГОСТ <span className="ml-1 text-xs text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded">+5 ₽</span></p>
                <p className="text-xs text-slate-500 mt-0.5">Times New Roman 14pt · поля 30/15/20/20 мм · 1,5 интервал · красная строка · нумерация страниц · чёрные заголовки</p>
              </div>
            </div>

            {/* File attachments */}
            <div>
              <label className="text-sm font-medium text-white block mb-1.5">
                Прикреплённые материалы <span className="text-slate-500">(необязательно)</span>
              </label>
              <p className="text-xs text-slate-500 mb-2">Методические указания, примеры работ, исходные данные — PDF, DOCX, изображения, таблицы и другие файлы (до 50 МБ)</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt,.xlsx,.xls,.csv,.pptx,.ppt,.odt,.ods"
                className="hidden"
                onChange={e => { if (e.target.files) { processFiles(Array.from(e.target.files)); e.target.value = ""; } }}
              />
              <div
                className={`border-2 border-dashed rounded-xl p-4 transition-all cursor-pointer ${isDragOver ? "border-primary bg-primary/10" : "border-white/15 hover:border-white/30 bg-white/3"}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={e => { e.preventDefault(); setIsDragOver(false); if (e.dataTransfer.files) processFiles(Array.from(e.dataTransfer.files)); }}
              >
                {attachments.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-2 text-center pointer-events-none">
                    <Upload className="w-6 h-6 text-slate-500" />
                    <p className="text-sm text-slate-400">Нажмите или перетащите файлы сюда</p>
                    <p className="text-xs text-slate-600">PDF, DOCX, изображения, Excel, TXT и др.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 pointer-events-none">
                    {attachments.map((f, i) => {
                      const Icon = getFileIconCw(f.type);
                      return (
                        <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/5">
                          <Icon className="w-4 h-4 text-primary shrink-0" />
                          <span className="text-sm text-slate-200 flex-1 truncate">{f.name}</span>
                          <span className="text-xs text-slate-500 shrink-0">{formatFileSize(f.size)}</span>
                          <button
                            type="button"
                            className="pointer-events-auto text-slate-600 hover:text-red-400 transition-colors shrink-0"
                            onClick={e => { e.stopPropagation(); setAttachments(prev => prev.filter((_, j) => j !== i)); }}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      className="pointer-events-auto flex items-center gap-2 text-xs text-slate-500 hover:text-primary transition-colors mt-1 px-2"
                      onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> Добавить ещё
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Pages */}
            <div>
              <label className="text-sm font-medium text-white block mb-1.5">
                Целевой объём: <span className="text-primary">{state.targetPages} страниц</span>
              </label>
              <input
                type="range" min={10} max={150} step={5}
                value={state.targetPages}
                onChange={e => update({ targetPages: Number(e.target.value) })}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-0.5">
                <span>10 стр.</span><span>150 стр.</span>
              </div>
            </div>

            {/* Pricing info */}
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-200 flex gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-blue-400" />
              <div>
                <span className="font-medium">Цена: </span>
                {perChapterCost} ₽ за раздел · 2 бесплатные доработки каждого раздела
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-white/5">
              <Button onClick={handleGeneratePlan} disabled={generatingPlan || !state.topic.trim() || !state.subject.trim()} size="lg">
                {generatingPlan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Составить план структуры
                {!generatingPlan && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── STEP 2 ─── */}
      {state.step === 2 && (
        <div className="space-y-4 animate-in slide-in-from-right-8 duration-300">
          <Button variant="ghost" onClick={() => update({ step: 1 })} className="-ml-2">
            <ArrowLeft className="mr-2 h-4 w-4" /> Назад
          </Button>

          <Card className="bg-card/40 border-white/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <List className="w-5 h-5 text-primary" />
                  Предлагаемая структура
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-white/5 border-white/10 text-slate-300">
                    ~{totalPages} стр.
                  </Badge>
                  <Badge variant="secondary" className="bg-white/5 border-white/10 text-slate-300">
                    ~{state.chapters.length * perChapterCost} ₽
                  </Badge>
                  <Button variant="outline" size="sm" onClick={handleRegeneratePlan} disabled={generatingPlan} className="border-white/10">
                    {generatingPlan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                    Пересмотреть
                  </Button>
                </div>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                Тема: <span className="text-white">«{state.topic}»</span> · {WORK_TYPE_LABELS[state.workType]}
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {generatingPlan ? (
                <div className="flex items-center gap-3 py-8 justify-center text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span>ИИ составляет структуру работы...</span>
                </div>
              ) : (
                <>
                  {state.chapters.map((c, idx) => (
                    <div key={c.id} className="flex items-center gap-2 p-3 bg-white/5 rounded-lg border border-white/5 group">
                      <span className="text-xs text-slate-500 w-6 text-center shrink-0">{idx + 1}</span>
                      {editingChapterIdx === idx ? (
                        <div className="flex-1 flex items-center gap-2">
                          <Input
                            value={editingChapterTitle}
                            onChange={e => setEditingChapterTitle(e.target.value)}
                            className="h-7 text-sm bg-background/70 py-0"
                            autoFocus
                            onKeyDown={e => { if (e.key === "Enter") saveChapterEdit(); if (e.key === "Escape") setEditingChapterIdx(null); }}
                          />
                          <Button size="sm" variant="ghost" onClick={saveChapterEdit} className="h-7 px-2 text-xs">OK</Button>
                        </div>
                      ) : (
                        <span
                          className="flex-1 text-sm text-slate-200 cursor-pointer hover:text-white"
                          onClick={() => { setEditingChapterIdx(idx); setEditingChapterTitle(c.title); }}
                        >
                          {c.title}
                        </span>
                      )}
                      <Badge variant="secondary" className="text-xs bg-transparent border-white/10 text-slate-500 shrink-0">
                        ~{c.estimatedPages} стр.
                      </Badge>
                      <button
                        type="button"
                        onClick={() => removeChapter(c.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addChapter}
                    className="w-full flex items-center gap-2 p-2 text-sm text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <PlusCircle className="w-4 h-4" /> Добавить раздел
                  </button>
                </>
              )}
            </CardContent>
          </Card>

          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-sm text-green-200 flex gap-3">
            <Gift className="w-4 h-4 mt-0.5 shrink-0 text-green-400" />
            <span>Каждый раздел включает <strong>2 бесплатные доработки</strong>. Нажмите на название для редактирования.</span>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleApprovePlan} disabled={generatingPlan || state.chapters.length === 0} size="lg">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Одобрить и начать написание
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ─── STEP 3 ─── */}
      {state.step === 3 && (
        <div className="animate-in slide-in-from-right-8 duration-300">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <Button variant="ghost" onClick={() => update({ step: 2 })} className="-ml-2" disabled={isGeneratingAll}>
              <ArrowLeft className="mr-2 h-4 w-4" /> К плану
            </Button>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">{approvedCount} из {totalChapters} согласовано</span>
                <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all rounded-full" style={{ width: `${totalChapters > 0 ? (approvedCount / totalChapters) * 100 : 0}%` }} />
                </div>
              </div>
              {state.chapters.some(c => state.chapterStatuses[c.id] === "pending") && (
                isGeneratingAll ? (
                  <Button size="sm" variant="outline" className="border-red-500/40 text-red-400 hover:bg-red-500/10"
                    onClick={() => { stopAllRef.current = true; }}>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Остановить
                  </Button>
                ) : (
                  <Button size="sm" onClick={handleGenerateAll} disabled={generating}
                    className="bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30">
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Сгенерировать всё ({state.chapters.filter(c => state.chapterStatuses[c.id] === "pending").length} разделов)
                  </Button>
                )
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
            {/* Sidebar: chapter list */}
            <div className="space-y-1">
              {state.chapters.map((c, idx) => {
                const st = state.chapterStatuses[c.id];
                const freeLeft = state.freeRevisionsLeft[c.id] ?? FREE_REVISIONS_PER_CHAPTER;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => update({ currentChapterIdx: idx })}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${state.currentChapterIdx === idx ? "bg-primary/15 border border-primary/30 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}
                  >
                    <div className="flex items-center gap-2">
                      {st === "approved" && <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />}
                      {(st === "generating" || st === "revising") && <Loader2 className="w-3.5 h-3.5 text-primary shrink-0 animate-spin" />}
                      {st === "pending" && <Clock className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                      {st === "generated" && <ChevronRight className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
                      <span className="truncate leading-tight flex-1">{c.title}</span>
                    </div>
                    {st !== "pending" && st !== "approved" && (
                      <div className="flex items-center gap-1 mt-1 ml-5">
                        <Gift className={`w-3 h-3 ${freeLeft > 0 ? "text-green-500" : "text-slate-600"}`} />
                        <span className={`text-[10px] ${freeLeft > 0 ? "text-green-500" : "text-slate-500"}`}>
                          {freeLeft} бесплатных доработок
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Main: chapter content */}
            {currentChapter && (
              <Card className="bg-card/40 border-white/5">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <CardTitle className="text-base text-white">{currentChapter.title}</CardTitle>
                      <p className="text-xs text-slate-500 mt-0.5">~{currentChapter.estimatedPages} страниц</p>
                    </div>
                    {currentStatus !== "pending" && (
                      <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${currentFreeLeft > 0 ? "text-green-400 border-green-500/30 bg-green-500/10" : "text-slate-400 border-white/10 bg-white/5"}`}>
                        <Gift className="w-3 h-3" />
                        {currentFreeLeft > 0 ? `${currentFreeLeft} бесплатных доработок` : "Доработки платные"}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {currentStatus === "pending" && !generating && (
                    <div className="py-10 flex flex-col items-center gap-4 text-center">
                      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                        <PenLine className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Раздел ещё не написан</p>
                        <p className="text-sm text-slate-400 mt-1">ИИ напишет полный текст раздела</p>
                        <p className="text-xs text-slate-500 mt-1">Стоимость: {perChapterCost} ₽ · 2 бесплатные доработки</p>
                      </div>
                      <Button onClick={handleGenerateChapter} disabled={generating}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Написать за {perChapterCost} ₽
                      </Button>
                    </div>
                  )}

                  {(currentStatus === "generating" || currentStatus === "revising") && (
                    <AILoadingState
                      visible={true}
                      title={currentStatus === "revising" ? "Дорабатываю раздел" : "Пишу раздел курсовой"}
                      stages={
                        currentStatus === "revising"
                          ? [
                              "Анализирую замечания…",
                              "Пересматриваю структуру раздела…",
                              "Улучшаю аргументацию…",
                              "Дополняю содержание…",
                              "Оформляю исправленный текст…",
                            ]
                          : [
                              "Изучаю тему и план раздела…",
                              "Формирую структуру и тезисы…",
                              "Пишу основной текст…",
                              "Добавляю примеры и ссылки…",
                              "Финальное оформление…",
                            ]
                      }
                      elapsed={generatingSeconds}
                      estimated={90}
                      color="blue"
                    />
                  )}

                  {(currentStatus === "generated" || currentStatus === "approved") && currentContent && (
                    <>
                      <div className={`relative bg-background/50 rounded-lg p-4 border ${currentStatus === "approved" ? "border-green-500/30" : "border-white/5"}`}>
                        <div className="absolute top-2 right-2 flex items-center gap-1">
                          {currentStatus === "approved" && (
                            <span className="flex items-center gap-1 text-xs text-green-400 px-2 py-0.5 bg-green-500/10 rounded-full border border-green-500/20">
                              <CheckCircle2 className="w-3 h-3" /> Согласовано
                            </span>
                          )}
                          <button
                            type="button"
                            className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-white/10 transition-all"
                            title="Скопировать раздел"
                            onClick={() => { navigator.clipboard.writeText(currentContent || ""); toast({ title: "Раздел скопирован" }); }}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="max-h-[500px] overflow-y-auto pr-8 text-slate-300">
                          <RenderMessage content={currentContent || ""} />
                        </div>
                        <AIDisclaimer variant="compact" className="mt-3" />
                      </div>

                      {showRevisionInput && currentStatus === "generated" && (
                        <div className="space-y-2 border border-white/10 rounded-xl p-4 bg-white/3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <p className="text-sm font-medium text-white">Укажите замечания</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${currentFreeLeft > 0 ? "bg-green-500/15 text-green-400 border border-green-500/25" : "bg-white/5 text-slate-400 border border-white/10"}`}>
                              {currentFreeLeft > 0 ? `Бесплатно (осталось ${currentFreeLeft})` : `Платно: ${Math.round(perChapterCost * 0.7)} ₽`}
                            </span>
                          </div>
                          <Textarea
                            value={revisionNote}
                            onChange={e => setRevisionNote(e.target.value)}
                            placeholder="Что нужно изменить? Например: добавь конкретные примеры, сократи введение, добавь подзаголовки..."
                            className="bg-background/50 min-h-[90px] text-sm"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={handleReviseChapter}
                              disabled={generating || revisionNote.trim().length < 5}
                            >
                              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                              {currentFreeLeft > 0 ? "Доработать бесплатно" : `Доработать (${Math.round(perChapterCost * 0.7)} ₽)`}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setShowRevisionInput(false); setRevisionNote(""); }}>Отмена</Button>
                          </div>
                        </div>
                      )}

                      {currentStatus === "generated" && !showRevisionInput && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button onClick={handleApproveChapter}>
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Согласовать
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setShowRevisionInput(true)}
                            className="border-white/10"
                          >
                            <RefreshCw className="mr-2 h-3.5 w-3.5" />
                            {currentFreeLeft > 0 ? "Доработать бесплатно" : "На доработку"}
                          </Button>
                          <Button variant="ghost" onClick={handleGenerateChapter} disabled={generating} size="sm">
                            Написать заново ({perChapterCost} ₽)
                          </Button>
                        </div>
                      )}

                      {currentStatus === "approved" && state.currentChapterIdx < state.chapters.length - 1 && (
                        <Button onClick={() => update({ currentChapterIdx: state.currentChapterIdx + 1 })}>
                          Следующий раздел <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {allApproved && (
            <div className="mt-6 p-5 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="font-semibold text-green-300">Все разделы согласованы!</p>
                <p className="text-sm text-green-400/70 mt-0.5">Итого слов: ~{totalWords.toLocaleString("ru")} · Готово к финальной сборке</p>
              </div>
              <Button onClick={handleAssemble} disabled={assembling} size="lg" className="bg-green-600 hover:bg-green-500">
                {assembling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Собрать работу
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ─── STEP 4 ─── */}
      {state.step === 4 && (
        <div className="space-y-5 animate-in slide-in-from-right-8 duration-300">
          {assembling ? (
            <div className="py-20 flex flex-col items-center gap-4 text-center">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <p className="text-white font-medium">Собираем работу и проверяем структуру...</p>
              <p className="text-sm text-slate-400">Это займёт несколько секунд</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Разделов", value: totalChapters },
                  { label: "Страниц (~)", value: totalPages },
                  { label: "Слов (~)", value: totalWords.toLocaleString("ru") },
                ].map(s => (
                  <Card key={s.label} className="bg-card/40 border-white/5">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-white">{s.value}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-300">Работа собрана успешно</p>
                  <p className="text-xs text-green-400/70 mt-0.5">{WORK_TYPE_LABELS[state.workType]} · Тема: «{state.topic}»</p>
                </div>
              </div>

              <Card className="bg-card/40 border-white/5">
                <CardHeader className="pb-2 flex-row items-center justify-between">
                  <CardTitle className="text-base text-white">Полный текст работы</CardTitle>
                  <Button variant="outline" size="sm" onClick={handleCopyAll} className="border-white/10">
                    <Copy className="w-3.5 h-3.5 mr-1.5" /> Скопировать всё
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="bg-background/50 rounded-lg p-4 max-h-[500px] overflow-y-auto border border-white/5 text-slate-300">
                    <RenderMessage content={assembledText} />
                  </div>
                </CardContent>
              </Card>

              {/* Image generation for coursework */}
              <Card className="bg-black/20 border-violet-500/15">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2 text-violet-300">
                    <ImagePlus className="w-4 h-4" /> Сгенерировать иллюстрацию · 15 ₽/шт
                  </CardTitle>
                  <p className="text-xs text-slate-500">Добавьте схему, диаграмму или тематическое изображение через DALL-E 3</p>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Опишите иллюстрацию для работы..."
                      className="flex-1 min-h-[56px] text-sm bg-background/50 border-violet-500/15 resize-none"
                      value={imagePromptCw}
                      onChange={e => setImagePromptCw(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleGenerateImageCw(); }}
                    />
                    <Button onClick={handleGenerateImageCw} disabled={imageLoadingCw || imagePromptCw.trim().length < 3} className="gap-2 bg-violet-600 hover:bg-violet-500 self-end h-9">
                      {imageLoadingCw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                      Создать
                    </Button>
                  </div>
                  {generatedImagesCw.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {generatedImagesCw.map((img, i) => (
                        <div key={i} className="rounded-lg overflow-hidden border border-white/10">
                          <img src={img.url} alt={img.prompt} className="w-full h-auto" />
                          <div className="flex items-center justify-between gap-1 px-2 py-1.5 bg-black/30">
                            <p className="text-xs text-slate-500 truncate flex-1">{img.prompt}</p>
                            <a href={img.url} download={`illustration-${i+1}.png`} target="_blank" rel="noopener noreferrer">
                              <button type="button" className="text-slate-500 hover:text-white">
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* CTA: Проверить уникальность готовой работы */}
              <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent">
                <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-6 h-6 text-amber-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-base flex items-center gap-2 flex-wrap">
                      Перед сдачей — проверьте уникальность
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">рекомендуем</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      Найдём шаблонные обороты и при необходимости перепишем работу. От 1 ₽ за 1 000 символов.
                    </div>
                  </div>
                  <Button
                    className="bg-amber-500 hover:bg-amber-400 text-amber-950 gap-2 shrink-0"
                    onClick={() => {
                      try {
                        sessionStorage.setItem("uniqueness:handoff", JSON.stringify({
                          text: assembledText,
                          source: "coursework",
                          topic: state.topic,
                          ts: Date.now(),
                        }));
                      } catch {}
                      setLocation("/uniqueness?from=coursework");
                    }}
                  >
                    <Sparkles className="w-4 h-4" /> Проверить уникальность
                  </Button>
                </CardContent>
              </Card>

              <div className="flex gap-3 flex-wrap">
                <Button
                  onClick={async () => {
                    try {
                      if (state.gost) {
                        const chargeRes = await fetch("/api/users/charge", {
                          method: "POST",
                          headers: { "Content-Type": "application/json", ...getAuthHeader() },
                          body: JSON.stringify({ amount: 5, description: "Оформление по ГОСТ" }),
                        });
                        if (!chargeRes.ok) {
                          const err = await chargeRes.json().catch(() => ({}));
                          if (err.error === "insufficient_balance") {
                            toast({ variant: "destructive", title: "Недостаточно средств", description: "Пополните баланс для ГОСТ-оформления (+5 ₽)" });
                            return;
                          }
                        }
                      }
                      await exportCourseworkToDocx({
                        topic: state.topic,
                        subject: state.subject,
                        workType: state.workType,
                        requirements: state.requirements,
                        chapters: state.chapters,
                        chapterContents: state.chapterContents,
                        gost: state.gost,
                      });
                      toast({ title: "Файл скачан", description: state.gost ? "Работа экспортирована по ГОСТ в формат Word (.docx)" : "Работа экспортирована в формат Word (.docx)" });
                    } catch {
                      toast({ variant: "destructive", title: "Ошибка экспорта", description: "Не удалось создать DOCX файл" });
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-500 gap-2"
                >
                  <Download className="w-4 h-4" /> Скачать Word {state.gost ? "(ГОСТ)" : "(.docx)"}
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      await exportCourseworkToPdf({
                        topic: state.topic,
                        subject: state.subject,
                        workType: state.workType,
                        requirements: state.requirements,
                        chapters: state.chapters,
                        chapterContents: state.chapterContents,
                      });
                      toast({ title: "Файл скачан", description: "Работа экспортирована в PDF" });
                    } catch {
                      toast({ variant: "destructive", title: "Ошибка экспорта", description: "Не удалось создать PDF файл" });
                    }
                  }}
                  className="bg-rose-600 hover:bg-rose-500 gap-2"
                >
                  <FileText className="w-4 h-4" /> Скачать PDF
                </Button>
                <Button variant="outline" onClick={handleCopyAll} className="border-white/10 gap-2">
                  <Copy className="w-4 h-4" /> Скопировать текст
                </Button>
                <Button
                  variant="outline"
                  className="border-violet-500/40 text-violet-300 hover:bg-violet-500/10 gap-2"
                  onClick={() => setLocation(`/illustrations?from=coursework&title=${encodeURIComponent(state.topic || "")}`)}
                >
                  <ImagePlus className="w-4 h-4" /> Добавить иллюстрации
                </Button>
                <Button onClick={handleNewWork} variant="ghost" className="border-white/10">
                  <PlusCircle className="mr-2 h-4 w-4" /> Новая работа
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
