import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp, TrendingDown, Target, Eye, Clock, Users,
  ArrowUpRight, Zap, Loader2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, Area, AreaChart, Legend,
} from "recharts";

interface DealScoreRow {
  id: string;
  campaign_id: string;
  des: number | null;
  momentum: string | null;
  viewer_count: number | null;
  sponsor_count: number | null;
  blocker_count: number | null;
  avg_watch_depth: number | null;
  breadth: number | null;
  event_velocity: number | null;
  multi_threading_score: number | null;
  cold_start_regime: string | null;
  scored_at: string;
}

interface CampaignRow {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

interface DealOutcomeRow {
  campaign_id: string;
  outcome: string;
}

export default function DealIntelligence() {
  const { membership } = useAuthContext();
  const [isLoading, setIsLoading] = useState(true);
  const [scores, setScores] = useState<DealScoreRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [outcomes, setOutcomes] = useState<DealOutcomeRow[]>([]);
  const [totalViewers, setTotalViewers] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      if (!membership?.org_id) return;
      try {
        const campaignsRes = await supabase.from("campaigns").select("id, name, status, created_at").eq("org_id", membership.org_id);
        const campaignList = (campaignsRes.data || []) as CampaignRow[];
        const campaignIds = campaignList.map((c) => c.id);
        setCampaigns(campaignList);

        if (campaignIds.length === 0) {
          setScores([]);
          setOutcomes([]);
          setTotalViewers(0);
          setIsLoading(false);
          return;
        }

        const [scoresRes, outcomesRes, viewersRes] = await Promise.all([
          supabase.from("deal_scores").select("*").in("campaign_id", campaignIds).order("scored_at", { ascending: false }),
          supabase.from("deal_outcomes").select("campaign_id, outcome").in("campaign_id", campaignIds),
          supabase.from("viewers").select("id", { count: "exact", head: true }).in("campaign_id", campaignIds),
        ]);

        // Only keep latest score per campaign
        const allScores = (scoresRes.data || []) as DealScoreRow[];
        const campaignIdSet = new Set(campaignIds);
        const latestMap = new Map<string, DealScoreRow>();
        for (const s of allScores) {
          if (campaignIdSet.has(s.campaign_id) && !latestMap.has(s.campaign_id)) {
            latestMap.set(s.campaign_id, s);
          }
        }
        setScores(Array.from(latestMap.values()));
        setOutcomes((outcomesRes.data || []) as DealOutcomeRow[]);
        setTotalViewers(viewersRes.count ?? 0);
      } catch {
        console.error("Fetch deal intelligence failed");
      } finally {
        setIsLoading(false);
      }
    };
    fetch();
  }, [membership?.org_id]);

  // KPIs
  const kpis = useMemo(() => {
    if (scores.length === 0) return { avgDes: 0, avgWatchDepth: 0, totalSponsors: 0, totalBlockers: 0, risingCount: 0, decliningCount: 0 };
    const avgDes = Math.round(scores.reduce((s, d) => s + (d.des ?? 0), 0) / scores.length);
    const avgWatchDepth = Math.round(scores.reduce((s, d) => s + (d.avg_watch_depth ?? 0), 0) / scores.length);
    const totalSponsors = scores.reduce((s, d) => s + (d.sponsor_count ?? 0), 0);
    const totalBlockers = scores.reduce((s, d) => s + (d.blocker_count ?? 0), 0);
    const risingCount = scores.filter((d) => d.momentum === "rising").length;
    const decliningCount = scores.filter((d) => d.momentum === "declining").length;
    return { avgDes, avgWatchDepth, totalSponsors, totalBlockers, risingCount, decliningCount };
  }, [scores]);

  // Chart: DES distribution
  const desDistribution = useMemo(() => {
    const buckets = [
      { name: "0-25", count: 0, color: "hsl(var(--destructive))" },
      { name: "26-50", count: 0, color: "hsl(45, 93%, 47%)" },
      { name: "51-75", count: 0, color: "hsl(173, 58%, 39%)" },
      { name: "76-100", count: 0, color: "hsl(142, 60%, 40%)" },
    ];
    for (const s of scores) {
      const des = s.des ?? 0;
      if (des <= 25) buckets[0].count++;
      else if (des <= 50) buckets[1].count++;
      else if (des <= 75) buckets[2].count++;
      else buckets[3].count++;
    }
    return buckets;
  }, [scores]);

  // Chart: momentum breakdown
  const momentumData = useMemo(() => [
    { name: "Rising", value: scores.filter((s) => s.momentum === "rising").length, color: "hsl(142, 60%, 40%)" },
    { name: "Stable", value: scores.filter((s) => s.momentum === "stable").length, color: "hsl(45, 93%, 47%)" },
    { name: "Declining", value: scores.filter((s) => s.momentum === "declining").length, color: "hsl(var(--destructive))" },
  ], [scores]);

  // Win rate from outcomes
  const outcomeStats = useMemo(() => {
    if (outcomes.length === 0) return { winRate: 0, lostRate: 0, stalledRate: 0 };
    const won = outcomes.filter((o) => o.outcome.startsWith("won")).length;
    const lost = outcomes.filter((o) => o.outcome.startsWith("lost") || o.outcome.includes("veto") || o.outcome.includes("block") || o.outcome.includes("disqualification")).length;
    const stalled = outcomes.length - won - lost;
    return {
      winRate: Math.round((won / outcomes.length) * 100),
      lostRate: Math.round((lost / outcomes.length) * 100),
      stalledRate: Math.round((stalled / outcomes.length) * 100),
    };
  }, [outcomes]);

  // Top signals
  const topSignals = useMemo(() => {
    const withVideo = scores.filter((s) => (s.viewer_count ?? 0) > 0);
    const avgDesWithViewers = withVideo.length > 0 ? Math.round(withVideo.reduce((a, s) => a + (s.des ?? 0), 0) / withVideo.length) : 0;
    const multiThreaded = scores.filter((s) => (s.multi_threading_score ?? 0) > 50).length;
    return [
      { label: "Deals avec viewers", value: withVideo.length, total: scores.length, impact: `DES moyen : ${avgDesWithViewers}` },
      { label: "Multi-threading élevé (>50)", value: multiThreaded, total: scores.length, impact: "Couverture buying committee" },
      { label: "Sponsors identifiés", value: kpis.totalSponsors, total: totalViewers || 1, impact: "Champions actifs" },
      { label: "Deals en hausse", value: kpis.risingCount, total: scores.length, impact: "Momentum positif" },
    ];
  }, [scores, kpis, totalViewers]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const hasData = scores.length > 0;

  return (
    <AppLayout>
      <PageHeader
        title="Deal Intelligence"
        description="Vue macro des signaux deal sur l'ensemble de votre pipeline"
      />

      {!hasData && (
        <div className="mb-6">
          <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-500/30 px-3 py-1 text-sm font-medium">
            Aucun signal
          </Badge>
          <p className="text-sm text-muted-foreground mt-2">
            Partagez vos landing pages pour commencer à collecter des signaux comportementaux.
          </p>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">DES moyen</p>
                <p className="text-2xl font-bold">{kpis.avgDes || "—"}</p>
              </div>
              <div className="p-2 rounded-lg bg-primary/10"><Zap className="w-5 h-5 text-primary" /></div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{scores.length} deals scorés</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Watch depth moyen</p>
                <p className="text-2xl font-bold">{kpis.avgWatchDepth}%</p>
              </div>
              <div className="p-2 rounded-lg bg-primary/10"><Eye className="w-5 h-5 text-primary" /></div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Profondeur de visionnage</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Contacts identifiés</p>
                <p className="text-2xl font-bold">{totalViewers}</p>
              </div>
              <div className="p-2 rounded-lg bg-primary/10"><Users className="w-5 h-5 text-primary" /></div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground flex items-center gap-1">
              <span>{kpis.totalSponsors} sponsors</span> · <span>{kpis.totalBlockers} bloqueurs</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Momentum pipeline</p>
                <p className="text-2xl font-bold flex items-center gap-1">
                  {kpis.risingCount > kpis.decliningCount ? (
                    <><TrendingUp className="h-5 w-5 text-emerald-600" /> Positif</>
                  ) : kpis.decliningCount > kpis.risingCount ? (
                    <><TrendingDown className="h-5 w-5 text-red-600" /> Négatif</>
                  ) : (
                    <>Neutre</>
                  )}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-primary/10"><Target className="w-5 h-5 text-primary" /></div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {kpis.risingCount} ↑ · {kpis.decliningCount} ↓
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="deals">Deals</TabsTrigger>
          <TabsTrigger value="outcomes">Outcomes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Distribution DES</CardTitle>
                <CardDescription>Répartition des Deal Engagement Scores</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={desDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Deals">
                        {desDistribution.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Signaux clés</CardTitle>
                <CardDescription>Impact de la vidéo exec sur le pipeline</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {topSignals.map((s) => (
                  <div key={s.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm">{s.label}</span>
                      <span className="text-sm font-semibold">{s.value}/{s.total}</span>
                    </div>
                    <Progress value={s.total > 0 ? (s.value / s.total) * 100 : 0} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">{s.impact}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Momentum chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Momentum des deals</CardTitle>
              <CardDescription>Tendance d'engagement par deal</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={momentumData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Deals">
                      {momentumData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Individual deals tab */}
        <TabsContent value="deals" className="space-y-4">
          {scores.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Aucun deal scoré pour le moment.
              </CardContent>
            </Card>
          ) : (
            scores.map((s) => {
              const camp = campaigns.find((c) => c.id === s.campaign_id);
              return (
                <Card key={s.id}>
                  <CardContent className="py-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{camp?.name || s.campaign_id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">Scoré le {new Date(s.scored_at).toLocaleDateString("fr-FR")}</p>
                    </div>
                    <Badge variant="outline" className={`font-bold ${
                      (s.des ?? 0) >= 70 ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" :
                      (s.des ?? 0) >= 40 ? "bg-amber-500/15 text-amber-700 border-amber-500/30" :
                      "bg-red-500/15 text-red-700 border-red-500/30"
                    }`}>
                      DES {s.des ?? 0}
                    </Badge>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>{s.viewer_count ?? 0} viewers</span>
                      <span>{s.sponsor_count ?? 0} sponsors</span>
                      <span>{s.blocker_count ?? 0} blockers</span>
                    </div>
                    {s.momentum === "rising" && <TrendingUp className="h-4 w-4 text-emerald-600" />}
                    {s.momentum === "declining" && <TrendingDown className="h-4 w-4 text-red-600" />}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* Outcomes tab */}
        <TabsContent value="outcomes" className="space-y-6">
          {outcomes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Aucun deal clôturé pour le moment.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-emerald-600">{outcomeStats.winRate}%</p>
                  <p className="text-sm text-muted-foreground mt-1">Win Rate</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {outcomes.filter((o) => o.outcome.startsWith("won")).length} deals gagnés
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-red-600">{outcomeStats.lostRate}%</p>
                  <p className="text-sm text-muted-foreground mt-1">Lost Rate</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-amber-600">{outcomeStats.stalledRate}%</p>
                  <p className="text-sm text-muted-foreground mt-1">Stalled Rate</p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
