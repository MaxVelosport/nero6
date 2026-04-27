import { useState, useEffect } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import {
  Zap, Star, Crown, Sparkles, CheckCircle2, ArrowRight,
  Wallet, Shield, RefreshCw, Lock, FileText, RotateCcw,
  CreditCard, Info, AlertCircle, Infinity as InfinityIcon, Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/lib/theme";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const PLANS = [
  {
    key: "starter",
    icon: Zap,
    label: "Стартовый",
    color: "from-slate-500 to-slate-600",
    border: "border-slate-500/30 hover:border-slate-500/60",
    bg: "bg-slate-500/5",
    badgeBg: "bg-slate-500/15 text-slate-300",
    price: 199,
    credit: 320,
    bonus: 60,
    bonusPct: "+60%",
    desc: "Для первого знакомства с сервисом",
    vatText: "без НДС",
    serviceDesc: "Пополнение внутреннего баланса для доступа к ИИ-инструментам НейроЗачёт",
    features: [
      "320 ₽ на балансе (+60% бонус)",
      "≈ 45 задач в режиме «Быстрый»",
      "≈ 16 задач в режиме «Стандарт»",
      "Баланс не сгорает",
    ],
  },
  {
    key: "pro",
    icon: Star,
    label: "Профи",
    color: "from-violet-500 to-purple-600",
    border: "border-violet-500/40 hover:border-violet-500/70",
    bg: "bg-violet-500/8",
    badgeBg: "bg-violet-500/20 text-violet-300",
    price: 399,
    credit: 720,
    bonus: 80,
    bonusPct: "+80%",
    desc: "Для активного студента",
    vatText: "без НДС",
    serviceDesc: "Пополнение внутреннего баланса для доступа к ИИ-инструментам НейроЗачёт",
    features: [
      "720 ₽ на балансе (+80% бонус)",
      "≈ 100 задач в режиме «Быстрый»",
      "≈ 36 задач в режиме «Стандарт»",
      "Приоритетная обработка",
    ],
    popular: true,
  },
  {
    key: "premium",
    icon: Crown,
    label: "Премиум",
    color: "from-amber-500 to-orange-500",
    border: "border-amber-500/40 hover:border-amber-500/70",
    bg: "bg-amber-500/8",
    badgeBg: "bg-amber-500/20 text-amber-300",
    price: 699,
    credit: 1400,
    bonus: 100,
    bonusPct: "+100%",
    desc: "Максимум для сессии",
    vatText: "без НДС",
    serviceDesc: "Пополнение внутреннего баланса для доступа к ИИ-инструментам НейроЗачёт",
    features: [
      "1400 ₽ на балансе (+100% бонус)",
      "≈ 200 задач в режиме «Быстрый»",
      "Экзаменационные билеты включены",
      "Все режимы без ограничений",
    ],
  },
];

const PAYMENT_METHODS = [
  { name: "Visa / Mastercard / Мир", icon: "💳" },
  { name: "СБП", icon: "⚡" },
  { name: "ЮMoney", icon: "💰" },
  { name: "SberPay", icon: "🟩" },
];

export default function SubscriptionsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { data: user } = useGetMe({ query: { retry: false } });
  const [loading, setLoading] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const { isLight } = useTheme();

  // Polling статуса платежа после возврата из ЮKassa
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") !== "processing") return;
    const pendingId = localStorage.getItem("pendingPaymentId");
    if (!pendingId) {
      toast({ title: "Проверяем платёж", description: "Если баланс не обновится в течение минуты — напишите на support@neurozachet.ru." });
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    let attempts = 0;
    const maxAttempts = 12; // ~36 секунд
    let cancelled = false;
    const token = localStorage.getItem("authToken");
    toast({ title: "Проверяем оплату…", description: "Это займёт несколько секунд." });

    const tick = async () => {
      if (cancelled) return;
      attempts++;
      try {
        const r = await fetch(`${BASE_URL}/api/payments/status/${pendingId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await r.json().catch(() => ({}));
        if (data?.status === "succeeded" && data?.paid) {
          // Платёж успешен у ЮKassa — но успех в кабинете показываем
          // только если подтверждено зачисление (credited или alreadyApplied).
          if (data.credited || data.alreadyApplied) {
            localStorage.removeItem("pendingPaymentId");
            if (data.kind === "subscription") {
              toast({ title: "Подписка активирована ✓", description: data.subscriptionUntil ? `Действует до ${new Date(data.subscriptionUntil).toLocaleDateString("ru-RU")}.` : "Подписка зачислена." });
            } else {
              toast({ title: "Баланс пополнен ✓", description: typeof data.newBalance === "number" ? `Текущий баланс: ${data.newBalance} ₽.` : "Зачисление выполнено." });
            }
            window.history.replaceState({}, "", window.location.pathname);
            window.location.reload();
            return;
          }
          // Платёж принят, но reconcile ещё не отработал — продолжаем опрос
          if (attempts >= maxAttempts) {
            toast({ title: "Платёж получен, ожидаем зачисления", description: "Если баланс не обновится в течение 5 минут — напишите на support@neurozachet.ru с номером операции.", variant: "destructive" });
            window.history.replaceState({}, "", window.location.pathname);
            return;
          }
          setTimeout(tick, 3000);
          return;
        }
        if (data?.status === "canceled") {
          localStorage.removeItem("pendingPaymentId");
          toast({ title: "Платёж отменён", description: "Деньги не списаны. Можно попробовать снова.", variant: "destructive" });
          window.history.replaceState({}, "", window.location.pathname);
          return;
        }
        if (attempts >= maxAttempts) {
          toast({ title: "Платёж в обработке", description: "Если деньги списались, но баланс не пополнился — напишите на support@neurozachet.ru с номером операции." });
          window.history.replaceState({}, "", window.location.pathname);
          return;
        }
        setTimeout(tick, 3000);
      } catch {
        if (attempts >= maxAttempts) return;
        setTimeout(tick, 3000);
      }
    };
    setTimeout(tick, 1500);
    return () => { cancelled = true; };
  }, [toast]);

  const handleBuy = async (plan: typeof PLANS[0]) => {
    if (!user) { setLocation("/login"); return; }
    if (!agreed) {
      toast({ title: "Необходимо согласие", description: "Пожалуйста, примите условия оферты перед оплатой", variant: "destructive" });
      return;
    }
    setLoading(plan.key);
    try {
      const token = localStorage.getItem("authToken");
      const resp = await fetch(`${BASE_URL}/api/payments/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ packageKey: plan.key, amount: plan.price }),
      });
      if (resp.status === 404 || resp.status === 501) {
        toast({
          title: "Оплата скоро будет доступна",
          description: "Подключение ЮKassa в процессе. Напишите на support@neurozachet.ru для ручного пополнения.",
        });
        return;
      }
      const data = await resp.json();
      if (!resp.ok) {
        toast({ title: "Ошибка", description: data.message || "Что-то пошло не так", variant: "destructive" });
        return;
      }
      if (data.confirmationUrl) {
        if (data.paymentId) {
          try { localStorage.setItem("pendingPaymentId", String(data.paymentId)); } catch {}
        }
        window.location.href = data.confirmationUrl;
      } else {
        toast({ title: "Баланс пополнен!", description: `+${plan.credit} ₽ добавлено на счёт` });
        setLocation("/dashboard");
      }
    } catch {
      toast({
        title: "Оплата скоро будет доступна",
        description: "Для ручного пополнения напишите на support@neurozachet.ru",
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300 pb-12">

      {/* Header */}
      <div className="text-center space-y-3 pt-2">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          Пополнение баланса
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-foreground">Выберите пакет</h1>
        <p className="text-muted-foreground max-w-xl mx-auto text-sm">
          Пополните баланс один раз — тратьте на любые задачи. Чем больше пакет, тем выгоднее.
        </p>
        {user && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold">
            <Wallet className="w-4 h-4" />
            Ваш баланс: {(user as any).balance ?? 0} ₽
          </div>
        )}
      </div>

      {/* ── ПОДПИСКА: Месяц безлимит ────────────────────────────────── */}
      {(() => {
        const subUntilStr = (user as any)?.subscriptionUntil as string | null | undefined;
        const subActive = !!(user as any)?.subscriptionActive;
        const subUntilDate = subUntilStr ? new Date(subUntilStr) : null;
        return (
          <div className={`relative rounded-3xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/8 via-orange-500/5 to-amber-500/8 p-6 sm:p-8 overflow-hidden`}>
            <div className="absolute -top-3 right-6 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-lg">
              Лучшее предложение
            </div>
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shrink-0">
                <InfinityIcon className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl sm:text-3xl font-black text-foreground">Месяц безлимит</h2>
                <p className="text-sm text-muted-foreground mt-1">Все ИИ-инструменты НейроЗачёт без списания баланса — 30 дней</p>
                <div className="flex items-end gap-3 mt-4">
                  <span className="text-4xl sm:text-5xl font-black text-foreground">990 ₽</span>
                  <span className="text-sm text-muted-foreground mb-2">/ 30 дней</span>
                </div>
                <ul className="grid sm:grid-cols-2 gap-2 mt-4">
                  {[
                    "Безлимитные задачи во всех режимах",
                    "Безлимитные чат-сессии (любая модель)",
                    "Конспекты и курсовые без доплат",
                    "Генерация изображений включена",
                    "Доработки разделов курсовых — бесплатно",
                    "Подписки складываются (можно продлевать)",
                  ].map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                {subActive && subUntilDate && (
                  <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                    <Calendar className="w-3.5 h-3.5" />
                    Подписка активна до {subUntilDate.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                  </div>
                )}
              </div>
              <div className="w-full sm:w-auto sm:min-w-[200px]">
                <Button
                  onClick={() => handleBuy({ key: "unlimited_month", label: "Месяц безлимит", price: 990, credit: 0, color: "from-amber-500 to-orange-500" } as any)}
                  disabled={loading === "unlimited_month"}
                  className="w-full h-12 font-bold text-white border-0 bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90"
                >
                  {loading === "unlimited_month"
                    ? <RefreshCw className="w-4 h-4 animate-spin" />
                    : <>{subActive ? "Продлить" : (user ? "Оформить" : "Войти и оформить")} <ArrowRight className="w-4 h-4 ml-1" /></>}
                </Button>
                <p className="text-[11px] text-muted-foreground text-center mt-2">Без автопродления · возврат по оферте</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Plans */}
      <div className="text-center text-sm text-muted-foreground pt-4">— или пополните баланс пакетом —</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {PLANS.map(plan => {
          const Icon = plan.icon;
          const isSelected = selectedPlan === plan.key;
          return (
            <div
              key={plan.key}
              onClick={() => setSelectedPlan(plan.key)}
              className={`relative rounded-3xl border ${plan.border} ${plan.bg} p-6 flex flex-col gap-5 transition-all duration-200 cursor-pointer
                ${plan.popular ? "scale-[1.02] shadow-[0_0_40px_rgba(139,92,246,0.15)]" : ""}
                ${isSelected ? "ring-2 ring-primary/60" : ""}
              `}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 text-white text-[10px] font-bold uppercase tracking-wider shadow-lg">
                  Популярный
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${plan.color} flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${plan.badgeBg}`}>{plan.bonusPct} бонус</span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-foreground">{plan.label}</h3>
                <p className="text-xs text-muted-foreground mb-3">{plan.desc}</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-black text-foreground">{plan.price} ₽</span>
                  <span className="text-sm text-muted-foreground mb-1">→</span>
                  <span className="text-xl font-black text-primary mb-0.5">{plan.credit} ₽</span>
                </div>
                <p className="text-xs text-muted-foreground">на балансе · {plan.vatText}</p>
              </div>

              <ul className="space-y-2 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={(e) => { e.stopPropagation(); handleBuy(plan); }}
                disabled={loading === plan.key}
                className={`w-full h-11 font-bold text-white border-0 bg-gradient-to-r ${plan.color} hover:opacity-90 transition-opacity`}
              >
                {loading === plan.key
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : <>{user ? "Оплатить" : "Войти и оплатить"} <ArrowRight className="w-4 h-4 ml-1" /></>
                }
              </Button>
            </div>
          );
        })}
      </div>

      {/* Agreement checkbox */}
      <div className={`flex items-start gap-3 p-4 rounded-2xl border ${agreed ? "border-emerald-500/30 bg-emerald-500/5" : "border-border/40 bg-card/30"} transition-colors`}>
        <button
          onClick={() => setAgreed(!agreed)}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${agreed ? "border-emerald-500 bg-emerald-500" : "border-muted-foreground/40"}`}
        >
          {agreed && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
        </button>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Нажимая «Оплатить», я принимаю условия{" "}
          <Link href="/offer" className="text-primary underline underline-offset-2 hover:opacity-80">Договора публичной оферты</Link>
          {" "}и{" "}
          <Link href="/privacy" className="text-primary underline underline-offset-2 hover:opacity-80">Политики конфиденциальности</Link>.
          Я подтверждаю, что мне исполнилось 18 лет. Пополнение баланса является оплатой информационной услуги согласно{" "}
          <Link href="/offer" className="text-primary underline underline-offset-2 hover:opacity-80">Оферте</Link>.{" "}
          Возврат регулируется <Link href="/refund" className="text-primary underline underline-offset-2 hover:opacity-80">Политикой возврата</Link>.
        </p>
      </div>

      {/* Payment methods + security */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Payment methods */}
        <div className={`p-5 rounded-2xl border border-border/40 ${isLight ? "bg-slate-50" : "bg-card/30"}`}>
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Способы оплаты</span>
            <div className="ml-auto px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20">
              <span className="text-[10px] font-bold text-primary">ЮKassa</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map(m => (
              <div key={m.name} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${isLight ? "bg-white border border-slate-200" : "bg-background/40 border border-border/30"}`}>
                <span className="text-base">{m.icon}</span>
                <span className="text-xs text-muted-foreground">{m.name}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground/60 mt-3">
            Платежи обрабатываются ООО НКО «ЮMoney» (лицензия ЦБ РФ). Данные карты не передаются продавцу.
          </p>
        </div>

        {/* Guarantees */}
        <div className={`p-5 rounded-2xl border border-border/40 ${isLight ? "bg-slate-50" : "bg-card/30"} space-y-3`}>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Гарантии и возврат</span>
          </div>
          {[
            { icon: Shield, text: "SSL-шифрование и безопасная обработка платежей" },
            { icon: Wallet, text: "Баланс не сгорает — тратьте когда удобно" },
            { icon: RotateCcw, text: "Возврат неизрасходованного остатка по заявке" },
            { icon: FileText, text: "Кассовый чек на email по 54-ФЗ" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-start gap-2.5 text-xs text-muted-foreground">
              <Icon className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              {text}
            </div>
          ))}
        </div>
      </div>

      {/* What you're buying - legal description for YooKassa */}
      <div className={`p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5`}>
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Что вы покупаете</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>Наименование услуги:</strong> Пополнение внутреннего баланса пользователя на платформе НейроЗачёт (neurozachet.ru) для оплаты информационных услуг по автоматизированной обработке учебных запросов с использованием технологий искусственного интеллекта.
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>Налогообложение:</strong> Без НДС (ИП на УСН). <strong>Чек:</strong> направляется на email, указанный при регистрации.
            </p>
          </div>
        </div>
      </div>

      {/* Return policy notice */}
      <div className={`p-4 rounded-2xl border border-border/30 ${isLight ? "bg-slate-50" : "bg-card/20"}`}>
        <div className="flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <strong className="text-foreground">Возврат средств</strong> — возможен на неизрасходованный остаток баланса. Средства, уже потраченные на выполненные ИИ-запросы, возврату не подлежат. Срок рассмотрения заявки — до 10 рабочих дней.
            </p>
            <p>
              Подробности: <Link href="/refund" className="text-primary underline underline-offset-2">Политика возврата</Link> · <Link href="/offer" className="text-primary underline underline-offset-2">Договор оферты</Link> · <a href="mailto:support@neurozachet.ru" className="text-primary underline underline-offset-2">support@neurozachet.ru</a>
            </p>
          </div>
        </div>
      </div>

      {/* Lock icon + security */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/60">
        <Lock className="w-3.5 h-3.5" />
        <span>Платежи защищены SSL · Данные карты не хранятся на наших серверах · ЮKassa — лицензия ЦБ РФ</span>
      </div>
    </div>
  );
}
