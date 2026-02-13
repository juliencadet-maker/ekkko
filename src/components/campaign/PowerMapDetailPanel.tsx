import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
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
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { LeadScoreBreakdown } from "./leadScoring";

type InterestLevel = "high" | "neutral" | "low";

interface PowerMapEntry {
  id: string;
  video_id: string;
  viewer_hash: string;
  watch_percentage: number;
  total_watch_seconds: number;
  max_percentage_reached: number;
  viewer_name: string | null;
  viewer_email: string | null;
  viewer_title: string | null;
  viewer_company: string | null;
  referred_by_hash: string | null;
  session_count: number;
  first_watched_at: string;
  last_watched_at: string;
  interest: InterestLevel;
  isChampion: boolean;
  referralCount: number;
  displayName: string;
  initials: string;
  leadScore: LeadScoreBreakdown;
}

function getInterestConfig(interest: InterestLevel) {
  switch (interest) {
    case "high":
      return {
        label: "Intérêt élevé",
        color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
        icon: TrendingUp,
        barColor: "bg-emerald-500",
      };
    case "low":
      return {
        label: "Intérêt faible",
        color: "bg-red-500/15 text-red-700 border-red-500/30",
        icon: TrendingDown,
        barColor: "bg-red-500",
      };
    default:
      return {
        label: "Neutre",
        color: "bg-muted text-muted-foreground border-border",
        icon: Minus,
        barColor: "bg-muted-foreground/40",
      };
  }
}

function formatDuration(seconds: number, totalDuration?: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const watched = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  if (totalDuration) {
    const totalMins = Math.floor(totalDuration / 60);
    const totalSecs = totalDuration % 60;
    const total = totalMins > 0 ? `${totalMins}m ${totalSecs}s` : `${totalSecs}s`;
    return `${watched} sur ${total}`;
  }
  return watched;
}

interface PowerMapDetailPanelProps {
  entry: PowerMapEntry;
  onClose: () => void;
  videoDuration?: number;
}

export function PowerMapDetailPanel({
  entry,
  onClose,
  videoDuration,
}: PowerMapDetailPanelProps) {
  const config = getInterestConfig(entry.interest);
  const InterestIcon = config.icon;

  return (
    <div className="h-full flex flex-col border-l bg-card">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-sm">Détails du viewer</h3>
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
              <InterestIcon className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
            <Badge variant="outline" className={`mt-1 ${entry.leadScore.bgColor} ${entry.leadScore.color} ${entry.leadScore.borderColor}`}>
              {entry.leadScore.total >= 75 && <Flame className="h-3 w-3 mr-1" />}
              Score : {entry.leadScore.total}/100 — {entry.leadScore.label}
            </Badge>
          </div>
        </div>

        {/* Contact info */}
        <div className="space-y-2">
          {entry.viewer_email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">{entry.viewer_email}</span>
            </div>
          )}
          {entry.viewer_title && (
            <div className="flex items-center gap-2 text-sm">
              <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">{entry.viewer_title}</span>
            </div>
          )}
          {entry.viewer_company && (
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">{entry.viewer_company}</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Watch progress */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Progression vidéo
          </h4>
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span>Progression max</span>
              <span className="font-medium">{entry.max_percentage_reached}%</span>
            </div>
            <Progress value={entry.max_percentage_reached} className="h-2" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-xs">Temps visionné</span>
              </div>
              <p className="text-sm font-medium">
                {formatDuration(entry.total_watch_seconds, videoDuration)}
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Eye className="h-3.5 w-3.5" />
                <span className="text-xs">Sessions</span>
              </div>
              <p className="text-sm font-medium">{entry.session_count}</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Lead Score Breakdown */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Lead Score
          </h4>
          <div className="space-y-2">
            {[
              { label: "Engagement", value: entry.leadScore.engagement, max: 30, color: "bg-emerald-500" },
              { label: "Fréquence", value: entry.leadScore.frequency, max: 25, color: "bg-blue-500" },
              { label: "Récence", value: entry.leadScore.recency, max: 25, color: "bg-purple-500" },
              { label: "Influence", value: entry.leadScore.influence, max: 20, color: "bg-amber-500" },
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
        </div>

        <Separator />

        {/* Referral info */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Referral
          </h4>
          {entry.isChampion ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Crown className="h-4 w-4 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-700">Champion</p>
                <p className="text-xs text-amber-600">
                  A partagé avec {entry.referralCount} personne
                  {entry.referralCount > 1 ? "s" : ""}
                </p>
              </div>
            </div>
          ) : entry.referred_by_hash ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Share2 className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Invité par un collaborateur
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Accès direct (pas de referral)
            </p>
          )}
        </div>

        <Separator />

        {/* Dates */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Historique
          </h4>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Premier visionnage :</span>
            <span className="font-medium">
              {format(new Date(entry.first_watched_at), "d MMM yyyy HH:mm", {
                locale: fr,
              })}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Dernier visionnage :</span>
            <span className="font-medium">
              {format(new Date(entry.last_watched_at), "d MMM yyyy HH:mm", {
                locale: fr,
              })}
            </span>
          </div>
        </div>

        <Separator />

        {/* Next Best Actions */}
        <NextBestActions entry={entry} />
      </div>
    </div>
  );
}

// ---- Infer committee role from title ----
type CommitteeRole = "champion" | "decision_maker" | "influencer" | "blocker" | "unknown";

function inferRole(entry: PowerMapEntry): CommitteeRole {
  if (entry.isChampion) return "champion";
  const t = (entry.viewer_title || "").toLowerCase();
  if (t.includes("dg") || t.includes("ceo") || t.includes("cto") || t.includes("cfo") || t.includes("daf") || t.includes("vp") || t.includes("président") || t.includes("directeur général") || t.includes("directrice générale")) return "decision_maker";
  if (t.includes("directeur") || t.includes("directrice") || t.includes("responsable") || t.includes("head") || t.includes("manager") || t.includes("chef de projet")) return "influencer";
  if (entry.interest === "low" && entry.max_percentage_reached < 15) return "blocker";
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
  const score = entry.leadScore.total;
  const daysSinceLastWatch = Math.max(0, (Date.now() - new Date(entry.last_watched_at).getTime()) / (1000 * 60 * 60 * 24));
  const isRecentlyActive = daysSinceLastWatch < 2;
  const isStale = daysSinceLastWatch > 7;

  // ---- HOT LEADS (score >= 75) ----
  if (score >= 75) {
    if (isRecentlyActive) {
      actions.push({
        id: "call-now",
        icon: Phone,
        title: "Appeler maintenant",
        description: `${entry.displayName} est très engagé(e) et actif(ve). C'est le moment idéal pour un appel de qualification.`,
        priority: "high",
        type: "call",
      });
    }
    if (role === "champion") {
      actions.push({
        id: "leverage-champion",
        icon: UserPlus,
        title: "Mobiliser le champion",
        description: `Demandez à ${entry.displayName} de vous introduire auprès du décideur. Proposez un contenu exclusif à partager.`,
        priority: "high",
        type: "meeting",
      });
    }
    if (role === "decision_maker") {
      actions.push({
        id: "propose-meeting",
        icon: Target,
        title: "Proposer un RDV décisionnel",
        description: "Le décideur montre un fort intérêt. Proposez une démo personnalisée ou un call stratégique.",
        priority: "high",
        type: "meeting",
      });
    }
    actions.push({
      id: "send-case-study",
      icon: Gift,
      title: "Envoyer une étude de cas",
      description: "Renforcez l'engagement avec un cas client pertinent pour son secteur/poste.",
      priority: "medium",
      type: "email",
    });
  }

  // ---- WARM LEADS (score 50-74) ----
  else if (score >= 50) {
    actions.push({
      id: "followup-video",
      icon: Video,
      title: "Vidéo de suivi personnalisée",
      description: `Créez une courte vidéo personnalisée adressée à ${entry.displayName} pour approfondir le sujet qui l'intéresse.`,
      priority: "high",
      type: "video",
    });
    if (entry.session_count >= 2) {
      actions.push({
        id: "email-deepdive",
        icon: MessageSquare,
        title: "Email d'approfondissement",
        description: `${entry.displayName} revient régulièrement (${entry.session_count} sessions). Envoyez du contenu technique détaillé.`,
        priority: "medium",
        type: "email",
      });
    }
    if (role === "influencer") {
      actions.push({
        id: "arm-influencer",
        icon: Target,
        title: "Armer l'influenceur",
        description: "Fournissez un comparatif ou ROI calculator que cette personne pourra présenter en interne.",
        priority: "medium",
        type: "email",
      });
    }
  }

  // ---- COLD LEADS (score 25-49) ----
  else if (score >= 25) {
    if (isStale) {
      actions.push({
        id: "re-engage",
        icon: Play,
        title: "Relance de ré-engagement",
        description: `Pas d'activité depuis ${Math.round(daysSinceLastWatch)} jours. Envoyez un angle différent ou une nouveauté produit.`,
        priority: "medium",
        type: "email",
      });
    } else {
      actions.push({
        id: "nurture-content",
        icon: MessageSquare,
        title: "Séquence de nurturing",
        description: "Intérêt modéré — intégrez dans une séquence automatique (3 emails sur 2 semaines).",
        priority: "low",
        type: "nurture",
      });
    }
  }

  // ---- BLOCKERS ----
  if (role === "blocker") {
    actions.push({
      id: "address-blocker",
      icon: AlertTriangle,
      title: "Lever le blocage",
      description: `${entry.displayName} montre peu d'intérêt (${entry.max_percentage_reached}%). Identifiez ses objections et préparez une réponse ciblée.`,
      priority: "high",
      type: "email",
    });
  }

  // ---- INACTIVE (score < 25) ----
  if (score < 25 && role !== "blocker") {
    actions.push({
      id: "last-chance",
      icon: Mail,
      title: "Email de dernière chance",
      description: "Engagement très faible. Tentez un angle provocateur ou une question ouverte avant d'archiver.",
      priority: "low",
      type: "email",
    });
  }

  return actions.slice(0, 3); // Max 3 actions
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
            <div
              key={action.id}
              className="p-3 rounded-lg border bg-card hover:shadow-sm transition-all"
            >
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
