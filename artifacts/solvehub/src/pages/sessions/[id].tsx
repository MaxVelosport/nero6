import { useEffect, useRef, useState, useCallback } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { useUpdateBalance } from "@/hooks/useUpdateBalance";
import {
  getSession, sendMessage, updateSessionStatus,
  Session, SessionMessage
} from "@/lib/sessions-api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Send, ArrowLeft, Loader2, CheckCircle2,
  Clock, Infinity, Bot, User, RotateCcw, Copy, Zap,
  Paperclip, X, Image, FileText, Sparkles, Library,
  Download, ChevronUp, ChevronDown, ThumbsUp, ThumbsDown, AlertTriangle,
  ImagePlus, Wand2, MoreVertical,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { RenderMessage } from "@/lib/render-message";
import { AIDisclaimer } from "@/components/ai-disclaimer";
import { exportSessionToDocx } from "@/lib/word-export";
import { exportSessionToPdf } from "@/lib/pdf-export";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/10 text-green-400 border-green-500/20",
  completed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  expired: "bg-red-500/10 text-red-400 border-red-500/20",
  paused: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Активна",
  completed: "Завершена",
  expired: "Истекла",
  paused: "Пауза",
};

const MODEL_LABELS: Record<string, { label: string; color: string }> = {
  "gemini-2-flash": { label: "Gemini 2.0 Flash", color: "text-blue-400" },
  "gpt-4o": { label: "GPT-4o", color: "text-emerald-400" },
  "claude-sonnet": { label: "Claude 3.5 Sonnet", color: "text-orange-400" },
  "deepseek-v3": { label: "DeepSeek-V3", color: "text-violet-400" },
  "grok": { label: "Grok 3 Mini", color: "text-cyan-400" },
};

const MODELS_WITH_IMAGES = ["gemini-2-flash", "gpt-4o", "claude-sonnet"];

// File pricing tiers (must match backend)
const FILE_TIERS = [
  { maxMB: 5,  extraCost: 0,  label: "бесплатно" },
  { maxMB: 20, extraCost: 30, label: "+30 ₽" },
  { maxMB: 50, extraCost: 80, label: "+80 ₽" },
] as const;
const MAX_FILE_MB = 50;

function getFileTierInfo(sizeBytes: number) {
  const mb = sizeBytes / (1024 * 1024);
  for (const tier of FILE_TIERS) {
    if (mb <= tier.maxMB) return tier;
  }
  return FILE_TIERS[FILE_TIERS.length - 1];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

interface Attachment {
  data: string; // base64
  name: string;
  type: string;
  previewUrl: string;
  sizeBytes: number;
}

function getStarterQuestions(subject: string, purposeType: string): string[] {
  const s = subject.toLowerCase();
  const bySubject: Record<string, string[]> = {
    матан: ["Объясни понятие предела функции простыми словами", "Как найти производную сложной функции? Покажи на примере", "Что такое интеграл Римана и как его вычислить?", "Сформулируй теорему Лагранжа о среднем значении", "Как найти точки экстремума функции?"],
    физик: ["Объясни законы Ньютона простыми словами с примерами", "Что такое электрический потенциал и как его рассчитать?", "Объясни закон сохранения импульса — задача с решением", "Что такое электромагнитная индукция?", "Объясни принцип суперпозиции сил"],
    хими: ["Что такое степень окисления? Как её определить?", "Объясни реакции окисления-восстановления (ОВР)", "Что такое гибридизация орбиталей?", "Как составить уравнение химической реакции?", "Объясни химическое равновесие и принцип Ле Шателье"],
    програм: ["Объясни разницу между компилируемыми и интерпретируемыми языками", "Что такое рекурсия? Пример на Python", "Объясни объектно-ориентированное программирование", "Что такое алгоритмическая сложность O(n)?", "Как работают указатели в C++?"],
    python: ["Объясни разницу между list и tuple в Python", "Как работают декораторы в Python? Пример", "Что такое генераторы и зачем они нужны?", "Объясни asyncio и асинхронное программирование", "Как работает сборщик мусора в Python?"],
    матема: ["Реши задачу: найти корни уравнения x² − 5x + 6 = 0", "Что такое матрица и как перемножить матрицы?", "Объясни теорему Виета", "Что такое прогрессия? Формулы суммы", "Как решать системы уравнений методом Гаусса?"],
    истори: ["Назови основные причины Первой мировой войны", "Что такое ГУЛАГ? Его роль в истории СССР", "Объясни причины и последствия Великой французской революции", "Что стало причиной распада СССР?", "Объясни политику НЭП в 1920-х годах"],
    экономик: ["Что такое эластичность спроса? Пример", "Объясни закон убывающей предельной полезности", "Что такое ВВП и чем он отличается от ВНП?", "Объясни понятие инфляции и её типы", "Что такое монополия и как она влияет на рынок?"],
    право: ["Что такое правоспособность и дееспособность?", "Объясни разницу между гражданским и административным правом", "Что такое презумпция невиновности?", "Объясни понятие юридического лица", "Что такое договор оферты?"],
    философи: ["Объясни основной вопрос философии", "В чём разница между материализмом и идеализмом?", "Что такое диалектика Гегеля?", "Объясни этику Канта — категорический императив", "В чём суть экзистенциализма?"],
    биологи: ["Что такое митоз и мейоз? Отличия", "Объясни законы Менделя с примерами", "Что такое ДНК и РНК? Их роль в клетке", "Объясни фотосинтез и дыхание клетки", "Что такое естественный отбор?"],
    английск: ["Объясни разницу между Present Perfect и Past Simple", "Как использовать условные предложения (conditionals) в английском?", "Что такое герундий и инфинитив в английском? Когда что?", "Объясни пассивный залог в английском — примеры", "Как правильно строить вопросы в английском?"],
  };

  for (const key of Object.keys(bySubject)) {
    if (s.includes(key)) return bySubject[key];
  }

  const byPurpose: Record<string, (sub: string) => string[]> = {
    exam_prep: sub => [`Какие основные темы по «${sub}» важны для экзамена?`, `Дай 5 типичных вопросов экзамена по ${sub}`, `Объясни самые сложные понятия по ${sub}`, "Что чаще всего спрашивают на зачёте?", "Как лучше структурировать ответ на экзамене?"],
    online_test: sub => [`Проверь мои знания по теме: напиши 5 тестовых вопросов по ${sub}`, `Что нужно знать для онлайн-теста по ${sub}?`, "Объясни тему, которую чаще всего проверяют в тестах", "Дай мне задачу с выбором ответа", "Объясни типичные ошибки в тестах по этой теме"],
    homework: sub => [`Помоги разобраться с домашним заданием по ${sub}`, "Объясни этот тип задач пошагово", "Проверь правильность моего решения", "Дай похожую задачу для практики", "Объясни формулу, которую нужно применить"],
    practice: sub => [`Дай задачу повышенной сложности по ${sub}`, "Объясни этот метод решения подробнее", "Разбери мою ошибку и объясни как правильно", "Дай ещё один пример для закрепления", `Какие типы задач по ${sub} самые распространённые?`],
  };

  if (byPurpose[purposeType]) return byPurpose[purposeType](subject || "этому предмету");

  return [
    `Объясни основные понятия по теме «${subject || "этому предмету"}»`,
    "Дай мне типичную задачу и помоги разобраться",
    "Что самое важное нужно знать по этой теме?",
    "Объясни эту тему как будто мне 18 лет",
    "Проверь мои знания — задай вопрос",
  ];
}

const MODEL_LABELS_SHORT: Record<string, string> = {
  "gemini-2-flash": "Gemini",
  "gpt-4o": "GPT-4o",
  "claude-sonnet": "Claude",
  "deepseek-v3": "DeepSeek",
  "grok": "Grok",
};

function MessageBubble({
  message, onCopy, rating, onRate, fallbackModel,
}: {
  message: SessionMessage;
  onCopy: (text: string) => void;
  rating?: "up" | "down";
  onRate?: (id: number, r: "up" | "down") => void;
  fallbackModel?: string;
}) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isError = !isUser && message.content.startsWith("⚠️");

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="text-xs text-muted-foreground bg-white/5 border border-white/10 rounded-full px-4 py-1.5 flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-primary" />
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} group`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${isUser ? 'bg-primary/20' : isError ? 'bg-red-500/20' : 'bg-white/10'}`}>
        {isUser ? <User className="w-4 h-4 text-primary" /> : isError ? <AlertTriangle className="w-4 h-4 text-red-400" /> : <Bot className="w-4 h-4 text-muted-foreground" />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[82%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {message.question_number && (
          <div className={`text-xs text-muted-foreground ${isUser ? 'text-right' : 'text-left'}`}>
            {isUser ? `Вопрос #${message.question_number}` : `Ответ #${message.question_number}`}
          </div>
        )}

        {/* Attachment preview (images) */}
        {isUser && message.attachment_data && message.attachment_type?.startsWith("image/") && (
          <div className={`${isUser ? 'self-end' : 'self-start'} mb-1`}>
            <div className="relative rounded-xl overflow-hidden border border-white/10 max-w-[240px]">
              <img
                src={`data:${message.attachment_type};base64,${message.attachment_data}`}
                alt={message.attachment_name || "Вложение"}
                className="max-w-full object-cover max-h-[180px]"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-xs text-white px-2 py-1 truncate">
                {message.attachment_name}
              </div>
            </div>
          </div>
        )}

        {/* Non-image attachment badge */}
        {isUser && message.attachment_data && !message.attachment_type?.startsWith("image/") && (
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-muted-foreground self-end mb-1">
            <FileText className="w-3 h-3" /> {message.attachment_name}
          </div>
        )}

        <div className={`relative rounded-2xl px-4 py-3 leading-relaxed ${isUser
          ? 'bg-primary text-white rounded-tr-sm text-sm'
          : isError
            ? 'bg-red-500/10 border border-red-500/20 text-foreground rounded-tl-sm'
            : 'bg-card/60 border border-white/10 text-foreground rounded-tl-sm'
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap text-sm">{message.content}</p>
          ) : (
            <RenderMessage content={message.content} />
          )}

          {/* Copy button — always visible on touch, hover-only on desktop */}
          {!isUser && !isError && (
            <button
              onClick={() => onCopy(message.content)}
              className="absolute top-2 right-2 sm:opacity-0 sm:group-hover:opacity-100 opacity-60 hover:opacity-100 transition-opacity w-6 h-6 rounded flex items-center justify-center bg-white/10 hover:bg-white/20"
              title="Копировать"
            >
              <Copy className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Meta + rating */}
        <div className={`flex items-center gap-2 text-xs text-muted-foreground ${isUser ? 'justify-end' : 'justify-start'}`}>
          <span>{format(new Date(message.created_at), "HH:mm", { locale: ru })}</span>
          {!isUser && message.processing_time_ms && (
            <span className="flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" /> {(message.processing_time_ms / 1000).toFixed(1)}с
            </span>
          )}
          {/* Fallback indicator */}
          {!isUser && fallbackModel && (
            <span className="flex items-center gap-0.5 text-amber-400/70 text-[10px]">
              <Zap className="w-2.5 h-2.5" />
              {MODEL_LABELS_SHORT[fallbackModel] || fallbackModel}
            </span>
          )}
          {/* Rating buttons */}
          {!isUser && !isError && onRate && (
            <div className="flex items-center gap-0.5 ml-1">
              <button
                onClick={() => onRate(message.id, "up")}
                className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${rating === "up" ? "text-green-400 bg-green-500/15" : "text-muted-foreground/40 hover:text-green-400 hover:bg-green-500/10"}`}
                title="Хорошо"
              >
                <ThumbsUp className="w-3 h-3" />
              </button>
              <button
                onClick={() => onRate(message.id, "down")}
                className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${rating === "down" ? "text-red-400 bg-red-500/15" : "text-muted-foreground/40 hover:text-red-400 hover:bg-red-500/10"}`}
                title="Плохо"
              >
                <ThumbsDown className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SessionChatPage() {
  const [, params] = useRoute("/sessions/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  useGetMe();
  const updateBalance = useUpdateBalance();
  const sessionId = parseInt(params?.id || "0");

  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [questionsUsed, setQuestionsUsed] = useState(0);
  const [questionsTotal, setQuestionsTotal] = useState(0);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [kbDoc, setKbDoc] = useState<{ content: string; addedAt: number } | null>(null);
  const [kbExpanded, setKbExpanded] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<number, "up" | "down">>({});
  const [messageFallbacks, setMessageFallbacks] = useState<Record<number, string>>({});

  const [imageGenOpen, setImageGenOpen] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageLoading, setImageLoading] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<{ url: string; prompt: string }[]>([]);
  const [headerMoreOpen, setHeaderMoreOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Mobile keyboard fix — track visual viewport height
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handler = () => setViewportHeight(vv.height);
    vv.addEventListener("resize", handler);
    handler();
    return () => vv.removeEventListener("resize", handler);
  }, []);

  // Word export
  const handleExportDocx = async () => {
    if (!session || !visibleMessages.length) return;
    try {
      await exportSessionToDocx({
        title: session.title,
        subject: session.subject,
        model: modelInfo?.label || session.model_id,
        createdAt: session.created_at,
        messages: visibleMessages,
      });
    } catch {
      toast({ variant: "destructive", title: "Ошибка", description: "Не удалось создать DOCX файл" });
    }
  };

  // PDF export — единый формат с другими инструментами (через html2pdf)
  const handleExportPDF = async () => {
    if (!session || !visibleMessages.length) return;
    try {
      await exportSessionToPdf({
        title: session.title,
        subject: session.subject,
        model: modelInfo?.label || session.model_id,
        createdAt: session.created_at,
        messages: visibleMessages,
      });
    } catch {
      toast({ variant: "destructive", title: "Ошибка экспорта", description: "Не удалось создать PDF файл" });
    }
  };

  useEffect(() => {
    if (!sessionId) return;
    getSession(sessionId)
      .then(data => {
        setSession(data);
        setMessages(data.messages || []);
        setQuestionsUsed(data.questions_used);
        setQuestionsTotal(data.questions_total);
      })
      .catch(() => toast({ variant: "destructive", title: "Сессия не найдена" }))
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!sessionId) return;
    try {
      const raw = localStorage.getItem(`kb_session_${sessionId}`);
      if (raw) setKbDoc(JSON.parse(raw));
    } catch {}
  }, [sessionId]);

  // Session countdown timer
  useEffect(() => {
    if (!session?.expires_at || session.status !== "active") { setTimeLeft(null); return; }
    const tick = () => {
      const diff = new Date(session.expires_at!).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("истекла"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(h > 0 ? `${h}ч ${String(m).padStart(2, "0")}м` : m > 0 ? `${m}м ${String(s).padStart(2, "0")}с` : `${s}с`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [session?.expires_at, session?.status]);

  const modelInfo = session ? (MODEL_LABELS[session.model_id] || { label: session.model_id, color: "text-muted-foreground" }) : null;
  const supportsImages = session ? MODELS_WITH_IMAGES.includes(session.model_id) : false;

  const processFile = useCallback((file: File) => {
    if (!supportsImages && file.type.startsWith("image/")) {
      toast({
        variant: "destructive",
        title: "Изображения не поддерживаются",
        description: `Модель ${modelInfo?.label} не поддерживает изображения. Выберите GPT-4o, Gemini или Claude.`,
      });
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "Файл слишком большой",
        description: `Максимальный размер: ${MAX_FILE_MB} МБ`,
      });
      return;
    }

    const tier = getFileTierInfo(file.size);
    if (tier.extraCost > 0) {
      toast({
        title: `Большой файл — ${formatFileSize(file.size)}`,
        description: `За отправку этого файла будет списано дополнительно ${tier.extraCost} ₽ с баланса.`,
      });
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const base64 = result.split(',')[1];
      const previewUrl = file.type.startsWith("image/") ? result : "";
      setAttachment({ data: base64, name: file.name, type: file.type, previewUrl, sizeBytes: file.size });
    };
    reader.readAsDataURL(file);
  }, [supportsImages, modelInfo]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  // Объявляем isActive здесь — до useEffect, который его использует
  const isActive = session?.status === "active";

  // ── Ctrl+V / Cmd+V — вставка изображения из буфера ──────────────────────
  useEffect(() => {
    if (!isActive) return;
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) { e.preventDefault(); processFile(file); break; }
        }
      }
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, [isActive, processFile]);

  const handleSend = async () => {
    if (!inputText.trim() || sending || !session) return;
    if (session.status !== "active") return;

    const text = inputText.trim();
    const currentAttachment = attachment;
    setInputText("");
    setAttachment(null);
    setSending(true);

    // Optimistic user message
    const optimisticMsg: SessionMessage = {
      id: Date.now(),
      session_id: sessionId,
      role: "user",
      content: text,
      question_number: questionsUsed + 1,
      processing_time_ms: null,
      created_at: new Date().toISOString(),
      attachment_data: currentAttachment?.data || null,
      attachment_name: currentAttachment?.name || null,
      attachment_type: currentAttachment?.type || null,
    };
    setMessages(prev => [...prev, optimisticMsg]);
    scrollToBottom();

    try {
      // Prepend KB context to the FIRST message (questionsUsed === 0)
      const isFirstMessage = questionsUsed === 0 && messages.filter(m => m.role === "user").length === 0;
      const textWithCtx = (isFirstMessage && kbDoc?.content)
        ? `[КОНТЕКСТ СЕССИИ]\n${kbDoc.content}\n[/КОНТЕКСТ СЕССИИ]\n\n${text}`
        : text;

      const result = await sendMessage(sessionId, textWithCtx, currentAttachment ? {
        data: currentAttachment.data,
        name: currentAttachment.name,
        type: currentAttachment.type,
        sizeBytes: currentAttachment.sizeBytes,
      } : null);

      setMessages(prev => [
        ...prev.filter(m => m.id !== optimisticMsg.id),
        result.userMessage,
        result.assistantMessage,
      ]);
      setQuestionsUsed(result.questionsUsed);

      // Track fallback model if different from session model
      if (result.actualModelUsed && result.assistantMessage?.id) {
        setMessageFallbacks(prev => ({ ...prev, [result.assistantMessage.id]: result.actualModelUsed }));
        const fallbackLabel = MODEL_LABELS[result.actualModelUsed]?.label || result.actualModelUsed;
        const sessionLabel = MODEL_LABELS[session.model_id]?.label || session.model_id;
        toast({
          title: `Переключено на ${fallbackLabel}`,
          description: `${sessionLabel} недоступен — ответ дал ${fallbackLabel}`,
        });
      }

      if (result.attachmentExtraCost && result.attachmentExtraCost > 0) {
        updateBalance();
        toast({
          title: `Списано ${result.attachmentExtraCost} ₽ за большой файл`,
          description: "Это дополнительная плата за файл более 5 МБ",
        });
      }

      if (result.sessionCompleted) {
        setSession(prev => prev ? { ...prev, status: "completed" } : prev);
        toast({ title: "Все вопросы использованы!", description: "Сессия завершена. Начните новую." });
      }
    } catch (err: any) {
      // Keep user message visible — replace optimistic with error response
      const errReply: SessionMessage = {
        id: Date.now() + 1,
        session_id: sessionId,
        role: "assistant",
        content: `⚠️ **${err?.message || "Не удалось получить ответ"}**\n\nПопробуйте отправить вопрос ещё раз.`,
        question_number: null,
        processing_time_ms: null,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? { ...m, id: optimisticMsg.id } : m).concat([errReply]));

      // Silently re-sync from server to get the true DB state
      getSession(sessionId).then(data => {
        setMessages(data.messages || []);
        setQuestionsUsed(data.questions_used ?? 0);
      }).catch(() => {});

      toast({ variant: "destructive", title: "Ошибка", description: err?.message || "Не удалось отправить вопрос" });
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return;
    setImageLoading(true);
    try {
      const token = localStorage.getItem("authToken");
      const resp = await fetch("/api/tasks/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: imagePrompt.trim() }),
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

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Скопировано" });
  };

  const handleRate = (id: number, r: "up" | "down") => {
    setRatings(prev => {
      if (prev[id] === r) { const n = { ...prev }; delete n[id]; return n; }
      return { ...prev, [id]: r };
    });
  };

  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshMessages = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const data = await getSession(sessionId);
      setMessages(data.messages || []);
      setQuestionsUsed(data.questions_used ?? 0);
      toast({ title: "Чат обновлён", description: `Загружено ${(data.messages || []).filter(m => m.role !== "system").length} сообщений` });
    } catch {
      toast({ variant: "destructive", title: "Ошибка", description: "Не удалось обновить чат" });
    } finally {
      setRefreshing(false);
    }
  };

  const handleComplete = async () => {
    if (!session) return;
    try {
      await updateSessionStatus(sessionId, "completed");
      setSession(prev => prev ? { ...prev, status: "completed" } : prev);
      toast({ title: "Сессия завершена" });
    } catch {
      toast({ variant: "destructive", title: "Ошибка" });
    }
  };

  const isUnlimited = questionsTotal >= 9999;
  const remaining = isUnlimited ? null : questionsTotal - questionsUsed;
  const progress = isUnlimited ? 0 : (questionsUsed / questionsTotal) * 100;
  const visibleMessages = messages.filter(m => m.role !== "system");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground mb-4">Сессия не найдена</p>
        <Link href="/sessions"><Button>← К сессиям</Button></Link>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col -m-6 md:-m-8 overflow-hidden"
      style={{ height: viewportHeight ? `${viewportHeight}px` : "calc(100vh - 8rem)", maxHeight: viewportHeight ? `${viewportHeight}px` : "900px" }}
      onDrop={isActive ? handleDrop : undefined}
      onDragOver={isActive ? handleDragOver : undefined}
      onDragLeave={isActive ? handleDragLeave : undefined}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary rounded-xl flex items-center justify-center">
          <div className="text-center">
            <Image className="w-12 h-12 text-primary mx-auto mb-2" />
            <p className="text-lg font-semibold text-primary">Перетащите изображение сюда</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-3 sm:px-6 py-2.5 sm:py-3 border-b border-white/10 bg-background/80 backdrop-blur-md flex items-center gap-2 sm:gap-3 shrink-0">
        <Link href="/sessions">
          <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="font-semibold text-sm sm:text-base truncate">{session.title}</h1>
            <Badge variant="outline" className={`text-[10px] sm:text-xs border shrink-0 px-1.5 py-0.5 ${STATUS_COLORS[session.status]}`}>
              {STATUS_LABELS[session.status]}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground">
            <span className="truncate max-w-[100px] sm:max-w-none">{session.subject}</span>
            {modelInfo && (
              <>
                <span className="hidden sm:inline">·</span>
                <span className={`hidden sm:flex items-center gap-1 ${modelInfo.color}`}>
                  <Sparkles className="w-2.5 h-2.5" />
                  {modelInfo.label}
                </span>
              </>
            )}
            {kbDoc?.content && (
              <span className="flex items-center gap-0.5 text-blue-400 shrink-0">
                <Library className="w-2.5 h-2.5" />
                <span className="hidden sm:inline">Контекст</span>
              </span>
            )}
          </div>
        </div>

        {/* Timer (for unlimited/time-based sessions) */}
        {timeLeft !== null && (
          <div className={`shrink-0 text-right ${timeLeft === "истекла" ? "text-red-400" : parseInt(timeLeft) <= 5 && timeLeft.endsWith("м") ? "text-amber-400" : "text-cyan-400"}`}>
            <div className="flex items-center gap-1 text-xs sm:text-sm font-mono font-medium">
              <Clock className="w-3 h-3" />
              {timeLeft}
            </div>
            <div className="text-[10px] text-muted-foreground hidden sm:block">{timeLeft === "истекла" ? "Время вышло" : "осталось"}</div>
          </div>
        )}

        {/* Progress indicator */}
        <div className="shrink-0 text-right">
          {isUnlimited ? (
            <div className="flex items-center gap-1 text-cyan-400 text-xs sm:text-sm font-medium">
              <Infinity className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Безлимит</span>
            </div>
          ) : (
            <div>
              <div className="text-sm font-bold">
                {questionsUsed}<span className="text-muted-foreground font-normal">/{questionsTotal}</span>
              </div>
              <div className="text-[10px] text-muted-foreground hidden sm:block">вопросов</div>
            </div>
          )}
        </div>

        {/* Exam mode badge */}
        {session.package_type === "exam" && (
          <span className="hidden sm:inline text-[10px] font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full shrink-0">
            Экзамен
          </span>
        )}

        {/* Desktop: individual buttons */}
        <div className="hidden sm:flex items-center gap-1">
          <Button
            variant="ghost" size="icon"
            onClick={handleRefreshMessages} disabled={refreshing}
            className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Обновить"
          >
            <RotateCcw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          {visibleMessages.length > 0 && (
            <Button variant="ghost" size="icon" onClick={handleExportDocx} className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Скачать DOCX">
              <FileText className="w-4 h-4" />
            </Button>
          )}
          {visibleMessages.length > 0 && (
            <Button variant="ghost" size="icon" onClick={() => { window.location.href = "/illustrations"; }} className="h-8 w-8 text-violet-400 hover:text-violet-300 hover:bg-violet-500/10" title="Иллюстрации">
              <ImagePlus className="w-4 h-4" />
            </Button>
          )}
          {visibleMessages.length > 0 && (
            <Button variant="ghost" size="icon" onClick={handleExportPDF} className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Сохранить PDF">
              <Download className="w-4 h-4" />
            </Button>
          )}
          {isActive && (
            <Button variant="ghost" size="sm" onClick={handleComplete} className="text-muted-foreground hover:text-foreground h-8 px-2">
              <CheckCircle2 className="w-4 h-4 mr-1" /> Завершить
            </Button>
          )}
        </div>

        {/* Mobile: consolidated "More" dropdown */}
        <div className="sm:hidden relative">
          <Button
            variant="ghost" size="icon"
            onClick={() => setHeaderMoreOpen(v => !v)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <MoreVertical className="w-4 h-4" />
          </Button>
          {headerMoreOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setHeaderMoreOpen(false)} />
              <div className="absolute right-0 top-9 z-40 bg-card/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl min-w-[160px] py-1 overflow-hidden">
                <button onClick={() => { handleRefreshMessages(); setHeaderMoreOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-white/5 transition-colors">
                  <RotateCcw className="w-4 h-4 text-muted-foreground" /> Обновить чат
                </button>
                {visibleMessages.length > 0 && (
                  <button onClick={() => { handleExportDocx(); setHeaderMoreOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-white/5 transition-colors">
                    <FileText className="w-4 h-4 text-muted-foreground" /> Скачать DOCX
                  </button>
                )}
                {visibleMessages.length > 0 && (
                  <button onClick={() => { handleExportPDF(); setHeaderMoreOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-white/5 transition-colors">
                    <Download className="w-4 h-4 text-muted-foreground" /> Сохранить PDF
                  </button>
                )}
                {visibleMessages.length > 0 && (
                  <button onClick={() => { window.location.href = "/illustrations"; setHeaderMoreOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-white/5 transition-colors text-violet-400">
                    <ImagePlus className="w-4 h-4" /> Иллюстрации
                  </button>
                )}
                {isActive && (
                  <>
                    <div className="h-px bg-white/8 mx-3 my-1" />
                    <button onClick={() => { handleComplete(); setHeaderMoreOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-white/5 transition-colors text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4" /> Завершить сессию
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {!isUnlimited && (
        <div className="px-4 sm:px-6 py-2 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <Progress value={progress} className="h-1.5 flex-1" />
            {remaining !== null && remaining > 0 && (
              <span className="text-xs text-muted-foreground shrink-0">осталось {remaining}</span>
            )}
            {remaining === 0 && (
              <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-400" /> Завершена
              </span>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
        {visibleMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Bot className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Сессия готова!</h3>
            <p className="text-sm text-muted-foreground max-w-xs mb-3">
              {isUnlimited
                ? `Безлимитная сессия${session.package?.durationHours ? ` · ${session.package.durationHours < 24 ? session.package.durationHours + " ч" : session.package.durationHours / 24 + " дн"}` : ""}. Задавайте вопросы — отвечу на каждый без ограничений.`
                : `Пакет на ${questionsTotal} вопросов. Задайте первый вопрос.`}
            </p>
            {modelInfo && (
              <div className={`flex items-center gap-1.5 text-xs ${modelInfo.color} bg-white/5 border border-white/10 rounded-full px-3 py-1`}>
                <Sparkles className="w-3 h-3" />
                {modelInfo.label}
                {supportsImages && <span className="text-emerald-400 ml-1">· поддерживает изображения</span>}
              </div>
            )}
            {session.package?.bestFor && (
              <div className="mt-3 px-4 py-2 bg-primary/10 border border-primary/20 rounded-xl text-xs text-primary">
                Идеально для: {session.package.bestFor}
              </div>
            )}
            {kbDoc?.content && (
              <div className="mt-3 w-full max-w-xs bg-blue-500/10 border border-blue-500/25 rounded-xl text-xs text-blue-300 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setKbExpanded(v => !v)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-blue-500/10 transition-colors"
                >
                  <Library className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="flex-1">Контекст сессии активен · {kbDoc.content.length} симв.</span>
                  {kbExpanded ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
                </button>
                {kbExpanded && (
                  <div className="px-4 pb-3 border-t border-blue-500/15">
                    <p className="mt-2 text-[11px] text-slate-400 leading-relaxed whitespace-pre-wrap line-clamp-6">{kbDoc.content}</p>
                  </div>
                )}
              </div>
            )}

            {/* Starter question chips */}
            {isActive && (() => {
              const subjectName = session.subject || "";
              const purpose = (session as any).purpose_type || "";
              const starters = getStarterQuestions(subjectName, purpose);
              return starters.length > 0 ? (
                <div className="mt-5 w-full max-w-sm">
                  <p className="text-[11px] text-slate-500 mb-2.5 flex items-center justify-center gap-1">
                    <Sparkles className="w-3 h-3" /> Начните с одного из вопросов:
                  </p>
                  <div className="flex flex-col gap-2">
                    {starters.map((q, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setInputText(q)}
                        className="w-full text-left text-xs px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:border-primary/30 hover:text-white hover:bg-primary/8 transition-all leading-relaxed"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        )}

        {visibleMessages.map(msg => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onCopy={handleCopy}
            rating={ratings[msg.id]}
            onRate={handleRate}
            fallbackModel={messageFallbacks[msg.id]}
          />
        ))}

        {/* Sending indicator */}
        {sending && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-1">
              <Bot className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="bg-card/60 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="px-4 sm:px-6 py-3 border-t border-white/10 bg-background/80 backdrop-blur-md shrink-0">
        {!isActive ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {session.status === 'completed' ? "Сессия завершена." : session.status === 'expired' ? "Время сессии истекло." : "Сессия приостановлена."}
            </p>
            <Link href="/sessions/new">
              <Button size="sm">
                <RotateCcw className="w-4 h-4 mr-2" /> Новая сессия
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Attachment preview strip */}
            {attachment && (() => {
              const tier = getFileTierInfo(attachment.sizeBytes);
              return (
                <div className="flex items-center gap-2 mb-2 p-2 bg-white/5 border border-white/10 rounded-xl">
                  {attachment.previewUrl ? (
                    <img src={attachment.previewUrl} alt="Preview" className="w-12 h-12 object-cover rounded-lg border border-white/10 shrink-0" />
                  ) : (
                    <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{attachment.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-slate-500">{formatFileSize(attachment.sizeBytes)}</p>
                      {tier.extraCost > 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400">
                          💳 {tier.label}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                          ✓ {tier.label}
                        </span>
                      )}
                    </div>
                    {attachment.type.startsWith("image/") && (
                      <p className="text-[10px] text-amber-400/70 mt-0.5 leading-tight">
                        Убедитесь, что текст на фото хорошо виден. При нечитаемом изображении ИИ попросит переснять.
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setAttachment(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              );
            })()}

            {/* Image generation panel */}
            {imageGenOpen && (
              <div className="mb-2 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-violet-300 flex items-center gap-1.5">
                    <ImagePlus className="w-3.5 h-3.5" /> Генерация изображения · 15 ₽
                  </p>
                  <button className="text-slate-600 hover:text-slate-400" onClick={() => setImageGenOpen(false)}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <Textarea
                  placeholder="Опишите изображение: схема, график, диаграмма, учебная иллюстрация..."
                  className="min-h-[60px] text-sm bg-background/50 border-violet-500/20 resize-none"
                  value={imagePrompt}
                  onChange={e => setImagePrompt(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleGenerateImage(); }}
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-600">DALL-E 3 · 1024×1024 · ~20 сек</p>
                  <Button size="sm" onClick={handleGenerateImage} disabled={imageLoading || imagePrompt.trim().length < 3} className="gap-2 bg-violet-600 hover:bg-violet-500 h-8">
                    {imageLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                    {imageLoading ? "Генерирую..." : "Создать"}
                  </Button>
                </div>
                {generatedImages.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {generatedImages.map((img, i) => (
                      <div key={i} className="rounded-lg overflow-hidden border border-white/10">
                        <img src={img.url} alt={img.prompt} className="w-full h-auto" />
                        <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-black/30">
                          <p className="text-xs text-slate-500 truncate flex-1">{img.prompt}</p>
                          <a href={img.url} download={`image-${i+1}.png`} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-white flex items-center gap-1">
                            <Download className="w-3 h-3" /> Скачать
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 items-end">
              {/* Attach button */}
              <input
                ref={fileInputRef}
                type="file"
                accept={supportsImages ? "image/*,.pdf,.txt,.doc,.docx" : ".txt,.pdf"}
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                variant="ghost"
                size="icon"
                className={`h-11 w-11 sm:h-[52px] sm:w-[52px] shrink-0 border transition-colors rounded-xl ${attachment ? 'border-primary text-primary bg-primary/10' : 'border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20'}`}
                onClick={() => fileInputRef.current?.click()}
                title="Прикрепить файл"
              >
                <Paperclip className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className={`h-11 w-11 sm:h-[52px] sm:w-[52px] shrink-0 border transition-colors rounded-xl ${imageGenOpen ? 'border-violet-500 text-violet-400 bg-violet-500/10' : 'border-white/10 text-muted-foreground hover:text-violet-400 hover:border-violet-500/40'}`}
                onClick={() => setImageGenOpen(o => !o)}
                title="Сгенерировать изображение (15 ₽)"
              >
                <ImagePlus className="w-4 h-4" />
              </Button>

              <Textarea
                ref={textareaRef}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={attachment ? `Вопрос #${questionsUsed + 1} (с файлом)...` : `Вопрос #${questionsUsed + 1}...`}
                className="flex-1 min-h-[44px] sm:min-h-[52px] max-h-[140px] resize-none bg-background/50 border-white/10 text-sm rounded-xl"
                disabled={sending}
                rows={1}
              />
              <Button
                onClick={handleSend}
                disabled={!inputText.trim() || sending}
                size="icon"
                className="h-11 w-11 sm:h-[52px] sm:w-[52px] shrink-0 rounded-xl shadow-[0_0_15px_rgba(124,58,237,0.3)]"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>

            <AIDisclaimer variant="compact" className="mt-1 px-1" />

            <div className="mt-1.5 flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground">
              <span>
                {supportsImages ? (
                  <span className="flex items-center gap-1 text-emerald-400/70">
                    <Image className="w-3 h-3" />
                    <span className="hidden sm:inline">Изображения поддерживаются ·</span>
                    <span className="sm:hidden">Фото ·</span>
                    Enter — отправить
                  </span>
                ) : (
                  <span className="hidden sm:block">Только текст · Enter — отправить</span>
                )}
              </span>
              {!isUnlimited && (
                <span>Осталось: <span className={`font-medium ${remaining === 0 ? 'text-red-400' : remaining && remaining <= 3 ? 'text-yellow-400' : 'text-foreground'}`}>{remaining}</span></span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
