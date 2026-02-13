import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, Loader2, Trash2, Star, Plus, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Identity } from "@/types/database";
import { IDENTITY_TYPES } from "@/lib/constants";
import { CreateIdentityDialog } from "@/components/identity/CreateIdentityDialog";

export default function Identities() {
  const [isLoading, setIsLoading] = useState(true);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { membership, profile, user, refreshUser } = useAuthContext();
  const { toast } = useToast();

  const fetchIdentities = async () => {
    if (!membership?.org_id) return;
    const { data } = await supabase
      .from("identities")
      .select("*")
      .eq("org_id", membership.org_id)
      .order("created_at", { ascending: false });
    setIdentities(data as Identity[] || []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchIdentities();
  }, [membership?.org_id]);

  const getTypeLabel = (type: string) => IDENTITY_TYPES.find(t => t.value === type)?.label || type;

  const handleDelete = async (identity: Identity) => {
    // Check if this is the user's last identity
    const userIdentities = identities.filter(i => i.owner_user_id === user.id);
    if (userIdentities.length === 1 && identity.owner_user_id === user.id) {
      toast({
        title: "Suppression impossible",
        description: "Vous devez conserver au moins une identité.",
        variant: "destructive",
      });
      return;
    }

    // Check if identity is used in campaigns
    const { count } = await supabase
      .from("campaigns")
      .select("*", { count: "exact", head: true })
      .eq("identity_id", identity.id);

    if (count && count > 0) {
      toast({
        title: "Suppression impossible",
        description: `Cette identité est utilisée dans ${count} campagne(s).`,
        variant: "destructive",
      });
      return;
    }

    setDeletingId(identity.id);
    try {
      // If this was the default identity, update the profile
      if (profile?.default_identity_id === identity.id) {
        const otherIdentity = identities.find(
          i => i.owner_user_id === user.id && i.id !== identity.id
        );
        await supabase
          .from("profiles")
          .update({ default_identity_id: otherIdentity?.id || null })
          .eq("user_id", user.id);
      }

      const { error } = await supabase
        .from("identities")
        .delete()
        .eq("id", identity.id);

      if (error) throw error;

      toast({ title: "Identité supprimée" });
      await fetchIdentities();
      await refreshUser();
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'identité",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetDefault = async (identity: Identity) => {
    try {
      await supabase
        .from("profiles")
        .update({ default_identity_id: identity.id })
        .eq("user_id", user.id);

      toast({ title: "Identité par défaut mise à jour" });
      await refreshUser();
    } catch (error) {
      console.error("Set default error:", error);
      toast({
        title: "Erreur",
        description: "Impossible de définir l'identité par défaut",
        variant: "destructive",
      });
    }
  };

  const isAdmin = membership?.role === "org_owner" || membership?.role === "org_admin";
  const isMyIdentity = (identity: Identity) => identity.owner_user_id === user.id;
  const isDefaultIdentity = (identity: Identity) => profile?.default_identity_id === identity.id;

  const handleToggleShareable = async (identity: Identity) => {
    try {
      await supabase
        .from("identities")
        .update({ is_shareable: !identity.is_shareable })
        .eq("id", identity.id);

      toast({
        title: identity.is_shareable ? "Identité privée" : "Identité partageable",
        description: identity.is_shareable
          ? "Cette identité ne peut plus être utilisée par d'autres."
          : "Les membres de l'organisation peuvent maintenant utiliser cette identité pour leurs campagnes.",
      });
      await fetchIdentities();
    } catch (error) {
      console.error("Toggle shareable error:", error);
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <PageHeader 
        title="Identités" 
        description="Gérez les identités numériques de votre organisation"
        actions={
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Créer une identité
          </Button>
        }
      />
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : identities.length === 0 ? (
            <EmptyState 
              icon={Users} 
              title="Aucune identité" 
              description="Créez votre première identité pour commencer à utiliser Ekko" 
              className="py-16"
              action={{
                label: "Créer une identité",
                onClick: () => setIsCreateDialogOpen(true)
              }}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Partageable</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {identities.map((identity) => (
                  <TableRow key={identity.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {identity.display_name}
                        {isMyIdentity(identity) && (
                          <Badge variant="secondary" className="text-xs">Vous</Badge>
                        )}
                        {isDefaultIdentity(identity) && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Star className="h-3 w-3 fill-current" />
                            Par défaut
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getTypeLabel(identity.type)}</TableCell>
                    <TableCell><StatusBadge status={identity.status} /></TableCell>
                    <TableCell>
                      {(isMyIdentity(identity) || isAdmin) ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={identity.is_shareable}
                                onCheckedChange={() => handleToggleShareable(identity)}
                              />
                              {identity.is_shareable && (
                                <Share2 className="h-3.5 w-3.5 text-primary" />
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {identity.is_shareable
                              ? "Les membres peuvent utiliser cette identité pour leurs campagnes"
                              : "Cliquez pour rendre cette identité utilisable par d'autres"}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        identity.is_shareable ? (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Share2 className="h-3 w-3" /> Oui
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Non</span>
                        )
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isMyIdentity(identity) && !isDefaultIdentity(identity) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetDefault(identity)}
                            title="Définir par défaut"
                          >
                            <Star className="h-4 w-4" />
                          </Button>
                        )}
                        {isMyIdentity(identity) && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                disabled={deletingId === identity.id}
                              >
                                {deletingId === identity.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Supprimer cette identité ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Cette action est irréversible. L'identité "{identity.display_name}" sera définitivement supprimée.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(identity)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Supprimer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateIdentityDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onIdentityCreated={fetchIdentities}
      />
    </AppLayout>
  );
}
