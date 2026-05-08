// Phase 1d.5d-1 — Backlog "Questions du prospect" (Asks queue côté AE).
// Liste prospect_room_questions WHERE ae_status IN ('new','reviewed').
// Actions: mark reviewed / actioned / dismissed.

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Eye, MessageSquare, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PRQ {
  id: string;
  question: string;
  generated_answer: string | null;
  ae_status: string;
  prospect_display_name: string | null;
  prospect_email: string | null;
  captured_at: string;
  metadata: any;
}

interface Props {
  campaignId: string;
  onCountChange?: (count: number) => void;
}

export function ProspectQuestionsSection({ campaignId, onCountChange }: Props) {
  const [items, setItems] = useState<PRQ[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("prospect_room_questions")
      .select("id, question, generated_answer, ae_status, prospect_display_name, prospect_email, captured_at, metadata")
      .eq("campaign_id", campaignId)
      .in("ae_status", ["new", "reviewed"])
      .order("captured_at", { ascending: false })
      .limit(50);
    const filtered = ((data ?? []) as PRQ[])
      // Hide [résumé page] auto-traces from the AE backlog
      .filter((r) => (r.metadata?.kind ?? "qa") === "qa");
    setItems(filtered);
    onCountChange?.(filtered.filter((r) => r.ae_status === "new").length);
    setLoading(false);
  }

  useEffect(() => { load(); }, [campaignId]);

  async function setStatus(id: string, status: "reviewed" | "actioned" | "dismissed") {
    const update: any = {
      ae_status: status,
      reviewed_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("prospect_room_questions").update(update).eq("id", id);
    if (error) {
      toast.error("Échec de la mise à jour");
      return;
    }
    toast.success(
      status === "actioned" ? "Marqué comme traité" :
      status === "dismissed" ? "Question écartée" : "Marqué comme vu"
    );
    load();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" /> Questions du prospect
          {items.filter((r) => r.ae_status === "new").length > 0 && (
            <Badge variant="default" className="ml-1">
              {items.filter((r) => r.ae_status === "new").length} nouvelle
              {items.filter((r) => r.ae_status === "new").length > 1 ? "s" : ""}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Questions posées dans la page du prospect, avec la réponse générée à partir des contenus visibles.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune question pour le moment. Les questions apparaîtront ici dès qu'un prospect en posera une dans la page.
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((q) => (
              <div key={q.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{q.question}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {q.prospect_display_name || q.prospect_email || "Visiteur identifié"}
                      {" · "}
                      {new Date(q.captured_at).toLocaleString("fr-FR", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <Badge variant={q.ae_status === "new" ? "default" : "secondary"} className="text-[10px]">
                    {q.ae_status === "new" ? "Nouveau" : "Vu"}
                  </Badge>
                </div>
                {q.generated_answer && (
                  <div className="rounded-md bg-muted p-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                      Réponse générée à partir des contenus de cette page
                    </p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{q.generated_answer}</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  {q.ae_status === "new" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus(q.id, "reviewed")}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> Marquer comme vu
                    </Button>
                  )}
                  <Button size="sm" variant="default" onClick={() => setStatus(q.id, "actioned")}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Traité
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setStatus(q.id, "dismissed")}>
                    <X className="h-3.5 w-3.5 mr-1" /> Écarter
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
