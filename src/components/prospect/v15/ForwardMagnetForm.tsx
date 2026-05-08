import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Props {
  campaignId: string;
  onSuccess?: () => void;
}

const ROLES = [
  { value: "champion", label: "Sponsor / Champion" },
  { value: "decideur", label: "Décideur" },
  { value: "influenceur", label: "Influenceur" },
  { value: "utilisateur", label: "Utilisateur final" },
  { value: "autre", label: "Autre" },
];

/**
 * Phase 1d — Forward Magnet (D38).
 * Mini-form prénom + email + rôle. Anti-spam D56 côté edge.
 */
export function ForwardMagnetForm({ campaignId, onSuccess }: Props) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!firstName || !email || !role) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("forward-magnet-submit", {
        body: { campaign_id: campaignId, first_name: firstName, email, role },
      });
      if (error) throw error;
      if ((data as { rate_limited?: boolean })?.rate_limited) {
        toast.info("Cette personne a déjà été partagée récemment.");
        return;
      }
      setDone(true);
      toast.success("Merci, le contenu lui sera transmis.");
      onSuccess?.();
    } catch (e) {
      toast.error("Une erreur est survenue. Réessayez plus tard.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-foreground/80">
        Merci, votre collègue recevra l'accès dans quelques instants.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-medium text-foreground">Partager avec un collègue</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Input placeholder="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <Input
          type="email"
          placeholder="Email professionnel"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <Select value={role} onValueChange={setRole}>
        <SelectTrigger>
          <SelectValue placeholder="Son rôle dans la décision" />
        </SelectTrigger>
        <SelectContent>
          {ROLES.map((r) => (
            <SelectItem key={r.value} value={r.value}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        onClick={submit}
        disabled={!firstName || !email || !email.includes("@") || !role || submitting}
        className="w-full"
      >
        {submitting ? "Envoi..." : "Partager"}
      </Button>
    </div>
  );
}
