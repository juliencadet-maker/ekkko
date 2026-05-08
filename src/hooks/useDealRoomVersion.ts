import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Phase 1d — Routing v1 / v3 Deal Room.
 * Resolves to 'v3' if the org has the `deal_room_v15` feature flag enabled,
 * otherwise falls back to legacy v1 surface.
 */
export function useDealRoomVersion(orgId: string | null | undefined) {
  const [version, setVersion] = useState<"v1" | "v3" | "loading">("loading");

  useEffect(() => {
    let cancelled = false;
    if (!orgId) {
      setVersion("v1");
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase.rpc("is_feature_enabled", {
          p_org_id: orgId,
          p_flag_name: "deal_room_v15",
        });
        if (cancelled) return;
        if (error) {
          console.warn("[useDealRoomVersion] flag lookup failed, falling back to v1", error);
          setVersion("v1");
          return;
        }
        setVersion(data === true ? "v3" : "v1");
      } catch (e) {
        if (!cancelled) setVersion("v1");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  return version;
}
