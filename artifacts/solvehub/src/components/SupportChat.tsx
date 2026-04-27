import { useEffect, useRef, useState } from "react";
import { Headset, Send, Loader2, X, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Msg = { role: "user" | "assistant"; content: string; ts: number };

const STORAGE_KEY = "nz_support_chat_v1";
const GREETING: Msg = {
  role: "assistant",
  ts: Date.now(),
  content:
    "Привет! 👋 Я — помощник НейроЗачёта. Спросите что угодно о платформе: как решить задачу, чем отличаются режимы, как пополнить баланс, что делать с антиплагиатом. Помогу за пару секунд.",
};

const SUGGESTIONS = [
  "С чего начать?",
  "Как решить задачу с фото?",
  "Чем отличаются режимы Быстро/Стандарт/Премиум?",
  "Как пополнить баланс?",
  "Как сделать антиплагиат?",
  "Как написать курсовую?",
];

function loadHistory(): Msg[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [GREETING];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  return [GREETING];
}

export function SupportChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(() => loadHistory());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {}
  }, [messages]);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
        taRef.current?.focus();
      }, 80);
    }
  }, [open, messages.length, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setError(null);
    const next: Msg[] = [...messages, { role: "user", content: trimmed, ts: Date.now() }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
      const r = await fetch("/api/support/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Ошибка ответа");
      setMessages((cur) => [...cur, { role: "assistant", content: data.reply || "…", ts: Date.now() }]);
    } catch (e: any) {
      setError(e?.message || "Не удалось получить ответ");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setMessages([{ ...GREETING, ts: Date.now() }]);
    setError(null);
  }

  function renderContent(text: string) {
    const parts = text.split(/(\/[a-z][a-z0-9/_-]*)/gi);
    return parts.map((p, i) => {
      if (/^\/[a-z]/i.test(p)) {
        return (
          <a
            key={i}
            href={p}
            onClick={() => setOpen(false)}
            className="text-violet-600 dark:text-violet-300 underline underline-offset-2 hover:text-violet-700"
          >
            {p}
          </a>
        );
      }
      return <span key={i}>{p}</span>;
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Чат поддержки"
        className="fixed z-40 right-4 bottom-[10rem] md:bottom-[5.5rem] w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-blue-500/40 hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
      >
        <Headset className="w-5 h-5 md:w-6 md:h-6" />
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
        </span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 flex flex-col gap-0 h-[100dvh]"
        >
          <SheetHeader className="px-5 pt-5 pb-4 border-b">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shrink-0">
                <Headset className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500 mb-0.5">Поддержка · ИИ</p>
                <SheetTitle className="text-lg leading-tight">Помощник НейроЗачёта</SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground mt-1">
                  Знаю всю платформу. Отвечу за секунды. Если не справлюсь — напишите на support@neurozachet.ru.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    m.role === "user"
                      ? "bg-violet-600 text-white rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  }`}
                >
                  {m.role === "assistant" ? renderContent(m.content) : m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-3.5 py-2.5 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Думаю…
                </div>
              </div>
            )}
            {error && (
              <div className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                {error}
              </div>
            )}
            {messages.length <= 1 && !loading && (
              <div className="pt-2">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Популярные вопросы
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-xs px-3 py-1.5 rounded-full border bg-background hover:bg-violet-50 dark:hover:bg-violet-500/10 hover:border-violet-300 transition-colors text-left"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="border-t p-3 bg-background/95 backdrop-blur">
            <div className="flex items-end gap-2">
              <Textarea
                ref={taRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="Спросите что угодно о платформе…"
                rows={1}
                className="min-h-[44px] max-h-32 resize-none text-sm"
                disabled={loading}
              />
              <Button
                type="button"
                size="icon"
                onClick={() => send(input)}
                disabled={loading || !input.trim()}
                className="h-11 w-11 shrink-0 bg-gradient-to-br from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
            <div className="flex items-center justify-between mt-2 px-1">
              <button
                onClick={reset}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Очистить чат
              </button>
              <span className="text-[10px] text-muted-foreground">Enter — отправить · Shift+Enter — новая строка</span>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
