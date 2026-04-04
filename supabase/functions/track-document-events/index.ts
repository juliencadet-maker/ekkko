import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_EVENTS = [
  "doc_opened", "doc_time_on_page", "doc_downloaded",
  "doc_return_visit", "doc_closed_without_read",
];

const THRESHOLDS: Record<string, number> = {
  doc_opened: 5,
  doc_time_on_page: 3,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      asset_id, campaign_id, viewer_hash, event_type,
      time_spent_seconds, viewer_email, viewer_name,
      referred_by_hash, asset_purpose,
    } = body;

    // Validation requise
    if (!asset_id || !campaign_id || !viewer_hash || !event_type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!VALID_EVENTS.includes(event_type)) {
      return new Response(
        JSON.stringify({ error: `Invalid event_type. Must be one of: ${VALID_EVENTS.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Upsert viewer
    const viewer_domain = viewer_email ? viewer_email.split("@")[1]?.toLowerCase() : null;
    const viewerHashNorm = viewer_hash.toString().trim();

    let viewerId: string | null = null;
    const { data: existingViewer } = await supabase
      .from("viewers")
      .select("id, email, name")
      .eq("campaign_id", campaign_id)
      .eq("viewer_hash", viewerHashNorm)
      .maybeSingle();

    if (existingViewer) {
      viewerId = existingViewer.id;
      const updates: Record<string, unknown> = { last_event_at: new Date().toISOString() };
      // Email trust : DÉSACTIVÉ en D2 — email vient du frontend, non vérifié
      // Réactiver en D3/E1 une fois l'identité validée via token
      if (viewer_name && !existingViewer.name) updates.name = viewer_name;
      if (Object.keys(updates).length > 1) {
        await supabase.from("viewers").update(updates).eq("id", viewerId);
      }
    } else {
      const { data: newViewer } = await supabase.from("viewers").insert({
        campaign_id,
        viewer_hash: viewerHashNorm,
        email: null,         // D2 : email non trusted (frontend) — D3+ via token
        name: viewer_name || null,
        domain: viewer_domain,
        referred_by_hash: referred_by_hash || null,
        first_seen_at: new Date().toISOString(),
        last_event_at: new Date().toISOString(),
        is_known: false,
        contact_type: "organic_discovery",
      }).select("id").single();
      viewerId = newViewer?.id || null;
    }

    // 2. Bot filter
    if (viewerId) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("asset_page_events")
        .select("id", { count: "exact" })
        .eq("campaign_id", campaign_id)
        .eq("viewer_id", viewerId)
        .gte("created_at", fiveMinutesAgo);

      if ((count ?? 0) > 10) {
        await supabase.from("system_failures").insert({
          campaign_id,
          failure_type: "tracking",
          severity: "low",
          message: `Bot suspicious: viewer ${viewerId} sent ${count} doc events in 5 min`,
          reason: "bot_suspicious",
        });
        return new Response(
          JSON.stringify({ ok: true, filtered: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 3. Déduplication : rejeter si event identique dans les 10 dernières secondes
    if (viewerId) {
      const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
      const { count: dupCount } = await supabase
        .from("asset_page_events")
        .select("id", { count: "exact" })
        .eq("campaign_id", campaign_id)
        .eq("asset_id", asset_id)
        .eq("viewer_id", viewerId)
        .eq("event_type", event_type)
        .gte("created_at", tenSecondsAgo);
      if ((dupCount ?? 0) > 0) {
        return new Response(
          JSON.stringify({ ok: true, deduped: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 3b. Seuil de validité (après dédup)
    const threshold = THRESHOLDS[event_type];
    if (threshold && (time_spent_seconds ?? 0) <= threshold) {
      await supabase.from("system_failures").insert({
        campaign_id,
        failure_type: "tracking",
        severity: "low",
        message: `Doc event ${event_type} below threshold (${time_spent_seconds}s <= ${threshold}s)`,
        reason: "below_threshold",
      });
      return new Response(
        JSON.stringify({ ok: true, below_threshold: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. INSERT asset_page_events
    const timeBucket = Math.floor(Date.now() / 30000);
    const event_hash = `${campaign_id}_${asset_id}_${viewer_hash}_${event_type}_${timeBucket}`;
    await supabase.from("asset_page_events").insert({
      asset_id,
      campaign_id,
      viewer_id: viewerId,
      event_hash,
      event_type,
      time_spent_seconds: time_spent_seconds ?? null,
      page_number: null,       // non mesurable via iframe cross-origin en D2
      max_scroll_pct: null,    // non mesurable via iframe cross-origin en D2
      identity_cluster_id: null,
    });

    // 5. INSERT timeline_events
    await supabase.from("timeline_events").insert({
      campaign_id,
      event_type,
      event_layer: "fact",
      event_data: {
        asset_id,
        asset_purpose: asset_purpose || null,
        time_spent_seconds: time_spent_seconds ?? null,
        viewer_id: viewerId,
      },
    });

    // 6. first_signal_at si doc_opened
    if (event_type === "doc_opened") {
      await supabase.from("campaigns")
        .update({ first_signal_at: new Date().toISOString() })
        .eq("id", campaign_id)
        .is("first_signal_at", null);
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[track-document-events]", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
