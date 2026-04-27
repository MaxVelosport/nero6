import { useState, useRef, useCallback, useEffect } from "react";
import { AIDisclaimer } from "@/components/ai-disclaimer";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useEstimateTask, useCreateTask, useGetMe } from "@workspace/api-client-react";
import { useUpdateBalance } from "@/hooks/useUpdateBalance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Zap, Loader2, ArrowRight, ArrowLeft, Brain, Crown,
  CheckCircle2, AlertCircle, Settings2, ChevronDown, Calculator,
  Code2, FlaskConical, FlaskRound, BarChart2, Scale, BookOpen, Globe, Atom,
  MessageSquare, FileText, Languages, AlignLeft, Layers,
  Microscope, TrendingUp, Music, GraduationCap, Briefcase,
  Users, Activity, Database, Sigma, Building2, HeartPulse,
  Lightbulb, PenLine, Landmark, Cpu,
  Wrench, Network, Shield, Bot, Gavel, Leaf, Newspaper, Palette, Scroll,
  Compass, Megaphone, HardHat, Stethoscope,
  Upload, X, ImageIcon, Paperclip, FileText as FileTextIcon,
  ScanLine, RotateCcw, ShieldCheck, Eye, Pencil, Check, Bookmark, Save,
  Camera, ClipboardPaste,
} from "lucide-react";
import { TaskEstimate } from "@workspace/api-client-react/src/generated/api.schemas";
import { RenderMessage } from "@/lib/render-message";

type SubjectEntry = { label: string; icon: React.ElementType; category: string };

const POPULAR_SUBJECTS: SubjectEntry[] = [
  // ─── Точные науки ────────────────────────────────────────────────────────────
  { label: "Математика",                    icon: Calculator,   category: "Точные науки" },
  { label: "Матанализ",                     icon: Sigma,        category: "Точные науки" },
  { label: "Линейная алгебра",              icon: Layers,       category: "Точные науки" },
  { label: "Дискретная математика",         icon: Calculator,   category: "Точные науки" },
  { label: "Теорвер / Статистика",          icon: TrendingUp,   category: "Точные науки" },
  { label: "Физика",                        icon: Atom,         category: "Точные науки" },
  { label: "Химия",                         icon: FlaskConical, category: "Точные науки" },
  { label: "Органическая химия",            icon: FlaskRound,   category: "Точные науки" },
  { label: "Биология",                      icon: Microscope,   category: "Точные науки" },
  { label: "Биохимия",                      icon: Microscope,   category: "Точные науки" },
  { label: "Экология",                      icon: Leaf,         category: "Точные науки" },
  { label: "Астрономия",                    icon: Atom,         category: "Точные науки" },
  // ─── Инженерия и техника ─────────────────────────────────────────────────────
  { label: "Теормех",                       icon: Wrench,       category: "Инженерия" },
  { label: "Сопромат",                      icon: Wrench,       category: "Инженерия" },
  { label: "ТОЭ / Электротехника",          icon: Zap,          category: "Инженерия" },
  { label: "Термодинамика",                 icon: Atom,         category: "Инженерия" },
  { label: "Детали машин",                  icon: Wrench,       category: "Инженерия" },
  { label: "Материаловедение",              icon: HardHat,      category: "Инженерия" },
  { label: "Строительство",                 icon: Building2,    category: "Инженерия" },
  { label: "Геодезия",                      icon: Compass,      category: "Инженерия" },
  // ─── Информатика и IT ────────────────────────────────────────────────────────
  { label: "Информатика",                   icon: Cpu,          category: "IT / Программирование" },
  { label: "Алгоритмы / Структуры данных",  icon: Database,     category: "IT / Программирование" },
  { label: "Python",                        icon: Code2,        category: "IT / Программирование" },
  { label: "Java",                          icon: Code2,        category: "IT / Программирование" },
  { label: "C++",                           icon: Code2,        category: "IT / Программирование" },
  { label: "C#",                            icon: Code2,        category: "IT / Программирование" },
  { label: "JavaScript",                    icon: Code2,        category: "IT / Программирование" },
  { label: "SQL / Базы данных",             icon: Database,     category: "IT / Программирование" },
  { label: "Кибербезопасность",             icon: Shield,       category: "IT / Программирование" },
  { label: "Сети / ОС",                     icon: Network,      category: "IT / Программирование" },
  { label: "Machine Learning / AI",         icon: Bot,          category: "IT / Программирование" },
  { label: "Веб-разработка",                icon: Code2,        category: "IT / Программирование" },
  // ─── Гуманитарные ────────────────────────────────────────────────────────────
  { label: "История",                       icon: BookOpen,     category: "Гуманитарные" },
  { label: "Философия",                     icon: Lightbulb,    category: "Гуманитарные" },
  { label: "Психология",                    icon: Brain,        category: "Гуманитарные" },
  { label: "Социология",                    icon: Users,        category: "Гуманитарные" },
  { label: "Политология",                   icon: Users,        category: "Гуманитарные" },
  { label: "Культурология",                 icon: Scroll,       category: "Гуманитарные" },
  { label: "Педагогика",                    icon: GraduationCap, category: "Гуманитарные" },
  { label: "Литература",                    icon: PenLine,      category: "Гуманитарные" },
  { label: "Русский язык",                  icon: Languages,    category: "Гуманитарные" },
  { label: "Журналистика",                  icon: Newspaper,    category: "Гуманитарные" },
  { label: "Реклама и PR",                  icon: Megaphone,    category: "Гуманитарные" },
  // ─── Иностранные языки ───────────────────────────────────────────────────────
  { label: "Английский",                    icon: Globe,        category: "Иностранные языки" },
  { label: "Немецкий",                      icon: Globe,        category: "Иностранные языки" },
  { label: "Французский",                   icon: Globe,        category: "Иностранные языки" },
  { label: "Китайский",                     icon: Globe,        category: "Иностранные языки" },
  { label: "Испанский",                     icon: Globe,        category: "Иностранные языки" },
  { label: "Итальянский",                   icon: Globe,        category: "Иностранные языки" },
  // ─── Экономика и бизнес ──────────────────────────────────────────────────────
  { label: "Микроэкономика",                icon: BarChart2,    category: "Экономика и бизнес" },
  { label: "Макроэкономика",                icon: BarChart2,    category: "Экономика и бизнес" },
  { label: "Эконометрика",                  icon: BarChart2,    category: "Экономика и бизнес" },
  { label: "Финансы",                       icon: Briefcase,    category: "Экономика и бизнес" },
  { label: "Менеджмент",                    icon: Briefcase,    category: "Экономика и бизнес" },
  { label: "Маркетинг",                     icon: TrendingUp,   category: "Экономика и бизнес" },
  { label: "Бухучёт",                       icon: Landmark,     category: "Экономика и бизнес" },
  { label: "Налоги и налогообложение",      icon: Landmark,     category: "Экономика и бизнес" },
  { label: "Логистика",                     icon: Briefcase,    category: "Экономика и бизнес" },
  // ─── Юридические ────────────────────────────────────────────────────────────
  { label: "Гражданское право",             icon: Scale,        category: "Право" },
  { label: "Уголовное право",               icon: Gavel,        category: "Право" },
  { label: "Конституционное право",         icon: Scroll,       category: "Право" },
  { label: "Международное право",           icon: Globe,        category: "Право" },
  { label: "Административное право",        icon: Scale,        category: "Право" },
  { label: "Трудовое право",                icon: Users,        category: "Право" },
  // ─── Медицина и здоровье ────────────────────────────────────────────────────
  { label: "Анатомия",                      icon: Stethoscope,  category: "Медицина" },
  { label: "Физиология",                    icon: HeartPulse,   category: "Медицина" },
  { label: "Фармакология",                  icon: FlaskConical, category: "Медицина" },
  { label: "Патологическая анатомия",       icon: Microscope,   category: "Медицина" },
  { label: "Гигиена / Эпидемиология",       icon: HeartPulse,   category: "Медицина" },
  // ─── Творческие и прикладные ────────────────────────────────────────────────
  { label: "Архитектура",                   icon: Building2,    category: "Творческие" },
  { label: "Дизайн",                        icon: Palette,      category: "Творческие" },
  { label: "Музыка",                        icon: Music,        category: "Творческие" },
  { label: "Физкультура / Спорт",           icon: Activity,     category: "Творческие" },
  // ─── Подготовка к экзаменам ─────────────────────────────────────────────────
  { label: "ЕГЭ / Математика",              icon: GraduationCap, category: "ЕГЭ / ОГЭ" },
  { label: "ЕГЭ / Физика",                  icon: GraduationCap, category: "ЕГЭ / ОГЭ" },
  { label: "ЕГЭ / Химия",                   icon: GraduationCap, category: "ЕГЭ / ОГЭ" },
  { label: "ЕГЭ / Русский язык",            icon: GraduationCap, category: "ЕГЭ / ОГЭ" },
  { label: "ОГЭ (подготовка)",              icon: GraduationCap, category: "ЕГЭ / ОГЭ" },
];

const SUBJECT_CATEGORIES = [...new Set(POPULAR_SUBJECTS.map(s => s.category))];

function SubjectPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [customValue, setCustomValue] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = POPULAR_SUBJECTS.filter(s => {
    const matchSearch = search === "" || s.label.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === null || s.category === activeCategory;
    return matchSearch && matchCat;
  });

  const selectedEntry = POPULAR_SUBJECTS.find(s => s.label === value);
  const SelectedIcon = selectedEntry?.icon;

  function handleSelect(label: string) {
    onChange(label);
    setOpen(false);
    setSearch("");
    setCustomValue("");
  }

  function handleCustomConfirm() {
    const v = customValue.trim();
    if (v.length >= 2) { handleSelect(v); }
  }

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 text-sm hover:border-white/20 transition-all text-left"
        >
          <span className="flex items-center gap-2 flex-1 min-w-0">
            {SelectedIcon ? (
              <SelectedIcon className="w-4 h-4 text-primary shrink-0" />
            ) : (
              <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
            <span className={value ? "text-foreground truncate" : "text-muted-foreground"}>
              {value || "Выберите или введите предмет..."}
            </span>
          </span>
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(480px,calc(100vw-1rem))] p-0 border-white/10 bg-[#0f0f1a]"
        align="start"
        sideOffset={4}
      >
        {/* Search */}
        <div className="p-3 border-b border-white/10">
          <Input
            ref={searchRef}
            placeholder="Поиск предмета..."
            value={search}
            onChange={e => { setSearch(e.target.value); setActiveCategory(null); }}
            className="bg-white/5 border-white/10 h-9"
          />
        </div>

        {/* Category pills */}
        <div className="flex gap-1.5 p-2.5 border-b border-white/10 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${activeCategory === null ? "bg-primary text-primary-foreground" : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"}`}
          >
            Все
          </button>
          {SUBJECT_CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => { setActiveCategory(cat); setSearch(""); }}
              className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${activeCategory === cat ? "bg-primary text-primary-foreground" : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Subject list */}
        <ScrollArea className="h-56">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">Не найдено — введите свой предмет ниже</div>
          ) : (
            <div className="p-1">
              {filtered.map(({ label, icon: Icon, category }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleSelect(label)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all text-left group ${value === label ? "bg-primary/15 text-primary" : "hover:bg-white/5 text-foreground"}`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${value === label ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
                  <span className="flex-1">{label}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{category}</span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Custom subject input */}
        <div className="p-2.5 border-t border-white/10 flex gap-2">
          <Input
            placeholder="Свой предмет (например: Нанотехнологии)..."
            value={customValue}
            onChange={e => setCustomValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleCustomConfirm(); } }}
            className="bg-white/5 border-white/10 h-8 text-sm flex-1"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 shrink-0 border-white/10"
            disabled={customValue.trim().length < 2}
            onClick={handleCustomConfirm}
          >
            Выбрать
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const TASK_TEMPLATES = [
  { icon: "📝", label: "Задача / Пример",    taskType: "homework" as const, description: "Условие задачи:\n\n" },
  { icon: "💻", label: "Код / Программа",    taskType: "homework" as const, description: "Напишите программу, которая:\n\n" },
  { icon: "📚", label: "Объяснение темы",    taskType: "other"    as const, description: "Объясните подробно следующую тему:\n\n" },
  { icon: "❓", label: "Тест / Вопросы",     taskType: "test"     as const, description: "Ответьте на следующие вопросы:\n1. \n2. \n3. \n4. \n5. " },
  { icon: "📄", label: "Эссе / Реферат",     taskType: "essay"    as const, description: "Напишите эссе на тему:\n\n" },
  { icon: "🧪", label: "Лаб. работа",        taskType: "lab"      as const, description: "Задание лабораторной работы:\n\nЦель: \n\nЗадание: \n\n" },
  { icon: "🔤", label: "Перевод текста",      taskType: "other"         as const, description: "Переведите следующий текст:\n\n" },
  { icon: "📐", label: "Формулы / Расчёты",  taskType: "homework"      as const, description: "Дано:\n\nНайти:\n\n" },
  { icon: "📊", label: "Презентация PPTX",   taskType: "presentation"  as const, description: "Тема презентации:\n\nАудитория: студенты\nЖелаемое количество слайдов: 10\n\nДополнительные пожелания:\n" },
];

// ── Пользовательские сохранённые шаблоны ─────────────────────────────────────
const SAVED_TPL_KEY = "task_saved_templates_v1";
interface SavedTemplate {
  id: string;
  name: string;
  subject: string;
  taskType: string;
  educationLevel: string;
}
function loadSavedTemplates(): SavedTemplate[] {
  try { return JSON.parse(localStorage.getItem(SAVED_TPL_KEY) || "[]"); } catch { return []; }
}
function persistTemplate(t: SavedTemplate) {
  const all = loadSavedTemplates().filter(x => x.id !== t.id);
  localStorage.setItem(SAVED_TPL_KEY, JSON.stringify([t, ...all].slice(0, 10)));
}
function deleteTemplate(id: string) {
  localStorage.setItem(SAVED_TPL_KEY, JSON.stringify(loadSavedTemplates().filter(t => t.id !== id)));
}

const formSchema = z.object({
  title: z.string().min(3, "Краткое название обязательно (мин. 3 символа)"),
  description: z.string().min(10, "Опишите задачу подробнее (мин. 10 символов)"),
  subject: z.string().min(2, "Укажите предмет"),
  taskType: z.enum(["homework", "test", "coursework", "lab", "essay", "diploma", "presentation", "other"]),
  educationLevel: z.enum(["school", "bachelor", "master", "phd", "other"]).optional(),
  outputLanguage: z.enum(["ru", "en", "same"]).default("ru"),
  detailLevel: z.enum(["brief", "detailed", "step_by_step"]).default("detailed"),
  outputFormat: z.enum(["plain", "formatted", "with_code", "with_formulas"]).default("formatted"),
  additionalRequirements: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

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

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return ImageIcon;
  if (type === "application/pdf") return FileTextIcon;
  return Paperclip;
}

export default function NewTaskPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user } = useGetMe();
  const updateBalance = useUpdateBalance();

  const [step, setStep] = useState<1 | 2>(1);
  const step2AnchorRef = useRef<HTMLDivElement | null>(null);

  // Автоскролл к Шагу 2 после получения оценки
  useEffect(() => {
    if (step === 2) {
      requestAnimationFrame(() => {
        step2AnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [step]);
  const [estimateData, setEstimateData] = useState<TaskEstimate | null>(null);
  const [selectedMode, setSelectedMode] = useState<"fast" | "standard" | "premium" | "super_premium" | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>(() => loadSavedTemplates());
  const [saveTplName, setSaveTplName] = useState("");
  const [showSaveTpl, setShowSaveTpl] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);

  // Поддержка глубоких ссылок с дашборда: /tasks/new?action=camera|file|paste
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const action = params.get("action");
    if (!action) return;
    // даём странице срендериться, потом дёргаем нужный input
    const t = setTimeout(() => {
      if (action === "camera") cameraInputRef.current?.click();
      else if (action === "file" || action === "upload") fileInputRef.current?.click();
      else if (action === "paste") {
        descriptionRef.current?.focus();
        descriptionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      // убираем query-параметр из URL чтобы не повторялось при HMR
      const url = new URL(window.location.href);
      url.searchParams.delete("action");
      window.history.replaceState({}, "", url.pathname + (url.search || "") + url.hash);
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Верификация нескольких изображений ──────────────────────────────────
  type ImageQuality = "good" | "poor" | "unreadable";
  type ImgVerify =
    | { status: "loading" }
    | { status: "done"; extractedText: string; quality: ImageQuality; qualityNote?: string }
    | { status: "confirmed"; extractedText: string; quality: ImageQuality; qualityNote?: string }
    | { status: "error"; message: string };

  const [imgVerifies, setImgVerifies] = useState<(ImgVerify | null)[]>([]);
  const [verifyIdx, setVerifyIdx] = useState(0);
  const [editingVerify, setEditingVerify] = useState(false);
  const [editedText, setEditedText] = useState("");

  // Вспомогательные геттеры
  const imageAttachments = attachments.filter(a => a.type.startsWith("image/"));
  const hasImages = imageAttachments.length > 0;
  const allConfirmed = hasImages && imgVerifies.length === imageAttachments.length && imgVerifies.every(v => v?.status === "confirmed");
  const currentVerify = imgVerifies[verifyIdx] ?? null;
  const isVerifying = currentVerify?.status === "loading";
  const isWaitingConfirm = currentVerify?.status === "done";

  const processFiles = useCallback((files: File[]) => {
    const MAX_SIZE = 50 * 1024 * 1024; // 50 MB
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

  // ── Вставка из буфера обмена (Ctrl+V / Cmd+V) ─────────────────────────────
  // Если в буфере есть файлы/изображения — всегда прикрепляем (даже из textarea).
  // Если только текст и курсор в поле — браузер вставляет сам.
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        processFiles(files);
      }
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, [processFiles]);

  const estimateMutation = useEstimateTask();
  const createMutation = useCreateTask();

  const initialTaskType = (() => {
    const p = new URLSearchParams(window.location.search).get("type");
    if (p === "presentation") return "presentation" as const;
    return "homework" as const;
  })();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: initialTaskType === "presentation"
        ? "Тема презентации:\n\nАудитория: студенты\nЖелаемое количество слайдов: 10\n\nДополнительные пожелания:\n"
        : "",
      subject: "",
      taskType: initialTaskType,
      educationLevel: "bachelor",
      outputLanguage: "ru",
      detailLevel: "detailed",
      outputFormat: "formatted",
      additionalRequirements: "",
    },
  });

  const buildDescription = (description: string) => {
    if (attachments.length === 0) return description;
    const fileList = attachments.map(f => `  • ${f.name} (${formatFileSize(f.size)})`).join("\n");
    return `${description}\n\n[Прикреплены файлы:]\n${fileList}`;
  };

  const onStep1Submit = (values: FormValues) => {
    estimateMutation.mutate({
      data: {
        description: buildDescription(values.description),
        subject: values.subject,
        taskType: values.taskType,
        educationLevel: values.educationLevel,
      }
    }, {
      onSuccess: (res) => {
        setEstimateData(res);
        setSelectedMode(res.recommendedMode as any || "standard");
        setStep(2);
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "Ошибка оценки",
          description: "Не удалось оценить задачу. Попробуйте изменить описание."
        });
      }
    });
  };

  // Сброс верификации при изменении набора изображений
  const prevImgCountRef = useRef(0);
  useEffect(() => {
    const imgCount = attachments.filter(a => a.type.startsWith("image/")).length;
    if (imgCount !== prevImgCountRef.current) {
      setImgVerifies([]);
      setVerifyIdx(0);
      setEditingVerify(false);
      setEditedText("");
      prevImgCountRef.current = imgCount;
    }
  }, [attachments]);

  // Запуск верификации одного изображения по индексу
  const verifyImage = async (idx: number) => {
    const imgAtts = attachments.filter(a => a.type.startsWith("image/"));
    const img = imgAtts[idx];
    if (!img) return;

    setImgVerifies(prev => {
      const next = [...prev];
      next[idx] = { status: "loading" };
      return next;
    });

    try {
      const values = form.getValues();
      const token = localStorage.getItem("authToken");
      const resp = await fetch("/api/tasks/verify-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          attachmentData: img.dataUrl.split(",")[1],
          attachmentType: img.type,
          subject: values.subject,
          description: values.description,
        }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.message || "Ошибка верификации");
      setImgVerifies(prev => {
        const next = [...prev];
        next[idx] = { status: "done", extractedText: json.extractedText, quality: json.quality ?? "good", qualityNote: json.qualityNote };
        return next;
      });
    } catch (e: any) {
      setImgVerifies(prev => {
        const next = [...prev];
        next[idx] = { status: "error", message: e.message || "Не удалось считать изображение" };
        return next;
      });
    }
  };

  // Подтвердить текущее изображение и перейти к следующему
  const confirmCurrentImage = () => {
    const imgAtts = attachments.filter(a => a.type.startsWith("image/"));
    const current = imgVerifies[verifyIdx];
    if (current?.status !== "done") return;

    // Если была правка — используем отредактированный текст
    const extractedText = editingVerify && editedText.trim() ? editedText.trim() : current.extractedText;
    const quality = (current as any).quality ?? "good";
    const qualityNote = (current as any).qualityNote;
    setEditingVerify(false);
    setEditedText("");
    // Собираем обновлённый массив без stale closure
    const updatedVerifies = [...imgVerifies];
    updatedVerifies[verifyIdx] = { status: "confirmed", extractedText, quality, qualityNote };
    setImgVerifies(updatedVerifies);

    const nextIdx = verifyIdx + 1;
    if (nextIdx < imgAtts.length) {
      setVerifyIdx(nextIdx);
      setTimeout(() => verifyImage(nextIdx), 50);
    } else {
      // Все подтверждены → создаём задачи, передавая актуальный массив явно
      setTimeout(() => doCreateAll(updatedVerifies), 80);
    }
  };

  // Создаём задачи: по одной на каждое изображение.
  // verifies — актуальный массив (передаём явно, чтобы не ловить stale closure).
  const doCreateAll = useCallback((verifies?: (ImgVerify | null)[]) => {
    if (!selectedMode || !estimateData) return;
    const resolvedVerifies = verifies ?? imgVerifies;
    const values = form.getValues();
    const isPresentation = values.taskType === "presentation";
    const imgAtts = attachments.filter(a => a.type.startsWith("image/"));
    const otherAttachments = attachments.filter(a => !a.type.startsWith("image/"));
    const baseDescription = isPresentation
      ? `СОЗДАЙ ПРЕЗЕНТАЦИЮ\n\n${buildDescription(values.description)}`
      : buildDescription(values.description);

    // Без изображений — одна задача как раньше
    if (imgAtts.length === 0) {
      createMutation.mutate({
        data: {
          title: values.title,
          description: baseDescription,
          subject: values.subject,
          taskType: (isPresentation ? "other" : values.taskType) as any,
          educationLevel: values.educationLevel,
          solvingMode: selectedMode,
          ...(otherAttachments.length > 0 ? {
            fileAttachments: JSON.stringify(otherAttachments.map(a => ({
              data: a.dataUrl.split(",")[1], type: a.type, name: a.name,
            }))),
          } : {}),
        } as any
      }, {
        onSuccess: (task) => {
          toast({ title: "Задача принята", description: "Нейросеть уже начала работу." });
          updateBalance();
          setLocation(`/tasks/${task.id}`);
        },
        onError: () => toast({ variant: "destructive", title: "Ошибка", description: "Не удалось создать задачу." }),
      });
      return;
    }

    // Для каждого изображения — отдельная задача
    const taskCount = imgAtts.length;
    let done = 0;
    let firstTaskId: number | null = null;

    imgAtts.forEach((img, i) => {
      const v = resolvedVerifies[i];
      const extracted = v?.status === "confirmed" ? v.extractedText : "";
      const descWithImg = extracted
        ? `${baseDescription}${baseDescription ? "\n\n" : ""}[Считано с фото]\n${extracted}`
        : baseDescription;
      const taskTitle = taskCount > 1 ? `${values.title} (задача ${i + 1})` : values.title;

      const token = localStorage.getItem("authToken");
      fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: taskTitle,
          description: descWithImg,
          subject: values.subject,
          taskType: isPresentation ? "other" : values.taskType,
          educationLevel: values.educationLevel,
          solvingMode: selectedMode,
          attachmentData: img.dataUrl.split(",")[1],
          attachmentType: img.type,
          attachmentName: img.name,
        }),
      })
        .then(r => r.json())
        .then(task => {
          if (i === 0) firstTaskId = task.id;
          done++;
          if (done === taskCount) {
            toast({
              title: taskCount > 1 ? `${taskCount} задачи приняты` : "Задача принята",
              description: "Нейросеть уже начала решение.",
            });
            updateBalance();
            if (taskCount > 1) setLocation("/tasks");
            else if (firstTaskId) setLocation(`/tasks/${firstTaskId}`);
          }
        })
        .catch(() => toast({ variant: "destructive", title: "Ошибка", description: `Не удалось создать задачу ${i + 1}` }));
    });
  }, [selectedMode, estimateData, attachments, imgVerifies, form, createMutation, toast, setLocation, updateBalance]);

  const onConfirm = async () => {
    if (!selectedMode || !estimateData) return;

    const imgAtts = attachments.filter(a => a.type.startsWith("image/"));
    const baseCost = estimateData.modes[selectedMode].cost;
    const totalCost = baseCost * Math.max(1, imgAtts.length);

    if (user && !(user as any).subscriptionActive && user.balance < totalCost) {
      toast({
        variant: "destructive",
        title: "Недостаточно средств",
        description: `Для запуска необходимо ~${totalCost} ₽. Ваш баланс: ${user.balance} ₽.`,
        action: <Link href="/profile"><Button variant="outline" size="sm">Пополнить</Button></Link>
      });
      return;
    }

    // Нет изображений → сразу создаём
    if (imgAtts.length === 0) { doCreateAll(); return; }

    // Все верифицированы → создаём задачи
    if (allConfirmed) { doCreateAll(); return; }

    // Текущее изображение ещё не верифицировалось → запускаем
    if (!currentVerify || currentVerify.status === "error") {
      verifyImage(verifyIdx);
      return;
    }

    // Ждём подтверждения пользователем (UI показывает кнопки)
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Новая задача</h1>
        <p className="text-slate-400 mt-1">Скопируйте или напишите условие — ИИ разберёт и решит за несколько минут.</p>
      </div>

      {/* How it works mini tip */}
      <div className="flex flex-wrap gap-3">
        {[
          { step: "1", text: "Вставьте условие задачи" },
          { step: "2", text: "ИИ оценит сложность и стоимость" },
          { step: "3", text: "Подтвердите — получите решение" },
        ].map(({ step, text }) => (
          <div key={step} className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-5 h-5 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-[10px] shrink-0">{step}</span>
            {text}
          </div>
        ))}
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between mb-2 relative">
        <div className="absolute left-0 top-5 w-full h-0.5 bg-white/10 -z-10 rounded-full" />
        <div className={`absolute left-0 top-5 h-0.5 ${step === 2 ? 'w-full' : 'w-[calc(50%-20px)]'} bg-primary transition-all duration-500 -z-10 rounded-full`} />
        {[
          { n: 1, label: "Условие" },
          { n: 2, label: "Оценка и запуск" },
        ].map(({ n, label }) => (
          <div key={n} className={`flex flex-col items-center gap-2 ${step >= n ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold bg-background border-2 transition-colors ${step >= n ? 'border-primary' : 'border-white/20'}`}>
              {step > n ? <CheckCircle2 className="w-5 h-5" /> : n}
            </div>
            <span className="text-sm font-medium bg-background px-2">{label}</span>
          </div>
        ))}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onStep1Submit)} className="space-y-6">

                {/* Title */}
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Краткое название задачи</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Например: Задача по интегралам, тест по истории СССР, код на Python..."
                          {...field}
                          className="bg-background/50"
                        />
                      </FormControl>
                      <p className="text-xs text-slate-500 mt-1">Название нужно только вам — чтобы потом найти задачу в истории</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Subject picker */}
                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Предмет / Дисциплина</FormLabel>
                      <FormControl>
                        <SubjectPicker value={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Presentation hint */}
                {form.watch("taskType") === "presentation" && (
                  <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-lg flex items-start gap-3 text-sm animate-in fade-in duration-200">
                    <Layers className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-white font-medium">Создание презентации</p>
                      <p className="text-slate-400 mt-0.5">
                        ИИ сгенерирует 8–12 слайдов по вашей теме. После готовности вы сможете скачать файл в формате <span className="text-violet-400 font-medium">PowerPoint (.pptx)</span> или Word (.docx).
                      </p>
                    </div>
                  </div>
                )}

                {/* Coursework hint */}
                {(form.watch("taskType") === "coursework" || form.watch("taskType") === "diploma") && (
                  <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-start gap-3 text-sm animate-in fade-in duration-200">
                    <GraduationCap className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-white font-medium">Нужна полная работа?</p>
                      <p className="text-slate-400 mt-0.5">
                        Для написания целой курсовой / дипломной по главам с согласованием используйте{" "}
                        <Link href="/coursework/new" className="text-primary hover:underline">раздел «Научные работы»</Link>.
                      </p>
                    </div>
                  </div>
                )}

                {/* Type + Level row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="taskType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Тип работы</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-background/50">
                              <SelectValue placeholder="Выберите тип" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="homework">Домашнее задание / Задачи</SelectItem>
                            <SelectItem value="test">Тест / Квиз</SelectItem>
                            <SelectItem value="lab">Лабораторная работа</SelectItem>
                            <SelectItem value="essay">Эссе / Реферат</SelectItem>
                            <SelectItem value="coursework">Курсовая (раздел)</SelectItem>
                            <SelectItem value="diploma">Дипломная (раздел)</SelectItem>
                            <SelectItem value="presentation">Презентация (PPTX)</SelectItem>
                            <SelectItem value="other">Другое</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="educationLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Уровень образования</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-background/50">
                              <SelectValue placeholder="Уровень" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="school">Школьник</SelectItem>
                            <SelectItem value="bachelor">Бакалавр / Специалитет</SelectItem>
                            <SelectItem value="master">Магистратура</SelectItem>
                            <SelectItem value="phd">Аспирантура</SelectItem>
                            <SelectItem value="other">Другое</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Quick templates */}
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-primary" /> Быстрые шаблоны — нажмите чтобы начать:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {TASK_TEMPLATES.map(t => (
                      <button
                        key={t.label}
                        type="button"
                        onClick={() => {
                          form.setValue("description", t.description, { shouldValidate: false });
                          form.setValue("taskType", t.taskType);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-white/10 bg-white/5 text-slate-400 hover:border-primary/40 hover:text-white hover:bg-primary/10 transition-all"
                      >
                        <span>{t.icon}</span> {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Saved user templates */}
                {savedTemplates.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
                      <Bookmark className="w-3 h-3 text-amber-400" /> Мои шаблоны:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {savedTemplates.map(t => (
                        <div key={t.id} className="flex items-center gap-0 rounded-lg border border-amber-500/25 bg-amber-500/8 text-xs overflow-hidden">
                          <button
                            type="button"
                            onClick={() => {
                              form.setValue("subject", t.subject);
                              form.setValue("taskType", t.taskType as any);
                              form.setValue("educationLevel", t.educationLevel as any);
                            }}
                            className="px-3 py-1.5 text-amber-300 hover:text-white hover:bg-amber-500/15 transition-all"
                          >
                            {t.name}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              deleteTemplate(t.id);
                              setSavedTemplates(loadSavedTemplates());
                            }}
                            className="px-1.5 py-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Условие задачи</FormLabel>

                      {/* Tip chips */}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {[
                          "📋 Скопируйте из учебника",
                          "📸 Перепишите с фото",
                          "🔢 Не забудьте числовые данные",
                          "📐 Укажите что нужно найти",
                        ].map(t => (
                          <span key={t} className="text-[10px] px-2 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400">{t}</span>
                        ))}
                      </div>

                      <FormControl>
                        <Textarea
                          placeholder={`Вставьте полное условие задачи.\n\nПример:\n«Найти производную функции f(x) = x³ − 3x² + 2. Найти точки экстремума и построить эскиз графика.»\n\nИли:\n«Написать функцию на Python, которая принимает список чисел и возвращает только чётные.»`}
                          className="min-h-[200px] resize-y bg-background/50 text-sm leading-relaxed"
                          {...field}
                          ref={(el) => { field.ref(el); descriptionRef.current = el; }}
                        />
                      </FormControl>
                      <div className="flex items-start gap-1.5 mt-1.5">
                        <Zap className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Чем подробнее условие — тем точнее решение. Если есть фото — прикрепите ниже.
                        </p>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* File attachments */}
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
                    <Paperclip className="w-4 h-4 text-muted-foreground" />
                    Вложения
                    <span className="text-xs text-muted-foreground font-normal ml-1">
                      фото, PDF, Word, TXT — до 50 МБ · <kbd className="px-1 py-0.5 rounded text-[10px] bg-white/10 border border-white/15 font-mono">Ctrl+V</kbd> для вставки скриншота
                    </span>
                  </p>
                  <div
                    className={`relative rounded-lg border-2 border-dashed transition-all ${isDragOver ? "border-primary bg-primary/5" : "border-white/15 hover:border-white/30"}`}
                    onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={e => { e.preventDefault(); setIsDragOver(false); processFiles(Array.from(e.dataTransfer.files)); }}
                  >
                    <div className="py-5 px-4 flex flex-col items-center gap-3 text-center">
                      <Upload className={`w-6 h-6 ${isDragOver ? "text-primary" : "text-muted-foreground"}`} />
                      <p className="text-xs text-muted-foreground hidden sm:block">
                        Перетащите файлы сюда, вставьте скриншот <kbd className="px-1 py-0.5 rounded text-[10px] bg-white/10 border border-white/15 font-mono">Ctrl+V</kbd> или выберите способ:
                      </p>
                      {/* 3 явные кнопки — флоу понятен и на мобиле, и на десктопе */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full max-w-md">
                        <button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-primary/15 hover:bg-primary/25 border border-primary/30 text-primary font-medium text-sm transition-colors"
                        >
                          <Camera className="w-4 h-4" />
                          Сфотографировать
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-white font-medium text-sm transition-colors"
                        >
                          <Upload className="w-4 h-4" />
                          Загрузить файл
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            descriptionRef.current?.focus();
                            descriptionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                            toast({ title: "Готово к вводу", description: "Вставьте скриншот (Ctrl+V) или текст условия." });
                          }}
                          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-white font-medium text-sm transition-colors"
                        >
                          <ClipboardPaste className="w-4 h-4" />
                          Вставить текст
                        </button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Фото · PDF · Word · Excel · TXT — до 50 МБ, до 10 файлов</p>
                    </div>
                    {/* hidden inputs */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx"
                      className="hidden"
                      onChange={e => { processFiles(Array.from(e.target.files || [])); e.target.value = ""; }}
                    />
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={e => { processFiles(Array.from(e.target.files || [])); e.target.value = ""; }}
                    />
                  </div>

                  {attachments.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {attachments.map((file, idx) => {
                        const isImage = file.type.startsWith("image/");
                        const Icon = getFileIcon(file.type);
                        return (
                          <div key={idx} className="relative group bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                            {isImage ? (
                              <img src={file.dataUrl} alt={file.name} className="w-full h-20 object-cover" />
                            ) : (
                              <div className="h-20 flex flex-col items-center justify-center gap-2 px-2">
                                <Icon className="w-6 h-6 text-primary" />
                                <span className="text-xs text-muted-foreground text-center truncate w-full px-1">{file.name}</span>
                              </div>
                            )}
                            <div className="px-2 py-1 text-[10px] text-muted-foreground truncate">{formatFileSize(file.size)}</div>
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); setAttachments(prev => prev.filter((_, i) => i !== idx)); }}
                              className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                            >
                              <X className="w-3 h-3 text-white" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Advanced settings */}
                <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" className="w-full justify-between border border-white/10 bg-white/5 hover:bg-white/10 -mx-0">
                      <span className="flex items-center gap-2 text-sm">
                        <Settings2 className="w-4 h-4 text-muted-foreground" />
                        Дополнительные настройки
                        {advancedOpen && (
                          <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30 text-xs">Открыты</Badge>
                        )}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Language */}
                      <FormField
                        control={form.control}
                        name="outputLanguage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1.5 text-sm">
                              <Languages className="w-3.5 h-3.5 text-muted-foreground" />
                              Язык ответа
                            </FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-background/50 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="ru">Русский</SelectItem>
                                <SelectItem value="en">English</SelectItem>
                                <SelectItem value="same">Как в условии</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />

                      {/* Detail level */}
                      <FormField
                        control={form.control}
                        name="detailLevel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1.5 text-sm">
                              <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                              Детализация
                            </FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-background/50 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="brief">Кратко (только ответ)</SelectItem>
                                <SelectItem value="detailed">Подробно</SelectItem>
                                <SelectItem value="step_by_step">Пошагово с объяснениями</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />

                      {/* Output format */}
                      <FormField
                        control={form.control}
                        name="outputFormat"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1.5 text-sm">
                              <AlignLeft className="w-3.5 h-3.5 text-muted-foreground" />
                              Формат вывода
                            </FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-background/50 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="plain">Простой текст</SelectItem>
                                <SelectItem value="formatted">С форматированием</SelectItem>
                                <SelectItem value="with_code">Код с подсветкой</SelectItem>
                                <SelectItem value="with_formulas">Формулы LaTeX</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Additional requirements */}
                    <FormField
                      control={form.control}
                      name="additionalRequirements"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1.5 text-sm">
                            <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                            Особые требования преподавателя
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Например: использовать метод Симпсона, не применять библиотеки numpy, ответ до 2 знаков после запятой..."
                              className="min-h-[80px] resize-none bg-background/50 text-sm"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </CollapsibleContent>
                </Collapsible>

                {/* Save as user template */}
                <div className="pt-3 border-t border-white/5">
                  {!showSaveTpl ? (
                    <button
                      type="button"
                      onClick={() => { setSaveTplName(""); setShowSaveTpl(true); }}
                      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-amber-400 transition-colors"
                    >
                      <Bookmark className="w-3 h-3" /> Сохранить настройки как шаблон
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 animate-in fade-in duration-200">
                      <input
                        autoFocus
                        placeholder='Название шаблона (напр. "Физика бакалавр")'
                        value={saveTplName}
                        onChange={e => setSaveTplName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && saveTplName.trim()) {
                            const vals = form.getValues();
                            if (!vals.subject) { toast({ title: "Укажите предмет", variant: "destructive" }); return; }
                            const t: SavedTemplate = { id: Date.now().toString(), name: saveTplName.trim(), subject: vals.subject, taskType: vals.taskType, educationLevel: vals.educationLevel || "bachelor" };
                            persistTemplate(t);
                            setSavedTemplates(loadSavedTemplates());
                            setShowSaveTpl(false);
                            toast({ title: `Шаблон «${t.name}» сохранён` });
                          }
                          if (e.key === "Escape") setShowSaveTpl(false);
                        }}
                        className="flex-1 px-2.5 py-1.5 rounded-lg text-xs bg-background/50 border border-white/10 text-white placeholder-slate-500 outline-none focus:border-primary/50"
                      />
                      <button
                        type="button"
                        disabled={!saveTplName.trim()}
                        onClick={() => {
                          const vals = form.getValues();
                          if (!vals.subject) { toast({ title: "Укажите предмет", variant: "destructive" }); return; }
                          const t: SavedTemplate = { id: Date.now().toString(), name: saveTplName.trim(), subject: vals.subject, taskType: vals.taskType, educationLevel: vals.educationLevel || "bachelor" };
                          persistTemplate(t);
                          setSavedTemplates(loadSavedTemplates());
                          setShowSaveTpl(false);
                          toast({ title: `Шаблон «${t.name}» сохранён` });
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-xs bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 disabled:opacity-40 transition-all flex items-center gap-1"
                      >
                        <Save className="w-3 h-3" /> Сохранить
                      </button>
                      <button type="button" onClick={() => setShowSaveTpl(false)} className="text-slate-600 hover:text-slate-400 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  <AIDisclaimer variant="compact" />
                  <div className="flex justify-end">
                    <Button type="submit" size="lg" disabled={estimateMutation.isPending}>
                      {estimateMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Brain className="mr-2 h-4 w-4" />
                      )}
                      Анализировать задачу <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Step 2 */}
      {step === 2 && estimateData && (
        <div ref={step2AnchorRef} className="space-y-6 animate-in slide-in-from-right-8 duration-300 scroll-mt-4">
          <Button variant="ghost" onClick={() => setStep(1)} className="mb-2 -ml-2">
            <ArrowLeft className="mr-2 h-4 w-4" /> Назад к условию
          </Button>

          {/* Summary */}
          <Card className="bg-card/40 border-white/10">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start gap-4">
                <div className="h-11 w-11 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Brain className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Анализ завершён</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Сложность задачи: <span className="text-white font-medium">{estimateData.complexityScore}/10</span>.
                    {(estimateData as any).isMultiSection && (
                      <> Работа разбита на <span className="text-amber-400 font-medium">{(estimateData as any).sectionCount} разделов</span> — каждый пишется отдельно.</>
                    )}
                    {(estimateData as any).isMultiQuestion && (
                      <> Тест на <span className="text-amber-400 font-medium">{(estimateData as any).questionCount} вопросов</span> — цена за вопрос.</>
                    )}
                    {' '}Рекомендуем <span className="text-primary font-medium">
                      {{ fast: 'Быстрый', standard: 'Стандартный', premium: 'Премиум', super_premium: 'Супер Премиум' }[estimateData.recommendedMode] ?? 'Стандартный'}
                    </span> режим.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {[
                      { label: form.getValues("subject"), icon: FileText },
                      { label: { homework: "Дом. задание", test: "Тест", coursework: "Курсовая", lab: "Лаб. работа", essay: "Эссе", diploma: "Диплом", other: "Другое" }[form.getValues("taskType")] || "", icon: BookOpen },
                      { label: { brief: "Кратко", detailed: "Подробно", step_by_step: "Пошагово" }[form.getValues("detailLevel")], icon: AlignLeft },
                      { label: { ru: "Рус.", en: "Eng.", same: "Авто" }[form.getValues("outputLanguage")], icon: Languages },
                    ].map((tag, i) => tag.label ? (
                      <Badge key={i} variant="secondary" className="bg-white/5 text-muted-foreground border-white/10 flex items-center gap-1">
                        <tag.icon className="w-3 h-3" /> {tag.label}
                      </Badge>
                    ) : null)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <h3 className="text-xl font-semibold">Выберите режим решения</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(['fast', 'standard', 'premium', 'super_premium'] as const).map((mode) => {
              const data = (estimateData.modes as any)[mode];
              const isSelected = selectedMode === mode;
              const isRecommended = estimateData.recommendedMode === mode;

              const titles = { fast: "Быстрый", standard: "Стандарт", premium: "Премиум", super_premium: "Супер Премиум" };
              const icons = { fast: Zap, standard: CheckCircle2, premium: Brain, super_premium: Crown };
              const descriptions = {
                fast: "Лёгкие модели. Определения, тесты, простые задачи.",
                standard: "Сбалансированно. Большинство учебных задач.",
                premium: "Reasoning-модели + Claude Sonnet. Курсовые и сложные задачи.",
                super_premium: "Максимум: Claude Opus финализирует. Дипломные и сложнейшие работы.",
              };
              const Icon = icons[mode];

              return (
                <Card
                  key={mode}
                  className={`cursor-pointer transition-all relative overflow-hidden ${isSelected ? 'border-primary ring-1 ring-primary bg-primary/5' : 'border-white/10 bg-card/40 hover:bg-white/5'}`}
                  onClick={() => setSelectedMode(mode)}
                >
                  {isRecommended && (
                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] uppercase font-bold px-2 py-1 rounded-bl-lg">
                      Рекомендуем
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Icon className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                      {titles[mode]}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white mb-0.5">~{data.cost} ₽</div>
                    {(data as any).sectionCount > 1 ? (
                      <div className="text-xs text-amber-400/80 mb-1">
                        {(data as any).sectionCount} разд. × {(data as any).perSectionCost} ₽
                      </div>
                    ) : (data as any).questionCount > 1 ? (
                      <div className="text-xs text-amber-400/80 mb-1">
                        {(data as any).questionCount} вопр. × {(data as any).perQuestionCost} ₽
                      </div>
                    ) : null}
                    <div className="text-xs text-muted-foreground flex items-center mb-3">
                      от {data.timeMinutes} мин.
                    </div>
                    <p className="text-xs text-muted-foreground/80 leading-relaxed">{descriptions[mode]}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Верификация изображений — по одному */}
          {hasImages && !allConfirmed && currentVerify && (
            <>
              {/* Прогресс: сколько задач верифицировано */}
              {imageAttachments.length > 1 && (
                <div className="flex items-center gap-2 px-1">
                  {imageAttachments.map((_, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className={`w-6 h-6 rounded-full border text-[10px] font-bold flex items-center justify-center transition-all ${
                        imgVerifies[i]?.status === "confirmed"
                          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                          : i === verifyIdx
                          ? "bg-violet-500/20 border-violet-500/50 text-violet-300"
                          : "bg-muted/20 border-border/30 text-muted-foreground/40"
                      }`}>
                        {imgVerifies[i]?.status === "confirmed" ? "✓" : i + 1}
                      </div>
                      {i < imageAttachments.length - 1 && (
                        <div className={`h-px w-4 ${imgVerifies[i]?.status === "confirmed" ? "bg-emerald-500/40" : "bg-border/30"}`} />
                      )}
                    </div>
                  ))}
                  <span className="text-xs text-muted-foreground ml-1">
                    Задача {verifyIdx + 1} из {imageAttachments.length}
                  </span>
                </div>
              )}

              {/* Загрузка */}
              {currentVerify.status === "loading" && (
                <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-blue-500/5 p-5">
                  <div className="flex items-center gap-4">
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-2xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center overflow-hidden">
                        {imageAttachments[verifyIdx] ? (
                          <img src={imageAttachments[verifyIdx].dataUrl} alt="" className="w-full h-full object-cover opacity-60" />
                        ) : (
                          <ScanLine className="w-5 h-5 text-violet-400" />
                        )}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-background border border-violet-500/40 flex items-center justify-center">
                        <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Считываю условие{imageAttachments.length > 1 ? ` задачи ${verifyIdx + 1}` : ""} с фото...
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">ИИ распознаёт текст задачи</p>
                      <div className="flex gap-1 mt-2">
                        {[0,1,2,3,4].map(i => (
                          <div key={i} className="h-1 w-6 rounded-full bg-violet-500/30 overflow-hidden">
                            <div className="h-full bg-violet-400 rounded-full animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Результат — нужна проверка */}
              {currentVerify.status === "done" && (
                <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/5 to-orange-500/3 overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-amber-500/15 bg-amber-500/5">
                    <div className="flex items-center gap-2.5">
                      {imageAttachments[verifyIdx] && (
                        <div className="w-8 h-8 rounded-xl overflow-hidden border border-amber-500/25 shrink-0">
                          <img src={imageAttachments[verifyIdx].dataUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {imageAttachments.length > 1 ? `Задача ${verifyIdx + 1} — проверьте условие` : "ИИ считал условие — проверьте"}
                        </p>
                        <p className="text-[11px] text-amber-400/80">Сверьте с оригиналом. Если ИИ ошибся — нажмите «Редактировать».</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!editingVerify) {
                          setEditedText(currentVerify.extractedText);
                          setEditingVerify(true);
                        } else {
                          setEditingVerify(false);
                        }
                      }}
                      className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-all shrink-0 ${
                        editingVerify
                          ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                          : "text-amber-400/70 hover:text-amber-300 hover:bg-amber-500/10 border border-transparent"
                      }`}
                    >
                      {editingVerify ? <><Check className="w-3 h-3" /> Просмотр</> : <><Pencil className="w-3 h-3" /> Редактировать</>}
                    </button>
                  </div>

                  {/* Quality warning banner */}
                  {(currentVerify.quality === "poor" || currentVerify.quality === "unreadable") && (
                    <div className={`mx-5 mt-4 flex items-start gap-3 rounded-xl border px-4 py-3 ${
                      currentVerify.quality === "unreadable"
                        ? "bg-destructive/8 border-destructive/25 text-destructive"
                        : "bg-amber-500/8 border-amber-500/25 text-amber-400"
                    }`}>
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">
                          {currentVerify.quality === "unreadable"
                            ? "Изображение нечитаемо"
                            : "Изображение частично нечёткое"}
                        </p>
                        <p className="text-xs mt-0.5 opacity-80">
                          {currentVerify.qualityNote || (currentVerify.quality === "unreadable"
                            ? "Текст практически не распознаётся. Сделайте более чёткое фото."
                            : "Часть текста могла быть считана неточно. Проверьте и при необходимости отредактируйте.")}
                        </p>
                        {currentVerify.quality === "unreadable" && (
                          <p className="text-xs mt-1.5 opacity-70">
                            Рекомендуем переснять: хорошее освещение, без тряски, весь текст в кадре.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Content: render or edit */}
                  <div className="px-5 py-4">
                    {editingVerify ? (
                      <textarea
                        className="w-full rounded-xl bg-background/60 border border-white/10 p-4 text-sm text-foreground leading-relaxed resize-y min-h-[120px] max-h-72 font-mono focus:outline-none focus:border-violet-500/40 focus:bg-background/80 transition-colors"
                        value={editedText}
                        onChange={e => setEditedText(e.target.value)}
                        autoFocus
                        spellCheck={false}
                      />
                    ) : (
                      <div className="rounded-xl bg-background/40 border border-white/8 p-4 max-h-64 overflow-y-auto">
                        <RenderMessage content={currentVerify.extractedText} />
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2.5 px-5 pb-4">
                    <Button
                      size="sm"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.25)] font-semibold"
                      onClick={confirmCurrentImage}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      {verifyIdx + 1 < imageAttachments.length
                        ? `Верно — к задаче ${verifyIdx + 2}`
                        : "Всё верно — запустить решение"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-border/50 text-muted-foreground hover:bg-destructive/8 hover:text-destructive hover:border-destructive/40"
                      onClick={() => { setImgVerifies([]); setVerifyIdx(0); setEditingVerify(false); setEditedText(""); setStep(1); }}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Переснять
                    </Button>
                  </div>
                </div>
              )}

              {/* Ошибка */}
              {currentVerify.status === "error" && (
                <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-destructive/15 border border-destructive/25 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-4 h-4 text-destructive" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-destructive">Не удалось считать изображение</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {(currentVerify as any).message} — попробуйте ещё раз или опишите условие вручную.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3 border-destructive/30 text-destructive hover:bg-destructive/10 h-7 text-xs"
                        onClick={() => verifyImage(verifyIdx)}
                      >
                        <RotateCcw className="h-3 w-3 mr-1.5" /> Попробовать снова
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Confirm bar */}
          {(() => {
            const imgCount = imageAttachments.length;
            const baseCost = (selectedMode && estimateData.modes[selectedMode]?.cost) || 0;
            const totalCost = baseCost * Math.max(1, imgCount);
            const isBlocked = isVerifying || isWaitingConfirm;
            const btnLabel = (() => {
              if (isVerifying) return "Считываю фото...";
              if (isWaitingConfirm) return "Проверьте условие выше";
              if (hasImages && imgVerifies.length === 0) return imgCount > 1 ? `Проверить ${imgCount} задачи и запустить` : "Проверить фото и запустить";
              return imgCount > 1 ? `Запустить ${imgCount} задачи` : "Запустить решение";
            })();
            return (
              <div className="flex items-center justify-between p-5 bg-card/60 border border-white/10 rounded-xl backdrop-blur-sm">
                <div>
                  <div className="flex items-baseline gap-1">
                    <p className="text-sm text-muted-foreground">К списанию ≈</p>
                    <p className="text-2xl font-bold">{totalCost} ₽</p>
                  </div>
                  {imgCount > 1 && (
                    <p className="text-xs text-violet-400/80 mt-0.5">{imgCount} задачи × {baseCost} ₽</p>
                  )}
                  <p className="text-xs text-slate-500 mt-0.5">Цена приблизительная, финальная может отличаться</p>
                  {user && <p className="text-xs text-muted-foreground mt-0.5">Ваш баланс: {user.balance} ₽</p>}
                </div>
                <Button
                  size="lg"
                  onClick={onConfirm}
                  disabled={isBlocked || !selectedMode}
                  className="px-8 shadow-[0_0_20px_rgba(124,58,237,0.3)]"
                >
                  {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {btnLabel}
                </Button>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

const FormDescription = ({ children, className }: any) => <p className={`text-sm text-muted-foreground ${className}`}>{children}</p>;
