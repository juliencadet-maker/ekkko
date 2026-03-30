import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Users, Loader2, Plus, Star, MoreVertical, Trash2, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Identity } from "@/types/database";
import { CreateIdentityDialog } from "@/components/identity/CreateIdentityDialog";

export default function Identities() {
  const [isLoading, setIsLoading] = useState(true);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteIdentity, setConfirmDeleteIdentity] = useState<Identity | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [dealCounts, setDealCounts] = useState<Record<string, number>>({});
  const { membership, profile, user, refreshUser } = useAuthContext();
  const { toast } = useToast();

  const fetchIdentities = async () => {
    if (!membership?.org_id) return;
    const { data } = await supabase
      .from("identities")
      .select("*")
      .eq("org_id", membership.org_id)
      .order("created_at", { ascending: false });
    const list = (data as Identity[]) || [];
    setIdentities(list);

    // Fetch deal counts per identity
    const ids = list.map(i => i.id);
    if (ids.length > 0) {
      const { data: campaigns } = await supabase
        .from("campaigns")
        .select("identity_id")
        .in("identity_id", ids)
        .not("status", "in", '("completed","cancelled")');
      
      const counts: Record<string, number> = {};
      campaigns?.forEach((c: any) => {
        counts[c.identity_id] = (counts[c.identity_id] || 0) + 1;
      });
      setDealCounts(counts);
    }

    setIsLoading(false);
  };

  useEffect(() => { fetchIdentities(); }, [membership?.org_id]);

  const getRoleLabel = (type: string) => {
    if (type === "executive") return "Exec clone";
    if (type === "sales_rep") return "AE facecam";
    if (type === "hr") return "RH clone";
    if (type === "marketing") return "Marketing clone";
    return "Clone";
  };

  const getStatusBadge = (identity: Identity) => {
    const status = identity.clone_status;
    if (status === "ready") return <Badge className="bg-signal-pale text-marine border-0 text-xs">Prêt</Badge>;
    if (status === "error" || status === "failed") return <Badge className="bg-destructive/10 text-destructive border-0 text-xs">Erreur</Badge>;
    return <Badge className="bg-warning/10 text-warning border-0 text-xs">En attente</Badge>;
  };

  const handleDelete = async (identity: Identity) => {
    const userIdentities = identities.filter(i => i.owner_user_id === user.id);
    if (userIdentities.length === 1 && identity.owner_user_id === user.id) {
      toast({ title: "Suppression impossible", description: "Vous devez conserver au moins une identité.", variant: "destructive" });
      return;
    }

    const { count } = await supabase
      .from("campaigns")
      .select("*", { count: "exact", head: true })
      .eq("identity_id", identity.id);

    if (count && count > 0) {
      toast({ title: "Suppression impossible", description: `Cette identité est utilisée dans ${count} deal(s).`, variant: "destructive" });
      return;
    }

    setDeletingId(identity.id);
    try {
      if (profile?.default_identity_id === identity.id) {
        const otherIdentity = identities.find(i => i.owner_user_id === user.id && i.id !== identity.id);
        await supabase.from("profiles").update({ default_identity_id: otherIdentity?.id || null }).eq("user_id", user.id);
      }
      const { error } = await supabase.from("identities").delete().eq("id", identity.id);
      if (error) throw error;
      toast({ title: "Identité supprimée" });
      await fetchIdentities();
      await refreshUser();
    } catch {
      toast({ title: "Erreur", description: "Impossible de supprimer l'identité", variant: "destructive" });
    } finally {
      setDeletingId(null);
      setConfirmDeleteIdentity(null);
    }
  };

  const handleSetDefault = async (identity: Identity) => {
    try {
      await supabase.from("profiles").update({ default_identity_id: identity.id }).eq("user_id", user.id);
      toast({ title: "Identité par défaut mise à jour" });
      await refreshUser();
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleToggleShareable = async (identity: Identity) => {
    try {
      await supabase.from("identities").update({ is_shareable: !identity.is_shareable }).eq("id", identity.id);
      toast({
        title: identity.is_shareable ? "Identité privée" : "Identité partageable",
        description: identity.is_shareable
          ? "Cette identité ne peut plus être utilisée par d'autres."
          : "Les membres peuvent maintenant utiliser cette identité.",
      });
      await fetchIdentities();
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const isMyIdentity = (identity: Identity) => identity.owner_user_id === user.id;
  const isDefaultIdentity = (identity: Identity) => profile?.default_identity_id === identity.id;

  return (
    <AppLayout>
      <PageHeader 
        title="Identités" 
        description="Gérez les identités numériques de votre organisation"
        actions={
          <Button onClick={() => setIsCreateDialogOpen(true)} className="rounded-cta bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="h-4 w-4 mr-2" />
            Créer une identité
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : identities.length === 0 ? (
        <EmptyState 
          icon={Users} 
          title="Aucune identité" 
          description="Créez votre première identité pour commencer à utiliser Ekko" 
          className="py-16"
          action={{ label: "Créer une identité", onClick: () => setIsCreateDialogOpen(true) }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {identities.map((identity) => (
            <div key={identity.id} className="bg-card rounded-card shadow-card p-5 relative">
              {/* Menu "..." */}
              {isMyIdentity(identity) && (
                <div className="absolute top-3 right-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!isDefaultIdentity(identity) && (
                        <DropdownMenuItem onClick={() => handleSetDefault(identity)}>
                          <Star className="h-3.5 w-3.5 mr-2" /> Définir par défaut
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleToggleShareable(identity)}>
                        <Share2 className="h-3.5 w-3.5 mr-2" />
                        {identity.is_shareable ? "Rendre privée" : "Rendre partageable"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setConfirmDeleteIdentity(identity)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}

              {/* Content */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-marine flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-bold text-signal">
                    {identity.display_name[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground truncate">{identity.display_name}</p>
                    {isMyIdentity(identity) && <Badge variant="secondary" className="text-[10px]">Vous</Badge>}
                    {isDefaultIdentity(identity) && (
                      <Star className="h-3.5 w-3.5 text-warning fill-warning" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{getRoleLabel(identity.type)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                {getStatusBadge(identity)}
                <span className="text-xs text-muted-foreground">
                  {dealCounts[identity.id] || 0} deal{(dealCounts[identity.id] || 0) !== 1 ? "s" : ""} actif{(dealCounts[identity.id] || 0) !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm delete dialog */}
      <AlertDialog open={!!confirmDeleteIdentity} onOpenChange={() => setConfirmDeleteIdentity(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette identité ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. L'identité "{confirmDeleteIdentity?.display_name}" sera définitivement supprimée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDeleteIdentity && handleDelete(confirmDeleteIdentity)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateIdentityDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onIdentityCreated={fetchIdentities}
      />
    </AppLayout>
  );
}
