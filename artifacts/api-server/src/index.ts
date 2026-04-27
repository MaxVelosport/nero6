import { execSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";
import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "./lib/migrate";
import { initSupabase } from "./lib/supabase";
import { setupErrorMonitor, expressErrorHandler } from "./lib/errorMonitor";

// Проверка секретов при старте — выводит таблицу отсутствующих ключей в консоль
try {
  const checkScript = resolve(process.cwd(), "../../scripts/check-env.mjs");
  if (existsSync(checkScript)) {
    execSync(`node "${checkScript}"`, { stdio: "inherit" });
  }
} catch {
  // Скрипт проверки не критичен — продолжаем запуск
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

setupErrorMonitor(logger);
app.use(expressErrorHandler());

async function pingPostgres() {
  if (!process.env.SUPABASE_DATABASE_URL && !process.env.DATABASE_URL) {
    logger.warn("Postgres URL not configured — Drizzle fallback path will be unavailable");
    return;
  }
  try {
    const { pool } = await import("@workspace/db");
    const r = await pool.query("select 1 as ok");
    logger.info({ ok: r.rows?.[0]?.ok === 1 }, "✅ Postgres pool готов (прямое подключение работает)");
  } catch (err) {
    logger.error({ err }, "❌ Не удалось подключиться к Postgres напрямую — проверьте SUPABASE_DATABASE_URL");
  }
}

async function start() {
  await initSupabase();
  await pingPostgres();

  try {
    await runMigrations();
  } catch (err) {
    logger.error({ err }, "Failed to run migrations — continuing anyway");
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

start();
