import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("Tavus webhook received:", JSON.stringify(payload));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const status = payload.status;
    const tavusVideoId = payload.video_id;
    const downloadUrl = payload.download_url;
    const hostedUrl = payload.hosted_url;
    const streamUrl = payload.stream_url;

    if (!tavusVideoId) {
      console.log("No video_id in webhook payload, ignoring");
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the video_job by provider_job_id
    const { data: videoJob, error: jobError } = await supabase
      .from("video_jobs")
      .select("*")
      .eq("provider_job_id", tavusVideoId)
      .single();

    if (jobError || !videoJob) {
      console.error("Video job not found for tavus video:", tavusVideoId);
      return new Response(JSON.stringify({ ok: true, warning: "Job not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (status === "ready") {
      console.log("Video ready:", tavusVideoId, "download:", downloadUrl);

      // Update video_job to completed
      await supabase
        .from("video_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", videoJob.id);

      // Create video record
      const storagePath = downloadUrl || hostedUrl || streamUrl || "";

      await supabase
        .from("videos")
        .insert({
          org_id: videoJob.org_id,
          campaign_id: videoJob.campaign_id,
          video_job_id: videoJob.id,
          recipient_id: videoJob.recipient_id,
          storage_path: storagePath,
          is_active: true,
          metadata: {
            tavus_video_id: tavusVideoId,
            download_url: downloadUrl,
            hosted_url: hostedUrl,
            stream_url: streamUrl,
            source: "tavus",
          },
        });

      // Check if all jobs for this campaign are complete
      const { count: pendingCount } = await supabase
        .from("video_jobs")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", videoJob.campaign_id)
        .neq("status", "completed")
        .neq("status", "failed");

      if (pendingCount === 0) {
        // All done - mark campaign as completed
        await supabase
          .from("campaigns")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", videoJob.campaign_id);

        console.log("Campaign completed:", videoJob.campaign_id);
      }
    } else if (status === "error" || status === "deleted") {
      console.error("Video generation failed:", tavusVideoId, payload);

      await supabase
        .from("video_jobs")
        .update({
          status: "failed",
          error_message: payload.status_details || payload.message || "Video generation failed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", videoJob.id);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("tavus-webhook error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
