import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  AlertTriangle,
  User,
  FileText,
  MessageSquare,
} from "lucide-react";

type ReviewState = "loading" | "ready" | "done" | "error";

export default function ApprovalReview() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<ReviewState>("loading");
  const [approval, setApproval] = useState<any>(null);
  const [editedScript, setEditedScript] = useState("");
  const [comment, setComment] = useState("");
  const [showScript, setShowScript] = useState(false);
  const [showComment, setShowComment] = useState(false);
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
    <div className="min-h-screen bg-background">
      {/* Compact header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b px-4 py-3">
        <div className="flex items-center justify-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            E
          </div>
          <span className="font-semibold">Ekko</span>
        </div>
      </header>

      <div className="px-4 py-6 max-w-lg mx-auto">
        {state === "loading" && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Lien invalide</h2>
            <p className="text-muted-foreground text-sm">
              Ce lien de validation n'existe pas ou a expiré.
            </p>
          </div>
        )}

        {state === "done" && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            {decision === "approved" ? (
              <>
                <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mb-6">
                  <CheckCircle2 className="h-10 w-10 text-accent" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Approuvé ✓</h2>
                <p className="text-muted-foreground mb-1">
                  « {campaignName} »
                </p>
                <p className="text-sm text-muted-foreground">
                  La campagne va entrer en production.
                </p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
                  <XCircle className="h-10 w-10 text-destructive" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Refusé</h2>
                <p className="text-muted-foreground mb-1">
                  « {campaignName} »
                </p>
                <p className="text-sm text-muted-foreground">
                  Le créateur sera notifié de votre décision.
                </p>
              </>
            )}
            <div className="mt-8 p-3 bg-muted rounded-lg flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
              Action enregistrée avec preuve horodatée.
            </div>
          </div>
        )}

        {state === "ready" && (
          <div className="space-y-6">
            {/* Context summary */}
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">Demande de validation</p>
              <h1 className="text-xl font-bold leading-tight">
                Approuvez-vous l'utilisation de votre identité pour ce deal ?
              </h1>
            </div>

            {/* Key info pills */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <User className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Identité utilisée</p>
                  <p className="text-sm font-medium truncate">{identityName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Campagne</p>
                  <p className="text-sm font-medium truncate">{campaignName}</p>
                </div>
              </div>
            </div>

            {/* Primary actions — ONE TAP */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                size="lg"
                variant="outline"
                className="h-14 text-base border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => handleAction("rejected")}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <XCircle className="mr-2 h-5 w-5" />
                    Refuser
                  </>
                )}
              </Button>
              <Button
                size="lg"
                className="h-14 text-base"
                onClick={() => handleAction("approved")}
                disabled={isSubmitting || !editedScript.trim()}
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    Approuver
                  </>
                )}
              </Button>
            </div>

            {/* Expandable script section */}
            <div className="border rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
                onClick={() => setShowScript(!showScript)}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Voir le script</span>
                </div>
                {showScript ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              {showScript && (
                <div className="px-4 pb-4 space-y-3">
                  {isEditing ? (
                    <Textarea
                      value={editedScript}
                      onChange={(e) => setEditedScript(e.target.value)}
                      rows={8}
                      className="font-mono text-sm"
                    />
                  ) : (
                    <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                      {editedScript}
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    {isEditing ? "Terminé" : "Modifier le script"}
                  </Button>
                </div>
              )}
            </div>

            {/* Expandable comment section */}
            <div className="border rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
                onClick={() => setShowComment(!showComment)}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Ajouter un commentaire</span>
                </div>
                {showComment ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              {showComment && (
                <div className="px-4 pb-4">
                  <Textarea
                    placeholder="Commentaire optionnel pour l'équipe..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                  />
                </div>
              )}
            </div>

            {/* Trust footer */}
            <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1.5 pb-4">
              <ShieldCheck className="h-3.5 w-3.5" />
              Décision enregistrée avec preuve horodatée.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
