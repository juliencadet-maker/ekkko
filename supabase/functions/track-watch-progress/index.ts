import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { video_id, viewer_hash, watch_percentage, total_watch_seconds, viewer_name, viewer_email, viewer_title, viewer_company, referred_by_hash } = body;

    if (!video_id || !viewer_hash) {
      return new Response(JSON.stringify({ error: "video_id and viewer_hash required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert watch progress
    const { data: existing } = await supabase
      .from("watch_progress")
      .select("id, max_percentage_reached, session_count, viewer_name, viewer_email")
      .eq("video_id", video_id)
      .eq("viewer_hash", viewer_hash)
      .maybeSingle();

    if (existing) {
      const updates: Record<string, unknown> = {
        watch_percentage: watch_percentage ?? existing.max_percentage_reached,
        total_watch_seconds: total_watch_seconds ?? 0,
        max_percentage_reached: Math.max(watch_percentage ?? 0, existing.max_percentage_reached ?? 0),
        last_watched_at: new Date().toISOString(),
      };

      // Only update viewer info if provided and not already set
      if (viewer_name && !existing.viewer_name) updates.viewer_name = viewer_name;
      if (viewer_email && !existing.viewer_email) updates.viewer_email = viewer_email;
      if (viewer_title) updates.viewer_title = viewer_title;
      if (viewer_company) updates.viewer_company = viewer_company;

      await supabase
        .from("watch_progress")
        .update(updates)
        .eq("id", existing.id);
    } else {
      await supabase
        .from("watch_progress")
        .insert({
          video_id,
          viewer_hash,
          watch_percentage: watch_percentage ?? 0,
          total_watch_seconds: total_watch_seconds ?? 0,
          max_percentage_reached: watch_percentage ?? 0,
          viewer_name: viewer_name ?? null,
          viewer_email: viewer_email ?? null,
          viewer_title: viewer_title ?? null,
          viewer_company: viewer_company ?? null,
          referred_by_hash: referred_by_hash ?? null,
        });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
