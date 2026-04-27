/**
 * Проверка наличия всех обязательных переменных окружения.
 * Запускается автоматически при старте API-сервера.
 * При переносе проекта: запусти `node scripts/check-env.mjs` для диагностики.
 */

const REQUIRED_SECRETS = [
  {
    key: "SUPABASE_URL",
    description: "Supabase Project URL",
    where: "Supabase Dashboard → Settings → API → Project URL",
    example: "https://abcdefgh.supabase.co",
    critical: true,
  },
  {
    key: "SUPABASE_ANON_KEY",
    description: "Supabase anon/public key",
    where: "Supabase Dashboard → Settings → API → anon/public",
    example: "eyJhbGci... (длинный JWT)",
    critical: true,
  },
  {
    key: "SUPABASE_SERVICE_KEY",
    description: "Supabase service_role key",
    where: "Supabase Dashboard → Settings → API → service_role",
    example: "eyJhbGci... (длинный JWT)",
    critical: true,
  },
  {
    key: "OPENAI_API_KEY",
    description: "OpenAI — GPT-4o, DALL-E 3, тикеты",
    where: "platform.openai.com → API Keys",
    example: "sk-proj-...",
    critical: true,
  },
  {
    key: "ANTHROPIC_API_KEY",
    description: "Anthropic — Claude 3.5 Sonnet",
    where: "console.anthropic.com → API Keys",
    example: "sk-ant-...",
    critical: true,
  },
  {
    key: "DEEPSEEK_API_KEY",
    description: "DeepSeek — DeepSeek-V3, DeepSeek-R1",
    where: "platform.deepseek.com → API Keys",
    example: "sk-...",
    critical: true,
  },
  {
    key: "OPENROUTER_API_KEY",
    description: "OpenRouter — Gemini 2.0 Flash, Gemini 2.5 Pro",
    where: "openrouter.ai → Keys",
    example: "sk-or-v1-...",
    critical: true,
  },
  {
    key: "XAI_API_KEY",
    description: "xAI — Grok 3",
    where: "console.x.ai → API Keys",
    example: "xai-...",
    critical: true,
  },
  {
    key: "SMTP_INFO_PASS",
    description: "Пароль от info@neurozachet.ru — для приветствий, уведомлений о задачах",
    where: "Beget → Почта → ящик info@neurozachet.ru → изменить → пароль",
    example: "ваш пароль от ящика",
    critical: false,
  },
  {
    key: "SMTP_SUPPORT_PASS",
    description: "Пароль от support@neurozachet.ru — для тикетов и поддержки",
    where: "Beget → Почта → ящик support@neurozachet.ru → изменить → пароль",
    example: "ваш пароль от ящика",
    critical: false,
  },
];

const OPTIONAL_SECRETS = [
  { key: "APP_URL", description: "Публичный URL (по умолч. авто-определяется из REPLIT_DOMAINS)" },
  { key: "APP_NAME", description: "Название приложения (по умолч.: НейроЗачёт)" },
  { key: "EMAIL_FROM", description: "Адрес отправителя email" },
  { key: "SUPPORT_EMAIL", description: "Email поддержки (по умолч.: support@neyrozachet.ru)" },
  { key: "SENTRY_DSN", description: "Sentry DSN для мониторинга backend-ошибок" },
];

function checkSecrets() {
  const missing = [];
  const missingCritical = [];
  const present = [];

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║           НейроЗачёт — Проверка секретов при старте          ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  for (const secret of REQUIRED_SECRETS) {
    const val = process.env[secret.key];
    if (!val) {
      missing.push(secret);
      if (secret.critical) missingCritical.push(secret);
      console.log(`  ❌  ${secret.key.padEnd(22)} — ОТСУТСТВУЕТ`);
    } else {
      present.push(secret);
      const preview = val.length > 12 ? val.slice(0, 8) + "..." + val.slice(-4) : "***";
      console.log(`  ✅  ${secret.key.padEnd(22)} — OK (${preview})`);
    }
  }

  if (missing.length > 0) {
    console.log("\n┌─────────────────────────────────────────────────────────────┐");
    console.log("│  ОТСУТСТВУЮЩИЕ СЕКРЕТЫ — добавь в Replit → Tools → Secrets  │");
    console.log("└─────────────────────────────────────────────────────────────┘");
    for (const s of missing) {
      console.log(`\n  🔑 ${s.key}`);
      console.log(`     Описание : ${s.description}`);
      console.log(`     Где взять: ${s.where}`);
      console.log(`     Пример   : ${s.example}`);
    }
    console.log("");
  }

  if (missingCritical.length > 0) {
    console.log(`\n⚠️  ВНИМАНИЕ: ${missingCritical.length} критических секретов отсутствуют!`);
    console.log("   Часть функционала не будет работать.\n");
  } else {
    console.log("\n✅ Все обязательные секреты установлены. Сервер запускается.\n");
  }

  return { missing, missingCritical, present };
}

const result = checkSecrets();

// При прямом запуске через node — завершаем процесс с ненулевым кодом если есть критические
if (process.argv[1] === new URL(import.meta.url).pathname) {
  process.exit(result.missingCritical.length > 0 ? 1 : 0);
}

export { checkSecrets };
