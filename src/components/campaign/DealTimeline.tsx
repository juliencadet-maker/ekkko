import { Eye, Share2, MousePointerClick, UserPlus, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TimelineEvent {
  id: string;
  type: string;
  label: string;
  detail: string;
  time: string;
}

interface DealTimelineProps {
  events: TimelineEvent[];
}

const ICON_MAP: Record<string, React.ElementType> = {
  view: Eye,
  share: Share2,
  cta_click: MousePointerClick,
  new_contact: UserPlus,
  declared: MessageSquare,
  offline_signal: MessageSquare,
};

export function DealTimeline({ events }: DealTimelineProps) {
  return (
    <div className="space-y-0">
      {events.map((event, idx) => {
        const Icon = ICON_MAP[event.type] || Eye;
        const isDeclared = event.type === "offline_signal" || event.type === "declared";
        return (
          <div key={event.id} className="flex gap-3 relative">
            {idx < events.length - 1 && (
              <div className="absolute left-[11px] top-7 bottom-0 w-px bg-border" />
            )}
            <div className="flex-shrink-0 mt-1 w-[23px] h-[23px] rounded-full bg-muted flex items-center justify-center z-10">
              <Icon className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm text-foreground">{event.label}</p>
                {isDeclared && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-[#3B82F6]/30 text-[#3B82F6] bg-[#3B82F6]/5 font-medium">
                    CONTEXTE AE
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{event.detail}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{event.time}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
