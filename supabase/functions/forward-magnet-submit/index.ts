// Phase 1d — Forward Magnet submission.
// - Validates payload (Zod-like manual validation, kept dep-free).
// - Anti-spam D56 : rejects same email on same campaign within 24h via deal_communication_log.
// - Persists into `recipients` + `deal_communication_log` (channel=forward, source=prospect_room).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = new Set(["champion", "decideur", "influenceur", "utilisateur", "autre"]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { campaign_id, first_name, email, role } = body || {};

    if (!campaign_id || typeof campaign_id !== "string" || !UUID_REGEX.test(campaign_id)) {
      return json({ error: "Valid campaign_id required" }, 400);
    }
    if (typeof first_name !== "string" || first_name.trim().length < 1 || first_name.length > 80) {
      return json({ error: "Prénom requis" }, 400);
    }
    if (typeof email !== "string" || !EMAIL_REGEX.test(email) || email.length > 200) {
      return json({ error: "Email invalide" }, 400);
    }
    if (typeof role !== "string" || !ROLES.has(role)) {
      return json({ error: "Rôle invalide" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve org_id from campaign
    const { data: campaign, error: campErr } = await supabase
      .from("campaigns")
      .select("id, org_id")
      .eq("id", campaign_id)
      .maybeSingle();

    if (campErr || !campaign) return json({ error: "Deal introuvable" }, 404);

    // Anti-spam D56 : 24h dedup
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from("deal_communication_log")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaign_id)
      .eq("recipient_email", email.toLowerCase())
      .eq("channel", "forward")
      .gte("sent_at", since);

    if ((recentCount ?? 0) > 0) {
      return json({ ok: true, rate_limited: true }, 200);
    }

    // Upsert recipient
    await supabase.from("recipients").insert({
      campaign_id,
      org_id: campaign.org_id,
      email: email.toLowerCase(),
      first_name,
      variables: { role, source: "forward_magnet" },
    });

    // Log forward event
    await supabase.from("deal_communication_log").insert({
      campaign_id,
      org_id: campaign.org_id,
      channel: "forward",
      source: "prospect_room",
      direction: "outbound",
      recipient_email: email.toLowerCase(),
      status: "queued",
      metadata: { first_name, role, forwarded_via: "magnet_form" },
    });

    return json({ ok: true }, 200);
  } catch (e) {
    console.error("[forward-magnet-submit] error", e);
    return json({ error: "Internal error" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
