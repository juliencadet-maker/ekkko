import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Eye,
  Clock,
  Search,
  Crown,
  Share2,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface WatchProgressEntry {
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
}

type InterestLevel = "high" | "neutral" | "low";

interface PowerMapEntry extends WatchProgressEntry {
  interest: InterestLevel;
  isChampion: boolean;
  referralCount: number;
  displayName: string;
  initials: string;
}

function getInterestLevel(maxPercentage: number): InterestLevel {
  if (maxPercentage >= 80) return "high";
  if (maxPercentage <= 20) return "low";
  return "neutral";
}

function getInterestConfig(interest: InterestLevel) {
  switch (interest) {
    case "high":
      return {
        label: "Intérêt élevé",
        color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
        icon: TrendingUp,
        ringColor: "ring-emerald-500/40",
      };
    case "low":
      return {
        label: "Intérêt faible",
        color: "bg-red-500/15 text-red-700 border-red-500/30",
        icon: TrendingDown,
        ringColor: "ring-red-500/40",
      };
    default:
      return {
        label: "Neutre",
        color: "bg-muted text-muted-foreground border-border",
        icon: Minus,
        ringColor: "ring-border",
      };
  }
}

interface PowerMapProps {
  campaignId: string;
  orgId: string;
}

export function PowerMap({ campaignId, orgId }: PowerMapProps) {
  const [watchData, setWatchData] = useState<WatchProgressEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterInterest, setFilterInterest] = useState<string>("all");

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get all videos for this campaign
        const { data: videos } = await supabase
          .from("videos")
          .select("id")
          .eq("campaign_id", campaignId)
          .eq("org_id", orgId);

        if (!videos?.length) {
          setIsLoading(false);
          return;
        }

        const videoIds = videos.map((v) => v.id);

        const { data: progress } = await supabase
          .from("watch_progress")
          .select("*")
          .in("video_id", videoIds);

        setWatchData((progress as WatchProgressEntry[]) || []);
      } catch (err) {
        console.error("PowerMap fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [campaignId, orgId]);

  const entries: PowerMapEntry[] = useMemo(() => {
    // Count referrals per viewer_hash
    const referralCounts = new Map<string, number>();
    watchData.forEach((wp) => {
      if (wp.referred_by_hash) {
        referralCounts.set(
          wp.referred_by_hash,
          (referralCounts.get(wp.referred_by_hash) || 0) + 1
        );
      }
    });

    return watchData.map((wp) => {
      const interest = getInterestLevel(wp.max_percentage_reached);
      const referralCount = referralCounts.get(wp.viewer_hash) || 0;
      const displayName =
        wp.viewer_name ||
        wp.viewer_email?.split("@")[0] ||
        `Viewer ${wp.viewer_hash.slice(0, 6)}`;
      const initials = wp.viewer_name
        ? wp.viewer_name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)
        : displayName.slice(0, 2).toUpperCase();

      return {
        ...wp,
        interest,
        isChampion: referralCount > 0,
        referralCount,
        displayName,
        initials,
      };
    });
  }, [watchData]);

  const filteredEntries = useMemo(() => {
    let result = entries;

    if (filterInterest !== "all") {
      result = result.filter((e) => e.interest === filterInterest);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.displayName.toLowerCase().includes(q) ||
          e.viewer_email?.toLowerCase().includes(q) ||
          e.viewer_company?.toLowerCase().includes(q) ||
          e.viewer_title?.toLowerCase().includes(q)
      );
    }

    // Sort: champions first, then by interest level, then by max_percentage_reached
    return result.sort((a, b) => {
      if (a.isChampion !== b.isChampion) return a.isChampion ? -1 : 1;
      const order: Record<InterestLevel, number> = { high: 0, neutral: 1, low: 2 };
      if (order[a.interest] !== order[b.interest]) return order[a.interest] - order[b.interest];
      return b.max_percentage_reached - a.max_percentage_reached;
    });
  }, [entries, filterInterest, searchQuery]);

  const stats = useMemo(() => {
    const high = entries.filter((e) => e.interest === "high").length;
    const neutral = entries.filter((e) => e.interest === "neutral").length;
    const low = entries.filter((e) => e.interest === "low").length;
    const champions = entries.filter((e) => e.isChampion).length;
    return { total: entries.length, high, neutral, low, champions };
  }, [entries]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/15">
                <TrendingUp className="h-5 w-5 text-emerald-700" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.high}</p>
                <p className="text-xs text-muted-foreground">Intérêt élevé</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Minus className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.neutral}</p>
                <p className="text-xs text-muted-foreground">Neutres</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/15">
                <TrendingDown className="h-5 w-5 text-red-700" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.low}</p>
                <p className="text-xs text-muted-foreground">Intérêt faible</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/15">
                <Crown className="h-5 w-5 text-amber-700" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.champions}</p>
                <p className="text-xs text-muted-foreground">Champions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, email, entreprise..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterInterest} onValueChange={setFilterInterest}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tous les niveaux" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous ({stats.total})</SelectItem>
            <SelectItem value="high">🟢 Élevé ({stats.high})</SelectItem>
            <SelectItem value="neutral">⚫ Neutre ({stats.neutral})</SelectItem>
            <SelectItem value="low">🔴 Faible ({stats.low})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Power Map Grid */}
      {filteredEntries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-1">
              {stats.total === 0
                ? "Aucune donnée de visionnage"
                : "Aucun résultat pour ces filtres"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {stats.total === 0
                ? "Les données apparaîtront ici quand des viewers regarderont vos vidéos."
                : "Essayez de modifier vos critères de recherche."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <TooltipProvider>
            {filteredEntries.map((entry) => {
              const config = getInterestConfig(entry.interest);
              const InterestIcon = config.icon;

              return (
                <Card
                  key={entry.id}
                  className={`relative overflow-hidden transition-all hover:shadow-md ring-2 ${config.ringColor}`}
                >
                  {entry.isChampion && (
                    <div className="absolute top-2 right-2">
                      <Tooltip>
                        <TooltipTrigger>
                          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/15 text-amber-700 text-xs font-medium">
                            <Crown className="h-3 w-3" />
                            Champion
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          A partagé la vidéo avec {entry.referralCount} personne
                          {entry.referralCount > 1 ? "s" : ""}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start gap-3">
                      <Avatar className={`h-11 w-11 ring-2 ${config.ringColor}`}>
                        <AvatarFallback className="text-sm font-medium">
                          {entry.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{entry.displayName}</p>
                        {entry.viewer_title && (
                          <p className="text-xs text-muted-foreground truncate">
                            {entry.viewer_title}
                          </p>
                        )}
                        {entry.viewer_company && (
                          <p className="text-xs text-muted-foreground truncate">
                            {entry.viewer_company}
                          </p>
                        )}
                        {entry.viewer_email && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {entry.viewer_email}
                          </p>
                        )}
                      </div>
                    </div>

                    <Separator className="my-3" />

                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={config.color}>
                        <InterestIcon className="h-3 w-3 mr-1" />
                        {config.label}
                      </Badge>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {entry.max_percentage_reached}%
                          </TooltipTrigger>
                          <TooltipContent>
                            Progression max : {entry.max_percentage_reached}%
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {entry.total_watch_seconds}s
                          </TooltipTrigger>
                          <TooltipContent>
                            Temps total de visionnage
                          </TooltipContent>
                        </Tooltip>
                        {entry.isChampion && (
                          <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1">
                              <Share2 className="h-3 w-3" />
                              {entry.referralCount}
                            </TooltipTrigger>
                            <TooltipContent>
                              {entry.referralCount} personne{entry.referralCount > 1 ? "s" : ""} invitée{entry.referralCount > 1 ? "s" : ""}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          entry.interest === "high"
                            ? "bg-emerald-500"
                            : entry.interest === "low"
                            ? "bg-red-500"
                            : "bg-muted-foreground/40"
                        }`}
                        style={{ width: `${entry.max_percentage_reached}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}
