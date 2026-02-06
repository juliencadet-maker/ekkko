import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Plus, Search, Video, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Campaign } from "@/types/database";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Campaigns() {
  const [isLoading, setIsLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const navigate = useNavigate();
  const { membership } = useAuthContext();

  useEffect(() => {
    const fetchCampaigns = async () => {
      if (!membership?.org_id) return;

      try {
        const { data, error } = await supabase
          .from("campaigns")
          .select("*, identities(display_name)")
          .eq("org_id", membership.org_id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setCampaigns(data as Campaign[] || []);
      } catch (error) {
        console.error("Fetch campaigns error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCampaigns();
  }, [membership?.org_id]);

  const filteredCampaigns = campaigns.filter((campaign) =>
    campaign.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout>
      <PageHeader 
        title="Campagnes"
        description="Gérez vos campagnes vidéo personnalisées"
        actions={
          <Button onClick={() => navigate("/app/campaigns/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle campagne
          </Button>
        }
      />

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une campagne..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Campaigns Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-pulse text-muted-foreground">Chargement...</div>
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <EmptyState
              icon={Video}
              title="Aucune campagne"
              description={searchQuery ? "Aucun résultat pour cette recherche" : "Créez votre première campagne vidéo"}
              action={searchQuery ? undefined : {
                label: "Créer une campagne",
                onClick: () => navigate("/app/campaigns/new"),
              }}
              className="py-16"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Identité</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date de création</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCampaigns.map((campaign) => (
                  <TableRow 
                    key={campaign.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/app/campaigns/${campaign.id}`)}
                  >
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {(campaign as any).identities?.display_name || "-"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={campaign.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(campaign.created_at), "d MMM yyyy", { locale: fr })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/app/campaigns/${campaign.id}`);
                          }}>
                            Voir les détails
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
