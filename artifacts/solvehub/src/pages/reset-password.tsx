import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Zap, Loader2, KeyRound, ArrowLeft, CheckCircle2, Eye, EyeOff, AlertTriangle } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export default function ResetPasswordPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [tokenMissing, setTokenMissing] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) {
      setToken(t);
    } else {
      setTokenMissing(true);
    }
  }, []);

  const passwordsMatch = confirm.length === 0 || password === confirm;
  const isStrong = password.length >= 6;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      toast({ variant: "destructive", title: "Пароль слишком короткий", description: "Минимум 6 символов" });
      return;
    }
    if (password !== confirm) {
      toast({ variant: "destructive", title: "Пароли не совпадают" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setDone(true);
      } else {
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: data.message || "Не удалось сменить пароль. Попробуйте запросить новую ссылку.",
        });
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
              <KeyRound className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold text-center">Новый пароль</CardTitle>
            <CardDescription className="text-center">
              Придумайте надёжный пароль для входа
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* Token missing */}
            {tokenMissing && (
              <div className="text-center space-y-4 py-2">
                <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-7 h-7 text-red-400" />
                </div>
                <p className="font-semibold text-white text-lg">Ссылка недействительна</p>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Эта ссылка для сброса пароля повреждена или устарела.
                  Запросите новую ссылку.
                </p>
                <Button asChild className="w-full">
                  <Link href="/forgot-password">Запросить новую ссылку</Link>
                </Button>
              </div>
            )}

            {/* Success state */}
            {done && (
              <div className="text-center space-y-4 py-2">
                <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                </div>
                <div>
                  <p className="font-semibold text-white text-lg mb-1">Пароль изменён!</p>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Вы можете войти в аккаунт с новым паролем.
                  </p>
                </div>
                <Button className="w-full" onClick={() => navigate("/login")}>
                  Войти в аккаунт
                </Button>
              </div>
            )}

            {/* Form */}
            {!tokenMissing && !done && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">Новый пароль</label>
                  <div className="relative">
                    <Input
                      type={showPwd ? "text" : "password"}
                      placeholder="Минимум 6 символов"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className={`bg-background/50 pr-10 ${
                        password.length > 0 && !isStrong ? "border-red-500/50" : ""
                      }`}
                      autoFocus
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPwd(v => !v)}
                    >
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {password.length > 0 && !isStrong && (
                    <p className="text-xs text-red-400">Пароль слишком короткий</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">Повторите пароль</label>
                  <div className="relative">
                    <Input
                      type={showConfirm ? "text" : "password"}
                      placeholder="Введите пароль ещё раз"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      className={`bg-background/50 pr-10 ${
                        !passwordsMatch ? "border-red-500/50" : confirm.length > 0 && passwordsMatch ? "border-emerald-500/50" : ""
                      }`}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowConfirm(v => !v)}
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {!passwordsMatch && (
                    <p className="text-xs text-red-400">Пароли не совпадают</p>
                  )}
                  {passwordsMatch && confirm.length > 0 && isStrong && (
                    <p className="text-xs text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Пароли совпадают
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !isStrong || !passwordsMatch || !confirm}
                >
                  {loading
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Сохраняю…</>
                    : <><KeyRound className="mr-2 h-4 w-4" /> Сохранить новый пароль</>
                  }
                </Button>
              </form>
            )}
          </CardContent>

          {!done && (
            <CardFooter className="flex justify-center">
              <Link href="/login" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Вернуться ко входу
              </Link>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}
