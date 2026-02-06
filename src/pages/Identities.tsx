import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Loader2 } from "lucide-react";
import type { Identity } from "@/types/database";
import { IDENTITY_TYPES } from "@/lib/constants";

export default function Identities() {
  const [isLoading, setIsLoading] = useState(true);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const { membership } = useAuthContext();

  useEffect(() => {
    const fetchIdentities = async () => {
      if (!membership?.org_id) return;
      const { data } = await supabase.from("identities").select("*").eq("org_id", membership.org_id);
      setIdentities(data as Identity[] || []);
      setIsLoading(false);
    };
    fetchIdentities();
  }, [membership?.org_id]);

  const getTypeLabel = (type: string) => IDENTITY_TYPES.find(t => t.value === type)?.label || type;

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
                </TableRow>
              </TableHeader>
              <TableBody>
                {identities.map((identity) => (
                  <TableRow key={identity.id}>
                    <TableCell className="font-medium">{identity.display_name}</TableCell>
                    <TableCell>{getTypeLabel(identity.type)}</TableCell>
                    <TableCell><StatusBadge status={identity.status} /></TableCell>
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
