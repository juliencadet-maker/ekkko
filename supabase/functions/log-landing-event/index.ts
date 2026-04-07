import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { campaign_id, ref, event_category } = await req.json();

    if (!campaign_id) {
      return new Response(
        JSON.stringify({ error: "campaign_id required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Vérifier que le campaign existe (éviter spam sur IDs aléatoires)
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("org_id")
      .eq("id", campaign_id)
      .maybeSingle();

    if (!campaign) {
      return new Response(
        JSON.stringify({ success: false, reason: "unknown_campaign" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    await supabase.from("audit_logs").insert({
      event_type: "landing_opened",
      entity_id: campaign_id,
      entity_type: "campaign",
      org_id: campaign.org_id,
      metadata: {
        ref: ref ?? null,
        is_preview: false,
        event_category: event_category ?? "activation",
      },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[log-landing-event] error:", err);
    return new Response(JSON.stringify({ success: false }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
