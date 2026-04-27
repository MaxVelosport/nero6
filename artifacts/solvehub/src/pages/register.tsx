import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useRegister } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Zap, Loader2, ArrowRight, Sparkles, Shield, Clock, AlertTriangle } from "lucide-react";
import { FloatingSymbols } from "@/components/effects/FloatingSymbols";

const registerSchema = z.object({
  name: z.string().min(2, { message: "Имя должно содержать минимум 2 символа" }),
  email: z.string().email({ message: "Введите корректный email" }),
  password: z.string().min(6, { message: "Пароль должен содержать минимум 6 символов" }),
  educationLevel: z.enum(["school", "bachelor", "master", "phd", "other"]),
  acceptTerms: z.boolean().refine((v) => v === true, { message: "Необходимо принять условия" }),
  understandsAi: z.boolean().refine((v) => v === true, { message: "Необходимо подтвердить понимание" }),
});

const BASE_URL_REG = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const registerMutation = useRegister();
  const [focused, setFocused] = useState<string | null>(null);
  const [welcomeBonus, setWelcomeBonus] = useState<number>(100);

  useEffect(() => {
    fetch(`${BASE_URL_REG}/api/public/settings`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d && typeof d.welcomeBonus === "number") setWelcomeBonus(d.welcomeBonus); })
      .catch(() => {});
  }, []);

  const PERKS = [
    welcomeBonus > 0
      ? { icon: Sparkles, label: `${welcomeBonus} ₽ на баланс сразу`, sub: "Хватит на первые задачи" }
      : { icon: Sparkles, label: "Старт за минуту", sub: "Без карты и подписки" },
    { icon: Shield, label: "Без подписки", sub: "Платите только за то, что используете" },
    { icon: Clock, label: "Ответ за 1–3 минуты", sub: "ИИ решает быстро" },
  ];

  const referralCode = new URLSearchParams(window.location.search).get('ref') || "";

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", educationLevel: "bachelor", acceptTerms: false, understandsAi: false },
  });

  function onSubmit(values: z.infer<typeof registerSchema>) {
    const { acceptTerms, understandsAi, ...rest } = values;
    void acceptTerms; void understandsAi;
    const data = referralCode ? { ...rest, referralCode } : rest;
    registerMutation.mutate({ data: data as any }, {
      onSuccess: (response) => {
        localStorage.setItem("authToken", response.token);
        localStorage.setItem("authTokenIssuedAt", Date.now().toString());
        localStorage.setItem("nz_onboarding", "1");
        const balance = Number((response as any)?.user?.balance ?? 0);
        toast({
          title: "Аккаунт создан!",
          description: balance > 0 ? `${balance} ₽ уже на балансе — пробуйте!` : "Добро пожаловать!",
        });
        setLocation("/dashboard");
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Ошибка регистрации",
          description: error.data?.message || "Не удалось создать аккаунт",
        });
      }
    });
  }

  return (
    <div className="min-h-screen flex bg-[#080b14] overflow-hidden relative">
      <FloatingSymbols count={24} className="z-0" />

      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[48%] relative flex-col items-start justify-center px-16 py-12 overflow-hidden z-10">
        <div className="absolute top-[-10%] left-[-5%] w-[450px] h-[450px] rounded-full bg-violet-700/18 blur-[100px] animate-pulse-glow pointer-events-none" />
        <div className="absolute bottom-[-20%] right-0 w-[350px] h-[350px] rounded-full bg-blue-700/12 blur-[80px] animate-pulse-glow pointer-events-none" style={{ animationDelay: "1.5s" }} />
        <div className="absolute inset-0 dot-grid opacity-35 pointer-events-none" />

        <div className="relative z-10 max-w-sm">
          <Link href="/" className="flex items-center gap-2.5 mb-14">
            <div className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center glow-sm">
              <Zap className="w-6 h-6 text-white" fill="white" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">НейроЗачёт</span>
          </Link>

          <h1 className="text-4xl font-bold leading-tight mb-4">
            <span className="text-white">Начните решать</span>
            <br />
            <span className="gradient-text">умнее</span>
          </h1>
          <p className="text-slate-400 text-base leading-relaxed mb-10">
            {welcomeBonus > 0
              ? `Создайте бесплатный аккаунт и сразу получите ${welcomeBonus} ₽ на баланс. Без карты, без подписки.`
              : "Создайте бесплатный аккаунт за 30 секунд. Без карты, без подписки."}
          </p>

          <div className="space-y-4">
            {PERKS.map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-center gap-4 p-4 rounded-2xl glass border border-white/6 hover:border-primary/20 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel (form) ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative">
        <div className="absolute bottom-0 left-0 w-[60%] h-[50%] rounded-full bg-violet-900/6 blur-[120px] pointer-events-none" />

        {/* Mobile logo */}
        <Link href="/" className="flex lg:hidden items-center gap-2 mb-10">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" fill="white" />
          </div>
          <span className="text-xl font-bold text-white">НейроЗачёт</span>
        </Link>

        <div className="w-full max-w-sm relative">
          {/* Card glow */}
          <div className="absolute inset-0 rounded-3xl bg-primary/4 blur-xl scale-105 pointer-events-none" />

          <div className="relative glass-strong rounded-3xl p-8 shadow-2xl">
            <div className="absolute top-0 left-8 right-8 h-[2px] rounded-full bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

            {/* Bonus badge */}
            {welcomeBonus > 0 && (
              <div className="inline-flex items-center gap-1.5 mb-6 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-xs font-semibold text-emerald-400">
                <Sparkles className="w-3 h-3" />
                {welcomeBonus} ₽ бонус при регистрации
              </div>
            )}

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-1">Создать аккаунт</h2>
              <p className="text-slate-400 text-sm">Бесплатно, за 30 секунд</p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-300 text-sm">Имя</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Александр"
                          {...field}
                          onFocus={() => setFocused("name")}
                          onBlur={() => setFocused(null)}
                          className={`bg-white/5 border-white/10 text-white placeholder:text-slate-600 transition-all ${focused === "name" ? "border-primary/60 ring-1 ring-primary/25" : ""}`}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-300 text-sm">Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="student@university.ru"
                          {...field}
                          onFocus={() => setFocused("email")}
                          onBlur={() => setFocused(null)}
                          className={`bg-white/5 border-white/10 text-white placeholder:text-slate-600 transition-all ${focused === "email" ? "border-primary/60 ring-1 ring-primary/25" : ""}`}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-300 text-sm">Пароль</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Минимум 6 символов"
                          {...field}
                          onFocus={() => setFocused("password")}
                          onBlur={() => setFocused(null)}
                          className={`bg-white/5 border-white/10 text-white placeholder:text-slate-600 transition-all ${focused === "password" ? "border-primary/60 ring-1 ring-primary/25" : ""}`}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="educationLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-300 text-sm">Уровень образования</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-white/5 border-white/10 text-white">
                            <SelectValue placeholder="Выберите уровень" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="school">🏫 Школьник</SelectItem>
                          <SelectItem value="bachelor">🎓 Бакалавриат / Специалитет</SelectItem>
                          <SelectItem value="master">🎓 Магистратура</SelectItem>
                          <SelectItem value="phd">📖 Аспирантура</SelectItem>
                          <SelectItem value="other">✨ Другое</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="understandsAi"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 mt-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="mt-0.5 border-amber-500/50 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-snug">
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-xs font-semibold text-amber-400">Я понимаю, что ИИ может ошибаться</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Сервис не гарантирует правильность, уникальность и принятие работы преподавателем. Я обязуюсь самостоятельно проверять сгенерированный контент.
                        </p>
                        <FormMessage className="text-[11px]" />
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="acceptTerms"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start gap-3 mt-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="mt-0.5"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-snug">
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Я принимаю{" "}
                          <a href="/offer" target="_blank" className="text-primary hover:underline">Договор-оферту</a>,{" "}
                          <a href="/privacy" target="_blank" className="text-primary hover:underline">Политику конфиденциальности</a> и{" "}
                          <a href="/refund" target="_blank" className="text-primary hover:underline">Политику возврата</a>. Подтверждаю, что мне есть 18 лет, и даю согласие на обработку персональных данных.
                        </p>
                        <FormMessage className="text-[11px]" />
                      </div>
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full h-11 mt-2 bg-primary hover:bg-primary/90 glow-sm transition-all font-semibold gap-2 group"
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>Зарегистрироваться <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></>
                  )}
                </Button>
              </form>
            </Form>

            <div className="mt-6 pt-6 border-t border-white/6 text-center">
              <p className="text-sm text-slate-500">
                Уже есть аккаунт?{" "}
                <Link href="/login" className="text-primary font-medium hover:text-primary/80 transition-colors">
                  Войти
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
