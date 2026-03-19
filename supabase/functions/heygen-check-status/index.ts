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

    const { type, id } = await req.json();

    if (type === "avatar") {
      const response = await fetch(`${HEYGEN_API_URL}/v2/avatars/${id}`, {
        headers: { "X-Api-Key": HEYGEN_API_KEY },
      });

      const data = await response.json();
      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: `HeyGen API error [${response.status}]: ${JSON.stringify(data)}` }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          status: data.data?.status || "unknown",
          avatar_id: id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (type === "video") {
      const response = await fetch(`${HEYGEN_API_URL}/v1/video_status.get?video_id=${id}`, {
        headers: { "X-Api-Key": HEYGEN_API_KEY },
      });

      const data = await response.json();
      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: `HeyGen API error [${response.status}]: ${JSON.stringify(data)}` }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          status: data.data?.status || "unknown",
          video_id: id,
          video_url: data.data?.video_url,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "type must be 'avatar' or 'video'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("heygen-check-status error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
