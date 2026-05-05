import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";

const BASE_URL_VE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type State = "loading" | "success" | "already" | "expired" | "invalid" | "error";

export default function VerifyEmailPage() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const [state, setState] = useState<State>("loading");
  const [bonus, setBonus] = useState<number>(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) { setState("invalid"); return; }

    fetch(`${BASE_URL_VE}/api/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (r.ok) {
          setBonus(Number(data.bonus ?? 0));
          setState(data.alreadyVerified ? "already" : "success");
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        } else if (data.error === "token_expired") {
          setState("expired");
        } else {
          setState("invalid");
        }
      })
      .catch(() => setState("error"));
  }, [token]);

  const config: Record<State, { icon: React.ReactNode; title: string; desc: string; color: string }> = {
    loading: {
      icon: <Loader2 className="w-10 h-10 text-primary animate-spin" />,
      title: "Проверяем ссылку…",
      desc: "Пожалуйста, подождите",
      color: "text-primary",
    },
    success: {
      icon: <CheckCircle className="w-10 h-10 text-green-500" />,
      title: "Email подтверждён! 🎉",
      desc: bonus > 0
        ? `На ваш счёт зачислено ${bonus} ₽. Теперь вы можете пользоваться всеми функциями НейроЗачёт.`
        : "Спасибо! Теперь вы можете пользоваться всеми функциями НейроЗачёт.",
      color: "text-green-500",
    },
    already: {
      icon: <CheckCircle className="w-10 h-10 text-green-500" />,
      title: "Email уже подтверждён",
      desc: "Ваш адрес электронной почты был подтверждён ранее.",
      color: "text-green-500",
    },
    expired: {
      icon: <XCircle className="w-10 h-10 text-amber-500" />,
      title: "Ссылка истекла",
      desc: "Ссылка действительна 24 часа. Зайдите в личный кабинет и запросите новое письмо.",
      color: "text-amber-500",
    },
    invalid: {
      icon: <XCircle className="w-10 h-10 text-red-500" />,
      title: "Неверная ссылка",
      desc: "Ссылка недействительна или уже была использована. Попробуйте запросить новое письмо.",
      color: "text-red-500",
    },
    error: {
      icon: <XCircle className="w-10 h-10 text-red-500" />,
      title: "Ошибка сервера",
      desc: "Что-то пошло не так. Попробуйте позже или напишите в поддержку.",
      color: "text-red-500",
    },
  };

  const c = config[state];

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground px-4">
      <div className="text-center max-w-md w-full">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          {c.icon}
        </div>
        <h1 className="text-2xl font-bold mb-3">{c.title}</h1>
        <p className="text-muted-foreground text-sm mb-8 leading-relaxed">{c.desc}</p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {state === "success" && (
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              Перейти в кабинет →
            </Link>
          )}
          {(state === "already") && (
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              В личный кабинет
            </Link>
          )}
          {(state === "expired" || state === "invalid" || state === "error") && (
            <>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
              >
                <Mail className="w-4 h-4" /> Запросить новое письмо
              </Link>
              <a
                href="mailto:support@neurozachet.ru"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-white/15 bg-white/5 text-sm font-medium hover:bg-white/10 transition-colors"
              >
                Написать в поддержку
              </a>
            </>
          )}
        </div>

        <Link
          href="/"
          className="inline-block mt-6 text-xs text-muted-foreground hover:text-white transition-colors"
        >
          На главную
        </Link>
      </div>
    </div>
  );
}
