import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Brain, ArrowLeft, FileText, CheckCircle2, AlertCircle, Clock, Copy, Download } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { RenderMessage } from "@/lib/render-message";

export default function SharedTaskPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { toast } = useToast();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/tasks/shared/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => setTask(data))
      .catch(e => { if (e === 404) setNotFound(true); })
      .finally(() => setLoading(false));
  }, [id]);

  const handleCopy = () => {
    if (task?.result) {
      navigator.clipboard.writeText(task.result);
      toast({ title: "Скопировано" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

  if (notFound || !task) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-center px-4">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Задача не найдена</h1>
        <p className="text-muted-foreground">Возможно, ссылка устарела или задача была удалена.</p>
        <Link href="/"><Button variant="outline">На главную</Button></Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-xl bg-primary flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-foreground text-sm hidden sm:block">НейроЗачёт</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 border-border/50">
              <Copy className="w-3.5 h-3.5" /> Копировать
            </Button>
            <Link href="/register">
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-white text-xs gap-1.5">
                Попробовать бесплатно
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
              {task.subject}
            </span>
            {task.status === "completed" && (
              <span className="text-xs flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" /> Выполнено
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{task.title}</h1>
          {task.createdAt && (
            <p className="text-sm text-muted-foreground">
              Решено {format(new Date(task.createdAt), "d MMMM yyyy", { locale: ru })}
            </p>
          )}
        </div>

        {/* Description */}
        {task.description && (
          <div className="rounded-2xl border border-border/50 bg-card/40 p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Условие</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{task.description}</p>
          </div>
        )}

        {/* Result */}
        {task.result && (
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-b from-card/80 to-card/40 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Решение ИИ</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleCopy} className="text-muted-foreground hover:text-foreground gap-1.5">
                <Copy className="w-3.5 h-3.5" /> Копировать
              </Button>
            </div>
            <div className="p-4 bg-black/20 rounded-xl border border-white/5">
              <RenderMessage content={task.result} />
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="rounded-2xl border border-border/50 bg-card/40 p-6 text-center space-y-3">
          <p className="text-sm font-semibold text-foreground">Нужно решить свою задачу?</p>
          <p className="text-xs text-muted-foreground">НейроЗачёт — ИИ-помощник для студентов. Задачи, курсовые, экзаменационные билеты.</p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/register">
              <Button className="bg-primary hover:bg-primary/90 text-white">Начать бесплатно</Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="border-border/50">Узнать больше</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
