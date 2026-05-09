// Phase 4 — Renders the AE's "actions en attente" + recent decided history.
// Used in AgentPage (full mode) and embeddable elsewhere.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Clock, AlertCircle } from "lucide-react";
import { ActionPreview } from "./ActionPreview";
import { useAgentNotifications } from "@/hooks/useAgentNotifications";
import { EkkoLoader } from "@/components/ui/EkkoLoader";

interface PendingActionsListProps { userId: string | null | undefined }

export function PendingActionsList({ userId }: PendingActionsListProps) {
  const { pendingActions, recentDecided, loading, decideAction } = useAgentNotifications(userId);
  const [busyId, setBusyId] = useState<string | null>(null);

  const onDecide = async (id: string, decision: "approve" | "reject") => {
    setBusyId(id);
    await decideAction(id, decision);
    setBusyId(null);
  };

  if (loading) return <div className="flex items-center justify-center py-8"><EkkoLoader mode="loop" size={24} /></div>;

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Actions en attente</h3>
          <Badge variant="secondary">{pendingActions.length}</Badge>
        </div>
        {pendingActions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Aucune action en attente.</p>
        ) : (
          <div className="space-y-3">
            {pendingActions.map((p) => {
              const expiresIn = Math.max(0, Math.round((new Date(p.expires_at).getTime() - Date.now()) / 3600000));
              return (
                <div key={p.id} className="border rounded-lg p-4 bg-card space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-foreground">{p.action_type.replace(/_/g, " ")}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" /> Expire dans {expiresIn}h
                      </p>
                    </div>
                  </div>
                  <ActionPreview p={p} />
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" disabled={busyId === p.id} onClick={() => onDecide(p.id, "approve")}>
                      <Check className="h-4 w-4 mr-1" /> Valider
                    </Button>
                    <Button size="sm" variant="outline" disabled={busyId === p.id} onClick={() => onDecide(p.id, "reject")}>
                      <X className="h-4 w-4 mr-1" /> Rejeter
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {recentDecided.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">Historique 24h</h3>
          <div className="space-y-2">
            {recentDecided.map((p) => (
              <div key={p.id} className="border rounded-md p-3 text-xs flex items-center justify-between">
                <div>
                  <p className="font-medium">{p.action_type.replace(/_/g, " ")}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {p.decided_at ? new Date(p.decided_at).toLocaleString("fr-FR") : "—"}
                  </p>
                </div>
                <Badge variant={
                  p.status === "executed" ? "default" :
                  p.status === "rejected" ? "destructive" : "secondary"
                }>
                  {p.status === "executed" ? "Exécutée" : p.status === "rejected" ? "Rejetée" : "Expirée"}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
