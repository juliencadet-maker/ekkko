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

    // Generate a signed URL for the reference video (Tavus needs a public URL)
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const callbackUrl = `${supabaseUrl}/functions/v1/tavus-webhook`;

    console.log("Creating Tavus replica for identity:", identity_id, "with callback:", callbackUrl);

    // Create replica on Tavus with callback_url for training completion notification
    const tavusResponse = await fetch(`${TAVUS_API_URL}/v2/replicas`, {
      method: "POST",
      headers: {
        "x-api-key": TAVUS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        train_video_url: signedUrlData.signedUrl,
        consent_video_url: signedUrlData.signedUrl,
        replica_name: identity.display_name,
        model_name: "phoenix-4",
        callback_url: callbackUrl,
      }),
    });

    const tavusData = await tavusResponse.json();

    if (!tavusResponse.ok) {
      console.error("Tavus API error:", tavusResponse.status, tavusData);
      return new Response(
        JSON.stringify({ error: `Tavus API error: ${tavusData.message || tavusData.detail || "Unknown error"}` }),
        { status: tavusResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const replicaId = tavusData.replica_id;
    console.log("Tavus replica created:", replicaId);

    // Update identity with Tavus replica ID and clone statuses
    const { error: updateError } = await serviceClient
      .from("identities")
      .update({
        provider_identity_id: replicaId,
        clone_status: "training",
        status: "pending_approval",
        metadata: {
          ...(identity.metadata as Record<string, unknown> || {}),
          tavus_replica_id: replicaId,
          tavus_clone_status: "training",
          // Voice clone is zero-shot via Voxtral — ready as soon as reference video exists
          voice_clone_status: "ready",
        },
      })
      .eq("id", identity_id);

    if (updateError) {
      console.error("Update identity error:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        replica_id: replicaId,
        status: "training",
        message: "Replica creation started. Training typically takes a few minutes.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("tavus-create-replica error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
