import { Router } from "express";
import { getSupabaseAdmin } from "../lib/supabase.js";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { hashPassword, verifyPassword, generateToken, hashToken } from "../lib/crypto";
import { storeToken, revokeToken, extractToken, requireAuth } from "../lib/auth";
import { sendPasswordResetEmail, sendWelcomeEmail, sendEmailVerificationEmail } from "../lib/email";
import { getWelcomeBonus, getVerifyBonus } from "../lib/settings.js";

const router = Router();

const TERMS_VERSION = "2026-05-06";

// ── IP Rate limiting для регистрации ──────────────────────────────────────────
const regAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_REG_PER_HOUR = 3;

function checkRegRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = regAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    regAttempts.set(ip, { count: 1, resetAt: now + 3_600_000 });
    return true;
  }
  if (entry.count >= MAX_REG_PER_HOUR) return false;
  entry.count++;
  return true;
}

// Resend rate limiting: не чаще 1 раза в 2 мин
const resendAttempts = new Map<number, number>();

// Login brute-force protection: 8 попыток / 15 минут, отдельно по IP и по email
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_LOGIN_ATTEMPTS = 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
function checkLoginRateLimit(key: string): boolean {
  const now = Date.now();
  const e = loginAttempts.get(key);
  if (!e || now > e.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return true;
  }
  if (e.count >= MAX_LOGIN_ATTEMPTS) return false;
  e.count++;
  return true;
}
function resetLoginRateLimit(key: string) { loginAttempts.delete(key); }

async function getPool() {
  const { pool } = await import("@workspace/db");
  return pool;
}

// ── Регистрация ────────────────────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const ip = (req.ip || req.socket?.remoteAddress || "unknown").replace("::ffff:", "");
    if (!checkRegRateLimit(ip)) {
      res.status(429).json({ error: "rate_limited", message: "Слишком много попыток регистрации. Попробуйте через час." });
      return;
    }

    const parsed = RegisterBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_error", message: "Invalid request data" });
      return;
    }

    const { name, email, password, educationLevel } = parsed.data;
    const sb = getSupabaseAdmin();

    const verifyToken = generateToken();
    const verifyTokenHash = hashToken(verifyToken);
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const welcomeBonus = await getWelcomeBonus();

    if (sb) {
      const { data: existing } = await sb.from("Neyrozachet_users").select("id").eq("email", email).single();
      if (existing) {
        res.status(409).json({ error: "conflict", message: "User with this email already exists" });
        return;
      }

      const passwordHash = hashPassword(password);
      const myCode = "NZ-" + Math.random().toString(36).substring(2, 10).toUpperCase();
      const { data: user, error } = await sb.from("Neyrozachet_users").insert({
        name, email, password_hash: passwordHash,
        education_level: educationLevel || "bachelor",
        balance: welcomeBonus,
        referral_code: myCode,
        email_verification_token: verifyTokenHash,
        email_verification_expires_at: verifyExpires,
      }).select().single();

      if (error || !user) {
        req.log.error({ error }, "Register insert error");
        res.status(500).json({ error: "internal_error", message: "Failed to create user" });
        return;
      }

      // Записываем факт согласия с документами (152-ФЗ).
      // Выполняется отдельным UPDATE — если колонки ещё не мигрированы,
      // ошибка подавляется и регистрация проходит без потери данных.
      const consentAt = new Date().toISOString();
      await sb.from("Neyrozachet_users").update({
        terms_accepted_at: consentAt,
        first_terms_accepted_at: consentAt,
        terms_version: TERMS_VERSION,
        consent_ip: ip,
      }).eq("id", user.id).then(({ error: ce }) => {
        if (ce) req.log.warn({ ce }, "consent columns not yet migrated — skipped");
      });

      if (welcomeBonus > 0) {
        await sb.from("Neyrozachet_transactions").insert({
          user_id: user.id, type: "topup", amount: welcomeBonus,
          description: "Приветственный бонус",
        });
      }

      const referralCodeInBody = typeof req.body.referralCode === "string" ? req.body.referralCode.trim() : null;
      if (referralCodeInBody) {
        try {
          const { data: referrer } = await sb.from("Neyrozachet_users").select("id, balance").eq("referral_code", referralCodeInBody).single();
          if (referrer) {
            await sb.from("Neyrozachet_referrals").insert({ referrer_id: referrer.id, referred_id: user.id, reward_given: true });
            await sb.from("Neyrozachet_users").update({ balance: (referrer.balance ?? 0) + 100 }).eq("id", referrer.id);
            await sb.from("Neyrozachet_transactions").insert({ user_id: referrer.id, type: "topup", amount: 100, description: "Реферальное вознаграждение" });
          }
        } catch (refErr) {
          req.log.warn({ refErr }, "Referral reward failed");
        }
      }

      const token = generateToken();
      await storeToken(token, user.id);
      sendWelcomeEmail(user.email, user.name).catch(() => {});
      sendEmailVerificationEmail(user.email, user.name, verifyToken).catch(() => {});
      res.status(201).json({
        user: { id: String(user.id), name: user.name, email: user.email, educationLevel: user.education_level, balance: user.balance, emailVerified: false, createdAt: user.created_at },
        token,
      });
      return;
    }

    // pg fallback
    const pool = await getPool();
    const { db, usersTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (existing.length > 0) {
      res.status(409).json({ error: "conflict", message: "User with this email already exists" });
      return;
    }
    const passwordHash = hashPassword(password);
    const [user] = await db.insert(usersTable).values({ name, email, passwordHash, educationLevel: (educationLevel as any) || "bachelor", balance: welcomeBonus }).returning();
    const myCode = "NZ-" + Math.random().toString(36).substring(2, 10).toUpperCase();
    await pool.query(
      `UPDATE "Neyrozachet_users" SET referral_code = $1, email_verification_token = $2, email_verification_expires_at = $3 WHERE id = $4`,
      [myCode, verifyTokenHash, verifyExpires, user.id]
    );
    if (welcomeBonus > 0) {
      await pool.query(
        `INSERT INTO "Neyrozachet_transactions" (user_id, type, amount, description) VALUES ($1, 'topup', $2, 'Приветственный бонус')`,
        [user.id, welcomeBonus]
      );
    }
    const token = generateToken();
    await storeToken(token, user.id);
    sendWelcomeEmail(user.email, user.name).catch(() => {});
    sendEmailVerificationEmail(user.email, user.name, verifyToken).catch(() => {});
    res.status(201).json({
      user: { id: String(user.id), name: user.name, email: user.email, educationLevel: user.educationLevel, balance: user.balance, emailVerified: false, createdAt: user.createdAt.toISOString() },
      token,
    });
  } catch (err) {
    req.log.error({ err }, "Register error");
    res.status(500).json({ error: "internal_error", message: "Internal server error" });
  }
});

// ── Подтверждение email ────────────────────────────────────────────────────────
router.post("/verify-email", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) { res.status(400).json({ error: "validation_error", message: "Токен обязателен" }); return; }

    const tokenHash = hashToken(token);
    const sb = getSupabaseAdmin();
    let user: any;

    if (sb) {
      const { data } = await sb.from("Neyrozachet_users")
        .select("id, name, email, balance, email_verified, email_verification_token, email_verification_expires_at")
        .eq("email_verification_token", tokenHash)
        .single();
      user = data;
    } else {
      const pool = await getPool();
      const result = await pool.query(
        `SELECT id, name, email, balance, email_verified, email_verification_token, email_verification_expires_at FROM "Neyrozachet_users" WHERE email_verification_token = $1`,
        [tokenHash]
      );
      user = result.rows[0];
    }

    if (!user) { res.status(400).json({ error: "invalid_token", message: "Ссылка недействительна или уже использована" }); return; }
    if (user.email_verified) { res.json({ success: true, alreadyVerified: true }); return; }
    if (new Date(user.email_verification_expires_at) < new Date()) {
      res.status(400).json({ error: "token_expired", message: "Ссылка истекла. Запросите новое письмо." });
      return;
    }

    const bonus = await getVerifyBonus();
    if (sb) {
      const updates: any = {
        email_verified: true,
        email_verification_token: null,
        email_verification_expires_at: null,
      };
      if (bonus > 0) updates.balance = (user.balance ?? 0) + bonus;
      await sb.from("Neyrozachet_users").update(updates).eq("id", user.id);
      if (bonus > 0) {
        await sb.from("Neyrozachet_transactions").insert({
          user_id: user.id, type: "topup", amount: bonus,
          description: "Бонус за подтверждение email",
        });
      }
    } else {
      const pool = await getPool();
      if (bonus > 0) {
        await pool.query(
          `UPDATE "Neyrozachet_users" SET email_verified = true, email_verification_token = NULL, email_verification_expires_at = NULL, balance = balance + $1 WHERE id = $2`,
          [bonus, user.id]
        );
        await pool.query(
          `INSERT INTO "Neyrozachet_transactions" (user_id, type, amount, description) VALUES ($1, 'topup', $2, 'Бонус за подтверждение email')`,
          [user.id, bonus]
        );
      } else {
        await pool.query(
          `UPDATE "Neyrozachet_users" SET email_verified = true, email_verification_token = NULL, email_verification_expires_at = NULL WHERE id = $1`,
          [user.id]
        );
      }
    }

    res.json({ success: true, bonus });
  } catch (err) {
    req.log.error({ err }, "VerifyEmail error");
    res.status(500).json({ error: "internal_error", message: "Internal server error" });
  }
});

// ── Повторная отправка письма верификации ─────────────────────────────────────
router.post("/resend-verification", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;

    if (user.email_verified) {
      res.status(400).json({ error: "already_verified", message: "Email уже подтверждён" });
      return;
    }

    const lastSent = resendAttempts.get(user.id);
    if (lastSent && Date.now() - lastSent < 2 * 60 * 1000) {
      res.status(429).json({ error: "rate_limited", message: "Письмо уже отправлено. Подождите 2 минуты." });
      return;
    }
    resendAttempts.set(user.id, Date.now());

    const verifyToken = generateToken();
    const verifyTokenHash = hashToken(verifyToken);
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const sb = getSupabaseAdmin();
    if (sb) {
      await sb.from("Neyrozachet_users").update({
        email_verification_token: verifyTokenHash,
        email_verification_expires_at: verifyExpires,
      }).eq("id", user.id);
    } else {
      const pool = await getPool();
      await pool.query(
        `UPDATE "Neyrozachet_users" SET email_verification_token = $1, email_verification_expires_at = $2 WHERE id = $3`,
        [verifyTokenHash, verifyExpires, user.id]
      );
    }

    await sendEmailVerificationEmail(user.email, user.name, verifyToken).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "ResendVerification error");
    res.status(500).json({ error: "internal_error", message: "Internal server error" });
  }
});

// ── Вход ──────────────────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const ip = (req.ip || req.socket?.remoteAddress || "unknown").replace("::ffff:", "");
    const parsed = LoginBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_error", message: "Invalid request data" });
      return;
    }
    const { email, password } = parsed.data;
    // Лимитируем только по IP, чтобы не дать атакующему «залочить» чужой email
    // массовыми попытками с разных адресов (DoS-вектор).
    const ipKey = `ip:${ip}`;
    if (!checkLoginRateLimit(ipKey)) {
      res.status(429).json({ error: "rate_limited", message: "Слишком много попыток входа. Подождите 15 минут или сбросьте пароль." });
      return;
    }
    const sb = getSupabaseAdmin();

    let user: any;
    if (sb) {
      const { data } = await sb.from("Neyrozachet_users").select("*").eq("email", email).single();
      user = data;
    } else {
      const { db, usersTable } = await import("@workspace/db");
      const { eq } = await import("drizzle-orm");
      const users = await db.select().from(usersTable).where(eq(usersTable.email, email));
      user = users[0] ? { ...users[0], password_hash: users[0].passwordHash, education_level: users[0].educationLevel, created_at: users[0].createdAt } : null;
    }

    if (!user) {
      res.status(401).json({ error: "invalid_credentials", message: "Invalid email or password" });
      return;
    }
    if (!verifyPassword(password, user.password_hash)) {
      res.status(401).json({ error: "invalid_credentials", message: "Invalid email or password" });
      return;
    }

    const token = generateToken();
    await storeToken(token, user.id);
    // Successful login — сбрасываем счётчик попыток по IP
    resetLoginRateLimit(`ip:${ip}`);
    res.json({
      user: { id: String(user.id), name: user.name, email: user.email, educationLevel: user.education_level, balance: user.balance, emailVerified: user.email_verified ?? false, createdAt: new Date(user.created_at).toISOString() },
      token,
    });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ error: "internal_error", message: "Internal server error" });
  }
});

// ── Выход ──────────────────────────────────────────────────────────────────────
router.post("/logout", async (req, res) => {
  try {
    const token = extractToken(req);
    if (token) await revokeToken(token);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Logout error");
    res.status(500).json({ error: "internal_error", message: "Internal server error" });
  }
});

// ── Текущий пользователь ────────────────────────────────────────────────────────
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { getSubscriptionUntil, isUserSubscribed } = await import("../lib/subscription.js");
    const subUntil = await getSubscriptionUntil(Number(user.id));
    const subActive = await isUserSubscribed(Number(user.id));
    res.json({
      id: String(user.id),
      name: user.name,
      email: user.email,
      educationLevel: user.educationLevel,
      institution: user.institution,
      specialty: user.specialty,
      balance: user.balance,
      emailVerified: user.email_verified ?? false,
      createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
      isAdmin: user.is_admin ?? user.isAdmin ?? false,
      subscriptionUntil: subUntil ?? null,
      subscriptionActive: subActive,
    });
  } catch (err) {
    req.log.error({ err }, "Me error");
    res.status(500).json({ error: "internal_error", message: "Internal server error" });
  }
});

// ── Сброс пароля ──────────────────────────────────────────────────────────────
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      res.status(400).json({ error: "validation_error", message: "Токен и новый пароль обязательны" });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: "validation_error", message: "Пароль должен содержать не менее 6 символов" });
      return;
    }
    const tokenHash = hashToken(token);
    const sb = getSupabaseAdmin();
    let user: any;
    if (sb) {
      const { data } = await sb
        .from("Neyrozachet_users")
        .select("id, reset_token, reset_token_expires_at")
        .eq("reset_token", tokenHash)
        .single();
      user = data;
    } else {
      const pool = await getPool();
      const result = await pool.query(
        `SELECT id, reset_token, reset_token_expires_at FROM "Neyrozachet_users" WHERE reset_token = $1`,
        [tokenHash]
      );
      user = result.rows[0];
    }

    if (!user) { res.status(400).json({ error: "invalid_token", message: "Неверный или истёкший токен" }); return; }
    if (!user.reset_token_expires_at || new Date(user.reset_token_expires_at) < new Date()) {
      res.status(400).json({ error: "token_expired", message: "Срок действия ссылки истёк. Запросите новую." });
      return;
    }

    const newHash = hashPassword(newPassword);
    if (sb) {
      await sb.from("Neyrozachet_users").update({
        password_hash: newHash,
        reset_token: null,
        reset_token_expires_at: null,
      }).eq("id", user.id);
    } else {
      const pool = await getPool();
      await pool.query(
        `UPDATE "Neyrozachet_users" SET password_hash = $1, reset_token = NULL, reset_token_expires_at = NULL WHERE id = $2`,
        [newHash, user.id]
      );
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "ResetPassword error");
    res.status(500).json({ error: "internal_error", message: "Internal server error" });
  }
});

// ── Refresh токен ─────────────────────────────────────────────────────────────
router.post("/refresh", requireAuth, async (req, res) => {
  try {
    const token = extractToken(req);
    if (!token) { res.status(401).json({ error: "unauthorized" }); return; }
    const hash = hashToken(token);
    const newExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const sb = getSupabaseAdmin();
    if (sb) {
      await sb.from("Neyrozachet_tokens").update({ expires_at: newExpiry }).eq("token_hash", hash);
    } else {
      const pool = await getPool();
      await pool.query(
        `UPDATE "Neyrozachet_tokens" SET expires_at = $1 WHERE token_hash = $2`,
        [newExpiry, hash]
      );
    }
    res.json({ ok: true, expiresAt: newExpiry });
  } catch (err) {
    req.log.error({ err }, "Refresh error");
    res.status(500).json({ error: "internal_error" });
  }
});

// ── Забыл пароль ──────────────────────────────────────────────────────────────
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) { res.status(400).json({ error: "validation_error", message: "Email required" }); return; }
    const sb = getSupabaseAdmin();
    let user: any;
    if (sb) {
      const { data } = await sb.from("Neyrozachet_users").select("id, name, email").eq("email", email).single();
      user = data;
    } else {
      const { db, usersTable } = await import("@workspace/db");
      const { eq } = await import("drizzle-orm");
      const users = await db.select().from(usersTable).where(eq(usersTable.email, email));
      user = users[0];
    }
    if (!user) { res.json({ success: true }); return; }
    const resetToken = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    if (sb) {
      await sb.from("Neyrozachet_users").update({ reset_token: hashToken(resetToken), reset_token_expires_at: expiresAt }).eq("id", user.id);
    } else {
      const pool = await getPool();
      await pool.query(`UPDATE "Neyrozachet_users" SET reset_token = $1, reset_token_expires_at = $2 WHERE id = $3`, [hashToken(resetToken), expiresAt, user.id]);
    }
    await sendPasswordResetEmail(user.email, user.name, resetToken).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "ForgotPassword error");
    res.status(500).json({ error: "internal_error", message: "Internal server error" });
  }
});

export default router;
