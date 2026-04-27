import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useGetMe } from "@workspace/api-client-react";
import {
  Zap, LayoutDashboard, Lightbulb, ArrowRight,
  ChevronLeft, Home, Menu, X
} from "lucide-react";
import { useState } from "react";

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: user, isLoading } = useGetMe({ query: { retry: false } });
  const [mobileOpen, setMobileOpen] = useState(false);

  const isHints = location.startsWith("/hints");
  const homeHref = user ? "/dashboard" : "/";

  return (
    <div className="min-h-screen bg-[#09091a] text-white relative">

      {/* Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
        <div className="absolute top-0 left-[20%] w-[500px] h-[300px] rounded-full bg-violet-700/12 blur-[120px]" />
      </div>

      {/* ─── NAVBAR ─── */}
      <header className="fixed top-0 inset-x-0 h-14 border-b border-white/10 bg-[#09091a]/90 backdrop-blur-xl z-50">
        <div className="container h-full mx-auto px-4 md:px-6 flex items-center justify-between gap-4">

          {/* Left: back + logo + nav */}
          <div className="flex items-center gap-1 min-w-0">

            {/* ← На главную / В кабинет */}
            <Link href={homeHref}>
              <button className="flex items-center gap-1 text-sm font-semibold text-slate-300 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-white/8 shrink-0">
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">{user ? "В кабинет" : "На главную"}</span>
                <span className="sm:hidden">Назад</span>
              </button>
            </Link>

            <div className="w-px h-5 bg-white/15 mx-1 shrink-0" />

            {/* Logo */}
            <Link href={homeHref} className="flex items-center gap-2 font-black text-white tracking-tight shrink-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-[0_0_14px_rgba(139,92,246,0.5)]">
                <Zap className="w-4 h-4 text-white" fill="currentColor" />
              </div>
              <span className="hidden sm:inline">НейроЗачёт</span>
            </Link>

            {/* Desktop section tabs */}
            <nav className="hidden md:flex items-center gap-1 ml-3">
              <Link href="/hints">
                <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  isHints
                    ? "bg-violet-500/20 text-violet-200 border border-violet-500/30"
                    : "text-slate-400 hover:text-white hover:bg-white/8"
                }`}>
                  <Lightbulb className="w-3.5 h-3.5" /> Подсказки
                </button>
              </Link>
            </nav>
          </div>

          {/* Right: auth */}
          <div className="flex items-center gap-2 shrink-0">
            {!isLoading && user ? (
              <Link href="/dashboard">
                <Button size="sm" className="gap-1.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 border-0 text-white font-bold shadow-[0_0_14px_rgba(139,92,246,0.35)]">
                  <LayoutDashboard className="w-3.5 h-3.5" /> Кабинет
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="hidden sm:inline-flex text-slate-300 hover:text-white hover:bg-white/10">
                    Войти
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 text-white font-bold shadow-[0_0_14px_rgba(139,92,246,0.35)] gap-1.5">
                    Начать <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </>
            )}

            {/* Mobile menu toggle */}
            <button
              className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
              onClick={() => setMobileOpen(v => !v)}
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="md:hidden border-t border-white/10 bg-[#09091a]/98 backdrop-blur-xl px-4 py-3 space-y-1">
            <Link href={homeHref} onClick={() => setMobileOpen(false)}>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/8">
                <Home className="w-4 h-4" /> {user ? "В кабинет" : "На главную"}
              </div>
            </Link>
            <Link href="/hints" onClick={() => setMobileOpen(false)}>
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                isHints ? "bg-violet-500/20 text-violet-200" : "text-slate-300 hover:text-white hover:bg-white/8"
              }`}>
                <Lightbulb className="w-4 h-4" /> Подсказки
              </div>
            </Link>
            {!isLoading && !user && (
              <div className="pt-1 border-t border-white/8 flex gap-2 mt-1">
                <Link href="/login" className="flex-1" onClick={() => setMobileOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full border-white/15 text-slate-300 bg-white/5">Войти</Button>
                </Link>
                <Link href="/register" className="flex-1" onClick={() => setMobileOpen(false)}>
                  <Button size="sm" className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 border-0 text-white font-bold">Начать</Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Breadcrumb strip */}
      <div className="fixed top-14 inset-x-0 z-40 border-b border-white/6 bg-[#09091a]/70 backdrop-blur-md">
        <div className="container mx-auto px-4 md:px-6 py-2 flex items-center gap-2 text-xs text-slate-400">
          <Link href={homeHref} className="hover:text-white transition-colors flex items-center gap-1">
            <Home className="w-3 h-3" /> {user ? "Кабинет" : "Главная"}
          </Link>
          <span className="text-white/20">/</span>
          <span className={isHints ? "text-violet-300 font-semibold" : "text-slate-300"}>
            {isHints ? "Подсказки" : "Раздел"}
          </span>
        </div>
      </div>

      {/* Content — offset for both navbar (56px) + breadcrumb (~33px) */}
      <main className="relative z-10 pt-[89px] min-h-screen">
        <div key={location} className="container mx-auto px-4 md:px-6 py-8 max-w-6xl animate-fade-in">
          {children}
        </div>
      </main>

      {/* CTA Banner for guests */}
      {!isLoading && !user && (
        <div className="relative z-10 border-t border-violet-500/20 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10">
          <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-slate-300">
              <span className="text-violet-300 font-bold">НейроЗачёт</span> — зарегистрируйтесь и получите <span className="text-white font-bold">100 ₽</span> на баланс.
            </p>
            <Link href="/register">
              <Button size="sm" className="shrink-0 bg-gradient-to-r from-violet-600 to-fuchsia-600 border-0 text-white font-bold shadow-[0_0_14px_rgba(139,92,246,0.4)]">
                Начать бесплатно <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
