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
    console.log("HeyGen webhook received:", JSON.stringify(payload));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // HeyGen webhook payload structure: event_data (not data)
    const ed = payload.event_data || payload.data || {};
    const eventType = payload.event_type || payload.type;
    const videoId = ed.video_id || payload.video_id;
    const videoUrl = ed.url || ed.video_url || payload.video_url;
    const callbackId = ed.callback_id || payload.callback_id;
    const errorMsg = ed.msg || ed.error || payload.message;
    const status = ed.status || payload.status;

    if (!videoId) {
      console.log("No video_id in webhook payload, ignoring");
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the video_job by provider_job_id
    const { data: videoJob, error: jobError } = await supabase
      .from("video_jobs")
      .select("*")
      .eq("provider_job_id", videoId)
      .single();

    if (jobError || !videoJob) {
      console.error("Video job not found for HeyGen video:", videoId);
      return new Response(JSON.stringify({ ok: true, warning: "Job not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (eventType === "avatar_video.success" || eventType === "video.completed" || status === "completed" || status === "ready") {
      console.log("Video ready:", videoId, "url:", videoUrl);

      // Update video_job to completed
      await supabase
        .from("video_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", videoJob.id);

      // Create video record
      const storagePath = videoUrl || "";

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
            heygen_video_id: videoId,
            hosted_url: videoUrl,
            download_url: videoUrl,
            source: "heygen",
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
        await supabase
          .from("campaigns")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", videoJob.campaign_id);

        console.log("Campaign completed:", videoJob.campaign_id);

        // Notify campaign creator
        const { data: campaign } = await supabase
          .from("campaigns")
          .select("name, created_by_user_id, org_id")
          .eq("id", videoJob.campaign_id)
          .single();

        if (campaign?.created_by_user_id) {
          await supabase.from("notifications").insert({
            org_id: campaign.org_id,
            user_id: campaign.created_by_user_id,
            title: "Vidéos prêtes 🎬",
            message: `Les vidéos de la campagne "${campaign.name}" sont prêtes à être partagées.`,
            type: "campaign_completed",
            entity_type: "campaign",
            entity_id: videoJob.campaign_id,
          });

          // Email notification via Resend
          const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
          if (RESEND_API_KEY) {
            const { data: creatorProfile } = await supabase
              .from("profiles")
              .select("email, first_name")
              .eq("user_id", campaign.created_by_user_id)
              .single();

            if (creatorProfile?.email) {
              try {
                await fetch("https://api.resend.com/emails", {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${RESEND_API_KEY}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    from: "Ekko <notifications@ekko.app>",
                    to: [creatorProfile.email],
                    subject: `🎬 Vidéos prêtes — ${campaign.name}`,
                    html: `
                      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2>Bonjour ${creatorProfile.first_name || ""} 👋</h2>
                        <p>Les vidéos de votre campagne <strong>"${campaign.name}"</strong> sont prêtes !</p>
                        <p>Connectez-vous à Ekko pour les visualiser et les partager avec vos destinataires.</p>
                        <br/>
                        <p style="color: #666; font-size: 12px;">— L'équipe Ekko</p>
                      </div>
                    `,
                  }),
                });
                console.log("Email notification sent to:", creatorProfile.email);
              } catch (emailError) {
                console.error("Email notification error:", emailError);
              }
            }
          }
        }
      }
    } else if (eventType === "avatar_video.fail" || eventType === "video.failed" || status === "error" || status === "failed") {
      console.error("Video generation failed:", videoId, errorMsg);

      await supabase
        .from("video_jobs")
        .update({
          status: "failed",
          error_message: errorMsg || "Video generation failed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", videoJob.id);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("heygen-webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
