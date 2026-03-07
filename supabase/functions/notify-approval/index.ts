import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SLACK_GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { approval_id } = await req.json();
    if (!approval_id) {
      return new Response(JSON.stringify({ error: "Missing approval_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Fetch approval with related data
    const { data: approval, error } = await admin
      .from("approval_requests")
      .select("*, campaigns(name, script, identities(display_name, owner_user_id))")
      .eq("id", approval_id)
      .single();

    if (error || !approval) {
      return new Response(JSON.stringify({ error: "Approval not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch exec profile
    const { data: execProfile } = await admin
      .from("profiles")
      .select("email, first_name, last_name, notification_channels")
      .eq("user_id", approval.assigned_to_user_id)
      .single();

    if (!execProfile) {
      return new Response(JSON.stringify({ error: "Exec profile not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch requester profile
    const { data: requesterProfile } = await admin
      .from("profiles")
      .select("first_name, last_name, title")
      .eq("user_id", approval.requested_by_user_id)
      .single();

    const requesterName = requesterProfile
      ? `${requesterProfile.first_name || ""} ${requesterProfile.last_name || ""}`.trim()
      : "Un membre de votre équipe";

    const approvalToken = approval.approval_token;
    const baseUrl = req.headers.get("origin") || "https://ekkko.lovable.app";
    const reviewUrl = `${baseUrl}/approve/${approvalToken}`;
    const campaignName = (approval as any).campaigns?.name || "Campagne";
    const identityName = (approval as any).campaigns?.identities?.display_name || "";
    const scriptPreview = (approval.script_snapshot || (approval as any).campaigns?.script || "").slice(0, 300);

    const channels = execProfile.notification_channels || ["email"];
    const results: Record<string, string> = {};

    // Fetch org settings
    const { data: orgData } = await admin
      .from("orgs")
      .select("settings")
      .eq("id", approval.org_id)
      .single();
    const orgSettings = (orgData?.settings || {}) as Record<string, any>;

    // ── EMAIL via Resend ──
    if (channels.includes("email")) {
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (RESEND_API_KEY) {
        const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f8f9fa;">
  <div style="background:white;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:#1a2744;color:white;width:40px;height:40px;line-height:40px;border-radius:8px;font-weight:bold;font-size:18px;">E</div>
      <h2 style="margin:8px 0 0;color:#1a2744;">Validation requise</h2>
    </div>
    <p style="color:#333;font-size:15px;">Bonjour ${execProfile.first_name || ""},</p>
    <p style="color:#555;font-size:14px;"><strong>${requesterName}</strong> souhaite utiliser votre identité « <strong>${identityName}</strong> » pour « <strong>${campaignName}</strong> ».</p>
    <div style="background:#f1f3f5;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 8px;font-weight:600;color:#333;font-size:13px;">SCRIPT :</p>
      <p style="margin:0;color:#555;font-size:13px;white-space:pre-wrap;">${scriptPreview}${scriptPreview.length >= 300 ? "..." : ""}</p>
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${reviewUrl}" style="display:inline-block;background:#1a2744;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Relire et répondre</a>
    </div>
    <p style="color:#999;font-size:12px;text-align:center;">Approuver, modifier ou refuser en un tap.</p>
  </div>
</body></html>`;

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Ekko <onboarding@resend.dev>",
            to: [execProfile.email],
            subject: `🎬 Validation requise : ${campaignName}`,
            html: emailHtml,
          }),
        });
        results.email = res.ok ? "sent" : "failed";
      } else {
        results.email = "no_api_key";
      }
    }

    // ── SLACK via Connector Gateway ──
    if (channels.includes("slack")) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
      const slackChannel = orgSettings.slack_channel_id;

      if (LOVABLE_API_KEY && SLACK_API_KEY && slackChannel) {
        try {
          const slackPayload = {
            channel: slackChannel,
            text: `🎬 Validation Ekko requise — ${campaignName}`,
            blocks: [
              {
                type: "header",
                text: { type: "plain_text", text: "🎬 Validation requise", emoji: true },
              },
              {
                type: "section",
                fields: [
                  { type: "mrkdwn", text: `*Campagne :*\n${campaignName}` },
                  { type: "mrkdwn", text: `*Identité :*\n${identityName}` },
                ],
              },
              {
                type: "section",
                text: { type: "mrkdwn", text: `*Demandé par :* ${requesterName}` },
              },
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*Script :*\n>${scriptPreview.slice(0, 200).replace(/\n/g, "\n>")}${scriptPreview.length > 200 ? "..." : ""}`,
                },
              },
              {
                type: "actions",
                elements: [
                  {
                    type: "button",
                    text: { type: "plain_text", text: "✅ Relire et répondre", emoji: true },
                    url: reviewUrl,
                    style: "primary",
                  },
                ],
              },
            ],
          };

          const slackRes = await fetch(`${SLACK_GATEWAY_URL}/chat.postMessage`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": SLACK_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(slackPayload),
          });

          const slackData = await slackRes.json();
          results.slack = slackData.ok ? "sent" : `failed: ${slackData.error || "unknown"}`;
        } catch (e) {
          console.error("Slack notification error:", e);
          results.slack = "error";
        }
      } else {
        results.slack = !slackChannel ? "no_channel_configured" : "no_api_keys";
      }
    }

    // ── WHATSAPP via Twilio ──
    if (channels.includes("whatsapp")) {
      const twilioSid = orgSettings.twilio_account_sid;
      const twilioToken = orgSettings.twilio_auth_token;
      const twilioFrom = orgSettings.twilio_whatsapp_from;
      const execPhone = orgSettings.exec_whatsapp_numbers?.[approval.assigned_to_user_id];

      if (twilioSid && twilioToken && twilioFrom && execPhone) {
        try {
          const message = `🎬 *Validation Ekko requise*\n\nCampagne: ${campaignName}\nIdentité: ${identityName}\nDemandé par: ${requesterName}\n\nScript:\n${scriptPreview.slice(0, 200)}${scriptPreview.length > 200 ? "..." : ""}\n\n👉 ${reviewUrl}`;
          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
          const body = new URLSearchParams();
          body.append("From", twilioFrom);
          body.append("To", `whatsapp:${execPhone}`);
          body.append("Body", message);

          const waRes = await fetch(twilioUrl, {
            method: "POST",
            headers: {
              "Authorization": `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: body.toString(),
          });
          results.whatsapp = waRes.ok ? "sent" : "failed";
        } catch (e) {
          console.error("WhatsApp notification error:", e);
          results.whatsapp = "error";
        }
      } else {
        results.whatsapp = "not_configured";
      }
    }

    return new Response(
      JSON.stringify({ success: true, review_url: reviewUrl, notifications: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Notify approval error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
