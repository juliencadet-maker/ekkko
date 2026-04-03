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

      // Call ekko-agent to analyze the offline signal
      const analysisMessages = [
        {
          role: "user",
          content: `L'AE vient de décrire une interaction offline. Analyse ce texte et extrais :
- Le sentiment général (positif / négatif / neutre)
- Les contacts mentionnés si identifiables
- L'impact sur le deal (avancement / blocage / neutre)
Retourne un JSON : { "sentiment": "...", "contacts_mentioned": [...], "deal_impact": "...", "summary_fr": "..." }

Texte de l'AE :
${text.trim()}`
        }
      ];

      let enrichedData: Record<string, unknown> = { raw_text: text.trim() };

      try {
        const { data: agentData, error: agentError } = await supabase.functions.invoke("ekko-agent", {
          body: {
            campaign_id: campaignId,
            messages: analysisMessages,
            user_id: user?.id,
          },
        });

        if (!agentError && agentData?.reply) {
          // Try to parse JSON from agent reply
          const jsonMatch = agentData.reply.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              enrichedData = {
                raw_text: text.trim(),
                sentiment: parsed.sentiment || "neutre",
                contacts_mentioned: parsed.contacts_mentioned || [],
                deal_impact: parsed.deal_impact || "neutre",
                summary_fr: parsed.summary_fr || text.trim().slice(0, 80),
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
            placeholder={"Decrivez ce qui s'est passe en dehors d'Ekko...\n\nEx: J'ai eu Pierre au telephone, il m'a dit que le budget etait valide mais que le DSI hesitait encore."}
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
