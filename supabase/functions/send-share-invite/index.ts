import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { video_id, campaign_id, sender_name, sender_viewer_hash, collaborators } = body;

    // Validate required fields
    if (!video_id || typeof video_id !== "string" || !UUID_REGEX.test(video_id)) {
      return new Response(JSON.stringify({ error: "Valid video_id (UUID) required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!campaign_id || typeof campaign_id !== "string" || !UUID_REGEX.test(campaign_id)) {
      return new Response(JSON.stringify({ error: "Valid campaign_id (UUID) required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const safeSenderName = sanitizeString(sender_name, 100);
    if (!safeSenderName) {
      return new Response(JSON.stringify({ error: "sender_name required (max 100 chars)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(collaborators) || collaborators.length === 0 || collaborators.length > 50) {
      return new Response(JSON.stringify({ error: "collaborators must be an array (1-50 items)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeSenderHash = sanitizeString(sender_viewer_hash, 50);

    // Get campaign info
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("name, org_id")
      .eq("id", campaign_id)
      .single();

    if (!campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: org } = await supabase
      .from("orgs")
      .select("name")
      .eq("id", campaign.org_id)
      .single();

    const companyName = org?.name || "notre entreprise";
    const landingPageBaseUrl = `${req.headers.get("origin") || "https://ekkko.lovable.app"}/lp/${campaign_id}`;

    const results = [];

    for (const collab of collaborators) {
      const firstName = sanitizeString(collab.first_name, 100);
      const lastName = sanitizeString(collab.last_name, 100);
      const email = sanitizeString(collab.email, 255);
      const title = sanitizeString(collab.title, 100);

      if (!firstName || !lastName || !email) {
        results.push({ email: email || "unknown", success: false, error: "Missing required fields" });
        continue;
      }

      if (!EMAIL_REGEX.test(email)) {
        results.push({ email, success: false, error: "Invalid email format" });
        continue;
      }

      const viewerHash = Math.abs(
        email.split("").reduce((h: number, c: string) => {
          return ((h << 5) - h + c.charCodeAt(0)) | 0;
        }, 0)
      ).toString(36);

      await supabase.from("watch_progress").upsert(
        {
          video_id,
          viewer_hash: viewerHash,
          viewer_name: `${firstName} ${lastName}`,
          viewer_email: email,
          viewer_title: title || null,
          referred_by_hash: safeSenderHash,
          watch_percentage: 0,
          total_watch_seconds: 0,
          max_percentage_reached: 0,
        },
        { onConflict: "video_id,viewer_hash" }
      );

      const shareUrl = `${landingPageBaseUrl}?ref=${encodeURIComponent(safeSenderHash || "")}`;

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
            subject: `${safeSenderName} vous invite à regarder une vidéo de ${companyName}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1e3a5f;">Vous avez reçu une invitation</h2>
                <p style="font-size: 16px; color: #333;">
                  Bonjour ${firstName},
                </p>
                <p style="font-size: 16px; color: #333;">
                  <strong>${safeSenderName}</strong> vous invite à regarder une vidéo personnalisée de <strong>${companyName}</strong>.
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
