import { getSupabaseAdmin } from "./supabase.js";

// ─────────────────────────────────────────────────────────────────────────────
// PRICING DEFAULTS — единственный источник правды по ценам.
// Любое поле может быть переопределено через таблицу Neyrozachet_settings
// (key='pricing', value=JSONB). Оверрайды мерджатся поверх дефолтов.
// ─────────────────────────────────────────────────────────────────────────────

export interface TaskModeConfig {
  costRub: number;
  markup: number;
  minPrice: number;
  minSectionPrice: number;
  perQuestion: number;
  baseTime: number;
}

export interface SessionPackageConfig {
  name: string;
  description: string;
  questions: number;
  price: number;
  pricePerQuestion: number;
  durationHours: number;
  icon: string;
  color: string;
  features: string[];
  bestFor: string;
  recommended?: boolean;
}

export interface PaymentPackageConfig {
  /** Тип: credit — пополняет баланс на credit ₽; subscription — продлевает подписку. */
  type: "credit" | "subscription";
  /** Цена в рублях (списывается с карты). */
  price: number;
  /** Видимый ярлык на UI. */
  label: string;
  /** Короткое описание. */
  description?: string;
  /** Сколько ₽ зачислить на баланс (для type=credit). */
  credit?: number;
  /** Сколько суток действует подписка (для type=subscription). */
  durationDays?: number;
  /** Помечать как «популярный» / «рекомендуем». */
  popular?: boolean;
  /** Скрыт от пользователей (только админы видят). */
  hidden?: boolean;
}

export interface PricingConfig {
  taskModes: Record<string, TaskModeConfig>;
  imageGeneration: { cost: number };
  sessionPackages: Record<string, SessionPackageConfig>;
  sessionModelSurcharges: Record<string, number>;
  sessionAttachmentTiers: { sizeBytes: number; extraCost: number }[];
  coursework: { chapterCosts: Record<string, number>; referencesCost: number; revisionDiscount: number };
  summary: Record<string, { price: number; label: string; description: string }>;
  /** Антиплагиат и уникализация — цены за 1000 символов исходника. */
  uniqueness: {
    checkPer1000: number;     // ₽ за анализ 1000 символов
    rewriteLight: number;     // ₽ за уникализацию 1000 символов (поверхностно)
    rewriteMedium: number;    // ₽ за уникализацию 1000 символов (стандарт)
    rewriteDeep: number;      // ₽ за уникализацию 1000 символов (глубоко)
    minCheck: number;         // минимальная цена анализа
    minRewrite: number;       // минимальная цена уникализации
  };
  payments: Record<string, PaymentPackageConfig>;
}

export const PRICING_DEFAULTS: PricingConfig = {
  taskModes: {
    fast:          { costRub: 0.369,  markup: 1.35, minPrice: 5,  minSectionPrice: 15,  perQuestion: 3,  baseTime: 1 },
    standard:      { costRub: 4.110,  markup: 1.35, minPrice: 15, minSectionPrice: 35,  perQuestion: 6,  baseTime: 2 },
    premium:       { costRub: 8.123,  markup: 1.30, minPrice: 25, minSectionPrice: 59,  perQuestion: 10, baseTime: 4 },
    super_premium: { costRub: 30.614, markup: 1.25, minPrice: 89, minSectionPrice: 139, perQuestion: 29, baseTime: 6 },
  },
  imageGeneration: { cost: 8 },
  sessionPackages: {
    hour1: { name: "1 Час",   description: "Быстрый онлайн-тест или ДЗ за один присест", questions: 9999, price: 59,  pricePerQuestion: 0, durationHours: 1,   icon: "zap",            color: "blue",   features: ["∞ вопросов без лимита", "1 час активной сессии", "История переписки", "Ответ за ~15 сек"],         bestFor: "Онлайн-тест, небольшое ДЗ" },
    hour3: { name: "3 Часа",  description: "Домашнее задание или сдача рубежного контроля", questions: 9999, price: 109, pricePerQuestion: 0, durationHours: 3,   icon: "book",           color: "green",  features: ["∞ вопросов без лимита", "3 часа активной сессии", "Подробные пояснения", "Разбор ошибок"],         bestFor: "Домашнее задание, рубежный контроль" },
    hour6: { name: "6 Часов", description: "Полноценная учёба или экзамен с запасом времени", questions: 9999, price: 179, pricePerQuestion: 0, durationHours: 6,   icon: "check-circle",   color: "violet", features: ["∞ вопросов без лимита", "6 часов активной сессии", "Высокая точность", "Разбор тем целиком"],     bestFor: "Зачёт, коллоквиум, большой тест", recommended: true },
    day1:  { name: "1 День",  description: "Весь день на подготовку или работу", questions: 9999, price: 249, pricePerQuestion: 0, durationHours: 24,  icon: "calendar",       color: "orange", features: ["∞ вопросов без лимита", "24 часа активной сессии", "Можно делать перерывы", "Подготовка к экзамену"], bestFor: "Подготовка к экзамену, ЕГЭ/ОГЭ, вступительные" },
    day3:  { name: "3 Дня",   description: "Три дня на глубокое изучение темы", questions: 9999, price: 369, pricePerQuestion: 0, durationHours: 72,  icon: "graduation-cap", color: "rose",   features: ["∞ вопросов без лимита", "3 дня активной сессии", "Несколько тем подряд", "Идеально для сессии"],   bestFor: "Экзаменационная сессия, курсовой проект" },
    week1: { name: "1 Неделя", description: "Неделя безлимитного доступа — максимум возможностей", questions: 9999, price: 479, pricePerQuestion: 0, durationHours: 168, icon: "infinity",       color: "cyan",   features: ["∞ вопросов без лимита", "7 дней активной сессии", "Несколько предметов", "Полная подготовка"],     bestFor: "Вся сессия, несколько экзаменов, дипломная подготовка" },
  },
  sessionModelSurcharges: {
    "gpt-4o": 40,
    "claude-sonnet": 30,
    "grok": 15,
    "deepseek-v3": 0,
    "gemini-2-flash": 0,
  },
  sessionAttachmentTiers: [
    { sizeBytes: 20 * 1024 * 1024, extraCost: 15 },
    { sizeBytes: 10 * 1024 * 1024, extraCost: 10 },
    { sizeBytes: 5  * 1024 * 1024, extraCost: 5  },
  ],
  coursework: {
    chapterCosts: {
      essay:        25,
      report:       30,
      coursework:   45,
      diploma:      65,
      master:       90,
      phd:          120,
    },
    referencesCost: 15,
    revisionDiscount: 0.7,
  },
  summary: {
    brief:    { price: 5,  label: "Краткий",     description: "Тезисы, формулы, главное" },
    standard: { price: 10, label: "Стандарт",    description: "Структурированный конспект" },
    detailed: { price: 20, label: "Подробный",   description: "С примерами и объяснениями" },
    maximum:  { price: 35, label: "Максимум",    description: "Глубокий разбор + методичка" },
  },
  uniqueness: {
    checkPer1000:  1,    // ₽1 за 1000 символов анализа (DeepSeek дёшев)
    rewriteLight:  3,    // ₽3 за 1000 символов лёгкого рерайта
    rewriteMedium: 5,    // ₽5 — стандарт
    rewriteDeep:   9,    // ₽9 — глубокий рерайт (GPT-4o)
    minCheck:      5,
    minRewrite:    5,
  },
  payments: {
    starter:          { type: "credit",       price: 199, credit: 320,  label: "Стартовый",     description: "Для первого знакомства" },
    pro:              { type: "credit",       price: 399, credit: 720,  label: "Профи",         description: "Для активного студента", popular: true },
    premium:          { type: "credit",       price: 699, credit: 1400, label: "Премиум",       description: "Максимум для сессии" },
    unlimited_month:  { type: "subscription", price: 990, durationDays: 30, label: "Месяц безлимит", description: "30 дней без ограничений: задачи, сессии, курсовые, конспекты — всё бесплатно" },
  },
};

// Прочие настройки, не связанные с ценами:
const SCALAR_DEFAULTS = {
  welcomeBonus: 100,
  verifyBonus: 0,
  maintenanceMode: false,
  announcement: "",
};

let cache: Record<string, any> | null = null;
let cacheAt = 0;
const TTL_MS = 30_000;

export async function getSettings(): Promise<typeof SCALAR_DEFAULTS & { pricing: PricingConfig } & Record<string, any>> {
  const now = Date.now();
  if (cache && now - cacheAt < TTL_MS) return cache as any;
  const sb = getSupabaseAdmin();
  const obj: Record<string, any> = { ...SCALAR_DEFAULTS, pricing: PRICING_DEFAULTS };
  if (sb) {
    try {
      const { data } = await sb.from("Neyrozachet_settings").select("key, value");
      for (const r of data ?? []) {
        if (r.key === "pricing") {
          obj.pricing = mergePricing(PRICING_DEFAULTS, r.value);
        } else {
          obj[r.key] = r.value;
        }
      }
    } catch {
      // table may not exist yet — defaults remain
    }
  }
  cache = obj;
  cacheAt = now;
  return obj as any;
}

/** Глубоко сливает overrides поверх defaults для PricingConfig. */
function mergePricing(defaults: PricingConfig, override: any): PricingConfig {
  if (!override || typeof override !== "object") return defaults;
  const out: any = { ...defaults };
  for (const k of Object.keys(defaults) as (keyof PricingConfig)[]) {
    const ov = override[k];
    const def = (defaults as any)[k];
    if (ov === undefined || ov === null) continue;
    if (Array.isArray(def)) {
      out[k] = Array.isArray(ov) ? ov : def;
    } else if (typeof def === "object") {
      out[k] = { ...def, ...ov };
      // Для вложенных объектов уровня 2 (taskModes.fast и т.п.) тоже мерджим.
      for (const key2 of Object.keys(out[k])) {
        if (def[key2] && typeof def[key2] === "object" && ov[key2] && typeof ov[key2] === "object" && !Array.isArray(def[key2])) {
          out[k][key2] = { ...def[key2], ...ov[key2] };
        }
      }
    } else {
      out[k] = ov;
    }
  }
  return out as PricingConfig;
}

export function invalidateSettingsCache() {
  cache = null;
  cacheAt = 0;
}

export async function getPricing(): Promise<PricingConfig> {
  const s = await getSettings();
  return s.pricing;
}

export async function getWelcomeBonus(): Promise<number> {
  const s = await getSettings();
  const v = parseFloat(String(s.welcomeBonus));
  return isNaN(v) || v < 0 ? 100 : v;
}

export async function getVerifyBonus(): Promise<number> {
  const s = await getSettings();
  const v = parseFloat(String(s.verifyBonus));
  return isNaN(v) || v < 0 ? 0 : v;
}

/** Возвращает только видимые пакеты для пользовательского UI. */
export async function getPublicPaymentPackages(): Promise<Record<string, PaymentPackageConfig>> {
  const pricing = await getPricing();
  const out: Record<string, PaymentPackageConfig> = {};
  for (const [k, v] of Object.entries(pricing.payments)) {
    if (!v.hidden) out[k] = v;
  }
  return out;
}
