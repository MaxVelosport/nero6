import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useLogin } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Zap, Loader2, Brain, MessageSquare, GraduationCap, CheckCircle2, ArrowRight, Copy, Check } from "lucide-react";
import { FloatingSymbols } from "@/components/effects/FloatingSymbols";

const loginSchema = z.object({
  email: z.string().email({ message: "Введите корректный email" }),
  password: z.string().min(1, { message: "Введите пароль" }),
});

const FEATURES = [
  { icon: Brain, text: "Решает задачи по 80+ предметам" },
  { icon: MessageSquare, text: "Живой чат с ИИ без ограничений" },
  { icon: GraduationCap, text: "Помощь с курсовыми и дипломами" },
  { icon: CheckCircle2, text: "100 ₽ на баланс при регистрации" },
];

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMutation = useLogin();
  const queryClient = useQueryClient();
  const [focused, setFocused] = useState<string | null>(null);
  const [credCopied, setCredCopied] = useState<"email" | "password" | null>(null);

  const TEST_EMAIL = "test@neyrozachet.ru";
  const TEST_PASSWORD = "TestPass123!";

  function fillTestAccount() {
    form.setValue("email", TEST_EMAIL, { shouldValidate: true });
    form.setValue("password", TEST_PASSWORD, { shouldValidate: true });
  }
  async function copyCred(value: string, key: "email" | "password") {
    try {
      await navigator.clipboard.writeText(value);
      setCredCopied(key);
      setTimeout(() => setCredCopied(null), 1500);
    } catch {}
  }

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  function onSubmit(values: z.infer<typeof loginSchema>) {
    loginMutation.mutate({ data: values }, {
      onSuccess: (response) => {
        localStorage.setItem("authToken", response.token);
        localStorage.setItem("authTokenIssuedAt", Date.now().toString());
        // Clear stale cache so all pages refetch with the new token
        queryClient.clear();
        setLocation("/dashboard");
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Ошибка входа",
          description: error.data?.message || "Неверный email или пароль",
        });
      }
    });
  }

  return (
    <div className="min-h-screen flex bg-[#080b14] overflow-hidden relative">
      <FloatingSymbols count={26} className="z-0" />

      {/* ── Left panel (branding) ── */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col items-start justify-center px-16 py-12 overflow-hidden z-10">

        {/* Ambient blobs */}
        <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full bg-violet-700/20 blur-[100px] animate-pulse-glow pointer-events-none" />
        <div className="absolute bottom-[-15%] right-[-5%] w-[400px] h-[400px] rounded-full bg-blue-700/15 blur-[90px] animate-pulse-glow pointer-events-none" style={{ animationDelay: "2s" }} />

        {/* Dot grid */}
        <div className="absolute inset-0 dot-grid opacity-40 pointer-events-none" />

        {/* Decorative ring */}
        <div className="absolute right-[-80px] top-[50%] translate-y-[-50%] w-[300px] h-[300px] rounded-full border border-violet-500/15 animate-spin-slow pointer-events-none" />
        <div className="absolute right-[-40px] top-[50%] translate-y-[-50%] w-[200px] h-[200px] rounded-full border border-violet-500/10 animate-spin-slow pointer-events-none" style={{ animationDirection: "reverse", animationDuration: "30s" }} />

        <div className="relative z-10 max-w-md">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 mb-12">
            <div className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center glow-sm">
              <Zap className="w-6 h-6 text-white" fill="white" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">НейроЗачёт</span>
          </Link>

          {/* Headline */}
          <h1 className="text-5xl font-bold leading-tight mb-5">
            <span className="text-white">ИИ-помощник</span>
            <br />
            <span className="gradient-text">для учёбы</span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed mb-10">
            Решайте задачи, готовьтесь к экзаменам и пишите научные работы с помощью передовых ИИ-моделей.
          </p>

          {/* Feature pills */}
          <div className="space-y-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 group">
                <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0 group-hover:bg-primary/25 transition-colors">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-slate-300 text-sm font-medium">{text}</span>
              </div>
            ))}
          </div>

          {/* Social proof */}
          <div className="mt-12 flex items-center gap-3">
            <div className="flex -space-x-2">
              {["В", "А", "М", "К"].map((l, i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-[#080b14] flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: ["#7c3aed","#2563eb","#059669","#d97706"][i] }}>
                  {l}
                </div>
              ))}
            </div>
            <div>
              <div className="flex gap-0.5 mb-0.5">
                {[1,2,3,4,5].map(i => <span key={i} className="text-amber-400 text-xs">★</span>)}
              </div>
              <p className="text-xs text-slate-500">10 000+ студентов уже используют</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel (form) ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative z-10">
        {/* Subtle background */}
        <div className="absolute top-0 right-0 w-[60%] h-[60%] rounded-full bg-violet-900/8 blur-[120px] pointer-events-none" />

        {/* Mobile logo */}
        <Link href="/" className="flex lg:hidden items-center gap-2 mb-10">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" fill="white" />
          </div>
          <span className="text-xl font-bold text-white">НейроЗачёт</span>
        </Link>

        {/* Form card */}
        <div className="w-full max-w-sm relative">
          {/* Card glow */}
          <div className="absolute inset-0 rounded-3xl bg-primary/5 blur-xl scale-105 pointer-events-none" />

          <div className="relative glass-strong rounded-3xl p-8 shadow-2xl">
            {/* Top accent line */}
            <div className="absolute top-0 left-8 right-8 h-[2px] rounded-full bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-1">Добро пожаловать!</h2>
              <p className="text-slate-400 text-sm">Войдите в свой аккаунт</p>
            </div>

            {/* Test account banner */}
            <div className="mb-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-300/90">Тестовый аккаунт</span>
                <button
                  type="button"
                  onClick={fillTestAccount}
                  className="text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 underline-offset-2 hover:underline transition"
                >
                  Подставить →
                </button>
              </div>
              <div className="space-y-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => copyCred(TEST_EMAIL, "email")}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-black/30 hover:bg-black/40 transition group"
                  title="Скопировать email"
                >
                  <span className="text-slate-400">Email:</span>
                  <span className="font-mono text-slate-200 truncate flex-1 text-left ml-2">{TEST_EMAIL}</span>
                  {credCopied === "email" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />}
                </button>
                <button
                  type="button"
                  onClick={() => copyCred(TEST_PASSWORD, "password")}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-black/30 hover:bg-black/40 transition group"
                  title="Скопировать пароль"
                >
                  <span className="text-slate-400">Пароль:</span>
                  <span className="font-mono text-slate-200 truncate flex-1 text-left ml-2">{TEST_PASSWORD}</span>
                  {credCopied === "password" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />}
                </button>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-300 text-sm">Email</FormLabel>
                      <FormControl>
                        <Input
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
                      <div className="flex items-center justify-between mb-1.5">
                        <FormLabel className="text-slate-300 text-sm">Пароль</FormLabel>
                        <Link href="/forgot-password" className="text-xs text-primary/70 hover:text-primary transition-colors">
                          Забыли пароль?
                        </Link>
                      </div>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
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
                <Button
                  type="submit"
                  className="w-full h-11 mt-2 bg-primary hover:bg-primary/90 glow-sm transition-all font-semibold gap-2 group"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>Войти <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></>
                  )}
                </Button>
              </form>
            </Form>

            <div className="mt-6 pt-6 border-t border-white/6 text-center">
              <p className="text-sm text-slate-500">
                Нет аккаунта?{" "}
                <Link href="/register" className="text-primary font-medium hover:text-primary/80 transition-colors">
                  Зарегистрироваться бесплатно
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
