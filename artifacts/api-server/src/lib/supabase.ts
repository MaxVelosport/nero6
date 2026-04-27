import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;
let _initPromise: Promise<void> | null = null;
let _lastInitAt = 0;

const RETRIES = 4;
const RETRY_DELAY_MS = 800;
const REINIT_COOLDOWN_MS = 30_000; // не чаще раза в 30с пытаться переинициализировать

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function tryKey(url: string, key: string, label: string): Promise<boolean> {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const candidate = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error } = await candidate.from("Neyrozachet_users").select("id").limit(1);
      if (!error) {
        console.log(`[supabase] Connected using ${label} (attempt ${attempt})`);
        _client = candidate;
        return true;
      }
      console.log(`[supabase] Key ${label} attempt ${attempt} rejected: ${error.message}`);
      if (!/fetch|network|ECONN|ETIMEDOUT|EAI_AGAIN|UND_ERR/i.test(error.message)) {
        // Это содержательная ошибка авторизации/прав — повторять смысла нет.
        return false;
      }
    } catch (e: any) {
      console.log(`[supabase] Key ${label} attempt ${attempt} threw: ${e?.message ?? e}`);
    }
    if (attempt < RETRIES) await sleep(RETRY_DELAY_MS * attempt);
  }
  return false;
}

async function doInit(): Promise<void> {
  _lastInitAt = Date.now();
  const url = process.env.SUPABASE_URL;
  if (!url) {
    console.log("[supabase] SUPABASE_URL not set — DB disabled");
    return;
  }

  const serviceKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (serviceKey && (await tryKey(url, serviceKey, "SUPABASE_SERVICE_KEY"))) return;
  if (anonKey && (await tryKey(url, anonKey, "SUPABASE_ANON_KEY"))) return;

  console.log("[supabase] WARNING: No valid Supabase key found — DB operations will fall back to local Postgres if configured");
}

export async function initSupabase(): Promise<void> {
  if (_client) return;
  if (!_initPromise) _initPromise = doInit().finally(() => { _initPromise = null; });
  return _initPromise;
}

export function getSupabaseAdmin(): SupabaseClient | null {
  // Lazy re-init: если первый init упал из-за network blip — попробуем снова
  // в фоне, не блокируя текущий запрос (он уйдёт на drizzle-fallback).
  if (!_client && Date.now() - _lastInitAt > REINIT_COOLDOWN_MS && !_initPromise) {
    _initPromise = doInit().finally(() => { _initPromise = null; });
  }
  return _client;
}
