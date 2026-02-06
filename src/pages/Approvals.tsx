import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
  FileText
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { ApprovalRequest } from "@/types/database";

export default function Approvals() {
  const [isLoading, setIsLoading] = useState(true);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user, membership } = useAuthContext();
  const { logEvent } = useAuditLog();
  const { toast } = useToast();

  const fetchApprovals = async () => {
    if (!membership?.org_id) return;

    try {
      const { data, error } = await supabase
        .from("approval_requests")
        .select("*, campaigns(name, script, identities(display_name))")
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

  useEffect(() => {
    fetchApprovals();
  }, [membership?.org_id]);

  const handleApprovalAction = async (action: "approve" | "reject") => {
    if (!selectedApproval) return;

    setIsSubmitting(true);
    try {
      const newStatus = action === "approve" ? "approved" : "rejected";
      
      // Update approval request
      await supabase
        .from("approval_requests")
        .update({
          status: newStatus,
          decision_comment: comment || null,
          decided_at: new Date().toISOString(),
          decided_by_user_id: user.id,
        })
        .eq("id", selectedApproval.id);

      // Update campaign status if approved
      if (action === "approve") {
        await supabase
          .from("campaigns")
          .update({
            status: "approved",
            approved_at: new Date().toISOString(),
            approved_by_user_id: user.id,
          })
          .eq("id", selectedApproval.campaign_id);

        await logEvent({
          eventType: "approval_approved",
          entityType: "approval_request",
          entityId: selectedApproval.id,
        });

        await logEvent({
          eventType: "campaign_approved",
          entityType: "campaign",
          entityId: selectedApproval.campaign_id,
        });
      } else {
        await supabase
          .from("campaigns")
          .update({ status: "draft" })
          .eq("id", selectedApproval.campaign_id);

        await logEvent({
          eventType: "approval_rejected",
          entityType: "approval_request",
          entityId: selectedApproval.id,
          metadata: { comment },
        });

        await logEvent({
          eventType: "campaign_rejected",
          entityType: "campaign",
          entityId: selectedApproval.campaign_id,
        });
      }

      toast({
        title: action === "approve" ? "Approuvé ✓" : "Refusé",
        description: action === "approve" 
          ? "La campagne a été approuvée et la génération va commencer."
          : "La campagne a été refusée.",
      });

      setIsDialogOpen(false);
      setSelectedApproval(null);
      setComment("");
      fetchApprovals();
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

  const openApprovalDialog = (approval: ApprovalRequest) => {
    setSelectedApproval(approval);
    setComment("");
    setIsDialogOpen(true);
  };

  const pendingApprovals = approvals.filter(a => a.status === "pending");
  const processedApprovals = approvals.filter(a => a.status !== "pending");

  return (
    <AppLayout>
      <PageHeader 
        title="Validations"
        description="Gérez les demandes de validation de scripts"
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Pending Approvals */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              En attente ({pendingApprovals.length})
            </h2>
            
            {pendingApprovals.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <EmptyState
                    icon={CheckSquare}
                    title="Aucune validation en attente"
                    description="Toutes les demandes ont été traitées"
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {pendingApprovals.map((approval) => (
                  <Card key={approval.id} className="card-interactive">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold">
                              {(approval as any).campaigns?.name}
                            </h3>
                            <StatusBadge status="pending" />
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            Identité: {(approval as any).campaigns?.identities?.display_name}
                          </p>
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="text-sm font-medium mb-1">Script:</p>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">
                              {approval.script_snapshot || (approval as any).campaigns?.script}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-3">
                            Demandé le {format(new Date(approval.created_at), "d MMM yyyy à HH:mm", { locale: fr })}
                          </p>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => openApprovalDialog(approval)}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Refuser
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => {
                              setSelectedApproval(approval);
                              handleApprovalAction("approve");
                            }}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Approuver
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Processed Approvals */}
          {processedApprovals.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                Historique ({processedApprovals.length})
              </h2>
              
              <div className="grid gap-4">
                {processedApprovals.map((approval) => (
                  <Card key={approval.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-medium">
                              {(approval as any).campaigns?.name}
                            </h3>
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
                            <p className="text-sm text-muted-foreground mt-2">
                              Commentaire: {approval.decision_comment}
                            </p>
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

      {/* Reject Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser cette demande ?</DialogTitle>
            <DialogDescription>
              Vous pouvez ajouter un commentaire pour expliquer le refus.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Commentaire (optionnel)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => handleApprovalAction("reject")}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Traitement...</>
              ) : (
                <>Refuser</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
