import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  TrendingUp, TrendingDown, Target, Eye, Clock, Users,
  ArrowUpRight, ArrowDownRight, Minus, BarChart3, Zap, Award,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart, Legend,
} from "recharts";

// ── Mock Data ──────────────────────────────────────────────

const pipelineStages = [
  { name: "Prospection", deals: 24, value: 480000, conversion: 45, color: "hsl(215, 20%, 65%)" },
  { name: "Qualification", deals: 18, value: 360000, conversion: 55, color: "hsl(222, 47%, 40%)" },
  { name: "Démo", deals: 12, value: 310000, conversion: 65, color: "hsl(173, 58%, 45%)" },
  { name: "Proposition", deals: 8, value: 240000, conversion: 72, color: "hsl(173, 58%, 35%)" },
  { name: "Négociation", deals: 5, value: 175000, conversion: 80, color: "hsl(142, 60%, 40%)" },
  { name: "Closing", deals: 3, value: 120000, conversion: 90, color: "hsl(142, 70%, 35%)" },
];

const forecastData = [
  { month: "Jan", prévu: 120000, réalisé: 115000, vidéoEnriché: 130000 },
  { month: "Fév", prévu: 135000, réalisé: 142000, vidéoEnriché: 148000 },
  { month: "Mar", prévu: 150000, réalisé: 138000, vidéoEnriché: 155000 },
  { month: "Avr", prévu: 145000, réalisé: 160000, vidéoEnriché: 168000 },
  { month: "Mai", prévu: 160000, réalisé: 155000, vidéoEnriché: 172000 },
  { month: "Juin", prévu: 175000, réalisé: null, vidéoEnriché: 185000 },
];

const teamBenchmarks = [
  { name: "Sophie Martin", deals: 8, winRate: 72, avgScore: 82, videosSent: 45, avgWatchRate: 78, revenue: 240000, trend: "up" as const },
  { name: "Thomas Dubois", deals: 6, winRate: 58, avgScore: 65, videosSent: 32, avgWatchRate: 62, revenue: 180000, trend: "down" as const },
  { name: "Claire Bonnet", deals: 10, winRate: 65, avgScore: 74, videosSent: 52, avgWatchRate: 71, revenue: 310000, trend: "up" as const },
  { name: "Marc Leroy", deals: 5, winRate: 80, avgScore: 88, videosSent: 28, avgWatchRate: 85, revenue: 200000, trend: "up" as const },
  { name: "Julie Petit", deals: 7, winRate: 43, avgScore: 52, videosSent: 38, avgWatchRate: 48, revenue: 145000, trend: "down" as const },
];

const videoSignals = [
  { label: "Deals avec vidéo vue >80%", value: 14, total: 24, impact: "+32% win rate" },
  { label: "Comité d'achat engagé", value: 8, total: 18, impact: "+45% vélocité" },
  { label: "Champions identifiés", value: 11, total: 24, impact: "+28% deal size" },
  { label: "Multi-viewer deals", value: 16, total: 24, impact: "+55% close rate" },
];

const atRiskDeals = [
  { name: "Contrat Ingérop", value: 85000, stage: "Négociation", risk: "Aucun viewer depuis 12j", score: 35 },
  { name: "Projet BouyguesTP", value: 120000, stage: "Proposition", risk: "Décideur non engagé", score: 42 },
  { name: "Appel Vinci Energies", value: 65000, stage: "Démo", risk: "Watch rate <20%", score: 28 },
];

const topDeals = [
  { name: "Expansion SNCF", value: 180000, stage: "Closing", signal: "3 décideurs engagés", score: 92 },
  { name: "Pilote EDF Renouv.", value: 95000, stage: "Négociation", signal: "Champion très actif", score: 87 },
  { name: "Déploiement Airbus", value: 220000, stage: "Proposition", signal: "5 viewers, 82% avg watch", score: 81 },
];

// ── Helpers ─────────────────────────────────────────────────

function formatCurrency(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function TrendIcon({ trend }: { trend: "up" | "down" | "flat" }) {
  if (trend === "up") return <ArrowUpRight className="w-4 h-4 text-accent" />;
  if (trend === "down") return <ArrowDownRight className="w-4 h-4 text-destructive" />;
  return <Minus className="w-4 h-4 text-muted-foreground" />;
}

function ScoreBadge({ score }: { score: number }) {
  const variant = score >= 75 ? "default" : score >= 50 ? "secondary" : "destructive";
  return <Badge variant={variant}>{score}</Badge>;
}

// ── Component ──────────────────────────────────────────────

export default function DealIntelligence() {
  const totalPipeline = pipelineStages.reduce((s, st) => s + st.value, 0);
  const weightedForecast = pipelineStages.reduce((s, st) => s + st.value * (st.conversion / 100), 0);

  return (
    <AppLayout>
      <PageHeader
        title="Deal Intelligence"
        description="Pipeline health, forecast enrichi par signaux vidéo et benchmarks équipe"
      />

      {/* ── KPI Row ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pipeline total</p>
                <p className="text-2xl font-bold">{formatCurrency(totalPipeline)}</p>
              </div>
              <div className="p-2 rounded-lg bg-primary/10"><Target className="w-5 h-5 text-primary" /></div>
            </div>
            <p className="mt-2 text-sm text-accent font-medium flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> +18% vs mois dernier
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Forecast pondéré</p>
                <p className="text-2xl font-bold">{formatCurrency(weightedForecast)}</p>
              </div>
              <div className="p-2 rounded-lg bg-accent/10"><BarChart3 className="w-5 h-5 text-accent" /></div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Basé sur la conversion par étape</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Win rate moyen</p>
                <p className="text-2xl font-bold">64%</p>
              </div>
              <div className="p-2 rounded-lg bg-accent/10"><Zap className="w-5 h-5 text-accent" /></div>
            </div>
            <p className="mt-2 text-sm text-accent font-medium flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> +8pts avec vidéo
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Deals à risque</p>
                <p className="text-2xl font-bold text-destructive">3</p>
              </div>
              <div className="p-2 rounded-lg bg-destructive/10"><TrendingDown className="w-5 h-5 text-destructive" /></div>
            </div>
            <p className="mt-2 text-sm text-destructive font-medium">Attention requise</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pipeline" className="space-y-6">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline Health</TabsTrigger>
          <TabsTrigger value="forecast">Forecast Vidéo</TabsTrigger>
          <TabsTrigger value="team">Benchmarks Équipe</TabsTrigger>
        </TabsList>

        {/* ── Pipeline Health ───────────────────── */}
        <TabsContent value="pipeline" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Funnel chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Entonnoir de conversion</CardTitle>
                <CardDescription>Nombre de deals et taux de conversion par étape</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pipelineStages} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                      <XAxis type="number" tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }} width={90} />
                      <Tooltip
                        formatter={(v: number) => formatCurrency(v)}
                        contentStyle={{ borderRadius: 8, border: "1px solid hsl(214, 32%, 91%)", fontSize: 12 }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {pipelineStages.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Video signals */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Signaux Vidéo</CardTitle>
                <CardDescription>Impact de l'engagement vidéo sur le pipeline</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {videoSignals.map((s) => (
                  <div key={s.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm">{s.label}</span>
                      <span className="text-sm font-semibold">{s.value}/{s.total}</span>
                    </div>
                    <Progress value={(s.value / s.total) * 100} className="h-2" />
                    <p className="text-xs text-accent mt-1 font-medium">{s.impact}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* At-risk / Top deals */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-destructive" /> Deals à risque
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {atRiskDeals.map((d) => (
                    <div key={d.name} className="flex items-center justify-between p-3 rounded-lg border bg-destructive/5 border-destructive/20">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{d.name}</p>
                        <p className="text-xs text-muted-foreground">{d.stage} · {d.risk}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold">{formatCurrency(d.value)}</span>
                        <ScoreBadge score={d.score} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-accent" /> Top deals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topDeals.map((d) => (
                    <div key={d.name} className="flex items-center justify-between p-3 rounded-lg border bg-accent/5 border-accent/20">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{d.name}</p>
                        <p className="text-xs text-muted-foreground">{d.stage} · {d.signal}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold">{formatCurrency(d.value)}</span>
                        <ScoreBadge score={d.score} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Forecast Vidéo ───────────────────── */}
        <TabsContent value="forecast" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Forecast classique vs enrichi par signaux vidéo</CardTitle>
              <CardDescription>Le forecast vidéo intègre les scores d'engagement, les champions identifiés et la couverture du comité d'achat</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecastData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }} />
                    <YAxis tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }} tickFormatter={(v) => `${v / 1000}k`} />
                    <Tooltip
                      formatter={(v: number | null) => v ? formatCurrency(v) : "—"}
                      contentStyle={{ borderRadius: 8, border: "1px solid hsl(214, 32%, 91%)", fontSize: 12 }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="prévu" stroke="hsl(215, 20%, 65%)" fill="hsl(215, 20%, 65%)" fillOpacity={0.15} name="Forecast classique" />
                    <Area type="monotone" dataKey="réalisé" stroke="hsl(222, 47%, 30%)" fill="hsl(222, 47%, 30%)" fillOpacity={0.2} name="Réalisé" />
                    <Area type="monotone" dataKey="vidéoEnriché" stroke="hsl(173, 58%, 39%)" fill="hsl(173, 58%, 39%)" fillOpacity={0.2} name="Forecast vidéo" strokeDasharray="5 5" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <Eye className="w-8 h-8 mx-auto text-accent mb-2" />
                <p className="text-2xl font-bold">+22%</p>
                <p className="text-sm text-muted-foreground">Précision du forecast avec signaux vidéo</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Clock className="w-8 h-8 mx-auto text-primary mb-2" />
                <p className="text-2xl font-bold">-15j</p>
                <p className="text-sm text-muted-foreground">Réduction du cycle de vente moyen</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Users className="w-8 h-8 mx-auto text-accent mb-2" />
                <p className="text-2xl font-bold">3.2x</p>
                <p className="text-sm text-muted-foreground">Plus de stakeholders engagés</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Benchmarks Équipe ───────────────── */}
        <TabsContent value="team" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Performance de l'équipe</CardTitle>
              <CardDescription>Comparaison des métriques clés par commercial</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Commercial</TableHead>
                    <TableHead className="text-center">Deals</TableHead>
                    <TableHead className="text-center">Win Rate</TableHead>
                    <TableHead className="text-center">Score moyen</TableHead>
                    <TableHead className="text-center">Vidéos envoyées</TableHead>
                    <TableHead className="text-center">Watch Rate</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-center">Trend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamBenchmarks.map((m) => (
                    <TableRow key={m.name}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell className="text-center">{m.deals}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={m.winRate >= 65 ? "default" : m.winRate >= 50 ? "secondary" : "destructive"}>
                          {m.winRate}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center"><ScoreBadge score={m.avgScore} /></TableCell>
                      <TableCell className="text-center">{m.videosSent}</TableCell>
                      <TableCell className="text-center">{m.avgWatchRate}%</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(m.revenue)}</TableCell>
                      <TableCell className="text-center"><TrendIcon trend={m.trend} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Team bar chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Revenue par commercial</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={teamBenchmarks}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(215, 16%, 47%)" }} />
                    <YAxis tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }} tickFormatter={(v) => `${v / 1000}k`} />
                    <Tooltip
                      formatter={(v: number) => formatCurrency(v)}
                      contentStyle={{ borderRadius: 8, border: "1px solid hsl(214, 32%, 91%)", fontSize: 12 }}
                    />
                    <Bar dataKey="revenue" fill="hsl(173, 58%, 39%)" radius={[4, 4, 0, 0]} name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
