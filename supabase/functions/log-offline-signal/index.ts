import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Phase 0.2 : offline_signal uniquement.
const ALLOWED_EVENT_TYPES = ["offline_signal"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    // ── Étape 1 : Auth JWT ──────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Étape 2 : Validation inputs ─────────────────────────────────
    const body = await req.json();
    const { campaign_id, event_type, event_layer, event_data } = body;

    if (!campaign_id) {
      return new Response(
        JSON.stringify({ error: "campaign_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!event_type || !ALLOWED_EVENT_TYPES.includes(event_type)) {
      return new Response(
        JSON.stringify({ error: `event_type must be one of: ${ALLOWED_EVENT_TYPES.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (event_layer !== "declared") {
      return new Response(
        JSON.stringify({ error: "event_layer must be 'declared'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!event_data || typeof event_data !== "object" || Array.isArray(event_data)) {
      return new Response(
        JSON.stringify({ error: "event_data required (object)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validation par type — offline_signal exige signal + label non vides
    if (event_type === "offline_signal") {
      const sig = (event_data as Record<string, unknown>).signal;
      const lbl = (event_data as Record<string, unknown>).label;
      if (!sig || typeof sig !== "string" || sig.trim() === "") {
        return new Response(
          JSON.stringify({ error: "event_data.signal required (non-empty string) for offline_signal" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!lbl || typeof lbl !== "string" || lbl.trim() === "") {
        return new Response(
          JSON.stringify({ error: "event_data.label required (non-empty string) for offline_signal" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Garde taille
    if (JSON.stringify(event_data).length > 5000) {
      return new Response(
        JSON.stringify({ error: "event_data too large (max 5000 chars)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Étape 3 : Vérification accès org ─────────────────────────────
    const { data: campaign, error: campaignError } = await userClient
      .from("campaigns")
      .select("org_id")
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: membership } = await userClient
      .from("org_memberships")
      .select("id")
      .eq("org_id", campaign.org_id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Étape 4 : Enrichissement côté serveur ────────────────────────
    const enrichedEventData = {
      ...(event_data as Record<string, unknown>),
      actor_user_id: user.id,
      logged_via: "log-offline-signal",
      source: "ae_input",
    };

    // ── Étape 5 : INSERT timeline_events via adminClient ─────────────
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: inserted, error: insertError } = await adminClient
      .from("timeline_events")
      .insert({
        campaign_id,
        event_type,
        event_layer,
        event_data: enrichedEventData,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[log-offline-signal] Insert failed:", insertError);
      await adminClient.from("system_failures").insert({
        campaign_id,
        failure_type: "execution",
        severity: "low",
        message: "log-offline-signal insert failed",
        reason: insertError.message,
      }).catch(() => {});
      return new Response(
        JSON.stringify({ success: false, error: "insert_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, event_id: inserted.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    // ── Étape 6 : catch global auditable ────────────────────────────
    console.error("[log-offline-signal] Unexpected error:", err);
    try {
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      await adminClient.from("system_failures").insert({
        campaign_id: null,
        failure_type: "execution",
        severity: "low",
        message: "log-offline-signal unexpected error",
        reason: String(err),
      });
    } catch (_) { /* best effort */ }

    return new Response(
      JSON.stringify({ success: false, error: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
