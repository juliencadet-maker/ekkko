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
    const { campaign_id, email } = await req.json();

    if (!campaign_id || !email) {
      return new Response(
        JSON.stringify({ error: "campaign_id and email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailDomain = normalizedEmail.split("@")[1];

    if (!emailDomain) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check if there's an access list for this campaign
    const { data: accessList, error } = await supabase
      .from("video_access_list")
      .select("access_type, email, domain")
      .eq("campaign_id", campaign_id);

    if (error) throw error;

    // If no access list exists, the video is open to anyone (backward compatible)
    if (!accessList || accessList.length === 0) {
      return new Response(
        JSON.stringify({ allowed: true, reason: "no_restrictions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check email match
    const emailMatch = accessList.some(
      (a) => a.access_type === "email" && a.email?.toLowerCase() === normalizedEmail
    );

    if (emailMatch) {
      return new Response(
        JSON.stringify({ allowed: true, reason: "email_match" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check domain match
    const domainMatch = accessList.some(
      (a) => a.access_type === "domain" && a.domain?.toLowerCase() === emailDomain
    );

    if (domainMatch) {
      return new Response(
        JSON.stringify({ allowed: true, reason: "domain_match" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ allowed: false, reason: "not_in_access_list" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("check-video-access error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
