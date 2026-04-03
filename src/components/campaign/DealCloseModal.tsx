import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { EkkoLoader } from "@/components/ui/EkkoLoader";

interface DealCloseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignName: string;
  dealScore?: any;
}

const OUTCOME_CATEGORIES = [
  {
    label: "Gagné",
    icon: CheckCircle2,
    color: "text-emerald-700",
    bg: "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20",
    outcomes: [
      { value: "won_closed", label: "Gagné — Signé" },
      { value: "won_expanded", label: "Gagné — Expansion" },
      { value: "won_renewal", label: "Gagné — Renouvellement" },
    ],
  },
  {
    label: "Perdu",
    icon: XCircle,
    color: "text-red-700",
    bg: "bg-red-500/10 border-red-500/20 hover:bg-red-500/20",
    outcomes: [
      { value: "lost_competitor", label: "Perdu — Concurrent identifié" },
      { value: "lost_to_internal_build", label: "Perdu — Développement interne" },
      { value: "lost_budget", label: "Perdu — Budget" },
      { value: "lost_timing", label: "Perdu — Mauvais timing" },
      { value: "executive_veto", label: "Perdu — Veto exécutif" },
      { value: "technical_disqualification", label: "Perdu — Disqualification technique" },
      { value: "legal_security_block", label: "Perdu — Blocage légal/sécurité" },
      { value: "procurement_block", label: "Perdu — Blocage procurement" },
    ],
  },
  {
    label: "Bloqué",
    icon: Clock,
    color: "text-amber-700",
    bg: "bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20",
    outcomes: [
      { value: "no_decision", label: "Pas de décision — statu quo" },
      { value: "ghost_deal", label: "Deal fantôme — opportunité fictive" },
      { value: "champion_left", label: "Champion parti" },
      { value: "sponsor_promoted", label: "Sponsor promu/muté" },
    ],
  },
];

export function DealCloseModal({ open, onOpenChange, campaignId, campaignName, dealScore }: DealCloseModalProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedOutcome) return;
    setIsSubmitting(true);

    try {
      // Insert deal outcome
      const { error: outcomeError } = await supabase.from("deal_outcomes").insert({
        campaign_id: campaignId,
        outcome: selectedOutcome,
        notes: notes || null,
        outcome_at: new Date().toISOString(),
      });
      if (outcomeError) throw outcomeError;

      // Update campaign status
      const newStatus = selectedOutcome.startsWith("won") ? "completed" : "cancelled";
      const { error: campaignError } = await supabase
        .from("campaigns")
        .update({ status: newStatus, completed_at: new Date().toISOString() })
        .eq("id", campaignId);
      if (campaignError) throw campaignError;

      toast.success(`Deal clôturé : ${selectedOutcome.replace(/_/g, " ")}`);
      onOpenChange(false);
      setSelectedOutcome(null);
      setNotes("");
    } catch (err) {
      console.error("Close deal error:", err);
      toast.error("Erreur lors de la clôture du deal");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Clôturer le deal</DialogTitle>
          <DialogDescription>
            {campaignName} — Sélectionnez l'issue du deal pour calibrer les modèles
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {OUTCOME_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <div key={cat.label}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-4 w-4 ${cat.color}`} />
                  <span className={`text-xs font-semibold uppercase tracking-wider ${cat.color}`}>{cat.label}</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {cat.outcomes.map((o) => (
                    <button
                      key={o.value}
                      onClick={() => setSelectedOutcome(o.value)}
                      className={`text-left px-3 py-2 rounded-md border text-xs font-medium transition-all ${
                        selectedOutcome === o.value
                          ? `ring-2 ring-primary ${cat.bg}`
                          : `${cat.bg} opacity-70`
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          <div>
            <label className="text-xs font-medium text-muted-foreground">Notes (optionnel)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contexte additionnel sur cette issue..."
              className="mt-1"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={!selectedOutcome || isSubmitting}>
            {isSubmitting && <EkkoLoader mode="once" size={16} className="mr-2" />}
            Clôturer le deal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
