import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { getPackages, getModels, createSession, SessionPackage, AIModel } from "@/lib/sessions-api";
import { useGetMe } from "@workspace/api-client-react";
import { useUpdateBalance } from "@/hooks/useUpdateBalance";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AIDisclaimer } from "@/components/ai-disclaimer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  MessageSquare, Zap, CheckCircle2, BookOpen, ClipboardList,
  GraduationCap, Infinity, ArrowLeft, Loader2, Star, Wallet,
  Calculator, Code2, FlaskConical, BarChart2, Scale, Globe, Atom,
  Image, FileText, Brain, Sparkles, Shield, Library,
  X, ChevronDown, ChevronUp, Clock, AlertTriangle,
  Microscope, TrendingUp, Music, Briefcase,
  Users, Activity, Database, Sigma, Building2, HeartPulse,
  Lightbulb, PenLine, Landmark, Cpu, Layers, Languages
} from "lucide-react";

const PURPOSES = [
  { value: "online_test", label: "Онлайн-тест / Рубежный контроль", icon: ClipboardList },
  { value: "homework", label: "Домашнее задание / Задачник", icon: BookOpen },
  { value: "exam_prep", label: "Подготовка к экзамену / Зачёту", icon: GraduationCap },
  { value: "practice", label: "Практика / Тренировка", icon: Zap },
  { value: "general", label: "Общие вопросы по предмету", icon: MessageSquare },
];

const SUBJECTS_QUICK = [
  // Точные науки
  { label: "Математика",        icon: Calculator },
  { label: "Матанализ",         icon: Sigma },
  { label: "Линейная алгебра",  icon: Layers },
  { label: "Теорвер/Статист.",  icon: TrendingUp },
  { label: "Физика",            icon: Atom },
  { label: "Химия",             icon: FlaskConical },
  { label: "Биология",          icon: Microscope },
  { label: "Информатика",       icon: Cpu },
  // Программирование
  { label: "Python",            icon: Code2 },
  { label: "Java",              icon: Code2 },
  { label: "C++",               icon: Code2 },
  { label: "SQL / Базы данных", icon: Database },
  // Гуманитарные
  { label: "История",           icon: BookOpen },
  { label: "Философия",         icon: Lightbulb },
  { label: "Психология",        icon: Brain },
  { label: "Социология",        icon: Users },
  { label: "Педагогика",        icon: GraduationCap },
  { label: "Литература",        icon: PenLine },
  { label: "Русский язык",      icon: Languages },
  // Языки
  { label: "Английский",        icon: Globe },
  { label: "Немецкий",          icon: Globe },
  { label: "Французский",       icon: Globe },
  { label: "Китайский",         icon: Globe },
  // Социально-экономические
  { label: "Экономика",         icon: BarChart2 },
  { label: "Финансы",           icon: Briefcase },
  { label: "Менеджмент",        icon: Briefcase },
  { label: "Маркетинг",         icon: TrendingUp },
  { label: "Бухучёт",           icon: Landmark },
  { label: "Право",             icon: Scale },
  // Прикладные
  { label: "ЕГЭ (подготовка)",  icon: GraduationCap },
  { label: "Медицина",          icon: HeartPulse },
  { label: "Архитектура",       icon: Building2 },
  { label: "Физкультура",       icon: Activity },
  { label: "Музыка",            icon: Music },
];

const MODEL_SURCHARGE: Record<string, number> = {
  "gpt-4o": 30,
  "claude-sonnet": 20,
  "grok": 10,
  "deepseek-v3": 0,
  "gemini-2-flash": 0,
};

const MODEL_AVG_SECONDS: Record<string, number> = {
  "gemini-2-flash": 3,
  "gpt-4o": 6,
  "claude-sonnet": 8,
  "deepseek-v3": 25,
  "grok": 8,
};

const PACKAGE_ICONS: Record<string, any> = {
  hour1: Zap,
  hour3: BookOpen,
  hour6: CheckCircle2,
  day1: ClipboardList,
  day3: GraduationCap,
  week1: Infinity,
};

const PACKAGE_COLORS: Record<string, string> = {
  hour1: "text-blue-400",
  hour3: "text-green-400",
  hour6: "text-violet-400",
  day1: "text-orange-400",
  day3: "text-rose-400",
  week1: "text-cyan-400",
};

function formatDurationLabel(hours: number | null): string {
  if (!hours) return "∞";
  if (hours < 24) return `${hours} ${hours === 1 ? "час" : hours < 5 ? "часа" : "часов"}`;
  if (hours === 24) return "1 день";
  if (hours < 24 * 7) return `${hours / 24} ${(hours / 24) < 5 ? "дня" : "дней"}`;
  return "1 неделя";
}

const MODEL_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  "gemini-2-flash": { bg: "bg-blue-500/10", border: "border-blue-500/40", text: "text-blue-400", glow: "shadow-blue-500/20" },
  "gpt-4o": { bg: "bg-emerald-500/10", border: "border-emerald-500/40", text: "text-emerald-400", glow: "shadow-emerald-500/20" },
  "claude-sonnet": { bg: "bg-orange-500/10", border: "border-orange-500/40", text: "text-orange-400", glow: "shadow-orange-500/20" },
  "deepseek-v3": { bg: "bg-violet-500/10", border: "border-violet-500/40", text: "text-violet-400", glow: "shadow-violet-500/20" },
};

const MODEL_PROVIDER_ICONS: Record<string, string> = {
  "Google": "🇬",
  "OpenAI": "⚡",
  "Anthropic": "🔶",
  "DeepSeek": "🧬",
};

const formSchema = z.object({
  title: z.string().min(3, "Минимум 3 символа"),
  subject: z.string().min(2, "Укажите предмет"),
  purpose: z.string().min(1, "Укажите цель"),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewSessionPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user } = useGetMe();
  const updateBalance = useUpdateBalance();

  const [packages, setPackages] = useState<Record<string, SessionPackage>>({});
  const [models, setModels] = useState<Record<string, AIModel>>({});
  const [selectedPackage, setSelectedPackage] = useState<string>("hour6");
  const [selectedModel, setSelectedModel] = useState<string>("gemini-2-flash");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [kbText, setKbText] = useState("");
  const [kbExpanded, setKbExpanded] = useState(false);

  useEffect(() => {
    getPackages().then(setPackages).catch(console.error);
    getModels().then(setModels).catch(console.error);
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", subject: "", purpose: "online_test" },
  });

  const subjectValue = form.watch("subject");
  const purposeValue = form.watch("purpose");

  const KB_MAX = 2000;

  const onStep1Submit = () => setStep(2);

  const onConfirm = async () => {
    const values = form.getValues();
    const pkg = packages[selectedPackage];
    if (!pkg) return;

    if (user && !(user as any).subscriptionActive && user.balance < pkg.price) {
      toast({
        variant: "destructive",
        title: "Недостаточно средств",
        description: `Нужно ${pkg.price} ₽, у вас ${user.balance} ₽`,
        action: <Link href="/profile"><Button variant="outline" size="sm">Пополнить</Button></Link>
      });
      return;
    }

    setLoading(true);
    try {
      const session = await createSession({
        title: values.title,
        subject: values.subject,
        purpose: values.purpose,
        packageType: selectedPackage,
        modelId: selectedModel,
      });
      if (kbText.trim()) {
        localStorage.setItem(`kb_session_${session.id}`, JSON.stringify({ content: kbText.trim(), addedAt: Date.now() }));
      }
      toast({ title: "Сессия создана!", description: kbText.trim() ? "Контекст подключён — ИИ будет его учитывать." : "Начинайте задавать вопросы." });
      updateBalance();
      setLocation(`/sessions/${session.id}`);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: err.message || "Не удалось создать сессию",
      });
    } finally {
      setLoading(false);
    }
  };

  const pkgEntries = Object.entries(packages);
  const modelEntries = Object.entries(models);
  const chosenModel = models[selectedModel];
  const chosenPkg = packages[selectedPackage];

  const STEPS = [
    { n: 1, label: "Настройка" },
    { n: 2, label: "Модель ИИ" },
    { n: 3, label: "Пакет" },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Link href="/sessions">
          <Button variant="ghost" size="icon" className="-ml-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Новая сессия</h1>
          <p className="text-slate-400 mt-0.5">Живой чат с ИИ — задавайте вопросы в любом порядке, столько угодно.</p>
        </div>
      </div>

      {/* What is a session */}
      <div className="flex flex-wrap gap-4 p-4 rounded-xl bg-blue-500/5 border border-blue-500/15">
        {[
          { icon: "💬", title: "Диалог", desc: "Задавайте любые вопросы — ИИ отвечает как репетитор" },
          { icon: "⏱️", title: "По времени", desc: "Не по количеству вопросов, а по часам" },
          { icon: "📚", title: "Любая тема", desc: "Математика, программирование, языки и ещё 80+ предметов" },
        ].map(({ icon, title, desc }) => (
          <div key={title} className="flex items-start gap-2 text-xs min-w-[130px] flex-1">
            <span className="text-base">{icon}</span>
            <div>
              <p className="font-semibold text-white">{title}</p>
              <p className="text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <AIDisclaimer variant="warning" />

      {/* Stepper */}
      <div className="-mx-4 px-4 overflow-x-auto sm:mx-0 sm:px-0 sm:overflow-visible mb-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-max sm:min-w-0">
          {STEPS.map(({ n, label }, idx) => (
            <div key={n} className="flex items-center gap-2 shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors shrink-0 ${step >= n ? 'border-primary bg-primary text-white' : 'border-white/20 text-muted-foreground'}`}>
                {step > n ? <CheckCircle2 className="w-4 h-4" /> : n}
              </div>
              <span className={`text-xs sm:text-sm whitespace-nowrap ${step >= n ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{label}</span>
              {idx < STEPS.length - 1 && <div className={`h-0.5 w-6 sm:w-12 rounded shrink-0 ${step > n ? 'bg-primary' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Session info */}
      {step === 1 && (
        <Card className="bg-card/40 border-white/10">
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onStep1Submit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Название сессии</FormLabel>
                      <FormControl>
                        <Input placeholder="Например: Подготовка к экзамену по физике, Помощь с Python, ДЗ по истории..." {...field} className="bg-background/50" />
                      </FormControl>
                      <p className="text-xs text-slate-500 mt-1">Нужно только вам — чтобы найти сессию в истории</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Предмет / Дисциплина</FormLabel>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {SUBJECTS_QUICK.map(({ label, icon: Icon }) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => field.onChange(label)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all ${subjectValue === label ? 'border-primary bg-primary/10 text-primary' : 'border-white/10 bg-white/5 text-muted-foreground hover:border-white/20 hover:text-foreground'}`}
                          >
                            <Icon className="w-3.5 h-3.5" />{label}
                          </button>
                        ))}
                      </div>
                      <FormControl>
                        <Input placeholder="Или введите свой предмет..." {...field} className="bg-background/50" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="purpose"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Цель сессии</FormLabel>
                      <p className="text-xs text-slate-500 -mt-1 mb-2">ИИ подстраивает стиль ответов под вашу цель</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {PURPOSES.map(({ value, label, icon: Icon }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => field.onChange(value)}
                            className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${field.value === value ? 'border-primary bg-primary/10 text-primary' : 'border-white/10 bg-white/5 text-muted-foreground hover:border-white/20 hover:text-foreground'}`}
                          >
                            <Icon className="w-4 h-4 shrink-0" />
                            <span className="text-sm font-medium">{label}</span>
                          </button>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Session Context */}
                <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setKbExpanded(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                        <Library className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-white">Контекст сессии</span>
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/25">Необязательно</span>
                      </div>
                      {kbText.trim() && (
                        <div className="flex items-center gap-1.5 ml-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-xs text-emerald-300 font-medium">{kbText.trim().length} симв.</span>
                        </div>
                      )}
                    </div>
                    {kbExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>

                  {kbExpanded && (
                    <div className="px-4 pb-4 border-t border-blue-500/15">
                      <p className="text-xs text-slate-400 mt-3 mb-2 leading-relaxed">
                        Вставьте текст, который ИИ должен учитывать в этой сессии — ИИ получит его вместе с каждым вашим вопросом.
                      </p>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {["Условие задачи", "Формулы из темы", "Требования препода", "Билеты к экзамену", "Прошлогодние тесты"].map(ex => (
                          <span key={ex} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/25 text-blue-300">{ex}</span>
                        ))}
                      </div>
                      <div className="relative">
                        <textarea
                          value={kbText}
                          onChange={e => setKbText(e.target.value.slice(0, KB_MAX))}
                          placeholder="Пример: «Тема — интегралы. Преподаватель требует оформлять решение через метод подстановки. Вот формулы из лекции: ∫x² dx = x³/3 + C...»"
                          className="w-full h-32 px-3 py-2.5 rounded-xl bg-background/60 border border-blue-500/30 text-sm text-white placeholder:text-slate-500 resize-none focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 leading-relaxed"
                        />
                        <div className={`absolute bottom-2 right-3 text-[10px] ${kbText.length > KB_MAX * 0.9 ? 'text-orange-400' : 'text-slate-600'}`}>
                          {kbText.length}/{KB_MAX}
                        </div>
                      </div>
                      {kbText.trim() && (
                        <div className="mt-2 flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <p className="text-xs text-emerald-300">ИИ получит этот текст как системный контекст в каждом сообщении</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2 border-t border-white/5">
                  <Button type="submit" size="lg">
                    Выбрать модель ИИ →
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Model selection */}
      {step === 2 && (
        <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
          <Button variant="ghost" onClick={() => setStep(1)} className="-ml-2">
            <ArrowLeft className="w-4 h-4 mr-2" /> Назад
          </Button>

          {/* Summary strip */}
          <Card className="bg-card/40 border-white/10">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="text-muted-foreground">Тема:</span>
                <span className="font-medium">{form.getValues("title")}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">Предмет:</span>
                <span className="font-medium">{form.getValues("subject")}</span>
              </div>
            </CardContent>
          </Card>

          <div>
            <h3 className="text-lg font-semibold mb-1">Выберите модель ИИ</h3>
            <p className="text-sm text-muted-foreground mb-4">Модель определяет качество ответов, скорость и возможность прикреплять изображения.</p>
          </div>

          {modelEntries.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <Card key={i} className="animate-pulse border-white/10 h-48 bg-white/5" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {modelEntries.map(([key, model]) => {
                const isSelected = selectedModel === key;
                const colors = MODEL_COLORS[key] || MODEL_COLORS["gemini-2-flash"];

                return (
                  <Card
                    key={key}
                    className={`cursor-pointer transition-all relative overflow-hidden ${isSelected
                      ? `${colors.border} ${colors.bg} ring-1 ring-current shadow-lg ${colors.glow}`
                      : 'border-white/10 bg-card/40 hover:border-white/20 hover:bg-white/5'
                    }`}
                    style={{ borderColor: isSelected ? undefined : undefined }}
                    onClick={() => setSelectedModel(key)}
                  >
                    {model.recommended && (
                      <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg flex items-center gap-1">
                        <Star className="w-2.5 h-2.5" /> Рекомендуем
                      </div>
                    )}
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-9 h-9 rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center text-lg`}>
                          {MODEL_PROVIDER_ICONS[model.provider] || "🤖"}
                        </div>
                        <div>
                          <CardTitle className="text-base leading-tight">{model.name}</CardTitle>
                          <p className="text-xs text-muted-foreground">{model.provider}</p>
                        </div>
                        <Badge className={`ml-auto text-[10px] ${colors.bg} ${colors.text} border ${colors.border}`}>
                          {model.badge}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs leading-relaxed mt-2">{model.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-2">
                      {/* Capabilities */}
                      <div className="flex gap-2">
                        {model.supportsImages && (
                          <div className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-400/10 rounded-full px-2 py-0.5">
                            <Image className="w-3 h-3" /> Изображения
                          </div>
                        )}
                        {model.supportsFiles && (
                          <div className="flex items-center gap-1 text-xs text-sky-400 bg-sky-400/10 rounded-full px-2 py-0.5">
                            <FileText className="w-3 h-3" /> Файлы
                          </div>
                        )}
                        {!model.supportsImages && !model.supportsFiles && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground bg-white/5 rounded-full px-2 py-0.5">
                            <Shield className="w-3 h-3" /> Только текст
                          </div>
                        )}
                      </div>

                      {/* Strengths */}
                      <div className="flex flex-wrap gap-1">
                        {model.strengths.map((s, i) => (
                          <Badge key={i} variant="secondary" className="text-xs bg-white/5 border-white/10 text-muted-foreground">{s}</Badge>
                        ))}
                      </div>

                      {/* Speed warning for DeepSeek */}
                      {(model as any).slowWarning && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-2.5 py-1.5">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span>Медленная (~25 сек/ответ) — нет стриминга</span>
                        </div>
                      )}

                      {/* Context & speed & price */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-white/5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          ~{MODEL_AVG_SECONDS[key] ?? 5}с/ответ
                        </span>
                        {MODEL_SURCHARGE[key] > 0 ? (
                          <span className="text-amber-400">+{MODEL_SURCHARGE[key]}₽ к пакету</span>
                        ) : MODEL_SURCHARGE[key] === 0 && key !== "deepseek-v3" ? (
                          <span className="text-emerald-400">Базовая цена</span>
                        ) : (
                          <span className="text-emerald-400">Самая низкая цена</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="flex justify-between items-center pt-2 border-t border-white/5">
            {chosenModel && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="w-4 h-4 text-primary" />
                Выбрано: <span className="font-medium text-foreground">{chosenModel.name}</span>
                {chosenModel.supportsImages && <span className="text-xs text-emerald-400">· с изображениями</span>}
              </div>
            )}
            <Button
              size="lg"
              onClick={() => setStep(3)}
              disabled={modelEntries.length === 0}
              className="ml-auto"
            >
              Выбрать пакет →
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Package selection */}
      {step === 3 && (
        <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
          <Button variant="ghost" onClick={() => setStep(2)} className="-ml-2">
            <ArrowLeft className="w-4 h-4 mr-2" /> Назад
          </Button>

          {/* Summary */}
          <Card className="bg-card/40 border-white/10">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="text-muted-foreground">Тема:</span>
                <span className="font-medium">{form.getValues("title")}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">Предмет:</span>
                <span className="font-medium">{form.getValues("subject")}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">Цель:</span>
                <span className="font-medium">{PURPOSES.find(p => p.value === purposeValue)?.label}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">Модель:</span>
                <span className="font-medium text-primary">{chosenModel?.name || selectedModel}</span>
                {kbText.trim() && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="flex items-center gap-1 text-blue-400">
                      <Library className="w-3 h-3" />
                      <span className="font-medium">Контекст {kbText.trim().length} симв.</span>
                    </span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <div>
            <h3 className="text-lg font-semibold">Выберите временной пакет</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Все пакеты — безлимитное количество вопросов. Разница только во времени доступа.</p>
          </div>

          {pkgEntries.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Card key={i} className="animate-pulse border-white/10 h-48 bg-white/5" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {pkgEntries.map(([key, pkg]) => {
                const isSelected = selectedPackage === key;
                const Icon = PACKAGE_ICONS[key] || Zap;
                const colorClass = PACKAGE_COLORS[key] || "text-primary";

                return (
                  <Card
                    key={key}
                    className={`cursor-pointer transition-all relative overflow-hidden ${isSelected ? 'border-primary ring-1 ring-primary bg-primary/5' : 'border-white/10 bg-card/40 hover:border-white/20 hover:bg-white/5'}`}
                    onClick={() => setSelectedPackage(key)}
                  >
                    {pkg.recommended && (
                      <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 rounded-bl-lg flex items-center gap-1">
                        <Star className="w-2.5 h-2.5" /> Популярный
                      </div>
                    )}
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-5 h-5 ${colorClass}`} />
                        <CardTitle className="text-base">{pkg.name}</CardTitle>
                      </div>
                      <CardDescription className="text-xs leading-relaxed">{pkg.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-2xl font-bold">{pkg.price + (MODEL_SURCHARGE[selectedModel] ?? 0)} ₽</span>
                        <span className={`text-sm font-semibold ${colorClass}`}>
                          · {formatDurationLabel(pkg.durationHours)}
                        </span>
                      </div>
                      {(MODEL_SURCHARGE[selectedModel] ?? 0) > 0 && (
                        <p className="text-[10px] text-muted-foreground mb-0.5">
                          {pkg.price}₽ пакет + {MODEL_SURCHARGE[selectedModel]}₽ ({chosenModel?.name})
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mb-2">∞ вопросов без ограничений</p>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {pkg.features.slice(1).map((f, i) => (
                          <Badge key={i} variant="secondary" className="text-xs bg-white/5 border-white/10 text-muted-foreground">{f}</Badge>
                        ))}
                      </div>
                      <p className="text-xs text-primary/80 italic">{pkg.bestFor}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Confirm */}
          {pkgEntries.length > 0 && chosenPkg && (() => {
            const surcharge = MODEL_SURCHARGE[selectedModel] ?? 0;
            const totalPrice = chosenPkg.price + surcharge;
            const afterBalance = user ? user.balance - totalPrice : null;
            return (
              <div className="flex items-center justify-between p-5 bg-card/60 border border-white/10 rounded-xl backdrop-blur-sm">
                <div>
                  <p className="text-sm text-muted-foreground">Итого к списанию</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold">{totalPrice} ₽</p>
                    <p className="text-sm text-primary font-medium">· {formatDurationLabel(chosenPkg.durationHours)} · ∞ вопросов</p>
                  </div>
                  {surcharge > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {chosenPkg.price}₽ пакет + {surcharge}₽ {chosenModel?.name}
                    </p>
                  )}
                  {user && (
                    <p className={`text-xs flex items-center gap-1 mt-0.5 ${afterBalance !== null && afterBalance < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                      <Wallet className="w-3 h-3" />
                      Баланс: {user.balance} ₽ {afterBalance !== null && `→ ${afterBalance} ₽`}
                    </p>
                  )}
                  {chosenModel && (
                    <p className="text-xs text-primary mt-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> {chosenModel.name}
                      {chosenModel.supportsImages && " · изображения ✓"}
                    </p>
                  )}
                </div>
                <Button
                  size="lg"
                  onClick={onConfirm}
                  disabled={loading || (user !== undefined && user !== null && afterBalance !== null && afterBalance < 0)}
                  className="px-8 shadow-[0_0_20px_rgba(124,58,237,0.3)]"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MessageSquare className="w-4 h-4 mr-2" />}
                  {loading ? "Создаём сессию..." : "Начать сессию"}
                </Button>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
