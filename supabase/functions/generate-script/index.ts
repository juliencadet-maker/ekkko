import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScriptContext {
  recipientName: string;
  recipientCompany: string;
  purpose: string;
  tone: string;
  keyPoints: string;
  callToAction: string;
  senderName: string;
  senderTitle: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { context } = await req.json() as { context: ScriptContext };
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Tu es un expert en communication commerciale et marketing vidéo. Tu génères des scripts de vidéos personnalisées pour des campagnes d'outreach B2B.

Les scripts doivent être:
- Courts et percutants (30-60 secondes de parole, environ 80-150 mots)
- Personnalisés avec le nom du destinataire
- Authentiques et naturels (pas de langage corporate)
- Orientés vers l'action avec un CTA clair

RÈGLE ABSOLUE : utiliser systématiquement le vouvoiement (vous, votre, vos). Ne jamais utiliser le tutoiement (tu, ton, tes) sauf si l'utilisateur écrit explicitement dans ses points clés ou son CTA une instruction comme "utiliser le tu" ou "tutoyer".

Utilise les variables suivantes dans ton script:
- {prénom} pour le prénom du destinataire
- {nom} pour le nom du destinataire  
- {entreprise} pour l'entreprise du destinataire

Réponds UNIQUEMENT avec le script, sans introduction ni explication.`;

    const userPrompt = `Génère un script vidéo personnalisé avec les informations suivantes:

**Destinataire:** ${context.recipientName || '{prénom}'} de ${context.recipientCompany || '{entreprise}'}
**Objectif:** ${context.purpose}
**Ton souhaité:** ${context.tone}
**Points clés à mentionner:** ${context.keyPoints}
**Call-to-action:** ${context.callToAction}
**Expéditeur:** ${context.senderName}, ${context.senderTitle}

Génère le script maintenant:`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requêtes atteinte. Veuillez réessayer dans quelques instants." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédits AI épuisés. Veuillez recharger votre compte." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erreur lors de la génération du script" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    let script = data.choices?.[0]?.message?.content || "";

    // Replace placeholders with actual values if provided
    if (context.recipientName) {
      script = script.replace(/\{prénom\}/gi, context.recipientName);
      script = script.replace(/\{prenom\}/gi, context.recipientName);
    }
    if (context.recipientCompany) {
      script = script.replace(/\{entreprise\}/gi, context.recipientCompany);
    }

    // Return script along with context data for auto-filling recipient fields
    return new Response(
      JSON.stringify({ 
        script,
        recipientData: {
          firstName: context.recipientName || "",
          company: context.recipientCompany || "",
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-script error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
