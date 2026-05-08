// Phase 1d.5b — Detach an asset (HYBRID delete).
// - If asset was already shared (EXISTS asset_tracked_links) → soft delete (deleted_at = now()).
// - Otherwise → hard delete (preserves clean state for upload errors).
// Body: { asset_id }

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
    const asset_id = body?.asset_id;
    if (!asset_id || typeof asset_id !== "string" || !UUID.test(asset_id)) {
      return json({ error: "Valid asset_id required" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: asset, error: aErr } = await admin
      .from("deal_assets").select("id, campaign_id, deleted_at, tracked_links")
      .eq("id", asset_id).maybeSingle();
    if (aErr || !asset) return json({ error: "Asset not found" }, 404);
    if (asset.deleted_at) return json({ ok: true, mode: "already_deleted" });

    const { data: campaign } = await admin
      .from("campaigns").select("id, org_id").eq("id", asset.campaign_id).maybeSingle();
    if (!campaign) return json({ error: "Campaign not found" }, 404);

    const { data: membership } = await admin
      .from("org_memberships")
      .select("role").eq("user_id", userId).eq("org_id", campaign.org_id)
      .eq("is_active", true).maybeSingle();
    if (!membership) return json({ error: "Forbidden" }, 403);

    // Was this asset shared? Detect via asset_tracked_links existence OR tracked_links jsonb non-empty.
    let wasShared = false;
    const { count, error: tlErr } = await admin
      .from("asset_tracked_links")
      .select("id", { count: "exact", head: true })
      .eq("asset_id", asset_id);
    if (!tlErr && (count ?? 0) > 0) wasShared = true;
    if (!wasShared && Array.isArray(asset.tracked_links) && asset.tracked_links.length > 0) {
      wasShared = true;
    }

    if (wasShared) {
      const { error: sErr } = await admin
        .from("deal_assets")
        .update({ deleted_at: new Date().toISOString(), asset_status: "archived" })
        .eq("id", asset_id);
      if (sErr) {
        console.error("[deal-assets-detach] soft delete failed", sErr);
        return json({ error: "Soft delete failed" }, 500);
      }
      return json({ ok: true, mode: "soft_delete" });
    }

    const { error: dErr } = await admin.from("deal_assets").delete().eq("id", asset_id);
    if (dErr) {
      console.error("[deal-assets-detach] hard delete failed", dErr);
      return json({ error: "Hard delete failed" }, 500);
    }
    return json({ ok: true, mode: "hard_delete" });
  } catch (e) {
    console.error("[deal-assets-detach] error", e);
    return json({ error: "Internal error" }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
