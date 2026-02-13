import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const {
      video_id,
      campaign_id,
      sender_name,
      sender_viewer_hash,
      collaborators,
    } = body;

    if (!video_id || !campaign_id || !sender_name || !collaborators?.length) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get campaign info for the email
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("name, org_id")
      .eq("id", campaign_id)
      .single();

    if (!campaign) {
      return new Response(
        JSON.stringify({ error: "Campaign not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get org name
    const { data: org } = await supabase
      .from("orgs")
      .select("name")
      .eq("id", campaign.org_id)
      .single();

    const companyName = org?.name || "notre entreprise";
    const landingPageBaseUrl = `${req.headers.get("origin") || "https://ekkko.lovable.app"}/lp/${campaign_id}`;

    const results = [];

    for (const collab of collaborators) {
      const { first_name, last_name, email, title } = collab;

      if (!first_name || !last_name || !email) {
        results.push({ email, success: false, error: "Missing required fields" });
        continue;
      }

      // Create a watch_progress entry for the new viewer (pre-seed with referral info)
      const viewerHash = Math.abs(
        email.split("").reduce((h: number, c: string) => {
          return ((h << 5) - h + c.charCodeAt(0)) | 0;
        }, 0)
      ).toString(36);

      await supabase.from("watch_progress").upsert(
        {
          video_id,
          viewer_hash: viewerHash,
          viewer_name: `${first_name} ${last_name}`,
          viewer_email: email,
          viewer_title: title || null,
          referred_by_hash: sender_viewer_hash,
          watch_percentage: 0,
          total_watch_seconds: 0,
          max_percentage_reached: 0,
        },
        { onConflict: "video_id,viewer_hash" }
      );

      const shareUrl = `${landingPageBaseUrl}?ref=${sender_viewer_hash}`;

      // Send email via Resend
      try {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Ekko <onboarding@resend.dev>",
            to: [email],
            subject: `${sender_name} vous invite à regarder une vidéo de ${companyName}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1e3a5f;">Vous avez reçu une invitation</h2>
                <p style="font-size: 16px; color: #333;">
                  Bonjour ${first_name},
                </p>
                <p style="font-size: 16px; color: #333;">
                  <strong>${sender_name}</strong> vous invite à regarder une vidéo personnalisée de <strong>${companyName}</strong>.
                </p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${shareUrl}" 
                     style="background-color: #1e3a5f; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">
                    Regarder la vidéo
                  </a>
                </div>
                <p style="font-size: 14px; color: #666;">
                  Cette vidéo a été spécialement préparée pour vous. Cliquez sur le bouton ci-dessus pour la découvrir.
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
                <p style="font-size: 12px; color: #999; text-align: center;">
                  Propulsé par Ekko
                </p>
              </div>
            `,
          }),
        });

        const emailData = await emailRes.json();
        if (!emailRes.ok) {
          throw new Error(`Resend API error [${emailRes.status}]: ${JSON.stringify(emailData)}`);
        }

        results.push({ email, success: true });
      } catch (emailErr) {
        console.error(`Failed to send email to ${email}:`, emailErr);
        results.push({
          email,
          success: false,
          error: emailErr instanceof Error ? emailErr.message : "Email send failed",
        });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
