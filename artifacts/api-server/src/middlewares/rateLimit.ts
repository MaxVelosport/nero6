import rateLimit from "express-rate-limit";
import type { Request } from "express";

function keyByUserOrIp(req: Request): string {
  const user = (req as any).user;
  if (user?.id) return `u:${user.id}`;
  return `ip:${req.ip || "unknown"}`;
}

const baseHandler = (_req: Request, res: any) => {
  res.status(429).json({
    error: "rate_limited",
    message: "Слишком много запросов. Подождите немного и попробуйте снова.",
  });
};

// Жёсткий лимит на дорогие AI-эндпоинты: 20 запросов в минуту на юзера
export const aiHeavyLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  handler: baseHandler,
});

// Средний лимит: 60 запросов в минуту на юзера
export const aiNormalLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  handler: baseHandler,
});

// Лимит на публичные/auth-эндпоинты (борьба с брутфорсом): 30 за 5 минут на IP
export const authLimiter = rateLimit({
  windowMs: 5 * 60_000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => `ip:${req.ip || "unknown"}`,
  handler: baseHandler,
});
