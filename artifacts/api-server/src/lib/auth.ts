import { Request, Response, NextFunction } from "express";
import { getSupabaseAdmin } from "./supabase.js";
import { hashToken } from "./crypto";

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

async function queryWithFallback(supabaseFn: () => Promise<any>, pgFn: () => Promise<any>) {
  const sb = getSupabaseAdmin();
  if (sb) {
    return await supabaseFn();
  }
  return await pgFn();
}

export async function storeToken(token: string, userId: number): Promise<void> {
  const hash = hashToken(token);
  const expiresAt = new Date(Date.now() + ONE_YEAR_MS).toISOString();

  const sb = getSupabaseAdmin();
  if (sb) {
    await sb.from("Neyrozachet_tokens").upsert(
      { token_hash: hash, user_id: userId, expires_at: expiresAt },
      { onConflict: "token_hash" }
    );
    return;
  }

  const { pool } = await import("@workspace/db");
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO "Neyrozachet_tokens" (token_hash, user_id, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (token_hash) DO UPDATE SET expires_at = $3`,
      [hash, userId, expiresAt]
    );
  } finally {
    client.release();
  }
}

export async function revokeToken(token: string): Promise<void> {
  const hash = hashToken(token);

  const sb = getSupabaseAdmin();
  if (sb) {
    await sb.from("Neyrozachet_tokens").delete().eq("token_hash", hash);
    return;
  }

  const { pool } = await import("@workspace/db");
  const client = await pool.connect();
  try {
    await client.query(`DELETE FROM "Neyrozachet_tokens" WHERE token_hash = $1`, [hash]);
  } finally {
    client.release();
  }
}

export async function getUserFromToken(token: string): Promise<{
  id: number; name: string; email: string; email_verified: boolean;
  educationLevel: string | null; institution: string | null;
  specialty: string | null; balance: number; createdAt: Date;
} | null> {
  const hash = hashToken(token);
  const now = new Date().toISOString();

  const sb = getSupabaseAdmin();
  if (sb) {
    const { data } = await sb
      .from("Neyrozachet_tokens")
      .select("user_id, expires_at, Neyrozachet_users!inner(id, name, email, email_verified, education_level, institution, specialty, balance, created_at)")
      .eq("token_hash", hash)
      .gt("expires_at", now)
      .single();

    if (!data) return null;
    const u = (data as any).Neyrozachet_users;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      email_verified: u.email_verified ?? false,
      educationLevel: u.education_level,
      institution: u.institution,
      specialty: u.specialty,
      balance: u.balance,
      createdAt: new Date(u.created_at),
    };
  }

  const { pool } = await import("@workspace/db");
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT u.id, u.name, u.email, u.email_verified,
              u.education_level, u.institution, u.specialty,
              u.balance, u.created_at
       FROM "Neyrozachet_tokens" t
       JOIN "Neyrozachet_users" u ON u.id = t.user_id
       WHERE t.token_hash = $1 AND t.expires_at > NOW()`,
      [hash]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      email_verified: row.email_verified ?? false,
      educationLevel: row.education_level,
      institution: row.institution,
      specialty: row.specialty,
      balance: row.balance,
      createdAt: row.created_at,
    };
  } finally {
    client.release();
  }
}

export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    return;
  }

  const user = await getUserFromToken(token);
  if (!user) {
    res.status(401).json({ error: "unauthorized", message: "Invalid or expired token" });
    return;
  }

  (req as any).user = user;
  next();
}
