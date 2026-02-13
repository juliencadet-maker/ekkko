import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TAVUS_API_URL = "https://tavusapi.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TAVUS_API_KEY = Deno.env.get("TAVUS_API_KEY");
    if (!TAVUS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "TAVUS_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { campaign_id, video_job_id } = await req.json();
    if (!campaign_id) {
      return new Response(
        JSON.stringify({ error: "campaign_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch campaign with identity
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*, identities(id, provider_identity_id, display_name, metadata)")
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ error: "Campaign not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const identity = (campaign as any).identities;
    const replicaId = identity?.provider_identity_id;

    if (!replicaId) {
      return new Response(
        JSON.stringify({ error: "Identity does not have a Tavus replica. Please create one first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch recipients for this campaign
    const { data: recipients, error: recipientsError } = await supabase
      .from("recipients")
      .select("*")
      .eq("campaign_id", campaign_id);

    if (recipientsError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch recipients" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Build the callback URL for webhooks
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const callbackUrl = `${supabaseUrl}/functions/v1/tavus-webhook`;

    const results = [];

    for (const recipient of (recipients || [])) {
      // Personalize script with recipient data
      let personalizedScript = campaign.script;
      if (recipient.first_name) {
        personalizedScript = personalizedScript.replace(/\{prénom\}/gi, recipient.first_name);
        personalizedScript = personalizedScript.replace(/\{prenom\}/gi, recipient.first_name);
      }
      if (recipient.last_name) {
        personalizedScript = personalizedScript.replace(/\{nom\}/gi, recipient.last_name);
      }
      if (recipient.company) {
        personalizedScript = personalizedScript.replace(/\{entreprise\}/gi, recipient.company);
      }

      console.log(`Generating video for recipient: ${recipient.email}`);

      // Generate video via Tavus
      const tavusResponse = await fetch(`${TAVUS_API_URL}/v2/videos`, {
        method: "POST",
        headers: {
          "x-api-key": TAVUS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          replica_id: replicaId,
          script: personalizedScript,
          video_name: `${campaign.name} - ${recipient.first_name || recipient.email}`,
          callback_url: callbackUrl,
        }),
      });

      const tavusData = await tavusResponse.json();

      if (!tavusResponse.ok) {
        console.error("Tavus video generation error:", tavusResponse.status, tavusData);
        results.push({
          recipient_id: recipient.id,
          success: false,
          error: tavusData.message || tavusData.detail || "Video generation failed",
        });
        continue;
      }

      const tavusVideoId = tavusData.video_id;
      console.log("Tavus video queued:", tavusVideoId);

      // Create or update video_job
      const jobData = {
        org_id: campaign.org_id,
        campaign_id: campaign.id,
        identity_id: campaign.identity_id,
        recipient_id: recipient.id,
        status: "processing" as const,
        provider_job_id: tavusVideoId,
        started_at: new Date().toISOString(),
      };

      if (video_job_id) {
        await serviceClient
          .from("video_jobs")
          .update({ ...jobData })
          .eq("id", video_job_id);
      } else {
        // Get provider
        const { data: provider } = await serviceClient
          .from("providers")
          .select("id")
          .eq("org_id", campaign.org_id)
          .eq("is_active", true)
          .limit(1)
          .single();

        await serviceClient
          .from("video_jobs")
          .insert({
            ...jobData,
            provider_id: provider?.id || null,
          });
      }

      results.push({
        recipient_id: recipient.id,
        success: true,
        tavus_video_id: tavusVideoId,
        status: "queued",
      });
    }

    // Update campaign status
    await serviceClient
      .from("campaigns")
      .update({ status: "generating" })
      .eq("id", campaign_id);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        message: `${results.filter(r => r.success).length} video(s) queued for generation`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("tavus-generate-video error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
