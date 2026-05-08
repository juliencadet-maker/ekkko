import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EkkoLoader } from "@/components/ui/EkkoLoader";
import { useAECockpitFeed } from "@/hooks/useAECockpitFeed";
import { Inbox as InboxIcon, Zap, MessageSquare, Activity, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const EVENT_LABEL: Record<string, string> = {
  page_view: "A consulté la page du deal",
  asset_view: "A ouvert un contenu",
  video_play: "A lancé la vidéo",
  video_complete: "A terminé la vidéo",
  doc_open: "A ouvert un document",
  doc_download: "A téléchargé un document",
  link_click: "A cliqué sur un lien",
  reply_received: "A répondu",
  signal_offline: "Signal AE saisi",
};

export default function Inbox() {
  const navigate = useNavigate();
  const { data, loading, error } = useAECockpitFeed(45_000);

  return (
    <AppLayout>
      <PageHeader
        title="Inbox"
        description="Tous les signaux et questions de vos deals, en un flux"
      />

      {loading && <div className="flex justify-center py-12"><EkkoLoader /></div>}
      {error && <Card><CardContent className="p-6 text-sm text-destructive">{error}</CardContent></Card>}

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Actions recommandées */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-signal" />
                Actions à traiter
                <span className="ml-auto text-xs text-muted-foreground">
                  {data.inbox.active_triggers.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.inbox.active_triggers.length === 0 ? (
                <p className="text-xs text-muted-foreground p-4">Aucune action en attente.</p>
              ) : (
                data.inbox.active_triggers.map((t: any) => (
                  <button
                    key={t.id}
                    onClick={() => navigate(`/app/campaigns/${t.campaign_id}`)}
                    className="w-full text-left p-3 border-b border-border/50 hover:bg-muted/40 transition-colors"
                  >
                    <div className="text-sm font-medium text-foreground">{t.message_what || "Action recommandée"}</div>
                    {t.message_why && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.message_why}</div>
                    )}
                    {t.message_action && (
                      <div className="text-xs text-signal mt-1">→ {t.message_action}</div>
                    )}
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          {/* Timeline cross-deals */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" />
                Activité (7 derniers jours)
                <span className="ml-auto text-xs text-muted-foreground">
                  {data.inbox.events.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.inbox.events.length === 0 ? (
                <p className="text-xs text-muted-foreground p-4">Aucun signal sur 7 jours.</p>
              ) : (
                data.inbox.events.map((e: any) => (
                  <button
                    key={e.id}
                    onClick={() => navigate(`/app/campaigns/${e.campaign_id}`)}
                    className="w-full text-left p-3 border-b border-border/50 hover:bg-muted/40 transition-colors flex items-start gap-3"
                  >
                    <div className="flex-1">
                      <div className="text-sm text-foreground">
                        {EVENT_LABEL[e.event_type] || e.event_type}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(e.created_at), { addSuffix: true, locale: fr })}
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground mt-1" />
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          {/* Pending questions */}
          {data.inbox.pending_questions > 0 && (
            <Card className="lg:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-500" />
                  {data.inbox.pending_questions} question(s) prospect en attente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Ouvrez chaque deal pour répondre dans l'onglet "Contenu du deal".
                </p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate("/app/campaigns")}>
                  Voir mes deals <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </AppLayout>
  );
}
