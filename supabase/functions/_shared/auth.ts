import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const buckets = new Map<string, { startedAt: number; count: number }>();

export async function requireUser(req: Request) {
  const authorization = req.headers.get("Authorization");
  if (!authorization) return { user: null, error: "Не авторизовано" };

  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authorization } } },
  );

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return { user: null, error: "Не авторизовано" };
  return { user: data.user, error: null };
}

export function allowRateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || now - current.startedAt >= windowMs) {
    buckets.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= max) return false;
  current.count += 1;
  return true;
}
