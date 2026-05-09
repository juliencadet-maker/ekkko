// Phase 4 — Cron: every 5 min, expire pending actions whose expires_at is past.
// Auth: Bearer == env CRON_SECRET (matches public.system_config.cron_secret).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const expected = Deno.env.get("CRON_SECRET");
    if (!expected || token !== expected) {
      return j({ error: "unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const nowIso = new Date().toISOString();
    const { data: expired, error } = await supabase
      .from("pending_external_actions")
      .update({ status: "expired" })
      .lt("expires_at", nowIso)
      .eq("status", "pending")
      .select("id, user_id, org_id, campaign_id, action_type");
    if (error) return j({ error: error.message }, 500);

    // Coaching nudge per expired (per-user). Best-effort.
    if (expired && expired.length) {
      const rows = expired.map((a: any) => ({
        user_id: a.user_id,
        org_id: a.org_id,
        campaign_id: a.campaign_id,
        kind: "coaching_nudge",
        title: "Action expirée sans décision",
        body: `Une action "${a.action_type}" a expiré faute de validation sous 24h.`,
        payload: { pending_action_id: a.id, action_type: a.action_type, reason: "expired" },
      }));
      await supabase.from("agent_notification_queue").insert(rows);
    }

    return j({ ok: true, expired_count: expired?.length ?? 0 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return j({ error: msg }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
