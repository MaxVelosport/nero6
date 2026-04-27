import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { OnboardingModal } from "@/components/OnboardingModal";
import {
  LayoutDashboard,
  ListTodo,
  PlusCircle,
  User as UserIcon,
  LogOut,
  Menu,
  Zap,
  BookOpen,
  Lightbulb,
  MessageSquare,
  GraduationCap,
  Sun,
  Moon,
  ShieldCheck,
  ClipboardList,
  FileText,
  Wallet,
  ImagePlus,
  BarChart3,
  Brain,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useTheme, LIGHT_VARS } from "@/lib/theme";
import { MobileBottomNav } from "./MobileBottomNav";
import { HelpButton } from "@/components/HelpButton";
import { SupportChat } from "@/components/SupportChat";

const navItems = [
  { href: "/dashboard",      label: "Обзор",          sub: "Главная страница",           icon: LayoutDashboard },
  { href: "/statistics",     label: "Статистика",     sub: "Графики и достижения",       icon: BarChart3 },
  { href: "/tasks",          label: "Мои задачи",     sub: "История решений",            icon: ListTodo },
  { href: "/tasks/new",      label: "Новая задача",   sub: "Отправить задание ИИ",       icon: PlusCircle, highlight: true },
  { href: "/coursework/new", label: "Научные работы", sub: "Курсовая, диплом, реферат",  icon: GraduationCap },
  { href: "/tickets/new",    label: "Билеты к экзамену", sub: "Учебник → ответы на билеты", icon: ClipboardList },
  { href: "/learn/summary",  label: "Конспект темы",   sub: "Быстрый структурный конспект", icon: FileText },
  { href: "/quiz",           label: "Тренажёр-тесты",  sub: "Тест по теме с автопроверкой", icon: Brain },
  { href: "/uniqueness",     label: "Антиплагиат",    sub: "Проверка и уникализация",    icon: ShieldCheck },
  { href: "/illustrations",  label: "Иллюстрации",    sub: "ГОСТ-рисунки для работ",     icon: ImagePlus },
  { href: "/sessions",       label: "Чат с ИИ",       sub: "Вопросы и объяснения",       icon: MessageSquare },
  { href: "/hints",          label: "Подсказки",       sub: "Советы и примеры",           icon: Lightbulb },
  { href: "/subscriptions",  label: "Пополнение",      sub: "Пакеты с бонусом до +100%",  icon: Wallet },
  { href: "/profile",        label: "Профиль",         sub: "Аккаунт и баланс",           icon: UserIcon },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const hasToken = Boolean(localStorage.getItem("authToken"));
  const { data: user, isLoading, error } = useGetMe({ query: { retry: 1, retryDelay: 800, enabled: hasToken } });
  const logoutMutation = useLogout();
  const { theme, toggle } = useTheme();

  const isLight = theme === "light";

  // Apply light-mode CSS vars to the root div; sidebar vars are excluded so sidebar stays dark.
  const themeStyle = isLight
    ? (LIGHT_VARS as React.CSSProperties)
    : {};

  useEffect(() => {
    if (!hasToken) {
      setLocation("/login");
      return;
    }
    if (!isLoading && error) {
      const status = (error as any)?.status;
      if (status === 401) {
        window.dispatchEvent(new CustomEvent("auth:expired"));
      } else {
        localStorage.removeItem("authToken");
        localStorage.removeItem("authTokenIssuedAt");
        setLocation("/login");
      }
    }
  }, [hasToken, isLoading, error, setLocation]);

  if (!hasToken || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return null;

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        localStorage.removeItem("authToken");
        setLocation("/");
      },
    });
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border relative overflow-hidden">
      <div className="absolute bottom-0 left-[-20%] w-[140%] h-[30%] rounded-full bg-primary/4 blur-3xl pointer-events-none" />

      {/* Logo */}
      <div className="p-5 pb-4 relative">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Zap className="w-4.5 h-4.5 text-white" fill="white" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-white">НейроЗачёт</span>
            <p className="text-[10px] text-sidebar-foreground/35 leading-none mt-0.5">ИИ-помощник студента</p>
          </div>
        </Link>
        <div className="absolute bottom-0 left-5 right-5 h-[1px] bg-gradient-to-r from-transparent via-white/8 to-transparent" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {[
          ...navItems,
          ...((user as any).isAdmin ? [{ href: "/admin", label: "Администратор", sub: "Панель управления", icon: ShieldCheck }] : []),
        ].map((item) => {
          const isActive =
            location === item.href ||
            (item.href !== "/dashboard" && item.href !== "/tasks/new" && location.startsWith(item.href)) ||
            (item.href === "/tasks/new" && location === "/tasks/new");

          return (
            <Link key={item.href} href={item.href}>
              <button
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group relative ${
                  isActive
                    ? "bg-primary/15 text-white border border-primary/30"
                    : "text-sidebar-foreground/55 hover:text-white hover:bg-white/5"
                } ${"highlight" in item && item.highlight && !isActive ? "border border-primary/20 bg-primary/5 text-primary/80 hover:text-primary hover:bg-primary/10" : ""}`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
                )}
                <item.icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? "text-primary" : "highlight" in item && item.highlight ? "text-primary/70" : "group-hover:text-white/80"}`} />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium leading-tight ${isActive ? "text-white" : ""}`}>{item.label}</div>
                  <div className="text-[10px] text-sidebar-foreground/30 leading-tight mt-0.5 group-hover:text-sidebar-foreground/50 transition-colors">{item.sub}</div>
                </div>
              </button>
            </Link>
          );
        })}
      </nav>

      {/* Theme toggle */}
      <div className="px-3 pb-1">
        <button
          onClick={toggle}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground/50 hover:text-white hover:bg-white/5 transition-all group"
          title={isLight ? "Переключить на тёмную тему" : "Переключить на светлую тему"}
        >
          <div className="relative w-8 h-4.5 rounded-full border border-white/20 bg-white/5 flex items-center px-0.5 transition-colors group-hover:border-primary/40">
            <div className={`w-3.5 h-3.5 rounded-full bg-primary transition-transform duration-300 ${isLight ? "translate-x-3.5" : "translate-x-0"}`} />
          </div>
          <div className="flex items-center gap-1.5">
            {isLight
              ? <><Moon className="w-3.5 h-3.5" /><span className="text-sm font-medium">Тёмная тема</span></>
              : <><Sun className="w-3.5 h-3.5" /><span className="text-sm font-medium">Светлая тема</span></>
            }
          </div>
        </button>
      </div>

      {/* User */}
      <div className="p-3 relative">
        <div className="absolute top-0 left-3 right-3 h-[1px] bg-gradient-to-r from-transparent via-white/8 to-transparent" />
        <Link href="/profile">
          <div className="flex items-center gap-3 mb-1.5 px-2 py-2.5 rounded-xl hover:bg-white/5 cursor-pointer transition-colors group">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/60 to-primary flex items-center justify-center text-white font-bold text-sm shrink-0 group-hover:scale-105 transition-transform">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user.name}</p>
              <p className="text-xs text-emerald-400/80 truncate font-medium">{user.balance} ₽ на балансе</p>
            </div>
          </div>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-400/60 hover:text-red-400 hover:bg-red-500/8 transition-all"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Выйти
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex" style={themeStyle}>
      {/* Desktop Sidebar — always dark, no themeStyle here */}
      <div className="hidden md:block w-60 fixed inset-y-0 z-50">
        <SidebarContent />
      </div>

      {/* Mobile Header & Main Content */}
      <div className="flex-1 md:pl-60 flex flex-col min-h-screen relative">
        {/* Ambient glows */}
        <div className={`fixed top-0 right-0 w-[600px] h-[400px] rounded-full ${isLight ? "bg-primary/4" : "bg-primary/3"} blur-[120px] pointer-events-none -z-0`} />
        <div className={`fixed bottom-0 left-[240px] w-[400px] h-[300px] rounded-full ${isLight ? "bg-blue-400/5" : "bg-blue-600/3"} blur-[100px] pointer-events-none -z-0`} />

        {/* Mobile header */}
        <header className="md:hidden h-14 border-b border-border/50 flex items-center justify-between px-4 bg-background/90 backdrop-blur-md sticky top-0 z-40">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" fill="white" />
            </div>
            <span className={`text-base font-bold ${isLight ? "text-foreground" : "text-white"}`}>НейроЗачёт</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title={isLight ? "Тёмная тема" : "Светлая тема"}
            >
              {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-60 bg-sidebar border-r-sidebar-border">
                <SidebarContent />
              </SheetContent>
            </Sheet>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 relative z-10">
          <div key={location} className="animate-fade-in">
            {children}
          </div>
        </main>

        <footer className="relative z-10 border-t border-border/30 bg-card/20 px-4 py-4 md:py-5 mb-20 md:mb-0">
          <div className="max-w-5xl mx-auto flex flex-col gap-2 text-[11px] text-muted-foreground">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <a href="/offer" className="hover:text-foreground transition-colors">Договор-оферта</a>
              <a href="/privacy" className="hover:text-foreground transition-colors">Конфиденциальность</a>
              <a href="/refund" className="hover:text-foreground transition-colors">Возврат</a>
              <a href="/refund-request" className="hover:text-foreground transition-colors">Заявка на возврат</a>
              <a href="mailto:support@neurozachet.ru" className="hover:text-foreground transition-colors">support@neurozachet.ru</a>
            </div>
            <div className="text-[10px] text-muted-foreground/70 leading-relaxed">
              Самозанятый Горбацевич М.Д., ИНН 590612402300. Применяется НПД (422-ФЗ). Сервис носит информационный характер; ИИ может ошибаться — ответственность за использование результатов несёт пользователь.
            </div>
          </div>
        </footer>
      </div>
      <OnboardingModal />
      <MobileBottomNav hiddenPaths={["/sessions/"]} />
      <HelpButton />
      <SupportChat />
    </div>
  );
}
