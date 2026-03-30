import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      video_id, campaign_id, viewer_hash, session_id,
      event_type, event_data, viewer_email, viewer_name,
      device_type, referrer, referred_by_hash, position_sec,
    } = body;

    // Validate required fields
    if (!video_id || !campaign_id || !viewer_hash || !event_type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: video_id, campaign_id, viewer_hash, event_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate event_type
    const validEvents = [
      "video_opened", "video_started", "watch_progress", "video_paused",
      "video_resumed", "video_seeked", "segment_replayed", "video_completed",
      "video_dropped", "speed_changed", "fullscreen_toggled", "tab_visibility_changed",
      "cta_clicked", "page_landed", "page_shared", "page_exit",
      "reaction_added", "comment_submitted",
    ];
    if (!validEvents.includes(event_type)) {
      return new Response(
        JSON.stringify({ error: `Invalid event_type. Must be one of: ${validEvents.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract domain from email
    const viewer_domain = viewer_email ? viewer_email.split("@")[1]?.toLowerCase() : null;

    // 1. Insert the event
    const { error: eventError } = await supabase.from("video_events").insert({
      video_id,
      campaign_id,
      viewer_hash,
      session_id: session_id || null,
      event_type,
      event_data: event_data || {},
      viewer_email: viewer_email || null,
      viewer_name: viewer_name || null,
      viewer_domain,
      device_type: device_type || null,
      user_agent: req.headers.get("user-agent") || null,
      ip_country: null, // Would need geo-ip service
      referrer: referrer || null,
      referred_by_hash: referred_by_hash || null,
      position_sec: position_sec ?? null,
    });

    if (eventError) {
      console.error("Event insert error:", eventError);
      return new Response(
        JSON.stringify({ error: "Failed to store event" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Upsert viewer profile
    const { data: existingViewer } = await supabase
      .from("viewers")
      .select("id, share_count, viewers_generated, total_watch_depth, replay_count, cta_clicked")
      .eq("campaign_id", campaign_id)
      .eq("viewer_hash", viewer_hash)
      .maybeSingle();

    if (existingViewer) {
      // Update existing viewer
      const updates: Record<string, unknown> = {
        last_event_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (viewer_email && !existingViewer.cta_clicked) {
        updates.email = viewer_email;
        updates.is_known = true;
      }
      if (viewer_name) updates.name = viewer_name;
      if (viewer_domain) updates.domain = viewer_domain;

      // Update scores based on event type
      if (event_type === "video_completed" || event_type === "watch_progress") {
        const depth = event_data?.percent || event_data?.watch_percentage || 0;
        if (depth > (existingViewer.total_watch_depth || 0)) {
          updates.total_watch_depth = depth;
        }
      }
      if (event_type === "segment_replayed") {
        updates.replay_count = (existingViewer.replay_count || 0) + 1;
      }
      if (event_type === "cta_clicked") {
        updates.cta_clicked = true;
      }
      if (event_type === "page_shared") {
        updates.share_count = (existingViewer.share_count || 0) + 1;
      }

      await supabase.from("viewers").update(updates).eq("id", existingViewer.id);
    } else {
      // Create new viewer
      const via_viewer_hash = referred_by_hash;
      let via_viewer_id = null;

      if (via_viewer_hash) {
        const { data: referrer } = await supabase
          .from("viewers")
          .select("id")
          .eq("campaign_id", campaign_id)
          .eq("viewer_hash", via_viewer_hash)
          .maybeSingle();

        if (referrer) {
          via_viewer_id = referrer.id;
          // Increment viewers_generated on the referrer
          await supabase.rpc("increment_viewers_generated_not_exist_yet", {});
          // Simple update instead
          await supabase.from("viewers")
            .update({ viewers_generated: (referrer as any).viewers_generated ? (referrer as any).viewers_generated + 1 : 1 })
            .eq("id", referrer.id);
        }
      }

      await supabase.from("viewers").insert({
        campaign_id,
        viewer_hash,
        email: viewer_email || null,
        name: viewer_name || null,
        domain: viewer_domain || null,
        is_known: !!viewer_email,
        via_viewer_id,
        total_watch_depth: event_type === "watch_progress" ? (event_data?.percent || 0) : 0,
        cta_clicked: event_type === "cta_clicked",
        share_count: event_type === "page_shared" ? 1 : 0,
        last_event_at: new Date().toISOString(),
        first_seen_at: new Date().toISOString(),
        status: viewer_email ? "nouveau" : "inconnu",
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Ingest error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
