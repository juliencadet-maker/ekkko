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
  Search,
  Crown,
  Share2,
  Sparkles,
  Flame,
  LayoutGrid,
  GitBranchPlus,
  AlertTriangle,
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

// ─── Types ───────────────────────────────────────────────────────────────────

export type ViewerRow = {
  id: string;
  name: string | null;
  title: string | null;
  email: string | null;
  domain: string | null;
  contact_score: number | null;
  sponsor_score: number | null;
  blocker_score: number | null;
  influence_score: number | null;
  status: string | null;
  identity_confidence: string | null;
  role_confidence: number | null;
  first_seen_at: string | null;
  last_event_at: string | null;
};

export type CommitteeLayerRow = {
  layer: string;
  expected_weight: number;
  typical_titles: string[] | null;
};

export interface PowerMapEntry {
  id: string;
  name: string | null;
  title: string | null;
  email: string | null;
  domain: string | null;
  contact_score: number;
  sponsor_score: number;
  blocker_score: number;
  influence_score: number;
  status: string | null;
  identity_confidence: string | null;
  role_confidence: number | null;
  first_seen_at: string | null;
  last_event_at: string | null;
  layer: string | null;
  layerWeight: number;
  confidence: number;
  engagement_réel: number;
  displayName: string;
  initials: string;
  badgeConfidence: string | null;
  isNew: boolean;
  isChampion: boolean;
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function detectLayer(title: string | null, layers: CommitteeLayerRow[]): string | null {
  if (!title || !layers?.length) return null;
  for (const l of layers) {
    const keywords: string[] = l.typical_titles || [];
    for (const kw of keywords) {
      if (title.toLowerCase().includes(kw.toLowerCase())) return l.layer;
    }
  }
  return null;
}

function calcConfidence(viewer: ViewerRow, layer: string | null): number {
  const idConf = viewer.identity_confidence;
  const id_w =
    idConf === "high" || idConf === "verified" ? 1.0
    : idConf === "medium" || idConf === "soft" ? 0.70
    : idConf === "low" ? 0.40
    : 0.20;
  return parseFloat((
    id_w * 0.40 +
    (layer !== null ? 0.8 : 0.3) * 0.30 +
    (viewer.role_confidence ?? 0.5) * 0.30
  ).toFixed(3));
}

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
      return {
        label: "Sponsor",
        color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
        icon: TrendingUp,
        ringColor: "ring-emerald-500/40",
        dotColor: "bg-emerald-500",
      };
    case "blocker":
      return {
        label: "Bloqueur potentiel",
        color: "bg-red-500/15 text-red-700 border-red-500/30",
        icon: TrendingDown,
        ringColor: "ring-red-500/40",
        dotColor: "bg-red-500",
      };
    case "neutral":
      return {
        label: "Neutre",
        color: "bg-muted text-muted-foreground border-border",
        icon: Minus,
        ringColor: "ring-border",
        dotColor: "bg-muted-foreground/50",
      };
    case "new":
      return {
        label: "Nouveau",
        color: "bg-blue-500/15 text-blue-700 border-blue-500/30",
        icon: Sparkles,
        ringColor: "ring-blue-500/40",
        dotColor: "bg-blue-500",
      };
    default:
      return {
        label: "Inconnu",
        color: "bg-muted text-muted-foreground border-border",
        icon: Minus,
        ringColor: "ring-border",
        dotColor: "bg-muted-foreground/50",
      };
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

interface PowerMapProps {
  campaignId: string;
  orgId: string;
  viewers: ViewerRow[];
  committeeLayers: CommitteeLayerRow[];
  refreshTrigger?: number;
}

export function PowerMap({ campaignId, orgId, viewers, committeeLayers, refreshTrigger = 0 }: PowerMapProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSpecial, setFilterSpecial] = useState<string>("none");
  const [selectedEntry, setSelectedEntry] = useState<PowerMapEntry | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "committee">("grid");
  const [declaredContacts, setDeclaredContacts] = useState<any[]>([]);

  useEffect(() => {
    if (!campaignId) return;
    supabase
      .from("deal_contact_roles")
      .select("id, role, confidence, created_at")
      .eq("campaign_id", campaignId)
      .eq("source", "declared")
      .is("viewer_id", null)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setDeclaredContacts(data);
      });
  }, [campaignId]);

  const handleStatClick = (status: string, special: string = "none") => {
    if (special !== "none") {
      setFilterSpecial((prev) => (prev === special ? "none" : special));
      setFilterStatus("all");
    } else {
      setFilterStatus((prev) => (prev === status ? "all" : status));
      setFilterSpecial("none");
    }
  };

  const entries: PowerMapEntry[] = useMemo(() => {
    return viewers
      .map((v) => {
        const layer = detectLayer(v.title, committeeLayers);
        const layerObj = committeeLayers.find((l) => l.layer === layer);
        const layerWeight = layerObj?.expected_weight ?? 0.55;
        const confidence = calcConfidence(v, layer);
        const contactScore = v.contact_score ?? 0;
        const engagement_réel = contactScore * layerWeight * confidence;
        const displayName = v.name || v.email?.split("@")[0] || "Contact";
        const initials = displayName.slice(0, 2).toUpperCase();
        const badgeConfidence =
          confidence < 0.65 ? "À confirmer" :
          confidence < 0.80 ? "≈" : null;

        return {
          ...v,
          contact_score: contactScore,
          sponsor_score: v.sponsor_score ?? 0,
          blocker_score: v.blocker_score ?? 0,
          influence_score: v.influence_score ?? 0,
          layer,
          layerWeight,
          confidence,
          engagement_réel,
          displayName,
          initials,
          badgeConfidence,
          isNew: v.first_seen_at
            ? (Date.now() - new Date(v.first_seen_at).getTime()) < 7 * 86400000
            : false,
          isChampion: (v.influence_score ?? 0) >= 50,
        };
      })
      .filter((v) => v.confidence >= 0.40) // masquer les contacts trop incertains
      .sort((a, b) => b.engagement_réel - a.engagement_réel); // tri par engagement réel
  }, [viewers, committeeLayers]);

  const filteredEntries = useMemo(() => {
    let result = entries;

    if (filterStatus !== "all") {
      result = result.filter((e) => {
        const level = getStatusLevel(e);
        return level === filterStatus;
      });
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
          e.email?.toLowerCase().includes(q) ||
          e.domain?.toLowerCase().includes(q) ||
          e.title?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [entries, filterStatus, filterSpecial, searchQuery]);

  const stats = useMemo(() => {
    const sponsors = entries.filter((e) => getStatusLevel(e) === "sponsor").length;
    const neutrals = entries.filter((e) => getStatusLevel(e) === "neutral").length;
    const blockers = entries.filter((e) => getStatusLevel(e) === "blocker").length;
    const champions = entries.filter((e) => e.isChampion).length;
    const newThisWeek = entries.filter((e) => e.isNew).length;
    return { total: entries.length, sponsors, neutrals, blockers, champions, newThisWeek };
  }, [entries]);

  const newEntries = useMemo(
    () => filteredEntries.filter((e) => e.isNew),
    [filteredEntries]
  );

  // ── Déduplication contacts déclarés ──────────────────────────────────
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\b(le|la|les|un|une|the|a)\b/g, "").trim();

  const uniqueDeclaredContacts = useMemo(() => {
    const observedLabels = new Set(
      viewers
        .map((v: any) => normalize(v.title || v.name || ""))
        .filter(Boolean)
    );
    const seenDeclared = new Set<string>();
    return declaredContacts
      .filter((dc) => {
        const key = normalize(dc.role || "");
        if (!key || seenDeclared.has(key)) return false;
        seenDeclared.add(key);
        return true;
      })
      .filter((dc) => !observedLabels.has(normalize(dc.role || "")));
  }, [declaredContacts, viewers]);

  // État vide si aucun viewer eligible
  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-1">
            Aucun contact avec un niveau de confiance suffisant.
          </h3>
          <p className="text-sm text-muted-foreground">
            Ajoutez des contacts pour visualiser le comité d'achat.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex gap-0 h-full">
      {/* Main content */}
      <div className={`flex-1 space-y-6 ${selectedEntry ? "pr-0" : ""}`}>
        {/* Summary Stats */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${filterStatus === "sponsor" && filterSpecial === "none" ? "ring-2 ring-emerald-500 shadow-md" : ""}`}
            onClick={() => handleStatClick("sponsor")}
          >
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-emerald-500/15">
                  <TrendingUp className="h-4 w-4 text-emerald-700" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.sponsors}</p>
                  <p className="text-[10px] text-muted-foreground">Sponsors</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${filterStatus === "neutral" && filterSpecial === "none" ? "ring-2 ring-border shadow-md" : ""}`}
            onClick={() => handleStatClick("neutral")}
          >
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-muted">
                  <Minus className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.neutrals}</p>
                  <p className="text-[10px] text-muted-foreground">Neutres</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${filterStatus === "blocker" && filterSpecial === "none" ? "ring-2 ring-red-500 shadow-md" : ""}`}
            onClick={() => handleStatClick("blocker")}
          >
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-red-500/15">
                  <AlertTriangle className="h-4 w-4 text-red-700" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.blockers}</p>
                  <p className="text-[10px] text-muted-foreground">Bloqueurs</p>
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
                const cfg = getStatusConfig(getStatusLevel(entry));
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
                    {entry.title && (
                      <span className="text-xs text-muted-foreground">
                        {entry.title}
                      </span>
                    )}
                    {entry.badgeConfidence === "À confirmer" && (
                      <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-500/30 text-[9px] px-1 py-0">
                        À confirmer
                      </Badge>
                    )}
                  </button>
                );
              })}
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
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous ({stats.total})</SelectItem>
              <SelectItem value="sponsor">🟢 Sponsors ({stats.sponsors})</SelectItem>
              <SelectItem value="neutral">⚫ Neutres ({stats.neutrals})</SelectItem>
              <SelectItem value="blocker">🔴 Bloqueurs ({stats.blockers})</SelectItem>
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
                Aucun résultat pour ces filtres
              </h3>
              <p className="text-sm text-muted-foreground">
                Essayez de modifier vos critères de recherche.
              </p>
            </CardContent>
          </Card>
        ) : (
          <TooltipProvider>
            <div className="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filteredEntries.map((entry) => {
                const level = getStatusLevel(entry);
                const config = getStatusConfig(level);
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
                            Champion · influence {entry.influence_score}
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

                    {/* Confidence badge */}
                    {entry.badgeConfidence === "À confirmer" && (
                      <div className="absolute bottom-1.5 right-1.5">
                        <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-500/30 text-[8px] px-1 py-0">
                          À confirmer
                        </Badge>
                      </div>
                    )}
                    {entry.badgeConfidence === "≈" && (
                      <div className="absolute bottom-1.5 right-1.5">
                        <span className="text-[9px] text-muted-foreground">≈</span>
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
                        {entry.title && (
                          <p className="text-[10px] text-muted-foreground truncate">
                            {entry.title}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Status + Score */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${config.color}`}
                        >
                          {config.label}
                        </Badge>
                        {entry.contact_score >= 75 && (
                          <Flame className="h-3 w-3 text-orange-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span className="font-bold">
                          {entry.contact_score}
                        </span>
                        {entry.isChampion && (
                          <span className="flex items-center gap-0.5">
                            <Share2 className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Mini progress bar (contact_score) */}
                    <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${config.dotColor}`}
                        style={{
                          width: `${Math.min(entry.contact_score, 100)}%`,
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </TooltipProvider>
        )}

        {/* Declared contacts section */}
        {uniqueDeclaredContacts.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
              Contacts déclarés
            </p>
            <div className="flex flex-wrap gap-2">
              {uniqueDeclaredContacts.map((contact) => {
                const daysAgo = contact.created_at
                  ? Math.floor(
                      (Date.now() - new Date(contact.created_at).getTime()) / 86400000
                    )
                  : null;
                const dateLabel =
                  daysAgo === 0 ? "Aujourd'hui"
                  : daysAgo === 1 ? "Hier"
                  : daysAgo !== null ? `Il y a ${daysAgo}j`
                  : "";
                return (
                  <div
                    key={contact.id}
                    className="flex flex-col gap-0.5 px-2 py-1.5 rounded-lg border"
                    style={{ borderColor: "#3B82F6", backgroundColor: "#EFF6FF" }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-foreground">
                        {contact.role || "Inconnu"}
                      </span>
                      <span
                        className="text-[9px] font-semibold px-1 py-0.5 rounded"
                        style={{ color: "#3B82F6", backgroundColor: "#DBEAFE" }}
                      >
                        DÉCLARÉ
                      </span>
                    </div>
                    {dateLabel && (
                      <span className="text-[10px] text-muted-foreground">
                        {dateLabel}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
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
