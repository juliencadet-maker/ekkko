// One-shot internal sync: copies env CRON_SECRET into public.system_config.cron_secret.
// Auth: requires Bearer == env CRON_SECRET itself (so caller must already know it).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const auth = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const secret = Deno.env.get("CRON_SECRET") ?? "";
  if (!secret || auth !== secret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error } = await sb.from("system_config").update({ value: secret, updated_at: new Date().toISOString() }).eq("key", "cron_secret");
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ ok: true, len: secret.length }), { status: 200 });
});
