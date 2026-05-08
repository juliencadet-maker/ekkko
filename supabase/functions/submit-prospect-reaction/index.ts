// Phase 1d.5g — submit-prospect-reaction (D82 fix C, option b)
// Public endpoint that resolves campaigns.org_id server-side, then inserts
// into prospect_reactions with service_role. Avoids exposing campaigns.org_id
// to anonymous viewers and stays future-proof for V2.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID = new Set(["up", "think", "spark"]);
const VALID_BLOCKS = new Set([
  "hero_video", "documents", "social_proof", "roi",
  "pricing", "references", "calendly", "other",
]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      campaign_id,
      asset_id,
      block_group,
      reaction,
      viewer_hash,
      prospect_email,
      action, // "add" | "remove"
    } = body;

    if (!campaign_id || typeof campaign_id !== "string" || !UUID.test(campaign_id)) {
      return new Response(JSON.stringify({ error: "Invalid campaign_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!reaction || typeof reaction !== "string" || !VALID.has(reaction)) {
      return new Response(JSON.stringify({ error: "Invalid reaction" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (block_group && !VALID_BLOCKS.has(String(block_group))) {
      return new Response(JSON.stringify({ error: "Invalid block_group" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (asset_id && !UUID.test(asset_id)) {
      return new Response(JSON.stringify({ error: "Invalid asset_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: c } = await supabase
      .from("campaigns")
      .select("org_id")
      .eq("id", campaign_id)
      .maybeSingle();

    if (!c?.org_id) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vHash = viewer_hash ? String(viewer_hash).trim().slice(0, 128) : null;
    const pEmail = prospect_email
      ? String(prospect_email).trim().toLowerCase().slice(0, 320)
      : null;

    if (action === "remove") {
      let q = supabase
        .from("prospect_reactions")
        .delete()
        .eq("campaign_id", campaign_id)
        .eq("reaction", reaction);
      if (block_group) q = q.eq("block_group", String(block_group));
      else q = q.is("block_group", null);
      if (asset_id) q = q.eq("asset_id", asset_id);
      else q = q.is("asset_id", null);
      if (vHash) q = q.eq("viewer_hash", vHash);
      else if (pEmail) q = q.eq("prospect_email", pEmail);
      else {
        return new Response(JSON.stringify({ error: "Need viewer_hash or prospect_email" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await q;
      return new Response(JSON.stringify({ ok: true, removed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // INSERT (relies on UNIQUE index for dedup; ignore conflict)
    const { error: insErr } = await supabase.from("prospect_reactions").insert({
      campaign_id,
      org_id: c.org_id,
      asset_id: asset_id ?? null,
      block_group: block_group ?? null,
      reaction,
      viewer_hash: vHash,
      prospect_email: pEmail,
    });

    if (insErr && !/duplicate key|unique/i.test(insErr.message)) {
      console.error("[submit-prospect-reaction] insert", insErr);
      return new Response(JSON.stringify({ error: "Insert failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fact-layer signal in timeline (best-effort).
    try {
      await supabase.from("timeline_events").insert({
        campaign_id,
        event_type: "prospect_reaction",
        event_layer: "fact",
        event_data: {
          reaction,
          block_group: block_group ?? null,
          asset_id: asset_id ?? null,
          has_viewer_hash: !!vHash,
        },
      });
    } catch { /* ignore */ }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[submit-prospect-reaction]", err);
    return new Response(JSON.stringify({ error: "Internal" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
