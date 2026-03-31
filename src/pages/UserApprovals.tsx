import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Check, X, Loader2, UserCheck, Clock, ShieldOff } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface PendingUser {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  is_approved: boolean;
  created_at: string;
}

export default function UserApprovals() {
  const { membership } = useAuthContext();
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const isAdmin = membership?.role === "org_owner" || membership?.role === "org_admin";

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, user_id, email, first_name, last_name, company, is_approved, created_at")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setUsers(data as PendingUser[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const approveUser = async (profileId: string) => {
    setProcessingIds((prev) => new Set(prev).add(profileId));
    const { error } = await supabase
      .from("profiles")
      .update({ is_approved: true } as any)
      .eq("id", profileId);

    if (error) {
      toast.error("Erreur lors de la validation");
    } else {
      toast.success("Utilisateur approuvé");
      setUsers((prev) => prev.map((u) => (u.id === profileId ? { ...u, is_approved: true } : u)));
    }
    setProcessingIds((prev) => {
      const next = new Set(prev);
      next.delete(profileId);
      return next;
    });
  };

  const revokeUser = async (profileId: string) => {
    setProcessingIds((prev) => new Set(prev).add(profileId));
    const { error } = await supabase
      .from("profiles")
      .update({ is_approved: false } as any)
      .eq("id", profileId);

    if (error) {
      toast.error("Erreur lors de la révocation");
    } else {
      toast.success("Accès révoqué");
      setUsers((prev) => prev.map((u) => (u.id === profileId ? { ...u, is_approved: false } : u)));
    }
    setProcessingIds((prev) => {
      const next = new Set(prev);
      next.delete(profileId);
      return next;
    });
  };

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <ShieldOff className="h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">Accès réservé aux administrateurs.</p>
        </div>
      </AppLayout>
    );
  }

  const pendingUsers = users.filter((u) => !u.is_approved);
  const approvedUsers = users.filter((u) => u.is_approved);

  return (
    <AppLayout>
      <PageHeader title="Validation des comptes" description="Approuvez ou révoquez l'accès des utilisateurs inscrits" />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pending */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" />
                En attente ({pendingUsers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Aucun utilisateur en attente de validation.</p>
              ) : (
                <div className="space-y-3">
                  {pendingUsers.map((u) => (
                    <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border bg-amber-500/5 border-amber-500/20">
                      <div>
                        <p className="font-medium text-sm">
                          {u.first_name || u.last_name ? `${u.first_name || ""} ${u.last_name || ""}`.trim() : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                        {u.company && <p className="text-xs text-muted-foreground">{u.company}</p>}
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                          Inscrit le {format(new Date(u.created_at), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => approveUser(u.id)} disabled={processingIds.has(u.id)}>
                        {processingIds.has(u.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                        Approuver
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Approved */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-emerald-500" />
                Approuvés ({approvedUsers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {approvedUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Aucun utilisateur approuvé.</p>
              ) : (
                <div className="space-y-2">
                  {approvedUsers.map((u) => (
                    <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium text-sm">
                          {u.first_name || u.last_name ? `${u.first_name || ""} ${u.last_name || ""}`.trim() : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-xs">
                          Actif
                        </Badge>
                        <Button variant="ghost" size="sm" className="text-destructive h-7 text-xs" onClick={() => revokeUser(u.id)} disabled={processingIds.has(u.id)}>
                          {processingIds.has(u.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3 mr-1" />}
                          Révoquer
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
