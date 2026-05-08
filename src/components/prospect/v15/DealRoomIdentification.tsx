import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export interface IdentificationResult {
  layer: "d1_token" | "d2_social" | "d3_topics";
  identifier?: string;
  topics?: string[];
}

interface Props {
  /** D1 — known viewer pre-resolved from token (no prompt shown). */
  knownViewerName?: string | null;
  /** D3 — neutral topics offered to the prospect. Never auto-selected. */
  topicsAvailable?: string[];
  onIdentify: (result: IdentificationResult) => void;
}

/**
 * Phase 1d — DealRoomIdentification 3 couches.
 * D1 : token URL → identification implicite (badge silencieux).
 * D2 : social select (LinkedIn / email manuel).
 * D3 : topics neutres (chips, jamais pré-sélectionnés).
 */
export function DealRoomIdentification({ knownViewerName, topicsAvailable = [], onIdentify }: Props) {
  const [email, setEmail] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  // D1 : déjà identifié via token, pas d'UI invasive.
  if (knownViewerName) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="secondary" className="font-normal">{knownViewerName}</Badge>
        <span>vous reconnaît.</span>
      </div>
    );
  }

  const toggleTopic = (t: string) => {
    setSelectedTopics((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  return (
    <div className="space-y-6 max-w-md">
      {/* D2 — social select (email manuel) */}
      <div className="space-y-2">
        <label className="text-sm text-foreground/80">Votre email professionnel (optionnel)</label>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="prenom.nom@entreprise.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button
            onClick={() => onIdentify({ layer: "d2_social", identifier: email })}
            disabled={!email || !email.includes("@")}
          >
            Continuer
          </Button>
        </div>
      </div>

      {/* D3 — topics neutres */}
      {topicsAvailable.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-foreground/80">
            Quels sujets vous intéressent dans cette présentation&nbsp;?
          </p>
          <div className="flex flex-wrap gap-2">
            {topicsAvailable.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleTopic(t)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  selectedTopics.includes(t)
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-foreground border-border hover:bg-muted"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {selectedTopics.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onIdentify({ layer: "d3_topics", topics: selectedTopics })}
            >
              Valider mes centres d'intérêt
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
