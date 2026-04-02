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
  Flame,
  Bell,
  Zap,
  ArrowUpRight,
  LayoutGrid,
  GitBranchPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PowerMapDetailPanel } from "./PowerMapDetailPanel";
import { BuyingCommittee } from "./BuyingCommittee";
import { computeLeadScore, generateAlerts, type LeadScoreBreakdown, type LeadAlert } from "./leadScoring";

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
  leadScore: LeadScoreBreakdown;
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

const MOCK_WATCH_DATA: WatchProgressEntry[] = [
  {
    id: "mock-1", video_id: "v1", viewer_hash: "abc123",
    watch_percentage: 95, total_watch_seconds: 114, max_percentage_reached: 95,
    viewer_name: "Sophie Martin", viewer_email: "sophie.martin@ingérop.fr",
    viewer_title: "Directrice des Opérations", viewer_company: "Ingérop",
    referred_by_hash: null, session_count: 3,
    first_watched_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    last_watched_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "mock-2", video_id: "v1", viewer_hash: "def456",
    watch_percentage: 88, total_watch_seconds: 105, max_percentage_reached: 88,
    viewer_name: "Thomas Durand", viewer_email: "t.durand@ingérop.fr",
    viewer_title: "Responsable Innovation", viewer_company: "Ingérop",
    referred_by_hash: "abc123", session_count: 2,
    first_watched_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    last_watched_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "mock-3", video_id: "v1", viewer_hash: "ghi789",
    watch_percentage: 45, total_watch_seconds: 54, max_percentage_reached: 45,
    viewer_name: "Françoise Denis", viewer_email: "f.denis@ingérop.fr",
    viewer_title: "DAF", viewer_company: "Ingérop",
    referred_by_hash: "abc123", session_count: 1,
    first_watched_at: new Date(Date.now() - 0.5 * 86400000).toISOString(),
    last_watched_at: new Date(Date.now() - 0.5 * 86400000).toISOString(),
  },
  {
    id: "mock-4", video_id: "v1", viewer_hash: "jkl012",
    watch_percentage: 100, total_watch_seconds: 120, max_percentage_reached: 100,
    viewer_name: "Marc Lefèvre", viewer_email: "m.lefevre@ingérop.fr",
    viewer_title: "DG", viewer_company: "Ingérop",
    referred_by_hash: null, session_count: 4,
    first_watched_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    last_watched_at: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: "mock-5", video_id: "v1", viewer_hash: "mno345",
    watch_percentage: 12, total_watch_seconds: 14, max_percentage_reached: 12,
    viewer_name: "Julie Perrin", viewer_email: "j.perrin@ingérop.fr",
    viewer_title: "Chargée de communication", viewer_company: "Ingérop",
    referred_by_hash: "def456", session_count: 1,
    first_watched_at: new Date(Date.now() - 0.3 * 86400000).toISOString(),
    last_watched_at: new Date(Date.now() - 0.3 * 86400000).toISOString(),
  },
  {
    id: "mock-6", video_id: "v1", viewer_hash: "pqr678",
    watch_percentage: 72, total_watch_seconds: 86, max_percentage_reached: 72,
    viewer_name: "Alexandre Morel", viewer_email: "a.morel@ingérop.fr",
    viewer_title: "Directeur Technique", viewer_company: "Ingérop",
    referred_by_hash: "abc123", session_count: 2,
    first_watched_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    last_watched_at: new Date(Date.now() - 43200000).toISOString(),
  },
  {
    id: "mock-7", video_id: "v1", viewer_hash: "stu901",
    watch_percentage: 8, total_watch_seconds: 10, max_percentage_reached: 8,
    viewer_name: "Claire Bonnet", viewer_email: "c.bonnet@ingérop.fr",
    viewer_title: "Assistante de direction", viewer_company: "Ingérop",
    referred_by_hash: "jkl012", session_count: 1,
    first_watched_at: new Date(Date.now() - 6 * 86400000).toISOString(),
    last_watched_at: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
  {
    id: "mock-8", video_id: "v1", viewer_hash: "vwx234",
    watch_percentage: 55, total_watch_seconds: 66, max_percentage_reached: 55,
    viewer_name: "Nicolas Girard", viewer_email: "n.girard@ingérop.fr",
    viewer_title: "Chef de Projet", viewer_company: "Ingérop",
    referred_by_hash: "jkl012", session_count: 2,
    first_watched_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    last_watched_at: new Date(Date.now() - 18000000).toISOString(),
  },
];

interface PowerMapProps {
  campaignId: string;
  orgId: string;
}

export function PowerMap({ campaignId, orgId }: PowerMapProps) {
  const [watchData, setWatchData] = useState<WatchProgressEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterInterest, setFilterInterest] = useState<string>("all");
  const [filterSpecial, setFilterSpecial] = useState<string>("none");
  const [selectedEntry, setSelectedEntry] = useState<PowerMapEntry | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "committee">("grid");

  const handleStatClick = (interest: string, special: string = "none") => {
    if (special !== "none") {
      setFilterSpecial((prev) => (prev === special ? "none" : special));
      setFilterInterest("all");
    } else {
      setFilterInterest((prev) => (prev === interest ? "all" : interest));
      setFilterSpecial("none");
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: videos } = await supabase
          .from("videos")
          .select("id")
          .eq("campaign_id", campaignId)
          .eq("org_id", orgId);

        if (!videos?.length) {
          // Use mock data when no real videos exist
          setWatchData(MOCK_WATCH_DATA);
          setIsLoading(false);
          return;
        }

        const videoIds = videos.map((v) => v.id);

        const { data: progress } = await supabase
          .from("watch_progress")
          .select("*")
          .in("video_id", videoIds);

        // Fall back to mock data if no real progress data
        setWatchData(
          (progress as WatchProgressEntry[])?.length
            ? (progress as WatchProgressEntry[])
            : MOCK_WATCH_DATA
        );
      } catch (err) {
        console.error("PowerMap fetch error:", err);
        setWatchData(MOCK_WATCH_DATA);
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

      const leadScore = computeLeadScore({
        maxPercentageReached: wp.max_percentage_reached,
        sessionCount: wp.session_count,
        lastWatchedAt: wp.last_watched_at,
        referralCount,
        totalWatchSeconds: wp.total_watch_seconds,
      });

      return {
        ...wp,
        interest,
        isChampion: referralCount > 0,
        referralCount,
        displayName,
        initials,
        isNew: isNewThisWeek(wp.first_watched_at),
        leadScore,
      };
    });
  }, [watchData]);

  const filteredEntries = useMemo(() => {
    let result = entries;

    if (filterInterest !== "all") {
      result = result.filter((e) => e.interest === filterInterest);
    }

    if (filterSpecial === "champion") {
      result = result.filter((e) => e.isChampion);
    } else if (filterSpecial === "new") {
      result = result.filter((e) => e.isNew);
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
      // Sort by lead score first
      if (a.leadScore.total !== b.leadScore.total)
        return b.leadScore.total - a.leadScore.total;
      if (a.isChampion !== b.isChampion) return a.isChampion ? -1 : 1;
      return b.max_percentage_reached - a.max_percentage_reached;
    });
  }, [entries, filterInterest, filterSpecial, searchQuery]);

  const alerts = useMemo(() => {
    return generateAlerts(
      entries.map((e) => ({
        id: e.id,
        displayName: e.displayName,
        leadScore: e.leadScore,
        sessionCount: e.session_count,
        isChampion: e.isChampion,
        referralCount: e.referralCount,
        lastWatchedAt: e.last_watched_at,
        maxPercentageReached: e.max_percentage_reached,
      }))
    );
  }, [entries]);

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
          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${filterInterest === "high" && filterSpecial === "none" ? "ring-2 ring-emerald-500 shadow-md" : ""}`}
            onClick={() => handleStatClick("high")}
          >
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
          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${filterInterest === "neutral" && filterSpecial === "none" ? "ring-2 ring-border shadow-md" : ""}`}
            onClick={() => handleStatClick("neutral")}
          >
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
          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${filterInterest === "low" && filterSpecial === "none" ? "ring-2 ring-red-500 shadow-md" : ""}`}
            onClick={() => handleStatClick("low")}
          >
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
          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${filterSpecial === "champion" ? "ring-2 ring-amber-500 shadow-md" : ""}`}
            onClick={() => handleStatClick("all", "champion")}
          >
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
          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${filterSpecial === "new" ? "ring-2 ring-blue-500 shadow-md" : ""}`}
            onClick={() => handleStatClick("all", "new")}
          >
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

        {/* Lead Scoring Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Bell className="h-4 w-4 text-orange-600" />
              Alertes commerciales
              <Badge variant="outline" className="bg-orange-500/15 text-orange-700 border-orange-500/30 text-[10px]">
                {alerts.length}
              </Badge>
            </h3>
            <div className="grid gap-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {alerts.slice(0, 3).map((alert) => (
                <button
                  key={alert.id}
                  onClick={() => {
                    const match = entries.find((e) => e.displayName === alert.viewerName);
                    if (match) setSelectedEntry(match);
                  }}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:shadow-md transition-all text-left cursor-pointer"
                >
                  <span className="mt-0.5">
                    {alert.icon === "hot_lead" && <Flame className="h-4 w-4 text-orange-500" />}
                    {alert.icon === "re_engagement" && <Zap className="h-4 w-4 text-amber-500" />}
                    {alert.icon === "champion_activity" && <Crown className="h-4 w-4 text-primary" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold truncate">{alert.title}</p>
                      <Badge variant="outline" className="bg-orange-500/15 text-orange-700 border-orange-500/30 text-[10px] shrink-0">
                        {alert.score}/100
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{alert.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filters + View Toggle */}
        <div className="flex gap-3 items-center">
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
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              className="rounded-r-none px-2.5"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "committee" ? "default" : "ghost"}
              size="sm"
              className="rounded-l-none px-2.5"
              onClick={() => setViewMode("committee")}
            >
              <GitBranchPlus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* View Content */}
        {viewMode === "committee" ? (
          <BuyingCommittee
            entries={filteredEntries}
            onSelectEntry={setSelectedEntry}
            selectedEntryId={selectedEntry?.id}
          />
        ) : filteredEntries.length === 0 ? (
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

                    {/* Lead Score + Interest */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${config.color}`}
                        >
                          {config.label}
                        </Badge>
                        {entry.leadScore.total >= 75 && (
                          <Flame className="h-3 w-3 text-orange-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span className={`font-bold ${entry.leadScore.color}`}>
                          {entry.leadScore.total}
                        </span>
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
