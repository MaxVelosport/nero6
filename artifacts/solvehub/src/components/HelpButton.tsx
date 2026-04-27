import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  HelpCircle, X, Camera, Upload, ClipboardPaste, MessageSquare,
  GraduationCap, ClipboardList, FileText, ShieldCheck, Wallet,
  ListTodo, User, Sparkles, ArrowRight, Lightbulb, BookOpen,
  Zap, ImagePlus, BarChart3, LayoutDashboard, Coins, AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

type Step = { icon: any; title: string; text: string };
type Tip = { icon: any; text: string };
type Cta = { href: string; label: string; primary?: boolean };

interface HelpEntry {
  icon: any;
  title: string;
  intro: string;
  cost?: string;
  steps: Step[];
  tips?: Tip[];
  warnings?: string[];
  ctas?: Cta[];
}

const HELP: { match: (path: string) => boolean; entry: HelpEntry }[] = [
  {
    match: (p) => p === "/dashboard" || p === "/",
    entry: {
      icon: LayoutDashboard,
      title: "Главный экран",
      intro:
        "Это ваш кабинет. Слева — все инструменты, в центре — большая фиолетовая кнопка для самого популярного сценария: фото задания → решение.",
      steps: [
        { icon: Camera, title: "Сфотографируйте задание", text: "Самый быстрый способ. ИИ распознаёт текст с фото и сразу решает." },
        { icon: MessageSquare, title: "Или откройте чат с ИИ", text: "Подходит, если задач много или нужно что-то объяснить — задавайте вопросы как в обычном мессенджере." },
        { icon: GraduationCap, title: "Большие работы — отдельный мастер", text: "Курсовая, диплом, реферат, билеты — пошаговые мастера сами всё сделают." },
      ],
      tips: [
        { icon: Wallet, text: "На балансе у вас уже есть бонусные деньги — попробуйте бесплатно." },
        { icon: Sparkles, text: "Если потерялись — нажмите эту «?» на любой странице, она объяснит, что делать." },
      ],
      ctas: [
        { href: "/tasks/new", label: "Решить первую задачу", primary: true },
        { href: "/hints", label: "Готовые шаблоны запросов" },
      ],
    },
  },
  {
    match: (p) => p === "/tasks/new",
    entry: {
      icon: Sparkles,
      title: "Новая задача",
      intro:
        "Здесь ИИ решает любое задание: математика, физика, программирование, гуманитарные предметы. Можно фотографией, файлом или просто текстом.",
      cost: "От 5 ₽ за задачу. Точная цена показывается на втором шаге.",
      steps: [
        { icon: Camera, title: "Шаг 1: дайте условие", text: "Сфотографируйте, прикрепите PDF/Word или вставьте текст. Можно несколько фото подряд — это будут отдельные задачи." },
        { icon: CheckCircle2, title: "Шаг 2: проверьте, что распознал ИИ", text: "Если на фото — увидите распознанный текст, можно отредактировать перед запуском." },
        { icon: Zap, title: "Шаг 3: выберите режим", text: "Быстро — для простых задач. Стандарт — основной выбор. Премиум — если задача сложная или важна точность." },
      ],
      tips: [
        { icon: Lightbulb, text: "В описании укажите курс/класс и формат ответа («с проверкой», «в LaTeX») — ИИ ответит точнее." },
        { icon: Coins, text: "Сначала всегда показывается цена — деньги списываются только после подтверждения." },
      ],
      warnings: [
        "Фото должно быть чётким и без бликов. Тёмные размытые фото распознаются хуже.",
      ],
      ctas: [
        { href: "/hints", label: "Шаблоны запросов по предметам", primary: true },
      ],
    },
  },
  {
    match: (p) => p.startsWith("/tasks/") && p !== "/tasks/new" && p !== "/tasks",
    entry: {
      icon: FileText,
      title: "Решение задачи",
      intro:
        "Готовое решение от ИИ. Можно скопировать, скачать в PDF или поделиться ссылкой с одногруппниками.",
      steps: [
        { icon: ClipboardPaste, title: "Скопируйте", text: "Кнопка «Копировать» рядом с решением." },
        { icon: ShieldCheck, title: "Проверьте на уникальность", text: "Если планируете сдавать — прогоните через антиплагиат." },
        { icon: AlertTriangle, title: "Что-то не так?", text: "Нажмите «Сообщить об ошибке» — деньги вернём, если ИИ действительно ошибся." },
      ],
      tips: [
        { icon: Sparkles, text: "Формулы рендерятся как LaTeX — копируются с правильным форматированием." },
      ],
    },
  },
  {
    match: (p) => p === "/tasks",
    entry: {
      icon: ListTodo,
      title: "Мои задачи",
      intro: "История всех ваших решённых задач. Любую можно открыть, скопировать заново или поделиться ссылкой.",
      steps: [
        { icon: Sparkles, title: "Поиск и фильтры", text: "Сверху можно отфильтровать по статусу и поискать по названию." },
        { icon: ArrowRight, title: "Клик по задаче", text: "Откроет полное решение — ничего не теряется." },
      ],
    },
  },
  {
    match: (p) => p.startsWith("/sessions/new"),
    entry: {
      icon: MessageSquare,
      title: "Новый чат с ИИ",
      intro:
        "Купите пакет вопросов — задавайте сколько хотите. Идеально для онлайн-тестов, проверки ДЗ или серии похожих задач.",
      cost: "От 49 ₽ за 5 вопросов до безлимита на 3 часа.",
      steps: [
        { icon: ClipboardList, title: "Выберите пакет", text: "Чем больше пакет — тем выгоднее цена за вопрос." },
        { icon: MessageSquare, title: "Задавайте вопросы", text: "Как в обычном мессенджере — текст, фото, файлы." },
      ],
      tips: [
        { icon: Lightbulb, text: "Безлимит на 3 часа удобен для онлайн-тестирования: купили — и не считаете каждый вопрос." },
      ],
    },
  },
  {
    match: (p) => p === "/sessions" || p.startsWith("/sessions/"),
    entry: {
      icon: MessageSquare,
      title: "Чат с ИИ",
      intro: "Активный диалог. Прикрепляйте фото, файлы, задавайте уточняющие вопросы.",
      steps: [
        { icon: Camera, title: "Прикрепить файл/фото", text: "Скрепка слева от поля ввода. Поддерживаются PNG, JPG, PDF, DOCX." },
        { icon: Sparkles, title: "Запросы по очереди", text: "Каждый вопрос засчитывается отдельно — следите за счётчиком сверху." },
      ],
      tips: [
        { icon: Lightbulb, text: "Можно цитировать предыдущий ответ ИИ для уточнения — он помнит контекст диалога." },
      ],
    },
  },
  {
    match: (p) => p.startsWith("/coursework"),
    entry: {
      icon: GraduationCap,
      title: "Научные работы",
      intro:
        "Курсовые, дипломы, рефераты, эссе. Мастер из 4 шагов: тема → план → утверждение → готовый Word.",
      cost: "От 199 ₽ за реферат, от 999 ₽ за курсовую.",
      steps: [
        { icon: FileText, title: "1. Тема и параметры", text: "Укажите название, объём, тип работы, требования." },
        { icon: ListTodo, title: "2. План", text: "ИИ предложит структуру — её можно отредактировать." },
        { icon: CheckCircle2, title: "3. Утверждение", text: "Подтвердите — деньги спишутся только после этого." },
        { icon: Sparkles, title: "4. Генерация", text: "ИИ напишет каждую главу. Можно скачать в Word с титульным листом по ГОСТ." },
      ],
      tips: [
        { icon: Lightbulb, text: "Чем подробнее опишете требования (методичка, кафедра, оформление) — тем меньше доработок понадобится." },
        { icon: ShieldCheck, text: "Готовую работу прогоните через антиплагиат — там же можно её уникализировать." },
      ],
    },
  },
  {
    match: (p) => p.startsWith("/tickets"),
    entry: {
      icon: ClipboardList,
      title: "Билеты к экзамену",
      intro:
        "Загрузите учебник (PDF/Word) и список билетов — ИИ напишет ответы строго по материалу. Есть режим карточек для зубрёжки.",
      cost: "От ~10 ₽ за билет.",
      steps: [
        { icon: Upload, title: "Загрузите учебник", text: "PDF или Word с теорией. Можно несколько файлов." },
        { icon: ClipboardList, title: "Вставьте список билетов", text: "Каждый билет — с новой строки или через нумерацию." },
        { icon: Sparkles, title: "Получите ответы", text: "ИИ выдаст структурированный ответ на каждый билет с отсылками к учебнику." },
      ],
      tips: [
        { icon: Lightbulb, text: "Включите «Режим карточек» — вопросы и ответы превратятся в обучающие карточки для повторения." },
      ],
    },
  },
  {
    match: (p) => p.startsWith("/learn/summary"),
    entry: {
      icon: BookOpen,
      title: "Конспект темы",
      intro:
        "Превращает длинный текст (статью, главу, лекцию) в структурированный конспект с ключевыми терминами и выводами.",
      cost: "Базовый конспект — бесплатно. Расширенный — несколько рублей.",
      steps: [
        { icon: Upload, title: "Загрузите или вставьте текст", text: "Поддерживаются PDF, Word, обычный текст или ссылка." },
        { icon: Sparkles, title: "Получите конспект", text: "С заголовками, ключевыми терминами и краткими выводами по каждому разделу." },
      ],
      tips: [
        { icon: Lightbulb, text: "Перед экзаменом — лучший способ за 5 минут вспомнить большую тему." },
      ],
    },
  },
  {
    match: (p) => p.startsWith("/uniqueness"),
    entry: {
      icon: ShieldCheck,
      title: "Антиплагиат и уникализация",
      intro:
        "Покажет, какие куски текста выглядят как написанные ИИ или скопированные, и поможет переписать их «человечнее».",
      cost: "Проверка — от 5 ₽. Уникализация — отдельно по объёму.",
      steps: [
        { icon: ClipboardPaste, title: "Вставьте текст", text: "Свой реферат, курсовую или эссе." },
        { icon: ShieldCheck, title: "Получите процент уникальности", text: "Подсветка по фрагментам: красный — нужно переписать, жёлтый — переформулировать." },
        { icon: Sparkles, title: "Уникализируйте одной кнопкой", text: "ИИ перепишет проблемные места, сохранив смысл." },
      ],
      tips: [
        { icon: Lightbulb, text: "Не гонитесь за 100% — научный текст обычно цитирует источники, идеально 75–85%." },
      ],
    },
  },
  {
    match: (p) => p.startsWith("/illustrations"),
    entry: {
      icon: ImagePlus,
      title: "Иллюстрации для работ",
      intro: "Создаёт схемы, графики и рисунки в стиле ГОСТ, которые можно вставить в курсовую или диплом.",
      steps: [
        { icon: FileText, title: "Опишите, что нужно", text: "Например: «блок-схема алгоритма быстрой сортировки»." },
        { icon: ImagePlus, title: "Скачайте в нужном формате", text: "PNG, SVG — готово для вставки в Word." },
      ],
    },
  },
  {
    match: (p) => p.startsWith("/subscriptions"),
    entry: {
      icon: Wallet,
      title: "Пополнение баланса",
      intro: "Никаких подписок — оплачиваете только то, что используете. Чем больше пакет, тем больше бонус (до +100%).",
      steps: [
        { icon: Coins, title: "Выберите пакет", text: "Бонус растёт с суммой — большие пакеты выгоднее." },
        { icon: Wallet, title: "Оплатите картой", text: "Деньги поступают на баланс мгновенно." },
      ],
      tips: [
        { icon: Lightbulb, text: "Если только присматриваетесь — начните с минимального пакета, его обычно хватает на 5–10 задач." },
      ],
    },
  },
  {
    match: (p) => p.startsWith("/profile"),
    entry: {
      icon: User,
      title: "Профиль",
      intro: "Ваш аккаунт, баланс, история операций и настройки уведомлений.",
      steps: [
        { icon: Wallet, title: "Баланс и операции", text: "Видны все списания и пополнения." },
        { icon: User, title: "Контактные данные", text: "Email и пароль для входа можно менять." },
      ],
    },
  },
  {
    match: (p) => p.startsWith("/statistics"),
    entry: {
      icon: BarChart3,
      title: "Статистика",
      intro: "Графики использования, любимые предметы, средняя оценка решений.",
      tips: [
        { icon: Lightbulb, text: "Полезно перед сессией — видно, по каким предметам у вас больше всего работы." },
      ],
      steps: [],
    },
  },
  {
    match: (p) => p.startsWith("/hints"),
    entry: {
      icon: Lightbulb,
      title: "Шаблоны запросов",
      intro:
        "Готовые формулировки запросов для разных предметов. Скопировал → вставил в новую задачу или чат → подставил свои данные.",
      steps: [
        { icon: ClipboardPaste, title: "Найдите подходящий шаблон", text: "Категории сверху, поиск — справа." },
        { icon: Sparkles, title: "Скопируйте и адаптируйте", text: "Замените пример на своё условие." },
      ],
    },
  },
];

const FALLBACK: HelpEntry = {
  icon: HelpCircle,
  title: "Помощь",
  intro:
    "Для этого раздела ещё нет встроенной подсказки. Откройте «Шаблоны запросов» — там собраны готовые формулировки для всех предметов.",
  steps: [],
  ctas: [
    { href: "/hints", label: "Открыть шаблоны", primary: true },
    { href: "/dashboard", label: "На главную" },
  ],
};

export function HelpButton() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();

  const entry = useMemo<HelpEntry>(() => {
    const match = HELP.find((h) => h.match(location));
    return match?.entry ?? FALLBACK;
  }, [location]);

  const Icon = entry.icon;

  return (
    <>
      {/* Floating action button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Подсказка по этой странице"
        title="Не знаете что делать? Нажмите!"
        className="
          fixed z-40 right-4 bottom-[5.25rem] md:bottom-6
          w-12 h-12 rounded-full
          bg-gradient-to-br from-violet-600 to-fuchsia-600
          text-white shadow-lg shadow-violet-500/40
          flex items-center justify-center
          hover:scale-105 active:scale-95 transition-transform
          ring-2 ring-white/15
        "
      >
        <HelpCircle className="w-6 h-6" />
        <span className="sr-only">Подсказка</span>
        {/* Soft pulse ring */}
        <span className="absolute inset-0 rounded-full bg-violet-500/30 animate-ping pointer-events-none" style={{ animationDuration: "2.4s" }} />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 overflow-y-auto">
          {/* Header */}
          <SheetHeader className="p-5 pb-3 border-b border-border/60 bg-gradient-to-br from-violet-500/10 via-fuchsia-500/5 to-transparent">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/30">
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500 mb-0.5">Помощь</p>
                <SheetTitle className="text-lg leading-tight">{entry.title}</SheetTitle>
              </div>
            </div>
            <SheetDescription className="text-sm text-muted-foreground leading-relaxed mt-3">{entry.intro}</SheetDescription>
            {entry.cost && (
              <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-1 self-start">
                <Coins className="w-3.5 h-3.5" />
                {entry.cost}
              </div>
            )}
          </SheetHeader>

          {/* Steps */}
          {entry.steps.length > 0 && (
            <div className="px-5 py-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Как пользоваться</p>
              <ol className="space-y-3">
                {entry.steps.map((s, i) => {
                  const SIcon = s.icon;
                  return (
                    <li key={i} className="flex gap-3">
                      <div className="relative shrink-0">
                        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                          <SIcon className="w-4 h-4 text-violet-500" />
                        </div>
                        <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</div>
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className="text-sm font-semibold text-foreground leading-snug">{s.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.text}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {/* Tips */}
          {entry.tips && entry.tips.length > 0 && (
            <div className="px-5 py-4 border-t border-border/60 bg-amber-500/5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5" /> Лайфхаки
              </p>
              <ul className="space-y-2">
                {entry.tips.map((t, i) => {
                  const TIcon = t.icon;
                  return (
                    <li key={i} className="flex gap-2.5 text-xs text-foreground/90 leading-relaxed">
                      <TIcon className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span>{t.text}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {entry.warnings && entry.warnings.length > 0 && (
            <div className="px-5 py-3 border-t border-border/60 bg-rose-500/5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Важно
              </p>
              <ul className="space-y-1.5">
                {entry.warnings.map((w, i) => (
                  <li key={i} className="text-xs text-foreground/90 leading-relaxed">{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* CTAs */}
          <div className="p-5 border-t border-border/60 space-y-2">
            {entry.ctas?.map((c, i) => (
              <Link key={i} href={c.href} onClick={() => setOpen(false)}>
                <Button
                  className={`w-full justify-between gap-2 ${c.primary ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white border-0" : ""}`}
                  variant={c.primary ? "default" : "outline"}
                  size="sm"
                >
                  {c.label}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            ))}
            <Link href="/hints" onClick={() => setOpen(false)}>
              <Button variant="ghost" size="sm" className="w-full justify-between gap-2 text-muted-foreground">
                Все шаблоны и инструкции
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setOpen(false)}>
              <X className="w-4 h-4 mr-1.5" /> Закрыть
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
