// =============================================
// EKKO - Lead Scoring Engine
// =============================================

export interface LeadScoreBreakdown {
  total: number; // 0-100
  engagement: number; // 0-30 (based on watch percentage)
  frequency: number; // 0-25 (based on session count)
  recency: number; // 0-25 (based on last watched)
  influence: number; // 0-20 (based on referrals/champion status)
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export type ScoreLevel = "hot" | "warm" | "cold" | "inactive";

export function computeLeadScore(params: {
  maxPercentageReached: number;
  sessionCount: number;
  lastWatchedAt: string;
  referralCount: number;
  totalWatchSeconds: number;
}): LeadScoreBreakdown {
  const { maxPercentageReached, sessionCount, lastWatchedAt, referralCount, totalWatchSeconds } = params;

  // 1. Engagement score (0-30): based on max percentage watched
  const engagement = Math.round((maxPercentageReached / 100) * 30);

  // 2. Frequency score (0-25): based on session count (capped at 5+)
  const frequencyRaw = Math.min(sessionCount / 5, 1);
  const frequency = Math.round(frequencyRaw * 25);

  // 3. Recency score (0-25): how recently they watched (decay over 14 days)
  const daysSinceLastWatch = Math.max(
    0,
    (Date.now() - new Date(lastWatchedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  const recencyRaw = Math.max(0, 1 - daysSinceLastWatch / 14);
  const recency = Math.round(recencyRaw * 25);

  // 4. Influence score (0-20): based on referral activity
  const influenceRaw = Math.min(referralCount / 3, 1);
  const influence = Math.round(influenceRaw * 20);

  const total = Math.min(100, engagement + frequency + recency + influence);

  const { label, color, bgColor, borderColor } = getScoreStyle(total);

  return { total, engagement, frequency, recency, influence, label, color, bgColor, borderColor };
}

function getScoreStyle(score: number): { label: string; color: string; bgColor: string; borderColor: string } {
  if (score >= 75) {
    return { label: "Engagé", color: "text-emerald-700", bgColor: "bg-orange-500/15", borderColor: "border-orange-500/30" };
  }
  if (score >= 50) {
    return { label: "Actif", color: "text-amber-700", bgColor: "bg-amber-500/15", borderColor: "border-amber-500/30" };
  }
  if (score >= 25) {
    return { label: "Froid", color: "text-blue-700", bgColor: "bg-blue-500/15", borderColor: "border-blue-500/30" };
  }
  return { label: "Inactif", color: "text-muted-foreground", bgColor: "bg-muted", borderColor: "border-border" };
}

export function getScoreLevel(score: number): ScoreLevel {
  if (score >= 75) return "hot";
  if (score >= 50) return "warm";
  if (score >= 25) return "cold";
  return "inactive";
}

export interface LeadAlert {
  id: string;
  type: "hot_lead" | "re_engagement" | "champion_activity" | "committee_growth";
  title: string;
  description: string;
  viewerName: string;
  score: number;
  timestamp: string;
  icon: string;
}

export function generateAlerts(entries: Array<{
  id: string;
  displayName: string;
  leadScore: LeadScoreBreakdown;
  sessionCount: number;
  isChampion: boolean;
  referralCount: number;
  lastWatchedAt: string;
  maxPercentageReached: number;
}>): LeadAlert[] {
  const alerts: LeadAlert[] = [];
  const now = Date.now();

  for (const entry of entries) {
    const hoursSinceLastWatch = (now - new Date(entry.lastWatchedAt).getTime()) / (1000 * 60 * 60);

    // Hot lead alert: score >= 75
    if (entry.leadScore.total >= 75) {
      alerts.push({
        id: `hot-${entry.id}`,
        type: "hot_lead",
        title: "Lead chaud détecté",
        description: `${entry.displayName} a un score d'engagement de ${entry.leadScore.total}/100`,
        viewerName: entry.displayName,
        score: entry.leadScore.total,
        timestamp: entry.lastWatchedAt,
        icon: "hot_lead",
      });
    }

    // Re-engagement: multiple sessions in last 24h
    if (entry.sessionCount >= 3 && hoursSinceLastWatch < 24) {
      alerts.push({
        id: `reeng-${entry.id}`,
        type: "re_engagement",
        title: "Ré-engagement intensif",
        description: `${entry.displayName} a visionné ${entry.sessionCount} fois (dernière il y a ${Math.round(hoursSinceLastWatch)}h)`,
        viewerName: entry.displayName,
        score: entry.leadScore.total,
        timestamp: entry.lastWatchedAt,
        icon: "re_engagement",
      });
    }

    // Champion activity: shared with 2+ people
    if (entry.isChampion && entry.referralCount >= 2) {
      alerts.push({
        id: `champ-${entry.id}`,
        type: "champion_activity",
        title: "Champion actif",
        description: `${entry.displayName} a partagé avec ${entry.referralCount} collaborateurs`,
        viewerName: entry.displayName,
        score: entry.leadScore.total,
        timestamp: entry.lastWatchedAt,
        icon: "👑",
      });
    }
  }

  // Sort by score descending
  return alerts.sort((a, b) => b.score - a.score);
}
