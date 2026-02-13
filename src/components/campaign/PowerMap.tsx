import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Eye,
  Clock,
  Search,
  Crown,
  Share2,
  Sparkles,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PowerMapDetailPanel } from "./PowerMapDetailPanel";

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
  isNew: boolean;
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
        label: "Élevé",
        color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
        icon: TrendingUp,
        ringColor: "ring-emerald-500/40",
        dotColor: "bg-emerald-500",
      };
    case "low":
      return {
        label: "Faible",
        color: "bg-red-500/15 text-red-700 border-red-500/30",
        icon: TrendingDown,
        ringColor: "ring-red-500/40",
        dotColor: "bg-red-500",
      };
    default:
      return {
        label: "Neutre",
        color: "bg-muted text-muted-foreground border-border",
        icon: Minus,
        ringColor: "ring-border",
        dotColor: "bg-muted-foreground/50",
      };
  }
}

function isNewThisWeek(dateStr: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return date >= weekAgo;
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
  const [selectedEntry, setSelectedEntry] = useState<PowerMapEntry | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
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
        isNew: isNewThisWeek(wp.first_watched_at),
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

    return result.sort((a, b) => {
      if (a.isChampion !== b.isChampion) return a.isChampion ? -1 : 1;
      const order: Record<InterestLevel, number> = { high: 0, neutral: 1, low: 2 };
      if (order[a.interest] !== order[b.interest])
        return order[a.interest] - order[b.interest];
      return b.max_percentage_reached - a.max_percentage_reached;
    });
  }, [entries, filterInterest, searchQuery]);

  const stats = useMemo(() => {
    const high = entries.filter((e) => e.interest === "high").length;
    const neutral = entries.filter((e) => e.interest === "neutral").length;
    const low = entries.filter((e) => e.interest === "low").length;
    const champions = entries.filter((e) => e.isChampion).length;
    const newThisWeek = entries.filter((e) => e.isNew).length;
    return { total: entries.length, high, neutral, low, champions, newThisWeek };
  }, [entries]);

  const newEntries = useMemo(
    () => filteredEntries.filter((e) => e.isNew),
    [filteredEntries]
  );

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
    <div className="flex gap-0 h-full">
      {/* Main content */}
      <div className={`flex-1 space-y-6 ${selectedEntry ? "pr-0" : ""}`}>
        {/* Summary Stats */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-emerald-500/15">
                  <TrendingUp className="h-4 w-4 text-emerald-700" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.high}</p>
                  <p className="text-[10px] text-muted-foreground">Intérêt élevé</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-muted">
                  <Minus className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.neutral}</p>
                  <p className="text-[10px] text-muted-foreground">Neutres</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-red-500/15">
                  <TrendingDown className="h-4 w-4 text-red-700" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.low}</p>
                  <p className="text-[10px] text-muted-foreground">Intérêt faible</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-amber-500/15">
                  <Crown className="h-4 w-4 text-amber-700" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.champions}</p>
                  <p className="text-[10px] text-muted-foreground">Champions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-blue-500/15">
                  <Sparkles className="h-4 w-4 text-blue-700" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.newThisWeek}</p>
                  <p className="text-[10px] text-muted-foreground">Nouveaux (7j)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* New interlocutors this week */}
        {newEntries.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              Nouveaux interlocuteurs cette semaine
            </h3>
            <div className="flex gap-2 flex-wrap">
              {newEntries.map((entry) => {
                const cfg = getInterestConfig(entry.interest);
                return (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedEntry(entry)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all hover:shadow-md cursor-pointer text-left ${
                      selectedEntry?.id === entry.id
                        ? "ring-2 ring-primary shadow-md"
                        : ""
                    }`}
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div className={`w-2 h-2 rounded-full ${cfg.dotColor}`} />
                    <span className="text-sm font-medium">{entry.displayName}</span>
                    {entry.viewer_title && (
                      <span className="text-xs text-muted-foreground">
                        {entry.viewer_title}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
          <TooltipProvider>
            <div className="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filteredEntries.map((entry) => {
                const config = getInterestConfig(entry.interest);
                const isSelected = selectedEntry?.id === entry.id;

                return (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedEntry(entry)}
                    className={`relative text-left p-3 rounded-lg border-2 transition-all hover:shadow-md cursor-pointer ${
                      isSelected
                        ? "ring-2 ring-primary shadow-md border-primary"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    {/* Champion badge */}
                    {entry.isChampion && (
                      <div className="absolute top-1.5 right-1.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Crown className="h-3.5 w-3.5 text-amber-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Champion · {entry.referralCount} partage
                            {entry.referralCount > 1 ? "s" : ""}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    )}

                    {/* New badge */}
                    {entry.isNew && (
                      <div className="absolute top-1.5 left-1.5">
                        <span className="inline-flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                      </div>
                    )}

                    <div className="flex items-center gap-2 mb-2">
                      <Avatar className={`h-8 w-8 ring-2 ${config.ringColor}`}>
                        <AvatarFallback className="text-[10px] font-medium">
                          {entry.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate">
                          {entry.displayName}
                        </p>
                        {entry.viewer_title && (
                          <p className="text-[10px] text-muted-foreground truncate">
                            {entry.viewer_title}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Interest + stats */}
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${config.color}`}
                      >
                        {config.label}
                      </Badge>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <Eye className="h-2.5 w-2.5" />
                          {entry.max_percentage_reached}%
                        </span>
                        {entry.isChampion && (
                          <span className="flex items-center gap-0.5">
                            <Share2 className="h-2.5 w-2.5" />
                            {entry.referralCount}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Mini progress bar */}
                    <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${config.dotColor}`}
                        style={{
                          width: `${entry.max_percentage_reached}%`,
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </TooltipProvider>
        )}
      </div>

      {/* Detail Panel */}
      {selectedEntry && (
        <div className="w-[340px] flex-shrink-0 ml-4">
          <div className="sticky top-0">
            <PowerMapDetailPanel
              entry={selectedEntry}
              onClose={() => setSelectedEntry(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
