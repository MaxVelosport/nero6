import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Sparkles, X, Wallet, ArrowUp } from "lucide-react";

const STORAGE_KEY = "nz_zero_balance_hint_dismissed_v1";

interface Props {
  show: boolean;
  isLight?: boolean;
}

/**
 * Anchored speech-bubble onboarding hint shown the first time a user's
 * balance hits 0 after they've actually used the platform. Designed as a
 * floating callout that points up at the "Пополнить" button in the hero.
 */
export function ZeroBalanceHint({ show, isLight }: Props) {
  const [dismissed, setDismissed] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  const visible = show && !dismissed;

  const close = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -16, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95, transition: { duration: 0.18 } }}
          transition={{ type: "spring", stiffness: 360, damping: 26, mass: 0.7 }}
          className="absolute right-3 sm:right-6 top-full mt-3 z-30 w-[min(360px,calc(100vw-2rem))] origin-top-right"
          role="status"
          aria-live="polite"
        >
          {/* Arrow pointing up to the Пополнить button */}
          <motion.div
            className="absolute -top-2 right-10 w-4 h-4 rotate-45 rounded-[3px] border border-primary/30 bg-gradient-to-br from-primary/25 to-violet-600/25 backdrop-blur-xl"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />

          <div
            className={`relative overflow-hidden rounded-2xl border backdrop-blur-xl shadow-2xl ${
              isLight
                ? "border-violet-200/70 bg-white/95 shadow-violet-500/10"
                : "border-primary/25 bg-[#11142080] shadow-primary/20"
            }`}
          >
            {/* Animated glow */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -inset-px rounded-2xl"
              style={{
                background:
                  "conic-gradient(from var(--angle, 0deg) at 50% 50%, transparent 0deg, rgba(139,92,246,.45) 60deg, transparent 120deg, transparent 240deg, rgba(59,130,246,.35) 300deg, transparent 360deg)",
                filter: "blur(14px)",
                opacity: 0.55,
              }}
              animate={{ ["--angle" as any]: ["0deg", "360deg"] }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            />

            <div className={`relative p-4 ${isLight ? "" : "bg-[#0b0e18]/60"} rounded-2xl`}>
              <button
                onClick={close}
                aria-label="Закрыть подсказку"
                className={`absolute top-2.5 right-2.5 p-1 rounded-md transition-colors ${
                  isLight
                    ? "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                    : "text-slate-500 hover:text-white hover:bg-white/10"
                }`}
              >
                <X className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-start gap-3 pr-6">
                <motion.div
                  className="shrink-0 relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center"
                  animate={{ rotate: [0, -6, 6, -3, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 1.2, ease: "easeInOut" }}
                >
                  <Wallet className="w-5 h-5 text-white" />
                  <motion.span
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center shadow-lg shadow-amber-400/50"
                    animate={{ scale: [1, 1.25, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Sparkles className="w-2.5 h-2.5 text-amber-900" />
                  </motion.span>
                </motion.div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ArrowUp className={`w-3.5 h-3.5 ${isLight ? "text-violet-600" : "text-primary"}`} />
                    <h3 className={`text-sm font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>
                      Баланс закончился
                    </h3>
                  </div>
                  <p className={`text-xs leading-relaxed ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                    Пополните счёт, чтобы продолжить решать задачи. От 50 ₽ — оплата картой, СБП или ЮMoney.
                  </p>

                  <div className="mt-3 flex items-center gap-2">
                    <Link href="/profile?tab=billing">
                      <motion.button
                        onClick={close}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-primary to-violet-600 text-white text-xs font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow"
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        Пополнить
                      </motion.button>
                    </Link>
                    <button
                      onClick={close}
                      className={`text-xs ${isLight ? "text-slate-500 hover:text-slate-800" : "text-slate-500 hover:text-slate-300"} transition-colors`}
                    >
                      Позже
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
