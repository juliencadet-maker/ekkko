import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EXTRACTION_PROMPT = `Tu reçois un message texte d'un AE commercial sur l'état d'un de ses deals.
Extrais uniquement ce qui est factuel ou explicitement déclaré par l'AE.
Ne jamais inventer. Ne jamais inférer au-delà de ce qui est dit.

Retourne UNIQUEMENT un objet JSON valide, sans markdown, sans backticks, sans texte avant ou après :
{
  "summary": "1 phrase max résumant ce qui s'est passé",
  "signals": [
    { "type": "string", "value": "string" }
  ],
  "stage_hint": "string ou null",
  "sentiment": "positif | neutre | negatif | null"
}

Règles strictes sur signals.type — utilise UNIQUEMENT ces valeurs si applicable :
sponsor_contact | pricing_sent | meeting_done | blocker_identified | deal_advancing
Si aucune ne correspond → ne pas inclure le signal dans le tableau.

Autres règles :
- Si l'AE dit "ça avance" sans détail → sentiment: positif, signals: []
- Si mention d'un contact → type: "sponsor_contact", value: "ce qui a été dit"
- Si mention d'envoi de document → type: "pricing_sent" si c'est un pricing, sinon ignorer
- Si ambiguë → ne pas inclure dans signals
- Maximum 5 signals
- summary en français, factuel, sans interprétation`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // ── Sécurité : vérification auth + org ────────────────────────────
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

    const { campaign_id, raw_input } = await req.json();

    if (!campaign_id || !raw_input) {
      return new Response(
        JSON.stringify({ error: "campaign_id and raw_input required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (raw_input.length > 1000) {
      return new Response(
        JSON.stringify({ error: "raw_input exceeds 1000 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Vérification accès org
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
    // ── Fin vérification sécurité ─────────────────────────────────────

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    let extracted: Record<string, unknown> = {
      summary: null,
      signals: [],
      stage_hint: null,
      sentiment: null,
    };
    let translationFailed = false;

    if (lovableApiKey) {
      try {
        const aiResponse = await fetch(
          "https://ai-gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${lovableApiKey}`,
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              max_tokens: 400,
              messages: [
                { role: "system", content: EXTRACTION_PROMPT },
                { role: "user", content: raw_input },
              ],
            }),
          }
        );

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const rawText = aiData.choices?.[0]?.message?.content || "";
          try {
            const cleaned = rawText
              .replace(/```json/g, "")
              .replace(/```/g, "")
              .trim();
            extracted = JSON.parse(cleaned);

            // Validation serveur — liste fermée signals.type
            const ALLOWED_SIGNAL_TYPES = [
              "sponsor_contact",
              "pricing_sent",
              "meeting_done",
              "blocker_identified",
              "deal_advancing",
            ];
            if (Array.isArray(extracted.signals)) {
              extracted.signals = (extracted.signals as any[]).filter(
                (s: any) => typeof s.type === "string" && ALLOWED_SIGNAL_TYPES.includes(s.type)
              );
            }

            // Garde summary — max 300 caractères
            if (typeof extracted.summary === "string" && extracted.summary.length > 300) {
              extracted.summary = extracted.summary.slice(0, 300);
            }
          } catch {
            console.error("[translate-offline-signal] JSON parse failed:", rawText);
            translationFailed = true;
          }
        } else {
          translationFailed = true;
        }
      } catch {
        translationFailed = true;
      }
    } else {
      translationFailed = true;
    }

    if (translationFailed) {
      await adminClient.from("system_failures").insert({
        campaign_id,
        failure_type: "inference_error",
        severity: "low",
        message: "Offline signal translation failed",
        reason: "LLM extraction failed — raw_input preserved",
      }).catch(() => {});
    }

    // raw_input toujours conservé
    const eventData: Record<string, unknown> = {
      raw_input,
      origin: "ae",
      source: "ae_input",
      ...extracted,
      ...(translationFailed ? { error: "translation_failed" } : {}),
    };

    const { data: inserted, error: insertError } = await adminClient
      .from("timeline_events")
      .insert({
        campaign_id,
        event_type: "offline_signal_translated",
        event_layer: "declared",
        event_data: eventData,
      })
      .select("id")
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({ success: false, error: "insert_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, event_id: inserted.id, extracted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[translate-offline-signal] Unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
