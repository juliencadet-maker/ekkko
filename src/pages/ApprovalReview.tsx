import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { EkkoLogo } from "@/components/ui/EkkoLogo";
import {
  CheckCircle2,
  XCircle,
  ShieldCheck,
  AlertTriangle,
  Edit3,
  X,
  Building2,
  User,
} from "lucide-react";
import { EkkoLoader } from "@/components/ui/EkkoLoader";

type ReviewState = "loading" | "ready" | "done" | "error";

interface RecipientInfo {
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  email: string;
  variables: any;
}

export default function ApprovalReview() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<ReviewState>("loading");
  const [approval, setApproval] = useState<any>(null);
  const [recipients, setRecipients] = useState<RecipientInfo[]>([]);
  const [editedScript, setEditedScript] = useState("");
  const [comment, setComment] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);
  const [confirmReject, setConfirmReject] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!token) return;
    const fetchApproval = async () => {
      const { data, error } = await supabase
        .from("approval_requests")
        .select("*, campaigns(name, script, description, identities(display_name))")
        .eq("approval_token", token)
        .maybeSingle();

      if (error || !data) { setState("error"); return; }
      if (data.status !== "pending") {
        setApproval(data);
        setDecision(data.status as "approved" | "rejected");
        setState("done");
        return;
      }

      // Fetch recipients for this campaign
      const { data: recipientData } = await supabase
        .from("recipients")
        .select("first_name, last_name, company, email, variables")
        .eq("campaign_id", data.campaign_id);

      setApproval(data);
      setRecipients(recipientData || []);
      setEditedScript(data.script_snapshot || (data as any).campaigns?.script || "");
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
      toast({ title: "Erreur", description: "Impossible de traiter cette demande", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const campaignName = approval?.campaigns?.name || "Campagne";
  const campaignDescription = approval?.campaigns?.description || "";
  const identityName = approval?.campaigns?.identities?.display_name || "";

  // Derive target companies
  const targetCompanies = [...new Set(recipients.map(r => r.company).filter(Boolean))];
  const targetRecipients = recipients.map(r => {
    const title = (r.variables as any)?.title || "";
    const name = [r.first_name, r.last_name].filter(Boolean).join(" ");
    return { name, title, company: r.company };
  });

  // ── LOADING ──
  if (state === "loading") {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <EkkoLoader mode="once" size={40} />
      </div>
    );
  }

  // ── ERROR ──
  if (state === "error") {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-6 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Lien invalide</h2>
        <p className="text-muted-foreground text-sm">Ce lien de validation n'existe pas ou a expiré.</p>
      </div>
    );
  }

  // ── DONE ──
  if (state === "done") {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-6 text-center">
        {decision === "approved" ? (
          <>
            <div className="w-24 h-24 rounded-full bg-accent/10 flex items-center justify-center mb-6 animate-in zoom-in-50 duration-300">
              <CheckCircle2 className="h-12 w-12 text-accent" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Approuvé ✓</h1>
            <p className="text-muted-foreground">« {campaignName} » entre en production.</p>
          </>
        ) : (
          <>
            <div className="w-24 h-24 rounded-full bg-destructive/10 flex items-center justify-center mb-6 animate-in zoom-in-50 duration-300">
              <XCircle className="h-12 w-12 text-destructive" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Refusé</h1>
            <p className="text-muted-foreground">L'équipe sera notifiée.</p>
          </>
        )}
        <div className="mt-8 p-3 bg-muted rounded-lg flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
          Action enregistrée avec preuve horodatée.
        </div>
      </div>
    );
  }

  // ── READY — Exec review view ──
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Minimal header */}
      <header className="flex items-center justify-center py-4 border-b">
        <EkkoLogo size={28} showText={false} onDark={false} />
      </header>

      <div className="flex-1 flex flex-col px-5 py-6 max-w-md mx-auto w-full">
        {/* Hero question */}
        <div className="text-center mb-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Validation requise</p>
          <h1 className="text-2xl font-bold leading-tight mb-4">
            Approuvez-vous ce message en votre nom ?
          </h1>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full text-sm">
            <span className="font-medium">{identityName}</span>
            <span className="text-muted-foreground">→</span>
            <span className="text-muted-foreground">{campaignName}</span>
          </div>
        </div>

        {/* Target company & recipients */}
        {(targetCompanies.length > 0 || targetRecipients.length > 0) && (
          <div className="bg-card border rounded-xl p-4 mb-4">
            {targetCompanies.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-semibold">
                  {targetCompanies.join(", ")}
                </span>
              </div>
            )}
            {campaignDescription && (
              <p className="text-xs text-muted-foreground mb-3">{campaignDescription}</p>
            )}
            <div className="space-y-1.5">
              {targetRecipients.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium">{r.name}</span>
                  {r.title && <span className="text-muted-foreground">— {r.title}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Script card */}
        <div className="flex-1 mb-6">
          <div className="bg-card border rounded-xl p-4 relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Script proposé</span>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="text-xs text-primary flex items-center gap-1 hover:underline"
              >
                {isEditing ? <><X className="h-3 w-3" /> Terminé</> : <><Edit3 className="h-3 w-3" /> Modifier</>}
              </button>
            </div>
            {isEditing ? (
              <Textarea
                value={editedScript}
                onChange={(e) => setEditedScript(e.target.value)}
                rows={6}
                className="font-mono text-sm border-primary/30"
                autoFocus
              />
            ) : (
              <p className="text-sm leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                {editedScript}
              </p>
            )}
          </div>
        </div>

        {/* Optional comment */}
        <div className="mb-6">
          <Textarea
            placeholder="Commentaire optionnel..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            className="text-sm"
          />
        </div>

        {/* Action buttons */}
        <div className="space-y-3 pb-6">
          <Button
            size="lg"
            className="w-full h-14 text-base font-semibold rounded-xl"
            onClick={() => handleAction("approved")}
            disabled={isSubmitting || !editedScript.trim()}
          >
            {isSubmitting ? (
              <EkkoLoader mode="once" size={24} />
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Approuver
              </>
            )}
          </Button>

          {!confirmReject ? (
            <button
              type="button"
              className="w-full text-center text-sm text-muted-foreground hover:text-destructive transition-colors py-2"
              onClick={() => setConfirmReject(true)}
            >
              Refuser
            </button>
          ) : (
            <Button
              size="lg"
              variant="outline"
              className="w-full h-14 text-base border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground rounded-xl animate-in fade-in duration-200"
              onClick={() => handleAction("rejected")}
              disabled={isSubmitting}
            >
              <XCircle className="mr-2 h-5 w-5" />
              Confirmer le refus
            </Button>
          )}
        </div>

        {/* Trust */}
        <p className="text-[11px] text-center text-muted-foreground flex items-center justify-center gap-1.5 pb-4">
          <ShieldCheck className="h-3 w-3" />
          Décision enregistrée avec preuve horodatée
        </p>
      </div>
    </div>
  );
}
