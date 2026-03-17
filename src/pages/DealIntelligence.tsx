import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp, TrendingDown, Target, Eye, Clock, Users,
  ArrowUpRight, ArrowDownRight, Zap,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, Area, AreaChart, Legend,
} from "recharts";

// ── Mock Data — focused on exec video impact ──────────────

const responseRateData = [
  { name: "Sans vidéo exec", taux: 12, color: "hsl(215, 20%, 65%)" },
  { name: "Avec vidéo exec", taux: 34, color: "hsl(173, 58%, 39%)" },
  { name: "Avec vidéo exec + relance", taux: 48, color: "hsl(142, 60%, 40%)" },
];

const cycleAccelerationData = [
  { month: "Jan", sansVideo: 45, avecVideo: 38 },
  { month: "Fév", sansVideo: 42, avecVideo: 32 },
  { month: "Mar", sansVideo: 48, avecVideo: 35 },
  { month: "Avr", sansVideo: 44, avecVideo: 30 },
  { month: "Mai", sansVideo: 46, avecVideo: 28 },
  { month: "Juin", sansVideo: 43, avecVideo: 27 },
];

const winRateComparison = [
  { name: "Sans vidéo exec", winRate: 22, deals: 48 },
  { name: "Vidéo vue <50%", winRate: 31, deals: 18 },
  { name: "Vidéo vue >50%", winRate: 45, deals: 24 },
  { name: "Vidéo vue >80% + multi-viewer", winRate: 62, deals: 14 },
];

const videoEngagementSignals = [
  { label: "Taux de réponse après vidéo exec", value: 34, total: 100, impact: "+22pts vs sans vidéo" },
  { label: "Vidéos vues >80% par le décideur", value: 14, total: 38, impact: "62% win rate" },
  { label: "Deals avec partage interne", value: 16, total: 38, impact: "+55% close rate" },
  { label: "Cycle raccourci (vidéo exec)", value: 28, total: 45, impact: "-15 jours en moyenne" },
];

function formatDays(n: number) { return `${n}j`; }

// ── Component ──────────────────────────────────────────────

export default function DealIntelligence() {
  return (
    <AppLayout>
      <PageHeader
        title="Deal Intelligence"
        description="Impact de la présence exécutive vidéo sur vos cycles de vente"
      />

      {/* Preview Badge */}
      <div className="mb-6">
        <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-500/30 px-3 py-1 text-sm font-medium">
          Preview
        </Badge>
        <p className="text-sm text-muted-foreground mt-2">
          Ces métriques illustrent l'impact attendu des vidéos exec sur vos cycles de vente. Données réelles disponibles en V2.
        </p>
      </div>

      {/* ── KPI Row ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taux de réponse avec vidéo</p>
                <p className="text-2xl font-bold">34%</p>
              </div>
              <div className="p-2 rounded-lg bg-accent/10"><Target className="w-5 h-5 text-accent" /></div>
            </div>
            <p className="mt-2 text-sm text-accent font-medium flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> +22pts vs email seul
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Réduction du cycle</p>
                <p className="text-2xl font-bold">-15j</p>
              </div>
              <div className="p-2 rounded-lg bg-primary/10"><Clock className="w-5 h-5 text-primary" /></div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Cycle moyen avec vidéo exec</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Win rate avec vidéo exec</p>
                <p className="text-2xl font-bold">45%</p>
              </div>
              <div className="p-2 rounded-lg bg-accent/10"><Zap className="w-5 h-5 text-accent" /></div>
            </div>
            <p className="mt-2 text-sm text-accent font-medium flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> +23pts vs sans vidéo
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Deals multi-viewer</p>
                <p className="text-2xl font-bold">42%</p>
              </div>
              <div className="p-2 rounded-lg bg-primary/10"><Users className="w-5 h-5 text-primary" /></div>
            </div>
            <p className="mt-2 text-sm text-accent font-medium flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" /> Partage interne élevé
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="response" className="space-y-6">
        <TabsList>
          <TabsTrigger value="response">Taux de réponse</TabsTrigger>
          <TabsTrigger value="cycle">Accélération du cycle</TabsTrigger>
          <TabsTrigger value="winrate">Win Rate</TabsTrigger>
        </TabsList>

        {/* Response Rate */}
        <TabsContent value="response" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Taux de réponse après envoi vidéo exec</CardTitle>
                <CardDescription>Comparaison des taux de réponse selon le type d'approche</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={responseRateData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                      <XAxis type="number" tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }} tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }} width={160} />
                      <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ borderRadius: 8, border: "1px solid hsl(214, 32%, 91%)", fontSize: 12 }} />
                      <Bar dataKey="taux" radius={[0, 4, 4, 0]}>
                        {responseRateData.map((entry, i) => (
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
                <CardTitle className="text-base">Signaux d'engagement vidéo</CardTitle>
                <CardDescription>Impact mesuré de la vidéo exec sur le pipeline</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {videoEngagementSignals.map((s) => (
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
        </TabsContent>

        {/* Cycle Acceleration */}
        <TabsContent value="cycle" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Durée moyenne du cycle de vente (jours)</CardTitle>
              <CardDescription>Comparaison des deals avec et sans vidéo exécutive</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cycleAccelerationData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }} />
                    <YAxis tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }} tickFormatter={(v) => formatDays(v)} />
                    <Tooltip formatter={(v: number) => formatDays(v)} contentStyle={{ borderRadius: 8, border: "1px solid hsl(214, 32%, 91%)", fontSize: 12 }} />
                    <Legend />
                    <Area type="monotone" dataKey="sansVideo" stroke="hsl(215, 20%, 65%)" fill="hsl(215, 20%, 65%)" fillOpacity={0.15} name="Sans vidéo exec" />
                    <Area type="monotone" dataKey="avecVideo" stroke="hsl(173, 58%, 39%)" fill="hsl(173, 58%, 39%)" fillOpacity={0.2} name="Avec vidéo exec" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <Clock className="w-8 h-8 mx-auto text-primary mb-2" />
                <p className="text-2xl font-bold">-15j</p>
                <p className="text-sm text-muted-foreground">Réduction moyenne du cycle</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Eye className="w-8 h-8 mx-auto text-accent mb-2" />
                <p className="text-2xl font-bold">78%</p>
                <p className="text-sm text-muted-foreground">Taux moyen de visionnage</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Users className="w-8 h-8 mx-auto text-accent mb-2" />
                <p className="text-2xl font-bold">2.8x</p>
                <p className="text-sm text-muted-foreground">Plus de stakeholders engagés</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Win Rate */}
        <TabsContent value="winrate" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Win rate selon le niveau d'engagement vidéo</CardTitle>
              <CardDescription>Plus l'engagement vidéo est fort, plus le win rate augmente</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={winRateComparison}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(215, 16%, 47%)" }} />
                    <YAxis tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ borderRadius: 8, border: "1px solid hsl(214, 32%, 91%)", fontSize: 12 }} />
                    <Bar dataKey="winRate" radius={[4, 4, 0, 0]} fill="hsl(173, 58%, 39%)" name="Win Rate" />
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
