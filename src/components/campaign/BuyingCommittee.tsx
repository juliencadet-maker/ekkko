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
import type { PowerMapEntry } from "./PowerMap";

type CommitteeRole = "champion" | "decision_maker" | "influencer" | "blocker" | "unknown";

interface BuyingCommitteeProps {
  entries: PowerMapEntry[];
  onSelectEntry: (entry: PowerMapEntry) => void;
  selectedEntryId?: string;
}

function inferCommitteeRole(entry: PowerMapEntry): CommitteeRole {
  if (entry.isChampion) return "champion";
  const title = (entry.title || "").toLowerCase();
  if (
    title.includes("dg") || title.includes("directeur général") || title.includes("directrice générale") ||
    title.includes("ceo") || title.includes("cto") || title.includes("cfo") || title.includes("coo") ||
    title.includes("vp") || title.includes("vice") || title.includes("président") || title.includes("daf")
  ) {
    return "decision_maker";
  }
  if (
    title.includes("directeur") || title.includes("directrice") || title.includes("responsable") ||
    title.includes("head") || title.includes("lead") || title.includes("manager") || title.includes("chef de projet")
  ) {
    return "influencer";
  }
  if (entry.blocker_score >= 50) return "blocker";
  return "unknown";
}

const ROLE_CONFIG: Record<CommitteeRole, {
  label: string;
  icon: typeof Crown;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  champion: { label: "Champion", icon: Crown, color: "text-amber-700", bgColor: "bg-amber-500/15", borderColor: "border-amber-500/30" },
  decision_maker: { label: "Decision Maker", icon: UserCheck, color: "text-purple-700", bgColor: "bg-purple-500/15", borderColor: "border-purple-500/30" },
  influencer: { label: "Influenceur", icon: Megaphone, color: "text-blue-700", bgColor: "bg-blue-500/15", borderColor: "border-blue-500/30" },
  blocker: { label: "Bloqueur", icon: ShieldAlert, color: "text-red-700", bgColor: "bg-red-500/15", borderColor: "border-red-500/30" },
  unknown: { label: "À identifier", icon: User, color: "text-muted-foreground", bgColor: "bg-muted", borderColor: "border-border" },
};

const IDEAL_COMMITTEE: CommitteeRole[] = ["champion", "decision_maker", "influencer"];

export function BuyingCommittee({ entries, onSelectEntry, selectedEntryId }: BuyingCommitteeProps) {
  const grouped = useMemo(() => {
    const groups: Record<CommitteeRole, PowerMapEntry[]> = {
      champion: [], decision_maker: [], influencer: [], blocker: [], unknown: [],
    };
    entries.forEach((e) => {
      const role = inferCommitteeRole(e);
      groups[role].push(e);
    });
    return groups;
  }, [entries]);

  const coverage = useMemo(() => {
    const covered = IDEAL_COMMITTEE.filter((r) => grouped[r].length > 0);
    return Math.round((covered.length / IDEAL_COMMITTEE.length) * 100);
  }, [grouped]);

  const roleOrder: CommitteeRole[] = ["champion", "decision_maker", "influencer", "blocker", "unknown"];

  return (
    <div className="space-y-6">
      {/* Coverage */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Couverture du comité</span>
            </div>
            <span className="text-sm font-bold">{coverage}%</span>
          </div>
          <Progress value={coverage} className="h-2" />
          <div className="flex gap-2 mt-3 flex-wrap">
            {IDEAL_COMMITTEE.map((role) => {
              const filled = grouped[role].length > 0;
              const cfg = ROLE_CONFIG[role];
              return (
                <Badge key={role} variant="outline" className={`text-[10px] ${filled ? `${cfg.bgColor} ${cfg.color} ${cfg.borderColor}` : "bg-muted text-muted-foreground border-border"}`}>
                  {filled ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
                  {cfg.label}
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Roles */}
      {roleOrder.map((role) => {
        const members = grouped[role];
        if (members.length === 0) return null;
        const cfg = ROLE_CONFIG[role];
        const RoleIcon = cfg.icon;

        return (
          <div key={role}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`p-1.5 rounded-md ${cfg.bgColor}`}>
                <RoleIcon className={`h-4 w-4 ${cfg.color}`} />
              </div>
              <h3 className="text-sm font-semibold">{cfg.label}</h3>
              <Badge variant="outline" className="text-[10px]">{members.length}</Badge>
            </div>
            <div className="grid gap-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {members.map((entry) => {
                const isSelected = selectedEntryId === entry.id;
                return (
                  <button
                    key={entry.id}
                    onClick={() => onSelectEntry(entry)}
                    className={`text-left p-3 rounded-lg border-2 transition-all hover:shadow-md cursor-pointer ${
                      isSelected ? "ring-2 ring-primary shadow-md border-primary" : `border-border hover:${cfg.borderColor}`
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[9px] font-medium">{entry.initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold truncate">{entry.displayName}</p>
                          {entry.contact_score >= 75 && <Flame className="h-3 w-3 text-orange-500 shrink-0" />}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">{entry.title || "Poste inconnu"}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${cfg.bgColor} ${cfg.color} ${cfg.borderColor}`}>
                        {cfg.label}
                      </Badge>
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {entry.contact_score}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
