import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeString(val: unknown, maxLen: number): string | null {
  if (typeof val !== "string") return null;
  return val.trim().slice(0, maxLen) || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { video_id, viewer_hash, watch_percentage, total_watch_seconds, viewer_name, viewer_email, viewer_title, viewer_company, referred_by_hash } = body;

    // Validate required fields
    if (!video_id || typeof video_id !== "string" || !UUID_REGEX.test(video_id)) {
      return new Response(JSON.stringify({ error: "Valid video_id (UUID) required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!viewer_hash || typeof viewer_hash !== "string" || viewer_hash.length > 50) {
      return new Response(JSON.stringify({ error: "Valid viewer_hash required (max 50 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate optional numeric fields
    const safePercentage = typeof watch_percentage === "number" ? Math.max(0, Math.min(100, Math.round(watch_percentage))) : 0;
    const safeWatchSeconds = typeof total_watch_seconds === "number" ? Math.max(0, Math.min(86400, Math.round(total_watch_seconds))) : 0;

    // Validate optional string fields
    const safeName = sanitizeString(viewer_name, 100);
    const safeTitle = sanitizeString(viewer_title, 100);
    const safeCompany = sanitizeString(viewer_company, 100);
    const safeRefHash = sanitizeString(referred_by_hash, 50);

    // Validate email format if provided
    let safeEmail: string | null = null;
    if (viewer_email && typeof viewer_email === "string") {
      const trimmed = viewer_email.trim().slice(0, 255);
      if (EMAIL_REGEX.test(trimmed)) {
        safeEmail = trimmed;
      }
    }

    // Upsert watch progress
    const { data: existing } = await supabase
      .from("watch_progress")
      .select("id, max_percentage_reached, session_count, viewer_name, viewer_email")
      .eq("video_id", video_id)
      .eq("viewer_hash", viewer_hash)
      .maybeSingle();

    if (existing) {
      const updates: Record<string, unknown> = {
        watch_percentage: safePercentage,
        total_watch_seconds: safeWatchSeconds,
        max_percentage_reached: Math.max(safePercentage, existing.max_percentage_reached ?? 0),
        last_watched_at: new Date().toISOString(),
      };

      if (safeName && !existing.viewer_name) updates.viewer_name = safeName;
      if (safeEmail && !existing.viewer_email) updates.viewer_email = safeEmail;
      if (safeTitle) updates.viewer_title = safeTitle;
      if (safeCompany) updates.viewer_company = safeCompany;

      await supabase
        .from("watch_progress")
        .update(updates)
        .eq("id", existing.id);
    } else {
      await supabase
        .from("watch_progress")
        .insert({
          video_id,
          viewer_hash,
          watch_percentage: safePercentage,
          total_watch_seconds: safeWatchSeconds,
          max_percentage_reached: safePercentage,
          viewer_name: safeName,
          viewer_email: safeEmail,
          viewer_title: safeTitle,
          viewer_company: safeCompany,
          referred_by_hash: safeRefHash,
        });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
