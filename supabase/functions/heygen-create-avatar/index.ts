import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HEYGEN_API_URL = "https://api.heygen.com";

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

    const { identity_id, training_video_url, consent_video_url, avatar_name } = await req.json();
    if (!identity_id) {
      return new Response(
        JSON.stringify({ error: "identity_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch identity
    const { data: identity, error: identityError } = await supabase
      .from("identities")
      .select("*")
      .eq("id", identity_id)
      .single();

    if (identityError || !identity) {
      return new Response(
        JSON.stringify({ error: "Identity not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If URLs not provided directly, generate signed URLs from stored paths
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let trainingUrl = training_video_url;
    let consentUrl = consent_video_url;

    if (!trainingUrl && identity.reference_video_path) {
      const { data: signedData } = await serviceClient.storage
        .from("identity_assets")
        .createSignedUrl(identity.reference_video_path, 3600);
      trainingUrl = signedData?.signedUrl;
    }

    // Consent video path from metadata
    const metadata = identity.metadata as Record<string, unknown> || {};
    if (!consentUrl && metadata.consent_video_path) {
      const { data: signedData } = await serviceClient.storage
        .from("identity_assets")
        .createSignedUrl(metadata.consent_video_path as string, 3600);
      consentUrl = signedData?.signedUrl;
    }

    if (!trainingUrl) {
      return new Response(
        JSON.stringify({ error: "No training video available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!consentUrl) {
      return new Response(
        JSON.stringify({ error: "No consent video available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Creating HeyGen digital twin for identity:", identity_id);

    // Build callback URL for avatar status updates
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const callbackUrl = `${supabaseUrl}/functions/v1/heygen-avatar-webhook`;

    // Create digital twin on HeyGen
    const heygenResponse = await fetch(`${HEYGEN_API_URL}/v2/video_avatar`, {
      method: "POST",
      headers: {
        "X-Api-Key": HEYGEN_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        training_footage_url: trainingUrl,
        video_consent_url: consentUrl,
        avatar_name: avatar_name || identity.display_name,
      }),
    });

    const heygenText = await heygenResponse.text();
    let heygenData: any;
    try {
      heygenData = JSON.parse(heygenText);
    } catch {
      console.error("HeyGen returned non-JSON:", heygenText.substring(0, 500));
      return new Response(
        JSON.stringify({ error: `HeyGen returned invalid response (status ${heygenResponse.status})` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!heygenResponse.ok) {
      console.error("HeyGen API error:", heygenResponse.status, heygenData);
      return new Response(
        JSON.stringify({ error: `HeyGen API error: ${heygenData.message || heygenData.error || "Unknown error"}` }),
        { status: heygenResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const avatarId = heygenData.data?.avatar_id || heygenData.avatar_id;
    console.log("HeyGen digital twin created:", avatarId, "callback:", callbackUrl);

    // Update identity with HeyGen avatar ID
    await supabase
      .from("identities")
      .update({
        provider_identity_id: avatarId,
        clone_status: "pending",
        metadata: {
          ...metadata,
          heygen_avatar_id: avatarId,
          heygen_status: "training",
        },
      })
      .eq("id", identity_id);

    return new Response(
      JSON.stringify({
        success: true,
        avatar_id: avatarId,
        status: "training",
        message: "Clone en cours de création. Vous serez notifié quand il sera prêt.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("heygen-create-avatar error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
