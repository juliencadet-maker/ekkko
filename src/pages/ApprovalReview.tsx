import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Pencil,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

type ReviewState = "loading" | "ready" | "done" | "error" | "expired";

export default function ApprovalReview() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<ReviewState>("loading");
  const [approval, setApproval] = useState<any>(null);
  const [editedScript, setEditedScript] = useState("");
  const [comment, setComment] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!token) return;
    const fetchApproval = async () => {
      const { data, error } = await supabase
        .from("approval_requests")
        .select("*, campaigns(name, script, identities(display_name))")
        .eq("approval_token", token)
        .maybeSingle();

      if (error || !data) {
        setState("error");
        return;
      }
      if (data.status !== "pending") {
        setApproval(data);
        setDecision(data.status);
        setState("done");
        return;
      }
      setApproval(data);
      setEditedScript(data.script_snapshot || data.campaigns?.script || "");
      setState("ready");
    };
    fetchApproval();
  }, [token]);

  const handleAction = async (action: "approved" | "rejected") => {
    if (!approval) return;
    setIsSubmitting(true);

    try {
      const scriptChanged = action === "approved" && editedScript !== (approval.script_snapshot || approval.campaigns?.script);

      // Update approval request
      const { error: updateError } = await supabase
        .from("approval_requests")
        .update({
          status: action,
          decision_comment: comment || null,
          decided_at: new Date().toISOString(),
          ...(scriptChanged ? { script_snapshot: editedScript } : {}),
        })
        .eq("id", approval.id)
        .eq("status", "pending");

      if (updateError) throw updateError;

      // Update campaign via edge function (service role needed for campaign update)
      await supabase.functions.invoke("process-approval-decision", {
        body: {
          approval_id: approval.id,
          action,
          edited_script: scriptChanged ? editedScript : null,
          comment: comment || null,
        },
      });

      setDecision(action);
      setState("done");
    } catch (error) {
      console.error("Approval action error:", error);
      toast({
        title: "Erreur",
        description: "Impossible de traiter cette demande",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const campaignName = approval?.campaigns?.name || "Campagne";
  const identityName = approval?.campaigns?.identities?.display_name || "";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl mx-auto mb-4">
            E
          </div>
          <h1 className="text-2xl font-bold text-foreground">Ekko</h1>
          <p className="text-sm text-muted-foreground mt-1">Validation de script</p>
        </div>

        {state === "loading" && (
          <Card>
            <CardContent className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        )}

        {state === "error" && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
              <h2 className="text-xl font-semibold mb-2">Lien invalide</h2>
              <p className="text-muted-foreground">
                Ce lien de validation n'existe pas ou a expiré.
              </p>
            </CardContent>
          </Card>
        )}

        {state === "done" && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              {decision === "approved" ? (
                <>
                  <CheckCircle2 className="h-16 w-16 text-accent mb-4" />
                  <h2 className="text-xl font-semibold mb-2">Script approuvé ✓</h2>
                  <p className="text-muted-foreground">
                    La campagne « {campaignName} » va entrer en production.
                  </p>
                </>
              ) : (
                <>
                  <XCircle className="h-16 w-16 text-destructive mb-4" />
                  <h2 className="text-xl font-semibold mb-2">Script refusé</h2>
                  <p className="text-muted-foreground">
                    Le créateur de la campagne sera notifié de votre décision.
                  </p>
                </>
              )}
              <div className="mt-6 p-4 bg-muted rounded-lg flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <p className="text-sm text-muted-foreground">
                  Cette action a été enregistrée dans le journal d'audit d'Ekko.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {state === "ready" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Demande de validation</CardTitle>
                <CardDescription>
                  Un membre de votre organisation souhaite utiliser votre identité « {identityName} » pour la campagne « {campaignName} ».
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold">Script proposé</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditing(!isEditing)}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      {isEditing ? "Aperçu" : "Modifier"}
                    </Button>
                  </div>
                  {isEditing ? (
                    <Textarea
                      value={editedScript}
                      onChange={(e) => setEditedScript(e.target.value)}
                      rows={10}
                      className="font-mono text-sm"
                    />
                  ) : (
                    <div className="p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                      {editedScript}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Commentaire (optionnel)</Label>
                  <Textarea
                    placeholder="Ajoutez un commentaire pour l'équipe..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => handleAction("rejected")}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                Refuser
              </Button>
              <Button
                className="flex-1"
                onClick={() => handleAction("approved")}
                disabled={isSubmitting || !editedScript.trim()}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Approuver
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Votre décision sera enregistrée dans le journal d'audit avec preuve horodatée.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
