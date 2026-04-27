import { Link } from "wouter";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground px-4">
      <div className="text-center max-w-sm">
        <div className="text-8xl font-black text-primary/20 mb-4 leading-none">404</div>
        <h1 className="text-2xl font-bold mb-2">Страница не найдена</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Такой страницы не существует. Возможно, ссылка устарела или содержит ошибку.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            <Home className="w-4 h-4" /> На главную
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/15 bg-white/5 text-sm font-medium hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Назад
          </button>
        </div>
      </div>
    </div>
  );
}
