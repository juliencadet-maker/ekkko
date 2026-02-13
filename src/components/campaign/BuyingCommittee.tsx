import { useMemo, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Crown,
  UserCheck,
  Megaphone,
  ShieldAlert,
  User,
  ArrowDown,
  Share2,
  Eye,
  Flame,
  Building2,
  Users,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { LeadScoreBreakdown } from "./leadScoring";

type InterestLevel = "high" | "neutral" | "low";
type CommitteeRole = "champion" | "decision_maker" | "influencer" | "blocker" | "unknown";

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
  isNew: boolean;
  leadScore: LeadScoreBreakdown;
}

interface BuyingCommitteeProps {
  entries: PowerMapEntry[];
  onSelectEntry: (entry: PowerMapEntry) => void;
  selectedEntryId?: string;
}

function inferCommitteeRole(entry: PowerMapEntry): CommitteeRole {
  // Champion: has referrals
  if (entry.isChampion) return "champion";

  const title = (entry.viewer_title || "").toLowerCase();

  // Decision Maker: C-level, DG, VP, Director
  if (
    title.includes("dg") ||
    title.includes("directeur général") ||
    title.includes("directrice générale") ||
    title.includes("ceo") ||
    title.includes("cto") ||
    title.includes("cfo") ||
    title.includes("coo") ||
    title.includes("vp") ||
    title.includes("vice") ||
    title.includes("président") ||
    title.includes("daf")
  ) {
    return "decision_maker";
  }

  // Influencer: Director, Head, Lead, Manager
  if (
    title.includes("directeur") ||
    title.includes("directrice") ||
    title.includes("responsable") ||
    title.includes("head") ||
    title.includes("lead") ||
    title.includes("manager") ||
    title.includes("chef de projet")
  ) {
    return "influencer";
  }

  // Blocker: very low engagement + decision-making title
  if (entry.interest === "low" && entry.max_percentage_reached < 15) {
    return "blocker";
  }

  return "unknown";
}

const ROLE_CONFIG: Record<CommitteeRole, {
  label: string;
  icon: typeof Crown;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  champion: {
    label: "Champion",
    icon: Crown,
    color: "text-amber-700",
    bgColor: "bg-amber-500/15",
    borderColor: "border-amber-500/30",
  },
  decision_maker: {
    label: "Decision Maker",
    icon: UserCheck,
    color: "text-purple-700",
    bgColor: "bg-purple-500/15",
    borderColor: "border-purple-500/30",
  },
  influencer: {
    label: "Influenceur",
    icon: Megaphone,
    color: "text-blue-700",
    bgColor: "bg-blue-500/15",
    borderColor: "border-blue-500/30",
  },
  blocker: {
    label: "Bloqueur",
    icon: ShieldAlert,
    color: "text-red-700",
    bgColor: "bg-red-500/15",
    borderColor: "border-red-500/30",
  },
  unknown: {
    label: "À identifier",
    icon: User,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    borderColor: "border-border",
  },
};

// Ideal committee roles for coverage calculation
const IDEAL_ROLES: CommitteeRole[] = ["champion", "decision_maker", "influencer"];

export function BuyingCommittee({
  entries,
  onSelectEntry,
  selectedEntryId,
}: BuyingCommitteeProps) {
  // Group entries by company
  const companyGroups = useMemo(() => {
    const groups = new Map<string, { entries: (PowerMapEntry & { role: CommitteeRole })[] }>();

    for (const entry of entries) {
      const company = entry.viewer_company || "Entreprise inconnue";
      if (!groups.has(company)) {
        groups.set(company, { entries: [] });
      }
      const role = inferCommitteeRole(entry);
      groups.get(company)!.entries.push({ ...entry, role });
    }

    // Sort groups by number of entries (largest first)
    return Array.from(groups.entries())
      .sort((a, b) => b[1].entries.length - a[1].entries.length);
  }, [entries]);

  // Build referral tree per company
  const referralLinks = useMemo(() => {
    const links: { from: string; to: string }[] = [];
    for (const entry of entries) {
      if (entry.referred_by_hash) {
        const referrer = entries.find((e) => e.viewer_hash === entry.referred_by_hash);
        if (referrer) {
          links.push({ from: referrer.id, to: entry.id });
        }
      }
    }
    return links;
  }, [entries]);

  return (
    <div className="space-y-6">
      {/* Coverage Summary */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {(["champion", "decision_maker", "influencer", "blocker"] as CommitteeRole[]).map((role) => {
          const config = ROLE_CONFIG[role];
          const Icon = config.icon;
          const count = entries.filter((e) => inferCommitteeRole(e) === role).length;
          const isCovered = count > 0;

          return (
            <Card key={role} className={`${isCovered && role !== "blocker" ? "border-emerald-500/30" : ""}`}>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-md ${config.bgColor}`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xl font-bold">{count}</p>
                      {isCovered && role !== "blocker" && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      )}
                      {!isCovered && role !== "blocker" && (
                        <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">{config.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Committee Coverage Bar */}
      {(() => {
        const coveredRoles = IDEAL_ROLES.filter((role) =>
          entries.some((e) => inferCommitteeRole(e) === role)
        );
        const coveragePct = Math.round((coveredRoles.length / IDEAL_ROLES.length) * 100);

        return (
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Couverture du comité d'achat</span>
                </div>
                <span className="text-sm font-bold">{coveragePct}%</span>
              </div>
              <Progress value={coveragePct} className="h-2" />
              <div className="flex gap-2 mt-2">
                {IDEAL_ROLES.map((role) => {
                  const isCovered = entries.some((e) => inferCommitteeRole(e) === role);
                  const config = ROLE_CONFIG[role];
                  return (
                    <Badge
                      key={role}
                      variant="outline"
                      className={`text-[10px] ${isCovered ? `${config.bgColor} ${config.color} ${config.borderColor}` : "bg-muted text-muted-foreground"}`}
                    >
                      {isCovered ? "✓" : "✗"} {config.label}
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Company Org Charts */}
      <TooltipProvider>
        {companyGroups.map(([companyName, group]) => {
          // Sort: decision_makers first, then champions, then influencers, then rest
          const roleOrder: Record<CommitteeRole, number> = {
            decision_maker: 0,
            champion: 1,
            influencer: 2,
            unknown: 3,
            blocker: 4,
          };
          const sorted = [...group.entries].sort(
            (a, b) => roleOrder[a.role] - roleOrder[b.role]
          );

          // Find the "root" nodes (no referrer in this group, or the referrer)
          const rootEntries = sorted.filter(
            (e) =>
              !e.referred_by_hash ||
              !sorted.some((s) => s.viewer_hash === e.referred_by_hash)
          );
          const referredEntries = sorted.filter(
            (e) =>
              e.referred_by_hash &&
              sorted.some((s) => s.viewer_hash === e.referred_by_hash)
          );

          // Group referred by their referrer
          const referrerGroups = new Map<string, typeof sorted>();
          for (const entry of referredEntries) {
            const key = entry.referred_by_hash!;
            if (!referrerGroups.has(key)) referrerGroups.set(key, []);
            referrerGroups.get(key)!.push(entry);
          }

          return (
            <Card key={companyName}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {companyName}
                  <Badge variant="outline" className="text-[10px] ml-auto">
                    {group.entries.length} interlocuteur{group.entries.length > 1 ? "s" : ""}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {rootEntries.map((entry) => (
                    <div key={entry.id}>
                      <MemberNode
                        entry={entry}
                        isSelected={selectedEntryId === entry.id}
                        onClick={() => onSelectEntry(entry)}
                      />
                      {/* Referred members */}
                      {referrerGroups.has(entry.viewer_hash) && (
                        <div className="ml-8 mt-1 space-y-1 border-l-2 border-dashed border-muted-foreground/20 pl-4">
                          {referrerGroups.get(entry.viewer_hash)!.map((referred) => (
                            <div key={referred.id} className="relative">
                              <div className="absolute -left-[18px] top-4 w-3 h-px bg-muted-foreground/20" />
                              <MemberNode
                                entry={referred}
                                isSelected={selectedEntryId === referred.id}
                                onClick={() => onSelectEntry(referred)}
                                isReferred
                              />
                              {/* Second level referrals */}
                              {referrerGroups.has(referred.viewer_hash) && (
                                <div className="ml-8 mt-1 space-y-1 border-l-2 border-dashed border-muted-foreground/20 pl-4">
                                  {referrerGroups.get(referred.viewer_hash)!.map((sub) => (
                                    <div key={sub.id} className="relative">
                                      <div className="absolute -left-[18px] top-4 w-3 h-px bg-muted-foreground/20" />
                                      <MemberNode
                                        entry={sub}
                                        isSelected={selectedEntryId === sub.id}
                                        onClick={() => onSelectEntry(sub)}
                                        isReferred
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </TooltipProvider>
    </div>
  );
}

function MemberNode({
  entry,
  isSelected,
  onClick,
  isReferred,
}: {
  entry: PowerMapEntry & { role: CommitteeRole };
  isSelected: boolean;
  onClick: () => void;
  isReferred?: boolean;
}) {
  const roleConfig = ROLE_CONFIG[entry.role];
  const RoleIcon = roleConfig.icon;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all hover:shadow-md cursor-pointer text-left ${
        isSelected
          ? "ring-2 ring-primary shadow-md border-primary"
          : "border-border hover:border-muted-foreground/30"
      }`}
    >
      {/* Avatar */}
      <div className="relative">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="text-[10px] font-medium">
            {entry.initials}
          </AvatarFallback>
        </Avatar>
        {/* Role icon overlay */}
        <div className={`absolute -bottom-1 -right-1 p-0.5 rounded-full ${roleConfig.bgColor} border border-background`}>
          <RoleIcon className={`h-2.5 w-2.5 ${roleConfig.color}`} />
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold truncate">{entry.displayName}</p>
          {entry.leadScore.total >= 75 && <Flame className="h-3 w-3 text-orange-500 shrink-0" />}
        </div>
        <p className="text-[10px] text-muted-foreground truncate">
          {entry.viewer_title || "—"}
        </p>
      </div>

      {/* Role badge + Score */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${roleConfig.bgColor} ${roleConfig.color} ${roleConfig.borderColor}`}>
          {roleConfig.label}
        </Badge>
        <span className={`text-[10px] font-bold ${entry.leadScore.color}`}>
          {entry.leadScore.total}
        </span>
      </div>

      {/* Engagement mini bar */}
      <div className="w-12 shrink-0">
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full ${
              entry.interest === "high"
                ? "bg-emerald-500"
                : entry.interest === "low"
                  ? "bg-red-500"
                  : "bg-muted-foreground/40"
            }`}
            style={{ width: `${entry.max_percentage_reached}%` }}
          />
        </div>
        <p className="text-[9px] text-muted-foreground text-center mt-0.5">
          {entry.max_percentage_reached}%
        </p>
      </div>
    </button>
  );
}
