import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HUBSPOT_API = "https://api.hubapi.com";

interface ViewerPayload {
  viewer_email: string;
  viewer_name: string | null;
  viewer_title: string | null;
  viewer_company: string | null;
  watch_percentage: number;
  max_percentage_reached: number;
  total_watch_seconds: number;
  session_count: number;
  lead_score: number;
  interest_level: string;
  is_champion: boolean;
  referral_count: number;
  committee_role: string;
  campaign_name?: string;
  first_watched_at: string;
  last_watched_at: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Get user's org and HubSpot token from org settings
    const { data: membership } = await supabase
      .from("org_memberships")
      .select("org_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: "No org found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: org } = await supabase
      .from("orgs")
      .select("settings")
      .eq("id", membership.org_id)
      .single();

    const hubspotToken = (org?.settings as Record<string, unknown>)?.hubspot_api_key as string | undefined;
    if (!hubspotToken) {
      return new Response(
        JSON.stringify({ error: "HubSpot API key not configured. Go to Settings to add it." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, viewers } = body as { action: string; viewers: ViewerPayload[] };

    if (action === "sync_contacts") {
      const results = [];

      for (const viewer of viewers) {
        if (!viewer.viewer_email) {
          results.push({ email: null, status: "skipped", reason: "no email" });
          continue;
        }

        // Search existing contact
        const searchRes = await fetch(
          `${HUBSPOT_API}/crm/v3/objects/contacts/search`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${hubspotToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              filterGroups: [
                {
                  filters: [
                    { propertyName: "email", operator: "EQ", value: viewer.viewer_email },
                  ],
                },
              ],
            }),
          }
        );

        const searchData = await searchRes.json();
        const existingContact = searchData?.results?.[0];

        const properties: Record<string, string> = {
          email: viewer.viewer_email,
          ekko_lead_score: String(viewer.lead_score),
          ekko_watch_percentage: String(viewer.max_percentage_reached),
          ekko_total_watch_time: String(viewer.total_watch_seconds),
          ekko_sessions: String(viewer.session_count),
          ekko_interest_level: viewer.interest_level,
          ekko_is_champion: viewer.is_champion ? "true" : "false",
          ekko_committee_role: viewer.committee_role,
          ekko_last_activity: viewer.last_watched_at,
        };

        if (viewer.viewer_name) {
          const parts = viewer.viewer_name.split(" ");
          properties.firstname = parts[0] || "";
          properties.lastname = parts.slice(1).join(" ") || "";
        }
        if (viewer.viewer_title) properties.jobtitle = viewer.viewer_title;
        if (viewer.viewer_company) properties.company = viewer.viewer_company;
        if (viewer.campaign_name) properties.ekko_campaign = viewer.campaign_name;

        if (existingContact) {
          // Update
          const updateRes = await fetch(
            `${HUBSPOT_API}/crm/v3/objects/contacts/${existingContact.id}`,
            {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${hubspotToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ properties }),
            }
          );
          const updateData = await updateRes.json();
          results.push({
            email: viewer.viewer_email,
            status: updateRes.ok ? "updated" : "error",
            hubspot_id: updateData.id,
            error: updateRes.ok ? undefined : updateData.message,
          });
        } else {
          // Create
          const createRes = await fetch(
            `${HUBSPOT_API}/crm/v3/objects/contacts`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${hubspotToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ properties }),
            }
          );
          const createData = await createRes.json();
          results.push({
            email: viewer.viewer_email,
            status: createRes.ok ? "created" : "error",
            hubspot_id: createData.id,
            error: createRes.ok ? undefined : createData.message,
          });
        }
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "test_connection") {
      const testRes = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts?limit=1`, {
        headers: { Authorization: `Bearer ${hubspotToken}` },
      });
      const ok = testRes.ok;
      return new Response(
        JSON.stringify({ success: ok, message: ok ? "Connexion HubSpot OK" : "Token invalide" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("HubSpot sync error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
