import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
}

interface DealTrigger {
  id: string;
  campaign_id: string;
  campaign_name: string;
  message_what: string;
  created_at: string;
}

export function NotificationBell() {
  const { user, membership } = useAuthContext();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dealTriggers, setDealTriggers] = useState<DealTrigger[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifications = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifications((data as Notification[]) || []);

    // Fetch deal_triggers for the org
    if (membership?.org_id) {
      const { data: orgCampaigns } = await supabase
        .from("campaigns")
        .select("id, name")
        .eq("org_id", membership.org_id)
        .limit(50);
      const campaignIds = (orgCampaigns || []).map((c: any) => c.id);
      const nameMap: Record<string, string> = {};
      (orgCampaigns || []).forEach((c: any) => { nameMap[c.id] = c.name; });

      if (campaignIds.length > 0) {
        const { data: triggers } = await supabase
          .from("deal_triggers")
          .select("id, campaign_id, message_what, created_at")
          .in("campaign_id", campaignIds)
          .not("delivered_at", "is", null)
          .is("acted_on_at", null)
          .order("created_at", { ascending: false })
          .limit(10);
        setDealTriggers(
          (triggers || []).map((t: any) => ({
            ...t,
            campaign_name: nameMap[t.campaign_id] || "Deal",
          }))
        );
      }
    }
  };

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel("notifications-bell")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
      }, () => fetchNotifications())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, membership?.org_id]);

  // Badge = deal_triggers count only
  const unreadCount = dealTriggers.length;

  const markAsRead = async (id: string) => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .in("id", unreadIds);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.entity_type === "campaign" && notification.entity_id) {
      navigate(`/app/campaigns/${notification.entity_id}`);
      setOpen(false);
    }
  };

  const handleTriggerClick = (trigger: DealTrigger) => {
    // Remove locally — do NOT update acted_on_at
    setDealTriggers(prev => prev.filter(t => t.id !== trigger.id));
    navigate(`/app/campaigns/${trigger.campaign_id}`);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        side="right"
        align="start"
        sideOffset={8}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="text-sm font-semibold">Notifications</h4>
          {notifications.filter(n => !n.is_read).length > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-primary hover:underline"
            >
              Tout marquer lu
            </button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {/* Deal triggers first */}
          {dealTriggers.length > 0 && (
            <div className="divide-y">
              {dealTriggers.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleTriggerClick(t)}
                  className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors bg-[hsl(var(--accent))]/5"
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-1.5 h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: "#1AE08A" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.campaign_name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {t.message_what}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: fr })}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Regular notifications */}
          {notifications.length === 0 && dealTriggers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune notification
            </p>
          ) : (
            <div className="divide-y">
              {notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors",
                    !n.is_read && "bg-primary/5"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && (
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                    <div className={cn("flex-1 min-w-0", n.is_read && "ml-4")}>
                      <p className="text-sm font-medium truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {n.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
