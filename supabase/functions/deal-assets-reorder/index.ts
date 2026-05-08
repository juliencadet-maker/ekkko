// Phase 1d.5b — Reorder assets within a campaign.
// Body: { campaign_id, ordered_asset_ids: string[] }
// Updates display_order to the array index for each asset (must all belong to campaign).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => null);
    const campaign_id = body?.campaign_id;
    const ordered: unknown = body?.ordered_asset_ids;
    if (!campaign_id || typeof campaign_id !== "string" || !UUID.test(campaign_id)) {
      return json({ error: "Valid campaign_id required" }, 400);
    }
    if (!Array.isArray(ordered) || ordered.length === 0 || ordered.length > 50) {
      return json({ error: "ordered_asset_ids invalid" }, 400);
    }
    if (!ordered.every((x) => typeof x === "string" && UUID.test(x))) {
      return json({ error: "ordered_asset_ids invalid" }, 400);
    }
    if (new Set(ordered as string[]).size !== ordered.length) {
      return json({ error: "Duplicate ids" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: campaign } = await admin
      .from("campaigns").select("id, org_id").eq("id", campaign_id).maybeSingle();
    if (!campaign) return json({ error: "Campaign not found" }, 404);

    const { data: membership } = await admin
      .from("org_memberships")
      .select("role").eq("user_id", userId).eq("org_id", campaign.org_id)
      .eq("is_active", true).maybeSingle();
    if (!membership) return json({ error: "Forbidden" }, 403);

    const { data: assets, error: aErr } = await admin
      .from("deal_assets").select("id")
      .eq("campaign_id", campaign_id).is("deleted_at", null);
    if (aErr) return json({ error: "Query failed" }, 500);

    const validIds = new Set((assets ?? []).map((r: any) => r.id));
    if (!(ordered as string[]).every((id) => validIds.has(id))) {
      return json({ error: "Asset id not in campaign" }, 400);
    }

    // Update each row sequentially (small N, max 12).
    for (let i = 0; i < (ordered as string[]).length; i++) {
      const id = (ordered as string[])[i];
      const { error: uErr } = await admin
        .from("deal_assets").update({ display_order: i }).eq("id", id);
      if (uErr) {
        console.error("[deal-assets-reorder] update failed", uErr);
        return json({ error: "Update failed" }, 500);
      }
    }

    return json({ ok: true, count: (ordered as string[]).length });
  } catch (e) {
    console.error("[deal-assets-reorder] error", e);
    return json({ error: "Internal error" }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
