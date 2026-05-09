// Phase 1d.5h — Client-side helper resolving the effective deal layout.
// Wraps the SQL function `effective_deal_layout(p_campaign_id)` which applies
// the hierarchy: active deal_room_version.layout_mode > deal_rooms.scope >
// legacy campaigns.deal_experience_mode > 'full'.
import { supabase } from "@/integrations/supabase/client";

export type DealLayoutMode = "full" | "quick_share";

/**
 * Resolves the effective layout mode for a deal.
 * Returns 'full' as a safe default if the RPC fails.
 */
export async function getEffectiveDealLayout(campaignId: string): Promise<DealLayoutMode> {
  if (!campaignId) return "full";
  try {
    const { data, error } = await supabase.rpc("effective_deal_layout", { p_campaign_id: campaignId });
    if (error) {
      console.warn("[dealLayout] effective_deal_layout RPC failed:", error.message);
      return "full";
    }
    return (data === "quick_share" ? "quick_share" : "full") as DealLayoutMode;
  } catch (e) {
    console.warn("[dealLayout] RPC threw:", e);
    return "full";
  }
}
