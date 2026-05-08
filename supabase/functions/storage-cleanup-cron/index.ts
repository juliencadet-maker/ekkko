// Phase 1c-2 — Cron 0 3 UTC — Nettoyage storage TTL différencié (D58).
//   - 90j post-publication (versions inactives)
//   - 7j drafts (deal_room_version jamais activée)
//   - 90j post-désactivation user (identités cloning_active=false)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAY = 24 * 3600 * 1000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const stats = { drafts_deleted: 0, inactive_versions_purged: 0, identity_assets_purged: 0, errors: 0 };

  try {
    // 1. Drafts > 7j (is_active=false AND audio_status='none' AND video_status='none')
    const sevenDaysAgo = new Date(Date.now() - 7 * DAY).toISOString();
    const { data: drafts } = await supabase
      .from("deal_room_version")
      .select("id, audio_storage_path, video_storage_path")
      .eq("is_active", false)
      .eq("audio_status", "none")
      .eq("video_status", "none")
      .lt("created_at", sevenDaysAgo);

    for (const d of drafts ?? []) {
      try {
        if (d.audio_storage_path) await deleteStorageObject(supabase, d.audio_storage_path);
        if (d.video_storage_path) await deleteStorageObject(supabase, d.video_storage_path);
        stats.drafts_deleted++;
      } catch (e) { stats.errors++; console.error("[storage-cleanup] draft purge:", (e as Error).message); }
    }

    // 2. Inactive versions > 90j (kept for archive then purged)
    const ninetyDaysAgo = new Date(Date.now() - 90 * DAY).toISOString();
    const { data: stale } = await supabase
      .from("deal_room_version")
      .select("id, audio_storage_path, video_storage_path")
      .eq("is_active", false)
      .lt("updated_at", ninetyDaysAgo);

    for (const s of stale ?? []) {
      try {
        if (s.audio_storage_path) await deleteStorageObject(supabase, s.audio_storage_path);
        if (s.video_storage_path) await deleteStorageObject(supabase, s.video_storage_path);
        stats.inactive_versions_purged++;
      } catch (e) { stats.errors++; console.error("[storage-cleanup] stale purge:", (e as Error).message); }
    }

    // 3. Identities cloning_active=false > 90j → purge audio_source_path & reference_video_path
    const { data: deactivated } = await supabase
      .from("identities")
      .select("id, audio_source_path, reference_video_path, updated_at")
      .eq("cloning_active", false)
      .lt("updated_at", ninetyDaysAgo);

    for (const id of deactivated ?? []) {
      try {
        if (id.audio_source_path) await deleteStorageObject(supabase, id.audio_source_path);
        if (id.reference_video_path) await deleteStorageObject(supabase, id.reference_video_path);
        stats.identity_assets_purged++;
      } catch (e) { stats.errors++; console.error("[storage-cleanup] identity purge:", (e as Error).message); }
    }

    return new Response(JSON.stringify({ ok: true, stats }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message, stats }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

async function deleteStorageObject(supabase: ReturnType<typeof createClient>, fullPath: string) {
  const idx = fullPath.indexOf("/");
  if (idx < 0) return;
  const bucket = fullPath.slice(0, idx);
  const key = fullPath.slice(idx + 1);
  await supabase.storage.from(bucket).remove([key]);
}
