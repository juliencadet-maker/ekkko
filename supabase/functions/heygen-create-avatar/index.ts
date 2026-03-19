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

    const { identity_id } = await req.json();
    if (!identity_id) {
      return new Response(
        JSON.stringify({ error: "identity_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch identity
    const { data: identity, error: identityError } = await supabase
      .from("identities")
      .select("*, providers(id, provider_type)")
      .eq("id", identity_id)
      .single();

    if (identityError || !identity) {
      return new Response(
        JSON.stringify({ error: "Identity not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!identity.reference_video_path) {
      return new Response(
        JSON.stringify({ error: "Identity has no reference video" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a signed URL for the reference video
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
      .from("identity_assets")
      .createSignedUrl(identity.reference_video_path, 3600);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error("Signed URL error:", signedUrlError);
      return new Response(
        JSON.stringify({ error: "Failed to generate video URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Creating HeyGen avatar for identity:", identity_id);

    // For HeyGen Creator plan: use the Photo Avatar or Instant Avatar API
    // The user will create their Digital Twin manually on HeyGen dashboard
    // This function serves as a placeholder that updates the identity record
    // If the user has already created their avatar on HeyGen, they can link it manually

    // Try to create an instant avatar via API (available on Creator plan)
    const heygenResponse = await fetch(`${HEYGEN_API_URL}/v1/avatar.create`, {
      method: "POST",
      headers: {
        "X-Api-Key": HEYGEN_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        video_url: signedUrlData.signedUrl,
        avatar_name: identity.display_name,
      }),
    });

    const heygenData = await heygenResponse.json();

    if (!heygenResponse.ok || heygenData.error) {
      console.error("HeyGen API error:", heygenResponse.status, heygenData);
      
      // Update identity to indicate manual linking is needed
      await supabase
        .from("identities")
        .update({
          clone_status: "manual_required",
          metadata: {
            ...(identity.metadata as Record<string, unknown> || {}),
            heygen_error: heygenData.error?.message || "API avatar creation not available on this plan",
            manual_avatar_required: true,
          },
        })
        .eq("id", identity_id);

      return new Response(
        JSON.stringify({ 
          success: false, 
          avatar_id: null,
          status: "manual_required",
          message: "L'avatar doit être créé manuellement sur HeyGen (plan Creator). Créez votre Digital Twin sur heygen.com puis liez l'Avatar ID ici.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const avatarId = heygenData.data?.avatar_id;
    console.log("HeyGen avatar created:", avatarId);

    // Update identity with HeyGen avatar ID
    await supabase
      .from("identities")
      .update({
        provider_identity_id: avatarId,
        status: "ready",
        clone_status: "ready",
        metadata: {
          ...(identity.metadata as Record<string, unknown> || {}),
          heygen_avatar_id: avatarId,
          source: "heygen",
        },
      })
      .eq("id", identity_id);

    return new Response(
      JSON.stringify({
        success: true,
        avatar_id: avatarId,
        status: "ready",
        message: "Avatar created successfully.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("heygen-create-avatar error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
