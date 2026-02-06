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
import { Users, Loader2, Trash2, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Identity } from "@/types/database";
import { IDENTITY_TYPES } from "@/lib/constants";

export default function Identities() {
  const [isLoading, setIsLoading] = useState(true);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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

  const isMyIdentity = (identity: Identity) => identity.owner_user_id === user.id;
  const isDefaultIdentity = (identity: Identity) => profile?.default_identity_id === identity.id;

  return (
    <AppLayout>
      <PageHeader title="Identités" description="Gérez les identités numériques de votre organisation" />
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : identities.length === 0 ? (
            <EmptyState icon={Users} title="Aucune identité" description="Les identités sont créées lors de l'onboarding" className="py-16" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
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
    </AppLayout>
  );
}
