import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

function getConnectionString(): string {
  const supabaseDbUrl = process.env.SUPABASE_DATABASE_URL;
  if (supabaseDbUrl) {
    console.info("[db] Using SUPABASE_DATABASE_URL");
    return supabaseDbUrl;
  }

  const localUrl = process.env.DATABASE_URL;
  if (localUrl) {
    console.info("[db] Using local DATABASE_URL");
    return localUrl;
  }

  throw new Error("No valid database URL found. Set SUPABASE_DATABASE_URL or DATABASE_URL.");
}

const connectionString = getConnectionString();

// SSL auto-detect:
// - sslmode=disable в URL → SSL выключен
// - sslmode=require/verify-* → SSL включён (rejectUnauthorized=false для self-signed)
// - host *.supabase.co (managed Supabase Cloud) → SSL включён
// - всё остальное (self-hosted, localhost) → SSL выключен по умолчанию
function detectSsl(url: string): false | { rejectUnauthorized: boolean } {
  try {
    const u = new URL(url);
    const sslmode = u.searchParams.get("sslmode");
    if (sslmode === "disable") return false;
    if (sslmode && sslmode !== "disable") return { rejectUnauthorized: false };
    if (u.hostname.endsWith(".supabase.co")) return { rejectUnauthorized: false };
    return false;
  } catch {
    return false;
  }
}

export const pool = new Pool({
  connectionString,
  ssl: detectSsl(connectionString),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
