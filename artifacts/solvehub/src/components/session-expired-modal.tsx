import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { LogIn, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SessionExpiredModal() {
  const [visible, setVisible] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const handler = () => setVisible(true);
    window.addEventListener("auth:expired", handler);
    return () => window.removeEventListener("auth:expired", handler);
  }, []);

  if (!visible) return null;

  const handleLogin = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authTokenIssuedAt");
    setVisible(false);
    setLocation("/login");
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-white/10 bg-[#1a1030] p-8 text-center shadow-2xl">
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
            <ShieldAlert className="h-8 w-8 text-amber-400" />
          </div>
        </div>
        <h2 className="mb-2 text-xl font-bold text-white">Сессия истекла</h2>
        <p className="mb-6 text-sm leading-relaxed text-purple-200/70">
          Время вашей сессии вышло или она была завершена на другом устройстве. Пожалуйста, войдите снова.
        </p>
        <Button
          onClick={handleLogin}
          className="w-full bg-gradient-to-r from-violet-600 to-purple-700 text-white hover:from-violet-500 hover:to-purple-600"
        >
          <LogIn className="mr-2 h-4 w-4" />
          Войти снова
        </Button>
      </div>
    </div>
  );
}
