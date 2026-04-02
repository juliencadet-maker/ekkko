import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SLACK_GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";

const APPROVE_KEYWORDS = ["ok", "approved", "approuvé", "approuve", "oui", "yes", "go", "validé", "valide", "c'est bon", "parfait"];
const REJECT_KEYWORDS = ["non", "no", "à modifier", "a modifier", "pas ok", "refusé", "refuse", "rejected", "modifier", "revoir", "nok"];

function classifyReply(text: string): "approved" | "rejected" | null {
  const normalized = text.toLowerCase().trim();
  if (APPROVE_KEYWORDS.some(kw => normalized === kw || normalized.startsWith(kw + " ") || normalized.startsWith(kw + "."))) {
    return "approved";
  }
  if (REJECT_KEYWORDS.some(kw => normalized === kw || normalized.startsWith(kw + " ") || normalized.startsWith(kw + "."))) {
    return "rejected";
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Allow service-to-service calls (pg_cron) - validate service role key if present
  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");
    if (token !== serviceRoleKey && token !== Deno.env.get("SUPABASE_ANON_KEY")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LOVABLE_API_KEY || !SLACK_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing Slack credentials" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const slackHeaders = {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": SLACK_API_KEY,
      "Content-Type": "application/json",
    };

    // Fetch all pending approvals that have Slack metadata
    const { data: pendingApprovals, error } = await admin
      .from("approval_requests")
      .select("id, campaign_id, org_id, assigned_to_user_id, slack_metadata, campaigns(name, script)")
      .eq("status", "pending")
      .not("slack_metadata", "is", null);

    if (error) {
      console.error("Error fetching pending approvals:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const processed: string[] = [];

    for (const approval of (pendingApprovals || [])) {
      const meta = approval.slack_metadata as any;
      if (!meta?.channel_id || !meta?.message_ts) {
        console.log(`Skipping approval ${approval.id}: no channel_id or message_ts`);
        continue;
      }

      // Fetch thread replies
      try {
        const repliesUrl = `${SLACK_GATEWAY_URL}/conversations.replies?channel=${meta.channel_id}&ts=${meta.message_ts}`;
        console.log(`[${approval.id}] Fetching replies from: ${repliesUrl}`);
        
        const repliesRes = await fetch(repliesUrl, { headers: slackHeaders });
        const repliesData = await repliesRes.json();
        
        console.log(`[${approval.id}] Slack API response status: ${repliesRes.status}, ok: ${repliesData.ok}, messages count: ${repliesData.messages?.length || 0}`);
        if (!repliesData.ok) {
          console.error(`[${approval.id}] Slack API error:`, JSON.stringify(repliesData));
        }

        if (!repliesData.ok || !repliesData.messages) continue;

        // Skip first message (it's the original post), look at replies
        const replies = repliesData.messages.filter((m: any) => m.ts !== meta.message_ts);
        console.log(`[${approval.id}] Thread replies (excluding original): ${replies.length}`, replies.map((r: any) => ({ ts: r.ts, text: r.text?.substring(0, 50), user: r.user })));
        if (replies.length === 0) continue;

        // Check already-processed replies
        const lastProcessedTs = meta.last_checked_ts || "0";
        const newReplies = replies.filter((m: any) => m.ts > lastProcessedTs);
        console.log(`[${approval.id}] New replies since ${lastProcessedTs}: ${newReplies.length}`);
        if (newReplies.length === 0) continue;

        // Check the latest reply for a decision
        for (const reply of newReplies) {
          const decision = classifyReply(reply.text || "");
          if (!decision) continue;

          // Process the decision
          const comment = reply.text || "";

          // Update approval status
          const { error: updateError } = await admin
            .from("approval_requests")
            .update({
              status: decision,
              decision_comment: `[via Slack] ${comment}`,
              decided_at: new Date().toISOString(),
              slack_metadata: { ...meta, last_checked_ts: reply.ts, decided_via: "slack_thread" },
            })
            .eq("id", approval.id)
            .eq("status", "pending");

          if (updateError) {
            console.error(`Error updating approval ${approval.id}:`, updateError);
            continue;
          }

          // Call process-approval-decision
          const processRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/process-approval-decision`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${serviceRoleKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              approval_id: approval.id,
              action: decision,
              edited_script: null,
              comment: `[via Slack] ${comment}`,
            }),
          });

          // Post confirmation in thread
          const confirmText = decision === "approved"
            ? `✅ *Approuvé !* La campagne « ${(approval as any).campaigns?.name || "Campagne"} » entre en production.`
            : `❌ *Refusé.* L'équipe sales a été notifiée pour revoir le script.`;

          await fetch(`${SLACK_GATEWAY_URL}/chat.postMessage`, {
            method: "POST",
            headers: slackHeaders,
            body: JSON.stringify({
              channel: meta.channel_id,
              thread_ts: meta.message_ts,
              text: confirmText,
            }),
          });

          // If rejected, notify sales via Slack
          if (decision === "rejected") {
            await notifySalesRejection(admin, slackHeaders, approval, meta.channel_id, comment);
          }

          processed.push(approval.id);
          break; // Only process first valid decision per approval
        }

        // Update last_checked_ts even if no decision
        if (!processed.includes(approval.id)) {
          const latestTs = newReplies[newReplies.length - 1].ts;
          await admin.from("approval_requests").update({
            slack_metadata: { ...meta, last_checked_ts: latestTs },
          }).eq("id", approval.id);
        }
      } catch (e) {
        console.error(`Error checking replies for approval ${approval.id}:`, e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, checked: pendingApprovals?.length || 0, processed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Check slack replies error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function notifySalesRejection(
  admin: any,
  slackHeaders: Record<string, string>,
  approval: any,
  channelId: string,
  comment: string,
) {
  // Fetch the sales user profile
  const { data: campaign } = await admin
    .from("campaigns")
    .select("created_by_user_id, name")
    .eq("id", approval.campaign_id)
    .single();

  if (!campaign) return;

  const { data: salesProfile } = await admin
    .from("profiles")
    .select("first_name, last_name, email, notification_channels")
    .eq("user_id", campaign.created_by_user_id)
    .single();

  if (!salesProfile) return;

  // Send Slack notification to the channel tagging the sales person
  const salesName = [salesProfile.first_name, salesProfile.last_name].filter(Boolean).join(" ");

  await fetch(`${SLACK_GATEWAY_URL}/chat.postMessage`, {
    method: "POST",
    headers: slackHeaders,
    body: JSON.stringify({
      channel: channelId,
      text: `🔔 @${salesName} — Le script de « ${campaign.name} » a été refusé et doit être revu.`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🔔 *Script à revoir*\n\nLa campagne « *${campaign.name}* » a été refusée par l'exécutif.\n${comment ? `> _${comment}_\n` : ""}\n*${salesName}*, merci de revoir le script dans Ekko.`,
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "📝 Ouvrir dans Ekko", emoji: true },
              url: `https://ekkko.lovable.app/app/campaigns/${approval.campaign_id}`,
            },
          ],
        },
      ],
    }),
  });

  // Also send email if configured
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (RESEND_API_KEY && (salesProfile.notification_channels || ["email"]).includes("email")) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Ekko <onboarding@resend.dev>",
        to: [salesProfile.email],
        subject: `⚠️ Script à revoir : ${campaign.name}`,
        html: `<p>Bonjour ${salesProfile.first_name || ""},</p><p>Le script de la campagne « <strong>${campaign.name}</strong> » a été refusé par l'exécutif.</p>${comment ? `<blockquote>${comment}</blockquote>` : ""}<p><a href="https://ekkko.lovable.app/app/campaigns/${approval.campaign_id}">Ouvrir dans Ekko pour modifier</a></p>`,
      }),
    });
  }
}
