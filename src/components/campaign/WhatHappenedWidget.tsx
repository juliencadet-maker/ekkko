import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "call_positive", label: "Call positif" },
  { value: "call_negative", label: "Call négatif" },
  { value: "internal_progress", label: "Avancement interne" },
  { value: "new_contact", label: "Nouveau contact" },
  { value: "nothing", label: "Rien" },
];

interface WhatHappenedWidgetProps {
  campaignId: string;
}

export function WhatHappenedWidget({ campaignId }: WhatHappenedWidgetProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = async () => {
    if (!selected) return;
    setIsSaving(true);
    try {
      await supabase.from("timeline_events").insert({
        campaign_id: campaignId,
        event_type: selected,
        event_layer: "declared",
        event_data: { source: "what_happened_widget" },
      });
      toast.success("Signal enregistré");
      setSelected(null);
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
            Ce qui s'est passé en dehors d'Ekko — enrichit la lecture du deal.
          </p>
        </button>
      </CardHeader>
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-out",
          isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <CardContent className="space-y-2 pt-1">
          {OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                selected === opt.value
                  ? "border-accent bg-accent/5"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <input
                type="radio"
                name="what_happened"
                value={opt.value}
                checked={selected === opt.value}
                onChange={() => setSelected(opt.value)}
                className="accent-[hsl(var(--accent))]"
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
          {selected && (
            <Button
              size="sm"
              className="w-full mt-2 rounded-cta bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={handleSubmit}
              disabled={isSaving}
            >
              Enregistrer
            </Button>
          )}
        </CardContent>
      </div>
    </Card>
  );
}
