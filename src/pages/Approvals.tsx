import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import { tavusApi } from "@/lib/api/tavus";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckSquare, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Clock,
  FileText,
  Pencil,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { ApprovalRequest } from "@/types/database";

export default function Approvals() {
  const [isLoading, setIsLoading] = useState(true);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"review" | "reject">("review");
  const [comment, setComment] = useState("");
  const [editedScript, setEditedScript] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user, membership } = useAuthContext();
  const { logEvent } = useAuditLog();
  const { toast } = useToast();

  const fetchApprovals = async () => {
    if (!membership?.org_id) return;
    try {
      const { data, error } = await supabase
        .from("approval_requests")
        .select("*, campaigns(name, script, identities(display_name, owner_user_id))")
        .eq("org_id", membership.org_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setApprovals(data as ApprovalRequest[] || []);
    } catch (error) {
      console.error("Fetch approvals error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchApprovals(); }, [membership?.org_id]);

  const handleApprovalAction = async (action: "approve" | "reject") => {
    if (!selectedApproval) return;
    setIsSubmitting(true);
    try {
      const newStatus = action === "approve" ? "approved" : "rejected";
      const scriptChanged = action === "approve" && editedScript !== (selectedApproval.script_snapshot || (selectedApproval as any).campaigns?.script);
      
      await supabase.from("approval_requests").update({
        status: newStatus,
        decision_comment: comment || null,
        decided_at: new Date().toISOString(),
        decided_by_user_id: user.id,
        ...(scriptChanged ? { script_snapshot: editedScript } : {}),
      }).eq("id", selectedApproval.id);

      if (action === "approve") {
        await supabase.from("campaigns").update({
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by_user_id: user.id,
          ...(scriptChanged ? { script: editedScript } : {}),
        }).eq("id", selectedApproval.campaign_id);

        await logEvent({ eventType: "approval_approved", entityType: "approval_request", entityId: selectedApproval.id, metadata: scriptChanged ? { script_modified: true } : undefined });
        await logEvent({ eventType: "campaign_approved", entityType: "campaign", entityId: selectedApproval.campaign_id });
        try { await tavusApi.generateVideo(selectedApproval.campaign_id); } catch {}
      } else {
        await supabase.from("campaigns").update({ status: "draft" }).eq("id", selectedApproval.campaign_id);
        await logEvent({ eventType: "approval_rejected", entityType: "approval_request", entityId: selectedApproval.id, metadata: { comment } });
        await logEvent({ eventType: "campaign_rejected", entityType: "campaign", entityId: selectedApproval.campaign_id });
      }

      toast({
        title: action === "approve" ? "Approuvé ✓" : "Refusé",
        description: action === "approve" ? "Le deal a été approuvé et la génération va commencer." : "Le deal a été refusé.",
      });

      setIsDialogOpen(false);
      setSelectedApproval(null);
      setComment("");
      setEditedScript("");
      fetchApprovals();
    } catch {
      toast({ title: "Erreur", description: "Impossible de traiter cette demande", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openReviewDialog = (approval: ApprovalRequest) => {
    setSelectedApproval(approval);
    setEditedScript(approval.script_snapshot || (approval as any).campaigns?.script || "");
    setComment("");
    setDialogMode("review");
    setIsDialogOpen(true);
  };

  const pendingApprovals = approvals.filter(a => a.status === "pending");
  const processedApprovals = approvals.filter(a => a.status !== "pending");
  const canActOn = (approval: ApprovalRequest) => approval.assigned_to_user_id === user.id;
  const campaign = selectedApproval ? (selectedApproval as any).campaigns : null;

  return (
    <AppLayout>
      <PageHeader 
        title="Validations"
        description="Scripts en attente de votre accord. Relisez, modifiez si besoin, approuvez en un clic."
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Pending */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              En attente ({pendingApprovals.length})
            </h2>
            
            {pendingApprovals.length === 0 ? (
              <Card className="rounded-card">
                <CardContent className="py-12">
                  <EmptyState icon={CheckSquare} title="Aucune validation en attente" description="Toutes les demandes ont été traitées" />
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {pendingApprovals.map((approval) => {
                  const c = (approval as any).campaigns;
                  return (
                    <Card key={approval.id} className="card-interactive rounded-card">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold">{c?.name}</h3>
                              <StatusBadge status="pending" />
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                              <User className="h-3.5 w-3.5" />
                              <span>Identité exec utilisée : {c?.identities?.display_name}</span>
                            </div>
                            {/* Script preview — fond ivoire */}
                            <div className="p-3 bg-ivory-2 rounded-lg">
                              <p className="text-sm font-medium mb-1">Script :</p>
                              <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-4">
                                {approval.script_snapshot || c?.script}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-3">
                              Demandé le {format(new Date(approval.created_at), "d MMM yyyy à HH:mm", { locale: fr })}
                            </p>
                          </div>
                          {/* Action buttons directly on card */}
                          <div className="flex flex-col gap-2 flex-shrink-0">
                            {canActOn(approval) ? (
                              <>
                                <Button 
                                  size="sm"
                                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                                  onClick={(e) => { e.stopPropagation(); openReviewDialog(approval); }}
                                >
                                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                  Approuver
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedApproval(approval);
                                    setEditedScript(approval.script_snapshot || c?.script || "");
                                    setComment("");
                                    setDialogMode("reject");
                                    setIsDialogOpen(true);
                                  }}
                                >
                                  <XCircle className="mr-1.5 h-3.5 w-3.5" />
                                  Refuser
                                </Button>
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground italic max-w-[180px] text-right">
                                Seul(e) {c?.identities?.display_name || "le propriétaire"} peut approuver
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* History */}
          {processedApprovals.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                Historique ({processedApprovals.length})
              </h2>
              <div className="space-y-3">
                {processedApprovals.map((approval) => (
                  <Card key={approval.id} className="rounded-card">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-medium">{(approval as any).campaigns?.name}</h3>
                            <StatusBadge status={approval.status} />
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {approval.decided_at && (
                              <>
                                {approval.status === "approved" ? "Approuvé" : "Refusé"} le{" "}
                                {format(new Date(approval.decided_at), "d MMM yyyy à HH:mm", { locale: fr })}
                              </>
                            )}
                          </p>
                          {approval.decision_comment && (
                            <p className="text-sm text-muted-foreground mt-2">Commentaire : {approval.decision_comment}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Review / Reject Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "review" ? "Relecture du script" : "Refuser cette demande ?"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "review"
                ? `Script soumis pour le deal "${campaign?.name}". Vous pouvez modifier le script avant d'approuver.`
                : "Vous pouvez ajouter un commentaire pour expliquer le refus."}
            </DialogDescription>
          </DialogHeader>

          {dialogMode === "review" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Script (modifiable)</Label>
                <Textarea
                  value={editedScript}
                  onChange={(e) => setEditedScript(e.target.value)}
                  rows={10}
                  className="font-mono text-sm bg-ivory"
                />
              </div>
              <div className="space-y-2">
                <Label>Commentaire (optionnel)</Label>
                <Textarea placeholder="Ajoutez un commentaire..." value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
              </div>
            </div>
          ) : (
            <Textarea placeholder="Commentaire (optionnel)" value={comment} onChange={(e) => setComment(e.target.value)} rows={4} />
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
            {dialogMode === "review" ? (
              <Button 
                onClick={() => handleApprovalAction("approve")}
                disabled={isSubmitting || !editedScript.trim()}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Traitement...</> : <><CheckCircle2 className="mr-2 h-4 w-4" />Approuver</>}
              </Button>
            ) : (
              <Button variant="destructive" onClick={() => handleApprovalAction("reject")} disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Traitement...</> : <>Refuser</>}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
