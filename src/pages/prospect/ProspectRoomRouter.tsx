import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AssetLandingPage from "@/pages/AssetLandingPage";
import { useDealRoomVersion } from "@/hooks/useDealRoomVersion";

// Lazy-load V1.5 surface to keep prospect bundle minimal for v1 traffic.
const V15Room = lazy(() =>
  import("@/pages/prospect/V15Room").then((m) => ({ default: m.V15Room }))
);

/**
 * Phase 1d — Routing wrapper v1 / v3.
 * Looks up the campaign's org and selects the surface based on `deal_room_v15` flag.
 * Default = v1 (zero regression for existing orgs).
 */
export default function ProspectRoomRouter() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const location = useLocation();
  const forceV3 = location.pathname.startsWith("/dr/");
  const [orgId, setOrgId] = useState<string | null | undefined>(undefined);
  const version = useDealRoomVersion(orgId ?? null);

  useEffect(() => {
    if (!campaignId) {
      setOrgId(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("campaigns")
        .select("org_id")
        .eq("id", campaignId)
        .maybeSingle();
      setOrgId(data?.org_id ?? null);
    })();
  }, [campaignId]);

  if (orgId === undefined || (!forceV3 && version === "loading")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  if ((forceV3 || version === "v3") && campaignId) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-background">
            <p className="text-sm text-muted-foreground">Chargement…</p>
          </div>
        }
      >
        <V15Room campaignId={campaignId} />
      </Suspense>
    );
  }

  // Default fallback : v1 (AssetLandingPage already reads :campaignId from useParams).
  return <AssetLandingPage />;
}
