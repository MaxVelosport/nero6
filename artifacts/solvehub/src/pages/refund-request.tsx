import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, RotateCcw, Send, Loader2, CheckCircle2, AlertTriangle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const CATEGORIES: { key: string; label: string; hint: string }[] = [
  { key: "tech_failure", label: "Техническая неполадка", hint: "ИИ не ответил, ошибка системы, задача зависла" },
  { key: "double_charge", label: "Двойное списание", hint: "Списали дважды за одну операцию" },
  { key: "payment_failed", label: "Оплата прошла, баланс не пополнился", hint: "Деньги ушли, но баланс не вырос" },
  { key: "balance_unused", label: "Возврат неизрасходованного остатка", hint: "Хочу вернуть деньги с баланса, не пользуюсь" },
  { key: "other", label: "Иное", hint: "Не подходит ни один вариант" },
];

export default function RefundRequestPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("tech_failure");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [taskId, setTaskId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ requestId: string } | null>(null);

  useEffect(() => {
    try {
      const token = localStorage.getItem("authToken");
      if (token) {
        fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => (r.ok ? r.json() : null))
          .then((u) => {
            if (u?.email) setEmail(u.email);
            if (u?.name) setName(u.name);
          })
          .catch(() => {});
      }
    } catch {}
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!consent) {
      setError("Подтвердите согласие на обработку заявки");
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem("authToken");
      const r = await fetch("/api/refund-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          email, name, category, reason, details,
          taskId: taskId || undefined,
          amount: amount || undefined,
          paymentDate: paymentDate || undefined,
          consent: true,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Не удалось отправить заявку");
      setSuccess({ requestId: data.requestId });
    } catch (err: any) {
      setError(err?.message || "Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-xl mx-auto px-4 py-12">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Заявка отправлена</h1>
            <p className="text-sm text-muted-foreground mb-4">
              Номер вашей заявки:{" "}
              <span className="font-mono font-bold text-foreground">{success.requestId}</span>
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Мы написали вам подтверждение на <b>{email}</b>. Срок рассмотрения — до <b>10 рабочих дней</b>.
              При положительном решении возврат — на реквизиты, с которых производилась оплата, в течение 30 рабочих дней.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Link href="/dashboard">
                <Button>В личный кабинет</Button>
              </Link>
              <a href="mailto:support@neurozachet.ru">
                <Button variant="outline" className="gap-2"><Mail className="w-4 h-4" /> Написать в поддержку</Button>
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link href="/refund" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> К политике возврата
        </Link>

        <div className="flex items-start gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0">
            <RotateCcw className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">Заявка на возврат</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Заполните форму — мы рассмотрим в течение 10 рабочих дней.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <b className="text-foreground">Важно.</b> Возврат за уже выполненные ИИ-запросы не производится — услуга
            считается оказанной в момент получения ответа от ИИ. Возврат возможен при <b>технической
            неполадке</b> (ИИ не ответил, задача зависла, двойное списание, оплата не зачислена), а также
            на <b>неизрасходованный остаток</b> баланса. Подробности —{" "}
            <Link href="/refund" className="underline underline-offset-2 hover:text-foreground">политика возврата</Link>.
          </div>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">Email аккаунта <span className="text-red-500">*</span></Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-sm">Имя</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Александр"
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label className="text-sm mb-2 block">Категория <span className="text-red-500">*</span></Label>
            <div className="grid grid-cols-1 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setCategory(c.key)}
                  className={`text-left rounded-xl border p-3 transition-all ${
                    category === c.key
                      ? "border-amber-500/60 bg-amber-500/8 ring-1 ring-amber-500/30"
                      : "border-border/40 bg-card/50 hover:border-border"
                  }`}
                >
                  <div className="font-semibold text-sm">{c.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{c.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-sm">Краткая причина <span className="text-red-500">*</span></Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              maxLength={200}
              placeholder="Например: задача №12345 зависла на 95% и не завершилась"
              className="mt-1.5"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm">ID операции / задачи</Label>
              <Input
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                placeholder="12345"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-sm">Сумма (₽)</Label>
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="100"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-sm">Дата операции</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label className="text-sm">Подробности <span className="text-red-500">*</span></Label>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              required
              minLength={20}
              maxLength={5000}
              rows={5}
              placeholder="Что именно произошло? Когда? Что вы делали? Что ожидали увидеть? Если есть скриншот — приложите его в письме на support@neurozachet.ru с темой «К заявке #...»."
              className="mt-1.5 resize-none"
            />
            <p className="text-[11px] text-muted-foreground mt-1">{details.length} / 5000</p>
          </div>

          <label className="flex items-start gap-3 p-3 rounded-xl border border-border/40 bg-card/30 cursor-pointer">
            <Checkbox
              checked={consent}
              onCheckedChange={(v) => setConsent(v === true)}
              className="mt-0.5"
            />
            <span className="text-xs text-muted-foreground leading-relaxed">
              Подтверждаю достоверность сведений и даю согласие на обработку персональных данных в целях
              рассмотрения заявки в соответствии с{" "}
              <Link href="/privacy" className="underline hover:text-foreground">Политикой конфиденциальности</Link>.
            </span>
          </label>

          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 gap-2 bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {loading ? "Отправка…" : "Отправить заявку"}
          </Button>

          <p className="text-[11px] text-muted-foreground text-center">
            Альтернативный способ — написать на{" "}
            <a href="mailto:support@neurozachet.ru" className="underline hover:text-foreground">support@neurozachet.ru</a>.
          </p>
        </form>
      </div>
    </div>
  );
}
