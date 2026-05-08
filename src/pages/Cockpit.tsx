import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EkkoLoader } from "@/components/ui/EkkoLoader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAECockpitFeed, type CockpitDeal } from "@/hooks/useAECockpitFeed";
import {
  ArrowRight,
  Flame,
  TrendingUp,
  AlertTriangle,
  Eye,
  Clock,
  Inbox as InboxIcon,
  MessageSquare,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const RISK_STYLE: Record<string, string> = {
  healthy: "bg-signal/10 text-signal border-signal/30",
  at_risk: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  critical: "bg-destructive/10 text-destructive border-destructive/30",
};

const TRAJECTORY_LABEL: Record<string, string> = {
  accelerating: "Accélère",
  rising: "Monte",
  stable: "Stable",
  slipping: "Ralentit",
  falling: "Décroche",
};

function DealRow({ deal, onOpen }: { deal: CockpitDeal; onOpen: (id: string) => void }) {
  return (
    <button
      onClick={() => onOpen(deal.id)}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 border-b border-border/50 text-left transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground truncate">{deal.company}</span>
          <span
            className={cn(
              "text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border",
              RISK_STYLE[deal.risk_level] || RISK_STYLE.healthy,
            )}
          >
            {deal.risk_level === "healthy" ? "OK" : deal.risk_level}
          </span>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
          {deal.des !== null && <span>DES {Math.round(deal.des)}</span>}
          <span>{TRAJECTORY_LABEL[deal.trajectory] || deal.trajectory}</span>
          {deal.days_since_last_signal !== null && (
            <span>· {deal.days_since_last_signal}j sans signal</span>
          )}
        </div>
        {deal.recommended_action && (
          <p className="text-xs text-foreground/70 mt-1 line-clamp-1">
            → {deal.recommended_action}
          </p>
        )}
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground" />
    </button>
  );
}

function Section({
  title,
  icon: Icon,
  deals,
  onOpen,
  emptyLabel,
  accent,
}: {
  title: string;
  icon: any;
  deals: CockpitDeal[];
  onOpen: (id: string) => void;
  emptyLabel: string;
  accent?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className={cn("w-4 h-4", accent || "text-foreground")} />
          <span>{title}</span>
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {deals.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {deals.length === 0 ? (
          <p className="text-xs text-muted-foreground p-4">{emptyLabel}</p>
        ) : (
          <div>
            {deals.map((d) => (
              <DealRow key={d.id} deal={d} onOpen={onOpen} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Cockpit() {
  const navigate = useNavigate();
  const { data, loading, error } = useAECockpitFeed(60_000);

  const openDeal = (id: string) => navigate(`/app/campaigns/${id}`);

  return (
    <AppLayout>
      <PageHeader
        title="Cockpit"
        description="Vos deals en mouvement, ce matin"
      />

      {loading && (
        <div className="flex justify-center py-12">
          <EkkoLoader />
        </div>
      )}

      {error && (
        <Card><CardContent className="p-6 text-sm text-destructive">{error}</CardContent></Card>
      )}

      {data && (
        <div className="space-y-6">
          {/* Top stripe : badges momentum */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Nouveaux depuis votre dernière visite</div>
                <div className="text-2xl font-semibold text-foreground mt-1">
                  {data.badges.new_since_visit}
                  <span className="text-xs text-muted-foreground font-normal ml-2">/ {data.badges.new_signals} sur 7j</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Questions prospect</div>
                <div className="text-2xl font-semibold text-foreground mt-1">
                  {data.badges.pending_questions}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Actions à traiter</div>
                <div className="text-2xl font-semibold text-foreground mt-1">
                  {data.badges.active_triggers}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Deals suivis</div>
                <div className="text-2xl font-semibold text-foreground mt-1">
                  {data.meta.deal_count}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pulse 7j (OOB-5) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-signal" />
                Pulse 7 jours
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs text-muted-foreground">Accélèrent</div>
                <div className="text-xl font-semibold text-signal">{data.momentum.accelerating}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Stables</div>
                <div className="text-xl font-semibold text-foreground">{data.momentum.stable}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Ralentissent</div>
                <div className="text-xl font-semibold text-destructive">{data.momentum.slipping}</div>
              </div>
            </CardContent>
          </Card>

          {data.meta.deal_count === 0 ? (
            <EmptyState
              icon={Flame}
              title="Aucun deal actif"
              description="Créez votre premier deal pour activer le cockpit."
              action={{ label: "Créer un deal", onClick: () => navigate("/app/campaigns/new") }}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Section
                title="Top priorités"
                icon={Flame}
                accent="text-amber-500"
                deals={data.cockpit.top_priority}
                onOpen={openDeal}
                emptyLabel="Tout est calme."
              />
              <Section
                title="En accélération"
                icon={TrendingUp}
                accent="text-signal"
                deals={data.cockpit.moving}
                onOpen={openDeal}
                emptyLabel="Aucun deal en accélération."
              />
              <Section
                title="À risque"
                icon={AlertTriangle}
                accent="text-destructive"
                deals={data.cockpit.at_risk}
                onOpen={openDeal}
                emptyLabel="Aucun deal à risque."
              />
              <Section
                title="En observation"
                icon={Eye}
                accent="text-blue-500"
                deals={data.cockpit.observing}
                onOpen={openDeal}
                emptyLabel="Aucun deal en observation."
              />
              <Section
                title="Sans signal récent"
                icon={Clock}
                accent="text-muted-foreground"
                deals={data.cockpit.silent}
                onOpen={openDeal}
                emptyLabel="Tous vos deals envoient des signaux."
              />
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <InboxIcon className="w-4 h-4" />
                    Inbox
                    <span className="ml-auto text-xs font-normal text-muted-foreground">
                      {data.inbox.new_signals_count}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-signal" />
                    {data.badges.active_triggers} action(s) recommandée(s)
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                    {data.badges.pending_questions} question(s) prospect
                  </div>
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => navigate("/app/inbox")}>
                    Ouvrir l'inbox <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
