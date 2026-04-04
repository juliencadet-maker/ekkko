import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { campaign_id, event_type, event_layer, event_data } = await req.json();

    if (!campaign_id || !event_type) {
      return new Response(JSON.stringify({ error: "campaign_id and event_type required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Insert timeline event
    await supabase.from("timeline_events").insert({
      campaign_id,
      event_type,
      event_layer: event_layer || "fact",
      event_data: event_data || {},
    });

    // topic_selection: update viewer metadata with declared topics
    if (
      event_type === "prospect_feedback" &&
      event_data?.response === "topic_selection" &&
      event_data?.viewer_id &&
      event_data.viewer_id !== "PENDING"
    ) {
      const { data: existingViewer } = await supabase
        .from("viewers")
        .select("metadata")
        .eq("id", event_data.viewer_id)
        .maybeSingle();
      const existingMeta = (existingViewer?.metadata as Record<string, unknown>) || {};
      await supabase.from("viewers").update({
        metadata: { ...existingMeta, declared_topics: event_data.topics || [] },
      }).eq("id", event_data.viewer_id);
    }

    // new_contact_identified: upsert viewer (Pattern 26 — organic discovery)
    if (
      event_type === "prospect_feedback" &&
      event_data?.response === "new_contact_identified"
    ) {
      const email = event_data.email as string;
      const name = event_data.name as string;
      if (email && name) {
        const normalizedEmail = email.toLowerCase().trim();
        const viewerHash = Math.abs(
          normalizedEmail.split("").reduce((h: number, c: string) => {
            return ((h << 5) - h + c.charCodeAt(0)) | 0;
          }, 0)
        ).toString(36);
        await supabase.from("viewers").upsert({
          campaign_id,
          name,
          email: normalizedEmail,
          viewer_hash: viewerHash,
          is_known: false,
          contact_type: "organic_discovery",
          first_seen_at: new Date().toISOString(),
        }, { onConflict: "campaign_id,viewer_hash" });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
