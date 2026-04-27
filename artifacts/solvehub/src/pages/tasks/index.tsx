import { useState, useMemo } from "react";
import { useListTasks } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  CheckCircle2, Clock, AlertCircle, Search, Filter, ArrowRight, X,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

// Безопасная подсветка совпадений: разбиваем строку на текстовые узлы и <mark>
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-primary/20 text-primary rounded px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export default function TasksPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  const { data, isLoading } = useListTasks({
    status: statusFilter !== "all" ? statusFilter as any : undefined,
    limit: 100,
  });

  const filteredTasks = useMemo(() => {
    if (!data?.tasks) return [];
    if (!searchQuery.trim()) return data.tasks;
    const q = searchQuery.toLowerCase();
    return data.tasks.filter(t =>
      (t.title || "").toLowerCase().includes(q) ||
      (t.subject || "").toLowerCase().includes(q) ||
      (t.description || "").toLowerCase().includes(q)
    );
  }, [data?.tasks, searchQuery]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20"><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Готово</span>;
      case 'processing': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20"><Clock className="w-3.5 h-3.5 mr-1 animate-pulse" /> В процессе</span>;
      case 'pending': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"><Clock className="w-3.5 h-3.5 mr-1" /> В очереди</span>;
      case 'failed': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20"><AlertCircle className="w-3.5 h-3.5 mr-1" /> Ошибка</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Мои задачи</h1>
          <p className="text-muted-foreground mt-1">История всех ваших запросов и их статус.</p>
        </div>
        <Link href="/tasks/new">
          <Button className="gap-2">+ Новая задача</Button>
        </Link>
      </div>

      <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Поиск по названию, предмету..." 
                className="pl-9 pr-9 bg-background/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Очистить поиск"
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="w-full md:w-64 flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  <SelectItem value="completed">Готово</SelectItem>
                  <SelectItem value="processing">В процессе</SelectItem>
                  <SelectItem value="pending">В очереди</SelectItem>
                  <SelectItem value="failed">Ошибка</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {searchQuery && (
            <p className="text-xs text-muted-foreground mb-3">
              Найдено: {filteredTasks.length} задач по запросу «{searchQuery}»
            </p>
          )}

          {/* Desktop: table */}
          <div className="hidden md:block rounded-md border border-white/10 bg-background/30 overflow-x-auto">
            <Table>
              <TableHeader className="bg-white/5">
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead>Предмет</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead className="text-right">Стоимость</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-white/10">
                      <TableCell><div className="h-4 w-12 bg-white/10 rounded animate-pulse"></div></TableCell>
                      <TableCell><div className="h-4 w-48 bg-white/10 rounded animate-pulse"></div></TableCell>
                      <TableCell><div className="h-4 w-24 bg-white/10 rounded animate-pulse"></div></TableCell>
                      <TableCell><div className="h-6 w-20 bg-white/10 rounded-full animate-pulse"></div></TableCell>
                      <TableCell><div className="h-4 w-24 bg-white/10 rounded animate-pulse"></div></TableCell>
                      <TableCell><div className="h-4 w-12 bg-white/10 rounded animate-pulse ml-auto"></div></TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  ))
                ) : filteredTasks.length > 0 ? (
                  filteredTasks.map((task) => (
                    <TableRow key={task.id} className="border-white/10 hover:bg-white/5 transition-colors group cursor-pointer">
                      <TableCell className="font-mono text-xs text-muted-foreground">{task.id.substring(0, 8)}</TableCell>
                      <TableCell className="font-medium">
                        <HighlightedText text={task.title} query={searchQuery} />
                      </TableCell>
                      <TableCell>
                        <span className="bg-white/10 px-2 py-1 rounded text-xs text-white/80">
                          {task.subject}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(task.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(task.createdAt), "d MMM yyyy", { locale: ru })}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {task.actualCost || task.estimatedCost} ₽
                      </TableCell>
                      <TableCell>
                        <Link href={`/tasks/${task.id}`}>
                          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      {searchQuery ? `Ничего не найдено по запросу «${searchQuery}»` : "Задачи не найдены"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: card list */}
          <div className="md:hidden space-y-2.5">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-background/30 p-3.5 space-y-2">
                  <div className="h-4 w-3/4 bg-white/10 rounded animate-pulse" />
                  <div className="flex gap-2">
                    <div className="h-5 w-20 bg-white/10 rounded-full animate-pulse" />
                    <div className="h-5 w-16 bg-white/10 rounded animate-pulse" />
                  </div>
                  <div className="h-3 w-1/2 bg-white/10 rounded animate-pulse" />
                </div>
              ))
            ) : filteredTasks.length > 0 ? (
              filteredTasks.map((task) => (
                <Link key={task.id} href={`/tasks/${task.id}`}>
                  <div className="rounded-xl border border-white/10 bg-background/30 hover:bg-white/5 active:bg-white/10 transition-colors p-3.5 space-y-2 cursor-pointer">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-medium text-sm leading-snug flex-1 min-w-0 break-words">
                        <HighlightedText text={task.title} query={searchQuery} />
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {getStatusBadge(task.status)}
                      <span className="bg-white/10 px-2 py-0.5 rounded text-[11px] text-white/80">
                        {task.subject}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
                      <span>{format(new Date(task.createdAt), "d MMM yyyy", { locale: ru })}</span>
                      <span className="font-medium text-foreground/80">{task.actualCost || task.estimatedCost} ₽</span>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-xl border border-white/10 bg-background/30 p-8 text-center text-sm text-muted-foreground">
                {searchQuery ? `Ничего не найдено по запросу «${searchQuery}»` : "Задачи не найдены"}
              </div>
            )}
          </div>
          
          {data && data.total > filteredTasks.length && !searchQuery && (
            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
              <div>Показано {filteredTasks.length} из {data.total}</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
