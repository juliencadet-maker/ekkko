import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface WhatHappenedWidgetProps {
  campaignId: string;
}

export function WhatHappenedWidget({ campaignId }: WhatHappenedWidgetProps) {
  const [text, setText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const analysisMessages = [
        {
          role: "user",
          content: `L'AE vient de décrire une interaction offline.
Analyse ce texte et retourne UNIQUEMENT un JSON valide (sans markdown, sans explication) avec cette structure exacte :
{
  "sentiment": "positive" | "negative" | "neutral",
  "impact": "low" | "medium" | "high",
  "contacts_detected": ["nom1", "nom2"],
  "summary_fr": "résumé en français, max 100 caractères"
}

Règles :
- Si tu ne peux pas extraire le sentiment avec confiance, utilise "neutral"
- Si tu ne peux pas évaluer l'impact avec confiance, utilise "low"
- contacts_detected = tableau vide si aucun contact identifiable
- summary_fr = résumé factuel, max 100 caractères
- Ce signal est du contexte déclaratif (declared). Il ne modifie JAMAIS le DES ni le priority_score. fact > inference > declared.

Texte de l'AE :
${text.trim()}`
        }
      ];

      let enrichedData: Record<string, unknown> = {
        raw_text: text.trim(),
        sentiment: "neutral",
        impact: "low",
        contacts_detected: [],
        summary_fr: text.trim().slice(0, 100),
        signal_layer: "declared",
      };

      try {
        const { data: agentData, error: agentError } = await supabase.functions.invoke("ekko-agent", {
          body: {
            campaign_id: campaignId,
            messages: analysisMessages,
            user_id: user?.id,
          },
        });

        if (!agentError && agentData?.reply) {
          const jsonMatch = agentData.reply.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              const validSentiments = ["positive", "negative", "neutral"];
              const validImpacts = ["low", "medium", "high"];
              enrichedData = {
                raw_text: text.trim(),
                sentiment: validSentiments.includes(parsed.sentiment) ? parsed.sentiment : "neutral",
                impact: validImpacts.includes(parsed.impact) ? parsed.impact : "low",
                contacts_detected: Array.isArray(parsed.contacts_detected) ? parsed.contacts_detected : [],
                summary_fr: typeof parsed.summary_fr === "string" ? parsed.summary_fr.slice(0, 100) : text.trim().slice(0, 100),
                signal_layer: "declared",
              };
            } catch {
              enrichedData.summary_fr = text.trim().slice(0, 80);
            }
          }
        }
      } catch {
        // Agent unavailable — store raw text anyway
        enrichedData.summary_fr = text.trim().slice(0, 80);
      }

      await supabase.from("timeline_events").insert([{
        campaign_id: campaignId,
        event_type: "offline_signal",
        event_layer: "declared",
        event_data: enrichedData as any,
      }]);

      toast.success("Signal enregistre");
      setText("");
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <button
          className="w-full text-left"
          onClick={() => setIsOpen((v) => !v)}
        >
          <CardTitle className="text-sm font-semibold cursor-pointer hover:text-foreground/80 transition-colors">
            Signal offline
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Ce qui s'est passe en dehors d'Ekko — enrichit la lecture du deal.
          </p>
        </button>
      </CardHeader>
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-out",
          isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <CardContent className="space-y-3 pt-1">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Ex : Call positif avec le CFO, mais budget a confirmer en interne avant fin avril."}
            className="min-h-[80px] resize-y text-sm"
          />
          {text.trim() && (
            <Button
              size="sm"
              variant="outline"
              className="w-full mt-2 rounded-cta border-primary text-primary hover:bg-primary/5"
              onClick={handleSubmit}
              disabled={isSaving}
            >
              {isSaving ? "Analyse en cours..." : "Enregistrer"}
            </Button>
          )}
        </CardContent>
      </div>
    </Card>
  );
}
