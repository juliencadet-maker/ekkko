import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Shield, Video, Eye, CheckSquare, Loader2 } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface PolicyData {
  approval_required: boolean;
  watermark_required: boolean;
  allow_self_approval_for_owners: boolean;
  identities_shareable: boolean;
  link_expiration_days: number;
  max_videos_per_campaign: number;
}

export default function Governance() {
  const { membership } = useAuthContext();
  const [isLoading, setIsLoading] = useState(true);
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [stats, setStats] = useState({ watermarkCompliance: 100, unapprovedVideos: 0, activeAlerts: 0, approvalRate: 100 });

  useEffect(() => {
    if (!membership?.org_id) return;

    const fetchData = async () => {
      try {
        const [{ data: policyData }, { count: totalVideos }, { count: watermarked }, { count: pendingApprovals }, { count: totalApprovals }, { count: approvedCount }] = await Promise.all([
          supabase.from("policies").select("*").eq("org_id", membership.org_id).single(),
          supabase.from("videos").select("*", { count: "exact", head: true }).eq("org_id", membership.org_id),
          supabase.from("videos").select("*", { count: "exact", head: true }).eq("org_id", membership.org_id).eq("watermark_enabled", true),
          supabase.from("approval_requests").select("*", { count: "exact", head: true }).eq("org_id", membership.org_id).eq("status", "pending"),
          supabase.from("approval_requests").select("*", { count: "exact", head: true }).eq("org_id", membership.org_id),
          supabase.from("approval_requests").select("*", { count: "exact", head: true }).eq("org_id", membership.org_id).eq("status", "approved"),
        ]);

        if (policyData) {
          setPolicy({
            approval_required: policyData.approval_required ?? true,
            watermark_required: policyData.watermark_required ?? true,
            allow_self_approval_for_owners: policyData.allow_self_approval_for_owners ?? true,
            identities_shareable: policyData.identities_shareable ?? false,
            link_expiration_days: policyData.link_expiration_days ?? 30,
            max_videos_per_campaign: policyData.max_videos_per_campaign ?? 100,
          });
        }

        const total = totalVideos || 0;
        const wm = watermarked || 0;
        const wmRate = total > 0 ? Math.round((wm / total) * 100) : 100;
        const allAppr = totalApprovals || 0;
        const approved = approvedCount || 0;
        const apprRate = allAppr > 0 ? Math.round((approved / allAppr) * 100) : 100;

        setStats({
          watermarkCompliance: wmRate,
          unapprovedVideos: pendingApprovals || 0,
          activeAlerts: 0,
          approvalRate: apprRate,
        });
      } catch {
        console.error("Governance fetch failed");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [membership?.org_id]);

  const updatePolicy = async (field: keyof PolicyData, value: boolean) => {
    if (!membership?.org_id || !policy) return;
    const updated = { ...policy, [field]: value };
    setPolicy(updated);

    await supabase
      .from("policies")
      .update({ [field]: value })
      .eq("org_id", membership.org_id);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader title="Gouvernance" description="Conformité et politiques de votre organisation" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard icon={Shield} value={`${stats.watermarkCompliance}%`} label="Conformité watermark" />
        <MetricCard icon={Video} value={stats.unapprovedVideos} label="Validations en attente" />
        <MetricCard icon={Eye} value={stats.activeAlerts} label="Alertes actives" />
        <MetricCard icon={CheckSquare} value={`${stats.approvalRate}%`} label="Taux d'approbation" />
      </div>

      <Card>
        <CardHeader><CardTitle>Politiques actives</CardTitle></CardHeader>
        <CardContent>
          {policy && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <Label htmlFor="approval_required" className="flex-1">Approbation requise avant génération</Label>
                <Switch
                  id="approval_required"
                  checked={policy.approval_required}
                  onCheckedChange={(v) => updatePolicy("approval_required", v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="watermark_required" className="flex-1">Watermark obligatoire sur les vidéos</Label>
                <Switch
                  id="watermark_required"
                  checked={policy.watermark_required}
                  onCheckedChange={(v) => updatePolicy("watermark_required", v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="self_approval" className="flex-1">Auto-approbation pour les propriétaires d'identité</Label>
                <Switch
                  id="self_approval"
                  checked={policy.allow_self_approval_for_owners}
                  onCheckedChange={(v) => updatePolicy("allow_self_approval_for_owners", v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="shareable" className="flex-1">Identités partageables entre membres</Label>
                <Switch
                  id="shareable"
                  checked={policy.identities_shareable}
                  onCheckedChange={(v) => updatePolicy("identities_shareable", v)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
