import { useEffect, useState } from "react";
import { Link } from "wouter";
import { listSessions, Session } from "@/lib/sessions-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  MessageSquare, Plus, Clock, CheckCircle2, XCircle, Pause,
  BookOpen, BarChart2, Zap, Infinity, Search
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

const STATUS_MAP = {
  active: { label: "Активна", icon: Zap, color: "bg-green-500/10 text-green-400 border-green-500/20" },
  completed: { label: "Завершена", icon: CheckCircle2, color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  expired: { label: "Истекла", icon: XCircle, color: "bg-red-500/10 text-red-400 border-red-500/20" },
  paused: { label: "Приостановлена", icon: Pause, color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
};

const PACKAGE_LABELS: Record<string, string> = {
  hour1:  "1 Час",
  hour3:  "3 Часа",
  hour6:  "6 Часов",
  day1:   "1 День",
  day3:   "3 Дня",
  week1:  "1 Неделя",
  // legacy keys
  mini: "Мини (5 вопр.)",
  homework: "Домашняя работа (10 вопр.)",
  standard: "Стандарт (15 вопр.)",
  test: "Онлайн-тест (30 вопр.)",
  exam: "Подготовка к экзамену (50 вопр.)",
  unlimited: "Безлимит (3 часа)",
};

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    listSessions()
      .then(data => setSessions(data.sessions))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = search
    ? sessions.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.subject.toLowerCase().includes(search.toLowerCase())
      )
    : sessions;

  // Check client-side expiry for sorting
  const isEffectivelyActive = (s: Session) =>
    s.status === "active" && (!s.expires_at || new Date(s.expires_at) >= new Date());

  const active = filtered.filter(isEffectivelyActive);
  const others = filtered.filter(s => !isEffectivelyActive(s));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Сессии</h1>
          <p className="text-muted-foreground mt-1">Режим чата — купите пакет и решайте вопросы по одному.</p>
        </div>
        <Link href="/sessions/new">
          <Button className="flex items-center gap-2 shadow-[0_0_20px_rgba(124,58,237,0.3)]">
            <Plus className="w-4 h-4" />
            Новая сессия
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по названию или предмету..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 bg-background/50 border-white/10"
        />
      </div>

      {/* Explanation banner */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">Как работают сессии?</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Покупаете временной пакет (1ч / 3ч / 6ч / день / 3 дня / неделя) и общаетесь с ИИ в режиме чата — задаёте неограниченное количество вопросов в рамках купленного времени. Идеально для онлайн-тестов, домашних заданий и подготовки к экзаменам.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3 sm:flex-col sm:items-end text-xs text-muted-foreground">
              {[
                { icon: BookOpen, text: "Онлайн-тест из 30 вопросов" },
                { icon: BarChart2, text: "Домашнее задание (10 задач)" },
                { icon: Infinity, text: "Экзаменационная подготовка" },
              ].map(({ icon: Icon, text }, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5 text-primary" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse border-white/10 h-32 bg-white/5" />
          ))}
        </div>
      )}

      {/* Active sessions */}
      {!loading && active.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
            Активные сессии
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {active.map(s => <SessionCard key={s.id} session={s} />)}
          </div>
        </div>
      )}

      {/* Other sessions */}
      {!loading && others.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 text-muted-foreground">Прошлые сессии</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {others.map(s => <SessionCard key={s.id} session={s} />)}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && sessions.length === 0 && (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Сессий пока нет</h3>
          <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
            Начните первую сессию — купите пакет вопросов и решайте тест или домашнюю работу в режиме чата.
          </p>
          <Link href="/sessions/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" /> Начать сессию
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

function SessionCard({ session }: { session: Session }) {
  // Fix lazy-expiry: check client-side if session has expired
  const effectiveStatus = (session.status === "active" && session.expires_at && new Date(session.expires_at) < new Date())
    ? "expired"
    : session.status;
  const statusInfo = STATUS_MAP[effectiveStatus] || STATUS_MAP["expired"];
  const StatusIcon = statusInfo.icon;
  const isUnlimited = session.questions_total >= 9999;
  const progress = isUnlimited ? 0 : (session.questions_used / session.questions_total) * 100;
  const remaining = isUnlimited ? null : session.questions_total - session.questions_used;

  return (
    <Link href={`/sessions/${session.id}`}>
      <Card className="bg-card/40 border-white/10 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer group">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-base truncate group-hover:text-primary transition-colors">
                {session.title}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {session.subject} · {PACKAGE_LABELS[session.package_type] || session.package_type}
              </div>
            </div>
            <Badge className={`shrink-0 border text-xs ${statusInfo.color}`} variant="outline">
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusInfo.label}
            </Badge>
          </div>

          {!isUnlimited && (
            <div className="space-y-1.5 mb-3">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Вопросов использовано</span>
                <span className="font-medium text-foreground">{session.questions_used} / {session.questions_total}</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          )}

          {isUnlimited && session.expires_at && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
              <Clock className="w-3.5 h-3.5" />
              {effectiveStatus === 'active'
                ? `До ${format(new Date(session.expires_at), "d MMM, HH:mm", { locale: ru })}`
                : "Время истекло"}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{format(new Date(session.created_at), "d MMM yyyy, HH:mm", { locale: ru })}</span>
            {effectiveStatus === 'active' && remaining !== null && remaining > 0 && (
              <span className="text-primary font-medium">Осталось: {remaining} вопр.</span>
            )}
            {effectiveStatus === 'active' && isUnlimited && (
              <span className="text-primary font-medium flex items-center gap-1">
                <Infinity className="w-3.5 h-3.5" /> Активен
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
