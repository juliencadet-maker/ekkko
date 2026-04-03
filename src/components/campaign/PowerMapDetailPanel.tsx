import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  X,
  Eye,
  Clock,
  Share2,
  Crown,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Mail,
  Building2,
  Briefcase,
  Flame,
  Zap,
  BarChart3,
  Play,
  MessageSquare,
  Phone,
  Gift,
  UserPlus,
  AlertTriangle,
  ChevronRight,
  Video,
  Target,
  Upload,
  Sparkles,
} from "lucide-react";
import { EkkoLoader } from "@/components/ui/EkkoLoader";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { PowerMapEntry } from "./PowerMap";

type StatusLevel = "sponsor" | "blocker" | "neutral" | "new" | "unknown";

function getStatusLevel(entry: PowerMapEntry): StatusLevel {
  if (entry.sponsor_score >= 60 && entry.contact_score >= 50) return "sponsor";
  if (entry.blocker_score >= 50) return "blocker";
  if (entry.contact_score >= 30) return "neutral";
  if (entry.isNew) return "new";
  return "unknown";
}

function getStatusConfig(level: StatusLevel) {
  switch (level) {
    case "sponsor":
      return { label: "Sponsor actif", color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", icon: TrendingUp, barColor: "bg-emerald-500" };
    case "blocker":
      return { label: "Bloqueur potentiel", color: "bg-red-500/15 text-red-700 border-red-500/30", icon: TrendingDown, barColor: "bg-red-500" };
    case "neutral":
      return { label: "Neutre", color: "bg-muted text-muted-foreground border-border", icon: Minus, barColor: "bg-muted-foreground/40" };
    case "new":
      return { label: "Nouveau", color: "bg-blue-500/15 text-blue-700 border-blue-500/30", icon: Sparkles, barColor: "bg-blue-500" };
    default:
      return { label: "Inconnu", color: "bg-muted text-muted-foreground border-border", icon: Minus, barColor: "bg-muted-foreground/40" };
  }
}

interface PowerMapDetailPanelProps {
  entry: PowerMapEntry;
  onClose: () => void;
  campaignName?: string;
}

export function PowerMapDetailPanel({
  entry,
  onClose,
  campaignName,
}: PowerMapDetailPanelProps) {
  const level = getStatusLevel(entry);
  const config = getStatusConfig(level);
  const StatusIcon = config.icon;
  const [isSyncing, setIsSyncing] = useState(false);

  return (
    <div className="h-full flex flex-col border-l bg-card">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-sm">Détails du contact</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Identity */}
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="text-sm font-medium">
              {entry.initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold">{entry.displayName}</p>
            <Badge variant="outline" className={`mt-1 ${config.color}`}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
            {entry.badgeConfidence === "À confirmer" && (
              <Badge variant="outline" className="mt-1 ml-1 bg-amber-500/15 text-amber-700 border-amber-500/30 text-[10px]">
                À confirmer
              </Badge>
            )}
          </div>
        </div>

        {/* Contact info */}
        <div className="space-y-2">
          {entry.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">{entry.email}</span>
            </div>
          )}
          {entry.title && (
            <div className="flex items-center gap-2 text-sm">
              <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">{entry.title}</span>
            </div>
          )}
          {entry.domain && (
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">{entry.domain}</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Score Breakdown */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Scores
          </h4>
          <div className="space-y-2">
            {[
              { label: "Contact", value: entry.contact_score, max: 100, color: "bg-emerald-500" },
              { label: "Sponsor", value: entry.sponsor_score, max: 100, color: "bg-blue-500" },
              { label: "Bloqueur (inference)", value: entry.blocker_score, max: 100, color: "bg-red-500" },
              { label: "Influence", value: entry.influence_score, max: 100, color: "bg-amber-500" },
            ].map((dim) => (
              <div key={dim.label}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-muted-foreground">{dim.label}</span>
                  <span className="font-medium">{dim.value}/{dim.max}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${dim.color}`}
                    style={{ width: `${(dim.value / dim.max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          {/* Engagement réel */}
          <div className="bg-muted/50 rounded-lg p-3 mt-2">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Engagement réel</span>
              <span className="font-medium">{Math.round(entry.engagement_réel)}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              = contact × poids layer × confiance
            </p>
          </div>
        </div>

        <Separator />

        {/* Layer info */}
        {entry.layer && (
          <>
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Layer comité
              </h4>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{entry.layer}</Badge>
                <span className="text-xs text-muted-foreground">
                  poids {entry.layerWeight.toFixed(2)}
                </span>
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Champion info */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Influence
          </h4>
          {entry.isChampion ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Crown className="h-4 w-4 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-700">Champion</p>
                <p className="text-xs text-amber-600">
                  Influence score : {entry.influence_score}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Pas encore identifié comme champion.
            </p>
          )}
        </div>

        <Separator />

        {/* Dates */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Historique
          </h4>
          {entry.first_seen_at && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Première détection :</span>
              <span className="font-medium">
                {format(new Date(entry.first_seen_at), "d MMM yyyy HH:mm", { locale: fr })}
              </span>
            </div>
          )}
          {entry.last_event_at && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Dernier signal :</span>
              <span className="font-medium">
                {format(new Date(entry.last_event_at), "d MMM yyyy HH:mm", { locale: fr })}
              </span>
            </div>
          )}
        </div>

        <Separator />

        {/* Next Best Actions */}
        <NextBestActions entry={entry} />

        <Separator />

        {/* HubSpot CRM Push */}
        <HubSpotPushButton entry={entry} campaignName={campaignName} isSyncing={isSyncing} setIsSyncing={setIsSyncing} />
      </div>
    </div>
  );
}

// ---- Infer committee role from title ----
type CommitteeRole = "champion" | "decision_maker" | "influencer" | "blocker" | "unknown";

function inferRole(entry: PowerMapEntry): CommitteeRole {
  if (entry.isChampion) return "champion";
  const t = (entry.title || "").toLowerCase();
  if (t.includes("dg") || t.includes("ceo") || t.includes("cto") || t.includes("cfo") || t.includes("daf") || t.includes("vp") || t.includes("président") || t.includes("directeur général") || t.includes("directrice générale")) return "decision_maker";
  if (t.includes("directeur") || t.includes("directrice") || t.includes("responsable") || t.includes("head") || t.includes("manager") || t.includes("chef de projet")) return "influencer";
  if (entry.blocker_score >= 50) return "blocker";
  return "unknown";
}

// ---- Next Best Action Engine ----
interface Action {
  id: string;
  icon: typeof Mail;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  type: "email" | "call" | "video" | "meeting" | "nurture";
}

function generateNextActions(entry: PowerMapEntry): Action[] {
  const actions: Action[] = [];
  const role = inferRole(entry);
  const score = entry.contact_score;
  const daysSinceLastEvent = entry.last_event_at
    ? Math.max(0, (Date.now() - new Date(entry.last_event_at).getTime()) / (1000 * 60 * 60 * 24))
    : 30;
  const isRecentlyActive = daysSinceLastEvent < 2;
  const isStale = daysSinceLastEvent > 7;

  // ---- HOT LEADS (score >= 75) ----
  if (score >= 75) {
    if (isRecentlyActive) {
      actions.push({
        id: "call-now", icon: Phone, title: "Appeler maintenant",
        description: `${entry.displayName} est très engagé(e) et actif(ve). C'est le moment idéal pour un appel de qualification.`,
        priority: "high", type: "call",
      });
    }
    if (role === "champion") {
      actions.push({
        id: "leverage-champion", icon: UserPlus, title: "Mobiliser le champion",
        description: `Demandez à ${entry.displayName} de vous introduire auprès du décideur. Proposez un contenu exclusif à partager.`,
        priority: "high", type: "meeting",
      });
    }
    if (role === "decision_maker") {
      actions.push({
        id: "propose-meeting", icon: Target, title: "Proposer un RDV décisionnel",
        description: "Le décideur montre un fort intérêt. Proposez une démo personnalisée ou un call stratégique.",
        priority: "high", type: "meeting",
      });
    }
    actions.push({
      id: "send-case-study", icon: Gift, title: "Envoyer une étude de cas",
      description: "Renforcez l'engagement avec un cas client pertinent pour son secteur/poste.",
      priority: "medium", type: "email",
    });
  }
  // ---- WARM LEADS (score 50-74) ----
  else if (score >= 50) {
    actions.push({
      id: "followup-video", icon: Video, title: "Vidéo de suivi personnalisée",
      description: `Créez une courte vidéo personnalisée adressée à ${entry.displayName} pour approfondir le sujet qui l'intéresse.`,
      priority: "high", type: "video",
    });
    if (role === "influencer") {
      actions.push({
        id: "arm-influencer", icon: Target, title: "Armer l'influenceur",
        description: "Fournissez un comparatif ou ROI calculator que cette personne pourra présenter en interne.",
        priority: "medium", type: "email",
      });
    }
  }
  // ---- COLD LEADS (score 25-49) ----
  else if (score >= 25) {
    if (isStale) {
      actions.push({
        id: "re-engage", icon: Play, title: "Relance de ré-engagement",
        description: `Pas d'activité depuis ${Math.round(daysSinceLastEvent)} jours. Envoyez un angle différent ou une nouveauté produit.`,
        priority: "medium", type: "email",
      });
    } else {
      actions.push({
        id: "nurture-content", icon: MessageSquare, title: "Séquence de nurturing",
        description: "Intérêt modéré — intégrez dans une séquence automatique (3 emails sur 2 semaines).",
        priority: "low", type: "nurture",
      });
    }
  }

  // ---- BLOCKERS ----
  if (role === "blocker") {
    actions.push({
      id: "address-blocker", icon: AlertTriangle, title: "Lever le blocage",
      description: `${entry.displayName} montre peu d'intérêt. Identifiez ses objections et préparez une réponse ciblée.`,
      priority: "high", type: "email",
    });
  }

  // ---- INACTIVE (score < 25) ----
  if (score < 25 && role !== "blocker") {
    actions.push({
      id: "last-chance", icon: Mail, title: "Email de dernière chance",
      description: "Engagement très faible. Tentez un angle provocateur ou une question ouverte avant d'archiver.",
      priority: "low", type: "email",
    });
  }

  return actions.slice(0, 3);
}

const PRIORITY_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  high: { bg: "bg-orange-500/15", text: "text-orange-700", border: "border-orange-500/30", label: "Urgent" },
  medium: { bg: "bg-blue-500/15", text: "text-blue-700", border: "border-blue-500/30", label: "Recommandé" },
  low: { bg: "bg-muted", text: "text-muted-foreground", border: "border-border", label: "Optionnel" },
};

function NextBestActions({ entry }: { entry: PowerMapEntry }) {
  const actions = generateNextActions(entry);
  if (actions.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <Zap className="h-3.5 w-3.5" />
        Prochaines actions
      </h4>
      <div className="space-y-2">
        {actions.map((action) => {
          const Icon = action.icon;
          const prio = PRIORITY_STYLES[action.priority];
          return (
            <div key={action.id} className="p-3 rounded-lg border bg-card hover:shadow-sm transition-all">
              <div className="flex items-start gap-2.5">
                <div className={`p-1.5 rounded-md ${prio.bg} shrink-0 mt-0.5`}>
                  <Icon className={`h-3.5 w-3.5 ${prio.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-xs font-semibold">{action.title}</p>
                    <Badge variant="outline" className={`text-[9px] px-1 py-0 ${prio.bg} ${prio.text} ${prio.border}`}>
                      {prio.label}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {action.description}
                  </p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- HubSpot CRM Push ----
function HubSpotPushButton({
  entry,
  campaignName,
  isSyncing,
  setIsSyncing,
}: {
  entry: PowerMapEntry;
  campaignName?: string;
  isSyncing: boolean;
  setIsSyncing: (v: boolean) => void;
}) {
  const role = inferRole(entry);

  const handlePush = async () => {
    if (!entry.email) {
      toast.error("Ce contact n'a pas d'email — impossible de synchroniser.");
      return;
    }
    setIsSyncing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("hubspot-sync", {
        body: {
          action: "sync_contacts",
          viewers: [
            {
              viewer_email: entry.email,
              viewer_name: entry.name,
              viewer_title: entry.title,
              viewer_company: entry.domain,
              contact_score: entry.contact_score,
              sponsor_score: entry.sponsor_score,
              blocker_score: entry.blocker_score,
              influence_score: entry.influence_score,
              is_champion: entry.isChampion,
              committee_role: role,
              campaign_name: campaignName,
              first_seen_at: entry.first_seen_at,
              last_event_at: entry.last_event_at,
            },
          ],
        },
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
      });

      if (res.data?.success) {
        const result = res.data.results?.[0];
        toast.success(
          result?.status === "created"
            ? `Contact créé dans HubSpot ✓`
            : `Contact mis à jour dans HubSpot ✓`
        );
      } else {
        toast.error(res.data?.error || "Erreur lors de la synchronisation");
      }
    } catch (e) {
      console.error("HubSpot sync error:", e);
      toast.error("Erreur de connexion à HubSpot");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <Upload className="h-3.5 w-3.5" />
        CRM HubSpot
      </h4>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={handlePush}
        disabled={isSyncing || !entry.email}
      >
        {isSyncing ? (
          <EkkoLoader mode="once" size={14} className="mr-2" />
        ) : (
          <Upload className="h-3.5 w-3.5 mr-2" />
        )}
        {isSyncing ? "Synchronisation..." : "Envoyer vers HubSpot"}
      </Button>
      {!entry.email && (
        <p className="text-[11px] text-muted-foreground">
          Email requis pour synchroniser ce contact.
        </p>
      )}
    </div>
  );
}
