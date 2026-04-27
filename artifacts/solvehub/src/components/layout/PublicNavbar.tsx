import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Zap, Menu, X } from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";
import { useState } from "react";

export function PublicNavbar() {
  const { data: user, isLoading } = useGetMe({ query: { retry: false } });
  const [open, setOpen] = useState(false);

  const navLinks = [
    { href: "#demo", label: "Демо" },
    { href: "#how-it-works", label: "Как работает" },
    { href: "#pricing", label: "Тарифы" },
  ];

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-white/10 bg-[#09091a]/95 backdrop-blur-xl">
      <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-[0_0_16px_rgba(139,92,246,0.6)]">
            <Zap className="w-5 h-5 text-white" fill="currentColor" />
          </div>
          <span className="text-lg font-black text-white tracking-tight">НейроЗачёт</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(l => (
            <a key={l.href} href={l.href}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/8 transition-all">
              {l.label}
            </a>
          ))}
          <Link href="/hints"
            className="px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/8 transition-all">
            Подсказки
          </Link>
        </nav>

        {/* Auth */}
        <div className="flex items-center gap-2 shrink-0">
          {!isLoading && user ? (
            <Link href="/dashboard">
              <Button className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 text-white font-bold shadow-[0_0_16px_rgba(139,92,246,0.45)]">
                В кабинет
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" className="hidden sm:inline-flex text-slate-300 hover:text-white hover:bg-white/10 font-semibold">
                  Войти
                </Button>
              </Link>
              <Link href="/register">
                <Button className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 text-white font-bold shadow-[0_0_16px_rgba(139,92,246,0.4)]">
                  Регистрация
                </Button>
              </Link>
            </>
          )}

          {/* Mobile burger */}
          <button className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
            onClick={() => setOpen(v => !v)}>
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-white/10 bg-[#09091a]/98 px-4 py-3 space-y-1">
          {navLinks.map(l => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}
              className="block px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/8">
              {l.label}
            </a>
          ))}
          <Link href="/hints" onClick={() => setOpen(false)}
            className="block px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/8">
            Подсказки
          </Link>
          {!isLoading && !user && (
            <div className="flex gap-2 pt-2 border-t border-white/8">
              <Link href="/login" className="flex-1" onClick={() => setOpen(false)}>
                <Button variant="outline" className="w-full border-white/15 text-slate-300 bg-white/5 font-semibold">Войти</Button>
              </Link>
              <Link href="/register" className="flex-1" onClick={() => setOpen(false)}>
                <Button className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 border-0 text-white font-bold">Регистрация</Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
