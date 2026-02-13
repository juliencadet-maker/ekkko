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
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

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
      </div>
    </div>
  );
}
