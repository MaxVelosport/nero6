import { useEffect, useState, useRef } from "react";
import { Sparkles } from "lucide-react";

interface AILoadingStateProps {
  visible: boolean;
  title?: string;
  stages: string[];
  elapsed: number;
  estimated?: number;
  color?: "violet" | "blue" | "amber" | "emerald" | "cyan" | "rose";
}

const COLOR_MAP = {
  violet: {
    orb1: "#7c3aed",
    orb2: "#4f46e5",
    orb3: "#a855f7",
    bar: "from-violet-500 via-purple-500 to-fuchsia-500",
    glow: "rgba(124,58,237,0.15)",
    dot: "bg-violet-400",
    stageBg: "bg-violet-500/10 border-violet-500/20",
    stageText: "text-violet-300",
    iconBg: "from-violet-600 to-purple-700",
  },
  blue: {
    orb1: "#2563eb",
    orb2: "#0891b2",
    orb3: "#3b82f6",
    bar: "from-blue-500 via-cyan-500 to-blue-400",
    glow: "rgba(37,99,235,0.15)",
    dot: "bg-blue-400",
    stageBg: "bg-blue-500/10 border-blue-500/20",
    stageText: "text-blue-300",
    iconBg: "from-blue-600 to-cyan-700",
  },
  amber: {
    orb1: "#d97706",
    orb2: "#ea580c",
    orb3: "#f59e0b",
    bar: "from-amber-500 via-orange-500 to-yellow-400",
    glow: "rgba(217,119,6,0.15)",
    dot: "bg-amber-400",
    stageBg: "bg-amber-500/10 border-amber-500/20",
    stageText: "text-amber-300",
    iconBg: "from-amber-600 to-orange-700",
  },
  emerald: {
    orb1: "#059669",
    orb2: "#0d9488",
    orb3: "#10b981",
    bar: "from-emerald-500 via-teal-500 to-green-400",
    glow: "rgba(5,150,105,0.15)",
    dot: "bg-emerald-400",
    stageBg: "bg-emerald-500/10 border-emerald-500/20",
    stageText: "text-emerald-300",
    iconBg: "from-emerald-600 to-teal-700",
  },
  cyan: {
    orb1: "#0e7490",
    orb2: "#0284c7",
    orb3: "#06b6d4",
    bar: "from-cyan-500 via-blue-500 to-sky-400",
    glow: "rgba(14,116,144,0.15)",
    dot: "bg-cyan-400",
    stageBg: "bg-cyan-500/10 border-cyan-500/20",
    stageText: "text-cyan-300",
    iconBg: "from-cyan-600 to-blue-700",
  },
  rose: {
    orb1: "#e11d48",
    orb2: "#db2777",
    orb3: "#f43f5e",
    bar: "from-rose-500 via-pink-500 to-fuchsia-400",
    glow: "rgba(225,29,72,0.15)",
    dot: "bg-rose-400",
    stageBg: "bg-rose-500/10 border-rose-500/20",
    stageText: "text-rose-300",
    iconBg: "from-rose-600 to-pink-700",
  },
};

function formatTime(secs: number): string {
  if (secs < 60) return `${secs}с`;
  return `${Math.floor(secs / 60)}м ${secs % 60}с`;
}

export function AILoadingState({
  visible,
  title = "ИИ работает над задачей…",
  stages,
  elapsed,
  estimated,
  color = "violet",
}: AILoadingStateProps) {
  const [stageIdx, setStageIdx] = useState(0);
  const [stageVisible, setStageVisible] = useState(true);
  const [dotCount, setDotCount] = useState(1);
  const prevStageRef = useRef(0);

  useEffect(() => {
    if (!visible) {
      setStageIdx(0);
      setStageVisible(true);
      return;
    }
    const interval = setInterval(() => {
      setStageVisible(false);
      setTimeout(() => {
        setStageIdx(i => (i + 1) % stages.length);
        setStageVisible(true);
      }, 400);
    }, 3000);
    return () => clearInterval(interval);
  }, [visible, stages.length]);

  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount(d => (d % 3) + 1);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!visible) prevStageRef.current = 0;
  }, [visible]);

  if (!visible) return null;

  const c = COLOR_MAP[color];
  const progress = estimated && estimated > 0
    ? Math.min(92, (elapsed / estimated) * 100)
    : Math.min(85, elapsed * 1.8);
  const remaining = estimated ? Math.max(0, estimated - elapsed) : null;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/8 bg-background/60 backdrop-blur-sm p-8 flex flex-col items-center text-center gap-6 animate-in fade-in duration-500">

      {/* Animated background orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute rounded-full blur-3xl opacity-20 animate-pulse"
          style={{
            width: 280, height: 280,
            top: "-60px", left: "10%",
            background: c.orb1,
            animationDuration: "3s",
          }}
        />
        <div
          className="absolute rounded-full blur-3xl opacity-15"
          style={{
            width: 200, height: 200,
            bottom: "-40px", right: "5%",
            background: c.orb2,
            animation: "pulse 4s ease-in-out infinite 1s",
          }}
        />
        <div
          className="absolute rounded-full blur-2xl opacity-10"
          style={{
            width: 120, height: 120,
            top: "40%", right: "20%",
            background: c.orb3,
            animation: "pulse 2.5s ease-in-out infinite 0.5s",
          }}
        />
      </div>

      {/* Icon */}
      <div className="relative z-10">
        <div
          className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${c.iconBg} flex items-center justify-center shadow-2xl`}
          style={{ boxShadow: `0 0 40px ${c.glow}` }}
        >
          <Sparkles className="w-7 h-7 text-white" style={{ animation: "spin 4s linear infinite" }} />
        </div>

        {/* Pulsing ring */}
        <div
          className="absolute inset-0 rounded-2xl animate-ping opacity-20"
          style={{ background: c.orb1, animationDuration: "2s" }}
        />
      </div>

      {/* Title */}
      <div className="relative z-10 space-y-1">
        <h3 className="text-lg font-bold text-foreground tracking-tight">
          {title}
          <span className="inline-block w-6 text-left">
            {".".repeat(dotCount)}
          </span>
        </h3>

        {/* Stage message */}
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm ${c.stageBg} ${c.stageText} transition-opacity duration-400`}
          style={{ opacity: stageVisible ? 1 : 0 }}
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${c.dot}`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${c.dot}`} />
          </span>
          {stages[stageIdx]}
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative z-10 w-full max-w-sm space-y-2">
        <div className="w-full bg-white/6 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${c.bar} rounded-full transition-all duration-1000 ease-out relative overflow-hidden`}
            style={{ width: `${progress}%` }}
          >
            {/* Shimmer effect */}
            <div
              className="absolute inset-0 opacity-60"
              style={{
                background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
                animation: "shimmer 1.5s ease-in-out infinite",
              }}
            />
          </div>
        </div>

        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatTime(elapsed)} прошло</span>
          {remaining !== null && remaining > 0 && (
            <span>~{formatTime(remaining)} осталось</span>
          )}
          {remaining === null && estimated && (
            <span>~{formatTime(estimated)} всего</span>
          )}
        </div>
      </div>

      {/* Shimmer keyframe */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
