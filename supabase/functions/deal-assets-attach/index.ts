// Phase 1d.5b — Attach a new asset to a campaign (Deal Room v3).
// Cap: 12 active (non-deleted) assets per campaign.
// Appends at the end (display_order = max + 1).
// File upload is performed client-side to the deal-videos / deal-room-video / etc. bucket.
// This function only registers the row in deal_assets.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ACTIVE_ASSETS = 12;
const ALLOWED_TYPES = new Set(["video", "pdf", "image", "link", "audio", "doc"]);
const ALLOWED_PURPOSES = new Set(["intro", "pricing", "technical", "closing", "other"]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Identify user via JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid body" }, 400);

    const {
      campaign_id,
      asset_type,
      asset_purpose,
      file_url,
      block_group,
      block_title,
      block_description,
    } = body as Record<string, unknown>;

    if (!campaign_id || typeof campaign_id !== "string" || !UUID.test(campaign_id)) {
      return json({ error: "Valid campaign_id required" }, 400);
    }
    if (typeof asset_type !== "string" || !ALLOWED_TYPES.has(asset_type)) {
      return json({ error: "Invalid asset_type" }, 400);
    }
    const purpose = (typeof asset_purpose === "string" && ALLOWED_PURPOSES.has(asset_purpose))
      ? asset_purpose : "other";
    if (typeof file_url !== "string" || file_url.length === 0 || file_url.length > 2048) {
      return json({ error: "Invalid file_url" }, 400);
    }
    const sanitize = (v: unknown, max: number) =>
      typeof v === "string" ? v.trim().slice(0, max) || null : null;

    const admin = createClient(supabaseUrl, serviceKey);

    // Tenant check: campaign org === user org
    const { data: campaign, error: campErr } = await admin
      .from("campaigns").select("id, org_id").eq("id", campaign_id).maybeSingle();
    if (campErr || !campaign) return json({ error: "Campaign not found" }, 404);

    const { data: membership } = await admin
      .from("org_memberships")
      .select("role")
      .eq("user_id", userId)
      .eq("org_id", campaign.org_id)
      .eq("is_active", true)
      .maybeSingle();
    if (!membership) return json({ error: "Forbidden" }, 403);

    // Cap & next display_order
    const { data: existing, error: exErr } = await admin
      .from("deal_assets")
      .select("display_order")
      .eq("campaign_id", campaign_id)
      .is("deleted_at", null);
    if (exErr) return json({ error: "Query failed" }, 500);

    if ((existing?.length ?? 0) >= MAX_ACTIVE_ASSETS) {
      return json({ error: "ASSET_CAP_REACHED", cap: MAX_ACTIVE_ASSETS }, 409);
    }
    const nextOrder = (existing ?? []).reduce(
      (m, r) => Math.max(m, (r.display_order ?? 0) + 1), 1
    );

    const { data: inserted, error: insErr } = await admin
      .from("deal_assets")
      .insert({
        campaign_id,
        asset_type,
        asset_purpose: purpose,
        file_url,
        asset_status: "active",
        display_order: nextOrder,
        block_group: sanitize(block_group, 64),
        block_title: sanitize(block_title, 200),
        block_description: sanitize(block_description, 1000),
      })
      .select("id, display_order")
      .single();

    if (insErr) {
      console.error("[deal-assets-attach] insert failed", insErr);
      return json({ error: "Insert failed" }, 500);
    }

    return json({ ok: true, asset_id: inserted.id, display_order: inserted.display_order });
  } catch (e) {
    console.error("[deal-assets-attach] error", e);
    return json({ error: "Internal error" }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
