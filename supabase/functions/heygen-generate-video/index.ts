import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HEYGEN_API_URL = "https://api.heygen.com";

async function findVoiceForAvatar(apiKey: string, avatarId: string): Promise<string | null> {
  // Try to find a cloned voice matching this avatar
  try {
    const res = await fetch(`${HEYGEN_API_URL}/v2/voices`, {
      headers: { "X-Api-Key": apiKey },
    });
    const data = await res.json();
    const voices = data.data?.voices || data.voices || [];
    
    // Look for a cloned voice associated with this avatar
    const clonedVoice = voices.find((v: any) => 
      v.voice_id?.includes(avatarId) || 
      v.name?.toLowerCase().includes("clone") ||
      v.type === "cloned"
    );
    if (clonedVoice) return clonedVoice.voice_id;

    // Fallback: use a French voice
    const frenchVoice = voices.find((v: any) => 
      v.language === "French" || v.language === "fr" || v.name?.toLowerCase().includes("french")
    );
    if (frenchVoice) return frenchVoice.voice_id;

    // Last resort: first available voice
    if (voices.length > 0) return voices[0].voice_id;
  } catch (e) {
    console.error("Error fetching voices:", e);
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HEYGEN_API_KEY = Deno.env.get("HEYGEN_API_KEY");
    if (!HEYGEN_API_KEY) {
      return new Response(
        JSON.stringify({ error: "HEYGEN_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let userClient: any = null;
    if (authHeader?.startsWith("Bearer ")) {
      userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { error: claimsError } = await userClient.auth.getClaims(token);
      if (claimsError) userClient = null;
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const queryClient = userClient || serviceClient;

    const { campaign_id, video_job_id } = await req.json();
    if (!campaign_id) {
      return new Response(
        JSON.stringify({ error: "campaign_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: campaign, error: campaignError } = await queryClient
      .from("campaigns")
      .select("*, identities(id, provider_identity_id, display_name, metadata, clone_status)")
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ error: "Campaign not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const identity = (campaign as any).identities;
    const avatarId = identity?.provider_identity_id;

    if (!avatarId) {
      return new Response(
        JSON.stringify({ error: "Identity does not have a HeyGen avatar." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (identity?.clone_status !== "ready") {
      return new Response(
        JSON.stringify({ error: "Avatar is not ready yet. Status: " + (identity?.clone_status || "unknown") }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve voice_id: from identity metadata, or auto-detect
    const identityMetadata = identity?.metadata as Record<string, unknown> || {};
    let voiceId = identityMetadata.heygen_voice_id as string || null;
    
    if (!voiceId) {
      console.log("No voice_id in metadata, auto-detecting...");
      voiceId = await findVoiceForAvatar(HEYGEN_API_KEY, avatarId);
      console.log("Auto-detected voice_id:", voiceId);
    }

    if (!voiceId) {
      return new Response(
        JSON.stringify({ error: "No voice available for this avatar. Please configure a voice_id in identity metadata." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch recipients
    const { data: recipients, error: recipientsError } = await queryClient
      .from("recipients")
      .select("*")
      .eq("campaign_id", campaign_id);

    if (recipientsError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch recipients" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callbackUrl = `${supabaseUrl}/functions/v1/heygen-webhook`;
    const results = [];

    for (const recipient of (recipients || [])) {
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

      console.log(`Generating HeyGen video for recipient: ${recipient.email}, voice: ${voiceId}`);

      const videoPayload = {
        video_inputs: [{
          character: {
            type: "avatar",
            avatar_id: avatarId,
            scale: 1,
          },
          voice: {
            type: "text",
            input_text: personalizedScript,
            voice_id: voiceId,
          },
        }],
        dimension: { width: 1280, height: 720 },
        callback_id: `${campaign.id}|${recipient.id}`,
        callback_url: callbackUrl,
      };

      console.log("HeyGen payload:", JSON.stringify(videoPayload));

      const heygenResponse = await fetch(`${HEYGEN_API_URL}/v2/video/generate`, {
        method: "POST",
        headers: {
          "X-Api-Key": HEYGEN_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(videoPayload),
      });

      const heygenData = await heygenResponse.json();

      if (!heygenResponse.ok) {
        console.error("HeyGen video generation error:", heygenResponse.status, heygenData);
        results.push({
          recipient_id: recipient.id,
          success: false,
          error: heygenData.message || heygenData.error || "Video generation failed",
        });
        continue;
      }

      const heygenVideoId = heygenData.data?.video_id || heygenData.video_id;
      console.log("HeyGen video queued:", heygenVideoId);

      const jobData = {
        org_id: campaign.org_id,
        campaign_id: campaign.id,
        identity_id: campaign.identity_id,
        recipient_id: recipient.id,
        status: "processing" as const,
        provider_job_id: heygenVideoId,
        started_at: new Date().toISOString(),
      };

      if (video_job_id) {
        await serviceClient.from("video_jobs").update(jobData).eq("id", video_job_id);
      } else {
        const { data: provider } = await serviceClient
          .from("providers")
          .select("id")
          .eq("org_id", campaign.org_id)
          .eq("is_active", true)
          .limit(1)
          .single();

        await serviceClient.from("video_jobs").insert({
          ...jobData,
          provider_id: provider?.id || null,
        });
      }

      results.push({
        recipient_id: recipient.id,
        success: true,
        heygen_video_id: heygenVideoId,
        status: "queued",
      });
    }

    await serviceClient.from("campaigns").update({ status: "generating" }).eq("id", campaign_id);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        voice_id_used: voiceId,
        message: `${results.filter(r => r.success).length} video(s) queued for generation`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("heygen-generate-video error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
