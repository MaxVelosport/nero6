import { AlertTriangle, ExternalLink, ShieldAlert } from "lucide-react";

interface AIDisclaimerProps {
  variant?: "result" | "chat" | "compact" | "warning";
  className?: string;
}

export function AIDisclaimer({ variant = "result", className = "" }: AIDisclaimerProps) {
  if (variant === "compact") {
    return (
      <p className={`flex items-start gap-1.5 text-[11px] text-muted-foreground/70 leading-relaxed ${className}`}>
        <AlertTriangle className="w-3 h-3 text-amber-500/60 shrink-0 mt-px" />
        ИИ может ошибаться — проверяйте результат перед использованием.{" "}
        <a href="/offer#ai" className="underline underline-offset-2 hover:text-muted-foreground transition-colors whitespace-nowrap">
          Подробнее
        </a>
      </p>
    );
  }

  if (variant === "chat") {
    return (
      <div className={`flex items-start gap-2.5 px-4 py-2.5 border-t border-border/20 bg-amber-500/3 ${className}`}>
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500/70 shrink-0 mt-px" />
        <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
          Ответы ИИ могут содержать ошибки или неточности. Не используйте без самостоятельной проверки.{" "}
          <a href="/offer" target="_blank" className="underline underline-offset-2 hover:text-muted-foreground">
            Условия использования
          </a>
        </p>
      </div>
    );
  }

  if (variant === "warning") {
    return (
      <div className={`flex items-start gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/8 ${className}`}>
        <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-1.5 text-xs leading-relaxed">
          <p className="font-semibold text-amber-600 dark:text-amber-400 text-sm">
            ИИ может ошибаться. Ответственность — на вас.
          </p>
          <p className="text-muted-foreground">
            Сервис помогает в учёбе, но <b>не гарантирует</b> правильность, уникальность и принятие работы преподавателем. Перед сдачей <b>проверяйте всё сами</b> в учебниках и других источниках.
          </p>
          <p className="text-muted-foreground">
            Возврат возможен <b>при технической неполадке</b> (ИИ не ответил, задача зависла, двойное списание) или для <b>неизрасходованного остатка баланса</b>.{" "}
            <a href="/refund-request" className="underline underline-offset-2 hover:text-amber-600">Оформить заявку</a>
            {" · "}
            <a href="/offer" target="_blank" className="underline underline-offset-2 hover:text-amber-600">Условия оферты</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-3 p-3.5 rounded-xl border border-amber-500/15 bg-amber-500/5 ${className}`}>
      <AlertTriangle className="w-4 h-4 text-amber-500/80 shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <p className="text-xs font-medium text-amber-600/90">
          Результат носит информационный характер
        </p>
        <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
          ИИ может допускать фактические ошибки, неточности и галлюцинации. Перед использованием
          проверяйте важные утверждения в дополнительных источниках. Сервис не несёт ответственности
          за последствия использования сгенерированного контента. Возврат — при технической неполадке или на неизрасходованный остаток.{" "}
          <a href="/offer" target="_blank" className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-amber-600 transition-colors">
            Условия оферты <ExternalLink className="w-2.5 h-2.5" />
          </a>
          {" · "}
          <a href="/refund-request" className="underline underline-offset-2 hover:text-amber-600">
            Заявка на возврат
          </a>
        </p>
      </div>
    </div>
  );
}
