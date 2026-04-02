import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es un expert en communication orale en français d'entreprise.
Transforme le script écrit fourni en langage parlé naturel français pour une vidéo exec.

RÈGLES STRICTES :
- Une idée par phrase, phrases courtes
- Supprimer le jargon corporate ("point d'étape", "je me rends disponible", "dans ce sens")
- Conserver le vouvoiement si présent dans l'original
- Maximum 90 secondes à l'oral (environ 200 mots)
- Garder les variables comme {prénom}, {entreprise}, {nom} telles quelles
- Ton : direct, humain, chaleureux — pas corporate, pas robotique
- Le message doit sonner comme quelqu'un qui parle, pas qui lit
- Commencer directement par le message, jamais par "Voici" ou "Bien sûr"
- Retourner UNIQUEMENT le script transformé, rien d'autre`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { campaign_id, script } = await req.json();

    if (!campaign_id || !script) {
      return new Response(
        JSON.stringify({ error: "campaign_id et script sont requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY manquante");
    }

    // Call Lovable AI gateway to transform script
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `SCRIPT À TRANSFORMER :\n${script}` },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const scriptOral = aiData.choices?.[0]?.message?.content?.trim();

    if (!scriptOral) {
      throw new Error("AI n'a pas retourné de script transformé");
    }

    // Save to database
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { error: updateError } = await supabase
      .from("campaigns")
      .update({
        script_oral: scriptOral,
        script_oral_generated_at: new Date().toISOString(),
      })
      .eq("id", campaign_id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ ok: true, script_oral: scriptOral }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("transform-script-to-speech error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
