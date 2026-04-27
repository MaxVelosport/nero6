import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, PlusCircle, MessageSquare, User,
  GraduationCap, MoreHorizontal, ClipboardList, FileText,
  ImagePlus, Wallet, X, BookOpen, Brain,
} from "lucide-react";
import { useState } from "react";

const PRIMARY_NAV = [
  { href: "/dashboard", label: "Главная", icon: LayoutDashboard },
  { href: "/tasks/new", label: "Задача", icon: PlusCircle, highlight: true },
  { href: "/sessions/new", label: "Чат", icon: MessageSquare },
  { href: "/profile", label: "Профиль", icon: User },
];

const MORE_ITEMS = [
  { href: "/coursework/new", label: "Курсовая", icon: GraduationCap },
  { href: "/tickets/new", label: "Билеты", icon: ClipboardList },
  { href: "/learn/summary", label: "Конспект", icon: FileText },
  { href: "/quiz", label: "Тренажёр", icon: Brain },
  { href: "/illustrations", label: "Иллюстрации", icon: ImagePlus },
  { href: "/tasks", label: "Мои задачи", icon: BookOpen },
  { href: "/subscriptions", label: "Пополнение", icon: Wallet },
];

interface MobileBottomNavProps {
  hiddenPaths?: string[];
}

export function MobileBottomNav({ hiddenPaths = [] }: MobileBottomNavProps) {
  const [location] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  if (hiddenPaths.some(p => location.startsWith(p))) return null;

  const isActive = (href: string) => {
    if (href === "/dashboard") return location === "/dashboard";
    if (href === "/tasks/new") return location === "/tasks/new";
    return location.startsWith(href) && href !== "/dashboard";
  };

  return (
    <>
      {/* More menu overlay */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* More menu drawer */}
      {moreOpen && (
        <div className="fixed bottom-[4.5rem] left-3 right-3 z-50 bg-card/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-3 md:hidden">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-sm font-semibold text-muted-foreground">Все инструменты</span>
            <button
              onClick={() => setMoreOpen(false)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {MORE_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link key={href} href={href} onClick={() => setMoreOpen(false)}>
                  <button className={`w-full flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl transition-all ${
                    active ? "bg-primary/15 text-primary" : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                  }`}>
                    <Icon className="w-5 h-5" />
                    <span className="text-[11px] font-medium leading-tight text-center">{label}</span>
                  </button>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-sidebar/95 backdrop-blur-xl border-t border-white/10 pb-safe">
        <div className="flex items-stretch h-[4.25rem]">
          {PRIMARY_NAV.map(({ href, label, icon: Icon, highlight }) => {
            const active = isActive(href);
            return (
              <Link key={href} href={href} className="flex-1">
                <button className={`w-full h-full flex flex-col items-center justify-center gap-1 transition-all relative ${
                  active
                    ? "text-primary"
                    : highlight
                    ? "text-primary/70"
                    : "text-muted-foreground/60"
                }`}>
                  {active && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full bg-primary" />
                  )}
                  {highlight && !active ? (
                    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_16px_rgba(139,92,246,0.4)] -mt-3">
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                  ) : (
                    <Icon className={`w-5 h-5 ${active ? "scale-110" : ""} transition-transform`} />
                  )}
                  <span className={`text-[10px] font-medium leading-none ${highlight && !active ? "mt-0.5" : ""}`}>
                    {label}
                  </span>
                </button>
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(v => !v)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all ${
              moreOpen ? "text-primary" : "text-muted-foreground/60"
            }`}
          >
            {moreOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <MoreHorizontal className="w-5 h-5" />
            )}
            <span className="text-[10px] font-medium leading-none">Ещё</span>
          </button>
        </div>
      </nav>
    </>
  );
}
