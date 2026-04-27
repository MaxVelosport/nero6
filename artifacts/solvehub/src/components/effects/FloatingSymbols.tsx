import { useMemo } from "react";
import { motion } from "framer-motion";

const SYMBOLS = [
  "∑", "∫", "π", "√", "∞", "λ", "μ", "Δ", "θ", "φ",
  "α", "β", "γ", "Ω", "ψ", "∂", "≈", "≠", "≤", "≥",
  "x²", "ƒ(x)", "→", "⇌", "C₆H₆", "H₂O", "E=mc²", "{ }", "</>",
  "Δx", "log", "sin", "cos", "lim",
];

type Sym = {
  ch: string;
  left: number;
  top: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  opacity: number;
  hue: number;
};

export function FloatingSymbols({ count = 22, className = "" }: { count?: number; className?: string }) {
  const items = useMemo<Sym[]>(() => {
    const rng = (min: number, max: number) => Math.random() * (max - min) + min;
    return Array.from({ length: count }, () => ({
      ch: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      left: rng(2, 96),
      top: rng(2, 94),
      size: rng(14, 38),
      delay: rng(0, 6),
      duration: rng(9, 18),
      drift: rng(-30, 30),
      opacity: rng(0.06, 0.18),
      hue: rng(250, 290),
    }));
  }, [count]);

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {items.map((s, i) => (
        <motion.span
          key={i}
          className="absolute font-mono font-bold select-none"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            fontSize: s.size,
            color: `hsl(${s.hue} 90% 70%)`,
            opacity: s.opacity,
            textShadow: `0 0 14px hsl(${s.hue} 90% 60% / 0.45)`,
            willChange: "transform, opacity",
          }}
          initial={{ y: 0, x: 0, rotate: 0 }}
          animate={{
            y: [0, -22, 0, 18, 0],
            x: [0, s.drift * 0.4, s.drift, s.drift * 0.4, 0],
            rotate: [0, 6, -4, 3, 0],
            opacity: [s.opacity, s.opacity * 1.6, s.opacity],
          }}
          transition={{
            duration: s.duration,
            delay: s.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {s.ch}
        </motion.span>
      ))}
    </div>
  );
}

export default FloatingSymbols;
