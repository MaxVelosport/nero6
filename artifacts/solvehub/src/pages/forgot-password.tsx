import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Zap, Loader2, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast({ variant: "destructive", title: "Введите корректный email" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ variant: "destructive", title: "Ошибка", description: data.message || "Попробуйте позже" });
      }
    } catch {
      toast({ variant: "destructive", title: "Ошибка сети", description: "Проверьте соединение и попробуйте снова" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden p-4">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2 text-2xl font-bold tracking-tighter text-white">
            <Zap className="w-6 h-6 text-primary" fill="currentColor" />
            НейроЗачёт
          </Link>
        </div>

        <Card className="border-white/10 bg-card/40 backdrop-blur-xl shadow-2xl">
          <CardHeader className="space-y-1">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center mx-auto mb-2">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold text-center">Восстановление пароля</CardTitle>
            <CardDescription className="text-center">
              Введите email — отправим инструкцию по сбросу пароля
            </CardDescription>
          </CardHeader>

          <CardContent>
            {sent ? (
              <div className="text-center space-y-4 py-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <div>
                  <p className="font-semibold text-white text-lg mb-1">Письмо отправлено!</p>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Если <span className="font-medium text-white">{email}</span> зарегистрирован в системе,
                    вы получите письмо с инструкциями в течение нескольких минут.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-300 text-left">
                  <p className="font-semibold mb-1">Не видите письмо?</p>
                  <p>Проверьте папку «Спам» или «Нежелательная почта». Ссылка действительна 1 час.</p>
                </div>
                <Button
                  variant="outline"
                  className="w-full border-white/15"
                  onClick={() => { setSent(false); setEmail(""); }}
                >
                  Попробовать другой email
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">Email</label>
                  <Input
                    type="email"
                    placeholder="student@university.ru"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="bg-background/50"
                    autoFocus
                    autoComplete="email"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                  Отправить инструкцию
                </Button>
              </form>
            )}
          </CardContent>

          <CardFooter className="flex justify-center">
            <Link href="/login" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Вернуться ко входу
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
