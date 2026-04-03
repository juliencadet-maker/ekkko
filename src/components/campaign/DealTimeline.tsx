import { Eye, Share2, MousePointerClick, UserPlus, MessageSquare } from "lucide-react";

interface TimelineEvent {
  id: string;
  type: string;
  label: string;
  time: string;
  event_layer?: "fact" | "inference" | "declared";
  freshness?: "recent" | "old" | null;
}

interface DealTimelineProps {
  events: TimelineEvent[];
}

const ICON_MAP: Record<string, React.ElementType> = {
  video_opened: Eye,
  video_started: Eye,
  watch_progress: Eye,
  video_completed: Eye,
  segment_replayed: Eye,
  cta_clicked: MousePointerClick,
  page_shared: Share2,
  doc_opened: Eye,
  doc_page_viewed: Eye,
  doc_downloaded: Eye,
  doc_return_visit: Eye,
  ae_action_done: MessageSquare,
  offline_signal: MessageSquare,
  view: Eye,
  share: Share2,
  new_viewer: UserPlus,
  declared: MessageSquare,
};

const LAYER_BADGE = {
  fact: { text: "FAIT", bg: "#F7F6F3", color: "#0D1B2A", border: "#D1D5DB" },
  inference: { text: "INFÉRENCE ≈", bg: "#FAEEDA", color: "#E8A838", border: "#F5D08A" },
  declared: { text: "CONTEXTE AE", bg: "#E6F1FB", color: "#3B82F6", border: "#BFDBFE" },
} as const;

const FRESHNESS_BADGE = {
  recent: { text: "Récent", bg: "#D0FAE8", color: "#1A7A4A" },
  old: { text: "Ancien", bg: "#F3F4F6", color: "#6B7280" },
} as const;

export function DealTimeline({ events }: DealTimelineProps) {
  return (
    <div className="space-y-0">
      {events.map((event, idx) => {
        const Icon = ICON_MAP[event.type] || Eye;
        const layerBadge = event.event_layer ? (LAYER_BADGE[event.event_layer] ?? null) : null;
        const freshnessBadge = event.freshness ? (FRESHNESS_BADGE[event.freshness] ?? null) : null;
        return (
          <div key={event.id} className="flex gap-3 relative">
            {idx < events.length - 1 && (
              <div className="absolute left-[11px] top-7 bottom-0 w-px bg-border" />
            )}
            <div className="flex-shrink-0 mt-1 w-[23px] h-[23px] rounded-full bg-muted flex items-center justify-center z-10">
              <Icon className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-1 flex-wrap">
                <p className="text-sm text-foreground">{event.label}</p>
                {layerBadge && (
                  <span
                    className="inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-medium"
                    style={{ backgroundColor: layerBadge.bg, color: layerBadge.color, borderColor: layerBadge.border }}
                  >
                    {layerBadge.text}
                  </span>
                )}
                {freshnessBadge && (
                  <span
                    className="inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium"
                    style={{ backgroundColor: freshnessBadge.bg, color: freshnessBadge.color }}
                  >
                    {freshnessBadge.text}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">{event.time}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
