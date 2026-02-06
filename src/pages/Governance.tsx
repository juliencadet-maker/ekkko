import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Video, Eye, CheckSquare } from "lucide-react";

export default function Governance() {
  return (
    <AppLayout>
      <PageHeader title="Gouvernance" description="Vue d'ensemble de la conformité et des politiques" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard icon={Shield} value="100%" label="Conformité watermark" />
        <MetricCard icon={Video} value="0" label="Vidéos sans approbation" />
        <MetricCard icon={Eye} value="0" label="Alertes actives" />
        <MetricCard icon={CheckSquare} value="100%" label="Taux d'approbation" />
      </div>
      <Card>
        <CardHeader><CardTitle>Politiques actives</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span>Approbation requise</span><span className="text-success font-medium">Activé</span>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span>Watermark obligatoire</span><span className="text-success font-medium">Activé</span>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span>Auto-approbation propriétaires</span><span className="text-success font-medium">Activé</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
