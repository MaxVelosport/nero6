import { logger } from "./logger";
import { getSupabaseAdmin } from "./supabase.js";

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS "Neyrozachet_users" (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    education_level TEXT DEFAULT 'bachelor',
    institution TEXT,
    specialty TEXT,
    balance REAL NOT NULL DEFAULT 0,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    reset_token TEXT,
    reset_token_expires_at TIMESTAMP,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    referral_code TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS "Neyrozachet_transactions" (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES "Neyrozachet_users"(id),
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS "Neyrozachet_tasks" (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES "Neyrozachet_users"(id),
    title TEXT NOT NULL,
    description TEXT,
    subject TEXT NOT NULL,
    task_type TEXT NOT NULL DEFAULT 'homework',
    education_level TEXT,
    solving_mode TEXT NOT NULL DEFAULT 'standard',
    status TEXT NOT NULL DEFAULT 'pending',
    complexity_score REAL,
    estimated_cost REAL NOT NULL DEFAULT 0,
    actual_cost REAL,
    estimated_time INTEGER,
    result TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Neyrozachet_tokens" (
    id SERIAL PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES "Neyrozachet_users"(id),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS "Neyrozachet_sessions" (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES "Neyrozachet_users"(id),
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    purpose TEXT NOT NULL DEFAULT 'general',
    package_type TEXT NOT NULL DEFAULT 'standard',
    model_id TEXT NOT NULL DEFAULT 'gemini-2-flash',
    status TEXT NOT NULL DEFAULT 'active',
    questions_used INTEGER NOT NULL DEFAULT 0,
    questions_total INTEGER NOT NULL DEFAULT 10,
    total_cost REAL NOT NULL DEFAULT 0,
    expires_at TIMESTAMP,
    context TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS "Neyrozachet_messages" (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES "Neyrozachet_sessions"(id),
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    question_number INTEGER,
    attachment_data TEXT,
    attachment_name TEXT,
    attachment_type TEXT,
    processing_time_ms INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS "Neyrozachet_referrals" (
    id SERIAL PRIMARY KEY,
    referrer_id INTEGER NOT NULL REFERENCES "Neyrozachet_users"(id),
    referred_id INTEGER NOT NULL REFERENCES "Neyrozachet_users"(id),
    reward_given BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS "Neyrozachet_promo_codes" (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    amount REAL NOT NULL,
    max_uses INTEGER NOT NULL DEFAULT 100,
    uses_count INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    expires_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS "Neyrozachet_promo_redemptions" (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES "Neyrozachet_users"(id),
    promo_id INTEGER NOT NULL REFERENCES "Neyrozachet_promo_codes"(id),
    amount REAL NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, promo_id)
  )`,
];

async function runMigrationsViaPool(): Promise<void> {
  const { pool } = await import("@workspace/db");
  const client = await pool.connect();
  try {
    for (const sql of MIGRATIONS) {
      await client.query(sql);
    }
  } finally {
    client.release();
  }
}

const SUPABASE_COLUMN_CHECKS: Array<{ table: string; column: string; fix: string }> = [
  {
    table: "Neyrozachet_users",
    column: "email_verification_token",
    fix: `ALTER TABLE "Neyrozachet_users" ADD COLUMN IF NOT EXISTS email_verification_token TEXT, ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ;`,
  },
  {
    table: "Neyrozachet_transactions",
    column: "external_payment_id",
    fix: `-- 1. Колонка для идемпотентности платежей ЮKassa
ALTER TABLE "Neyrozachet_transactions" ADD COLUMN IF NOT EXISTS external_payment_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS neyrozachet_transactions_external_payment_id_uniq
  ON "Neyrozachet_transactions" (external_payment_id)
  WHERE external_payment_id IS NOT NULL;

-- 2. Атомарная функция зачисления платежа: одна транзакция,
--    защита от двойного зачисления через UNIQUE-индекс выше.
CREATE OR REPLACE FUNCTION credit_yookassa_payment(
  p_user_id BIGINT,
  p_amount NUMERIC,
  p_description TEXT,
  p_external_id TEXT
) RETURNS TABLE(applied BOOLEAN, new_balance NUMERIC) AS $$
DECLARE
  v_inserted INT;
  v_balance NUMERIC;
BEGIN
  INSERT INTO "Neyrozachet_transactions" (user_id, type, amount, description, external_payment_id)
  VALUES (p_user_id, 'topup', p_amount, p_description, p_external_id)
  ON CONFLICT (external_payment_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    SELECT balance INTO v_balance FROM "Neyrozachet_users" WHERE id = p_user_id;
    RETURN QUERY SELECT FALSE, v_balance;
    RETURN;
  END IF;

  UPDATE "Neyrozachet_users" SET balance = COALESCE(balance, 0) + p_amount
   WHERE id = p_user_id RETURNING balance INTO v_balance;

  RETURN QUERY SELECT TRUE, v_balance;
END;
$$ LANGUAGE plpgsql;`,
  },
  {
    table: "Neyrozachet_settings",
    column: "key",
    fix: `CREATE TABLE IF NOT EXISTS "Neyrozachet_settings" (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`,
  },
  {
    table: "Neyrozachet_users",
    column: "subscription_until",
    fix: `-- Колонка для подписки «Месяц безлимит»
ALTER TABLE "Neyrozachet_users" ADD COLUMN IF NOT EXISTS subscription_until TIMESTAMPTZ;`,
  },
];

async function checkSupabaseSchema(): Promise<void> {
  const supabase = getSupabaseAdmin()!;
  const missing: string[] = [];
  for (const check of SUPABASE_COLUMN_CHECKS) {
    const { error } = await supabase.from(check.table).select(check.column).limit(1);
    if (error && error.message.includes("does not exist")) {
      missing.push(check.fix);
    }
  }
  if (missing.length > 0) {
    logger.error(
      "⚠️  ТРЕБУЕТСЯ МИГРАЦИЯ БАЗЫ ДАННЫХ. Выполните в Supabase SQL Editor:\n\n" +
      missing.join("\n\n") +
      "\n\nПерейдите: https://supabase.com/dashboard → SQL Editor"
    );
  } else {
    logger.info("✅ Схема Supabase актуальна, миграции не требуются");
  }
}

export async function runMigrations(): Promise<void> {
  logger.info("Running database migrations...");

  const supabase = getSupabaseAdmin();
  if (supabase) {
    logger.info("Supabase configured — проверяю схему...");
    await checkSupabaseSchema();
    return;
  }

  try {
    await runMigrationsViaPool();
    logger.info("Database migrations completed (pg pool)");
  } catch (err) {
    logger.error({ err }, "Migration failed");
    throw err;
  }
}
