import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEMO_SALES_EMAIL = "demo@ekko.app";
const DEMO_EXEC_EMAIL = "exec@ekko.app";

async function deleteUserAndData(admin: any, email: string) {
  const { data: existingUsers } = await admin.auth.admin.listUsers();
  const existing = existingUsers?.users?.find((u: any) => u.email === email);
  if (!existing) return null;

  const { data: membership } = await admin
    .from("org_memberships")
    .select("org_id")
    .eq("user_id", existing.id)
    .maybeSingle();

  // Only delete org data if this is the sales account (org creator)
  if (membership && email === DEMO_SALES_EMAIL) {
    const orgId = membership.org_id;
    const { data: campaigns } = await admin.from("campaigns").select("id").eq("org_id", orgId);
    const campaignIds = campaigns?.map((c: any) => c.id) || [];

    if (campaignIds.length > 0) {
      const { data: videos } = await admin.from("videos").select("id").in("campaign_id", campaignIds);
      const videoIds = videos?.map((v: any) => v.id) || [];
      if (videoIds.length > 0) {
        await admin.from("watch_progress").delete().in("video_id", videoIds);
        await admin.from("view_events").delete().in("video_id", videoIds);
        await admin.from("video_events").delete().in("video_id", videoIds);
        await admin.from("video_reactions").delete().in("video_id", videoIds);
      }
      await admin.from("videos").delete().in("campaign_id", campaignIds);
      await admin.from("video_jobs").delete().in("campaign_id", campaignIds);
      await admin.from("approval_requests").delete().in("campaign_id", campaignIds);
      await admin.from("recipients").delete().in("campaign_id", campaignIds);
      await admin.from("viewer_relationships").delete().in("campaign_id", campaignIds);
      await admin.from("viewers").delete().in("campaign_id", campaignIds);
      await admin.from("deal_scores").delete().in("campaign_id", campaignIds);
      await admin.from("deal_outcomes").delete().in("campaign_id", campaignIds);
      await admin.from("recommendation_outcomes").delete().in("campaign_id", campaignIds);
      await admin.from("agent_conversations").delete().in("campaign_id", campaignIds);
      await admin.from("script_versions").delete().in("campaign_id", campaignIds);
    }
    await admin.from("campaigns").delete().eq("org_id", orgId);
    await admin.from("identities").delete().eq("org_id", orgId);
    await admin.from("providers").delete().eq("org_id", orgId);
    await admin.from("policies").delete().eq("org_id", orgId);
    await admin.from("audit_logs").delete().eq("org_id", orgId);
    await admin.from("templates").delete().eq("org_id", orgId);
    // Delete all memberships for this org (including exec)
    await admin.from("org_memberships").delete().eq("org_id", orgId);
    await admin.from("orgs").delete().eq("id", orgId);
  } else if (membership && email === DEMO_EXEC_EMAIL) {
    // Just remove exec's membership, profile — org data cleaned by sales account
    await admin.from("org_memberships").delete().eq("user_id", existing.id);
  }

  await admin.from("profiles").delete().eq("user_id", existing.id);
  await admin.auth.admin.deleteUser(existing.id);
  return existing.id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const DEMO_PASSWORD = Deno.env.get("DEMO_PASSWORD");
    if (!DEMO_PASSWORD) {
      return new Response(JSON.stringify({ error: "DEMO_PASSWORD secret not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Clean up both demo accounts
    await deleteUserAndData(admin, DEMO_EXEC_EMAIL);
    await deleteUserAndData(admin, DEMO_SALES_EMAIL);

    // 2. Create sales demo user
    const { data: salesUser, error: salesError } = await admin.auth.admin.createUser({
      email: DEMO_SALES_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (salesError) throw salesError;
    const salesUserId = salesUser.user.id;

    // 3. Create exec demo user
    const { data: execUser, error: execError } = await admin.auth.admin.createUser({
      email: DEMO_EXEC_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (execError) throw execError;
    const execUserId = execUser.user.id;

    // 4. Create org via handle_user_signup (for sales user)
    const { data: signupResult, error: signupError } = await admin.rpc("handle_user_signup", {
      p_user_id: salesUserId,
      p_email: DEMO_SALES_EMAIL,
      p_org_name: "Acme Corp",
    });
    if (signupError) throw signupError;
    const orgId = (signupResult as any).org_id;

    // 5. Add exec user to same org as org_admin
    await admin.from("org_memberships").insert({
      org_id: orgId,
      user_id: execUserId,
      role: "org_admin",
      is_active: true,
    });

    // 6. Create exec profile
    await admin.from("profiles").insert({
      user_id: execUserId,
      email: DEMO_EXEC_EMAIL,
      first_name: "Marc",
      last_name: "Lefevre",
      title: "CEO",
      company: "Acme Corp",
      onboarding_completed: true,
      onboarding_step: 5,
    });

    // 7. Update sales profile
    await admin.from("profiles").update({
      first_name: "Jean",
      last_name: "Dupont",
      title: "VP Sales",
      company: "Acme Corp",
      onboarding_completed: false,
      onboarding_step: 0,
    }).eq("user_id", salesUserId);

    // 8. Create sales identity
    const { data: salesIdentity } = await admin.from("identities").insert({
      org_id: orgId,
      owner_user_id: salesUserId,
      display_name: "Jean Dupont — VP Sales",
      type: "sales_rep",
      status: "ready",
      consent_given: true,
      consent_given_at: new Date().toISOString(),
      reference_video_duration: 45,
      is_shareable: false,
      metadata: { title: "VP Sales", company: "Acme Corp" },
    }).select().single();
    const salesIdentityId = salesIdentity!.id;

    await admin.from("profiles").update({ default_identity_id: salesIdentityId }).eq("user_id", salesUserId);

    // 9. Create exec identity (shareable, owned by exec user)
    const { data: execIdentity } = await admin.from("identities").insert({
      org_id: orgId,
      owner_user_id: execUserId,
      display_name: "Marc Lefevre — CEO",
      type: "executive",
      status: "ready",
      consent_given: true,
      consent_given_at: new Date().toISOString(),
      reference_video_duration: 38,
      is_shareable: true,
      metadata: { title: "CEO", company: "Acme Corp" },
    }).select().single();
    const execIdentityId = execIdentity!.id;

    await admin.from("profiles").update({ default_identity_id: execIdentityId }).eq("user_id", execUserId);

    const { data: provider } = await admin.from("providers").select("id").eq("org_id", orgId).single();
    const providerId = provider!.id;

    // ── ACCOUNT 1: TechVision ──────────────────────────────────────
    const techVisionMeta = {
      landingPageConfig: {
        logoUrl: null,
        brandColor: "#0f4c81",
        ctaText: "Réserver une démo",
        ctaUrl: "https://calendly.com/jean-dupont",
        headline: "Bonjour {{first_name}}, découvrez notre solution",
        subheadline: "Jean Dupont vous a préparé une vidéo personnalisée",
      },
    };

    const { data: tvParent } = await admin.from("campaigns").insert({
      org_id: orgId,
      identity_id: salesIdentityId,
      created_by_user_id: salesUserId,
      name: "TechVision",
      description: "Compte stratégique — Infrastructure cloud & data analytics. Décision attendue Q2 2026.",
      script: "",
      status: "completed",
      is_self_campaign: false,
      metadata: techVisionMeta,
    }).select().single();
    const tvParentId = tvParent!.id;

    // Sub-campaigns for TechVision
    const subCampaigns = [
      {
        name: "Réponse RFP — Infrastructure Cloud",
        description: "Vidéo personnalisée accompagnant notre réponse à l'appel d'offres infrastructure.",
        script: "Bonjour Sophie, suite à votre RFP sur l'infrastructure cloud, j'ai souhaité vous adresser ce message personnel. Notre plateforme répond précisément à vos 3 critères clés : scalabilité, sécurité zero-trust, et réduction des coûts de 40%.",
        status: "completed" as const,
        identity_id: salesIdentityId,
        recipients: [
          { first_name: "Sophie", last_name: "Martin", email: "sophie.martin@techvision.fr", company: "TechVision", variables: { industry: "SaaS", title: "CTO" } },
          { first_name: "Pierre", last_name: "Lefebvre", email: "pierre.lefebvre@techvision.fr", company: "TechVision", variables: { industry: "SaaS", title: "VP Engineering" } },
        ],
      },
      {
        name: "Relance décideurs Q1",
        description: "Relance personnalisée pour les décideurs qui n'ont pas encore répondu.",
        script: "Bonjour Thomas, je me permets de revenir vers vous suite à notre échange du mois dernier. Nous avons depuis lancé une nouvelle fonctionnalité de monitoring IA qui pourrait particulièrement intéresser TechVision.",
        status: "completed" as const,
        identity_id: salesIdentityId,
        recipients: [
          { first_name: "Thomas", last_name: "Dubois", email: "thomas.dubois@techvision.fr", company: "TechVision", variables: { industry: "SaaS", title: "Head of Sales" } },
        ],
      },
      {
        name: "Mot du CEO — Sponsor Deal",
        description: "Message du CEO pour renforcer la relation au niveau C-Level.",
        script: "Bonjour Marie, je suis Marc Lefevre, CEO d'Acme Corp. Je tenais personnellement à vous remercier pour la confiance que TechVision nous accorde. Notre partenariat est stratégique.",
        status: "completed" as const,
        identity_id: execIdentityId,
        recipients: [
          { first_name: "Marie", last_name: "Bernard", email: "marie.bernard@techvision.fr", company: "TechVision", variables: { industry: "SaaS", title: "CEO" } },
        ],
      },
      {
        name: "Invitation Tech Summit 2026",
        description: "Invitation VIP à notre événement annuel pour les clients premium.",
        script: "Bonjour Sophie, nous organisons le Tech Summit 2026 le 15 mars à Paris. En tant que partenaire privilégié, nous vous offrons une invitation VIP.",
        status: "generating" as const,
        identity_id: salesIdentityId,
        recipients: [
          { first_name: "Sophie", last_name: "Martin", email: "sophie.martin@techvision.fr", company: "TechVision", variables: { industry: "SaaS", title: "CTO" } },
          { first_name: "Camille", last_name: "Moreau", email: "camille.moreau@techvision.fr", company: "TechVision", variables: { industry: "SaaS", title: "COO" } },
        ],
      },
    ];

    const createdSubIds: string[] = [];

    for (const sub of subCampaigns) {
      const { data: subCampaign } = await admin.from("campaigns").insert({
        org_id: orgId,
        identity_id: sub.identity_id,
        created_by_user_id: salesUserId,
        parent_campaign_id: tvParentId,
        name: sub.name,
        description: sub.description,
        script: sub.script,
        status: sub.status,
        is_self_campaign: false,
        metadata: techVisionMeta,
        completed_at: sub.status === "completed" ? new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString() : null,
      }).select().single();

      createdSubIds.push(subCampaign!.id);

      const { data: recipients } = await admin.from("recipients").insert(
        sub.recipients.map((r) => ({ ...r, campaign_id: subCampaign!.id, org_id: orgId }))
      ).select();

      if (sub.status === "completed") {
        for (const recipient of recipients!) {
          const { data: job } = await admin.from("video_jobs").insert({
            org_id: orgId,
            campaign_id: subCampaign!.id,
            recipient_id: recipient.id,
            identity_id: sub.identity_id,
            provider_id: providerId,
            status: "completed",
            started_at: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
            completed_at: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
          }).select().single();

          const { data: video } = await admin.from("videos").insert({
            org_id: orgId,
            campaign_id: subCampaign!.id,
            recipient_id: recipient.id,
            video_job_id: job!.id,
            storage_path: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
            duration_seconds: 62,
            is_active: true,
            watermark_enabled: true,
            metadata: {
              hosted_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
            },
          }).select().single();

          const videoId = video!.id;

          const viewerProfiles = [
            {
              name: recipient.first_name + " " + recipient.last_name,
              email: recipient.email,
              title: (recipient.variables as any)?.title,
              company: recipient.company,
              hash: `v_${recipient.id.slice(0, 8)}`,
              watchPct: 75 + Math.floor(Math.random() * 25),
              sessions: 2 + Math.floor(Math.random() * 3),
            },
            ...(Math.random() > 0.4
              ? [{
                  name: "Collègue de " + recipient.first_name,
                  email: `collegue.${recipient.first_name?.toLowerCase()}@techvision.fr`,
                  title: "Product Manager",
                  company: "TechVision",
                  hash: `s_${recipient.id.slice(0, 8)}`,
                  watchPct: 30 + Math.floor(Math.random() * 40),
                  sessions: 1,
                }]
              : []),
          ];

          for (const viewer of viewerProfiles) {
            for (let s = 0; s < viewer.sessions; s++) {
              await admin.from("view_events").insert({
                video_id: videoId,
                viewer_hash: viewer.hash,
                viewer_name: viewer.name,
                viewer_email: viewer.email,
                referred_by_hash: viewer.hash.startsWith("s_") ? `v_${recipient.id.slice(0, 8)}` : null,
                user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
                country_code: "FR",
                viewed_at: new Date(Date.now() - (6 - s) * 24 * 3600 * 1000).toISOString(),
              });
            }

            await admin.from("watch_progress").insert({
              video_id: videoId,
              viewer_hash: viewer.hash,
              viewer_name: viewer.name,
              viewer_email: viewer.email,
              viewer_title: viewer.title,
              viewer_company: viewer.company,
              watch_percentage: viewer.watchPct,
              max_percentage_reached: viewer.watchPct,
              total_watch_seconds: Math.round((viewer.watchPct / 100) * 62),
              session_count: viewer.sessions,
              referred_by_hash: viewer.hash.startsWith("s_") ? `v_${recipient.id.slice(0, 8)}` : null,
              first_watched_at: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString(),
              last_watched_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
            });
          }
        }
      }
    }

    // ── ACCOUNT 2: DataFlow ──────────────────────────────────────
    const { data: dfParent } = await admin.from("campaigns").insert({
      org_id: orgId,
      identity_id: salesIdentityId,
      created_by_user_id: salesUserId,
      name: "DataFlow",
      description: "Prospect mid-market — Data analytics & BI. Premier contact initié via LinkedIn.",
      script: "",
      status: "draft",
      is_self_campaign: false,
      metadata: {},
    }).select().single();

    await admin.from("campaigns").insert({
      org_id: orgId,
      identity_id: salesIdentityId,
      created_by_user_id: salesUserId,
      parent_campaign_id: dfParent!.id,
      name: "Introduction produit",
      description: "Première prise de contact vidéo personnalisée pour DataFlow.",
      script: "Bonjour Alex, je me permets de vous contacter car j'ai vu que DataFlow cherchait à moderniser sa stack data.",
      status: "draft",
      is_self_campaign: false,
      metadata: {},
    });

    // ── Pending approval request (exec must approve) ──────────────
    const { data: execCampaign } = await admin.from("campaigns").insert({
      org_id: orgId,
      identity_id: execIdentityId,
      created_by_user_id: salesUserId,
      parent_campaign_id: tvParentId,
      name: "Engagement CEO — Sponsor Deal",
      description: "Message personnalisé du CEO pour réaffirmer l'engagement d'Acme Corp sur le deal TechVision.",
      script: "Bonjour Marie, je suis Marc Lefevre, CEO d'Acme Corp. Je souhaitais personnellement vous assurer de notre engagement total sur ce partenariat stratégique avec TechVision. Nos équipes sont mobilisées pour garantir le succès de cette collaboration.",
      status: "pending_approval",
      is_self_campaign: false,
      metadata: techVisionMeta,
    }).select().single();

    await admin.from("recipients").insert({
      org_id: orgId,
      campaign_id: execCampaign!.id,
      email: "marie.bernard@techvision.fr",
      first_name: "Marie",
      last_name: "Bernard",
      company: "TechVision",
      variables: { title: "CEO" },
    });

    // Approval assigned to EXEC user (not sales user)
    const { data: approvalReq } = await admin.from("approval_requests").insert({
      org_id: orgId,
      campaign_id: execCampaign!.id,
      requested_by_user_id: salesUserId,
      assigned_to_user_id: execUserId,
      approval_type: "script",
      script_snapshot: execCampaign!.script,
      status: "pending",
    }).select().single();

    // ── VIEWERS for TechVision (buying committee) ──────────────────
    const tvViewerProfiles = [
      { name: "Sophie Martin", email: "sophie.martin@techvision.fr", title: "CTO", company: "TechVision", status: "champion", contact_score: 92, sponsor_score: 85, influence_score: 78, blocker_score: 5, share_count: 3, viewers_generated: 2, total_watch_depth: 88, replay_count: 2, cta_clicked: true },
      { name: "Marie Bernard", email: "marie.bernard@techvision.fr", title: "CEO", company: "TechVision", status: "engaged", contact_score: 78, sponsor_score: 90, influence_score: 95, blocker_score: 0, share_count: 1, viewers_generated: 1, total_watch_depth: 72, replay_count: 1, cta_clicked: false },
      { name: "Pierre Lefebvre", email: "pierre.lefebvre@techvision.fr", title: "VP Engineering", company: "TechVision", status: "engaged", contact_score: 65, sponsor_score: 40, influence_score: 60, blocker_score: 10, share_count: 0, viewers_generated: 0, total_watch_depth: 55, replay_count: 0, cta_clicked: false },
      { name: "Thomas Dubois", email: "thomas.dubois@techvision.fr", title: "Head of Sales", company: "TechVision", status: "cold", contact_score: 30, sponsor_score: 15, influence_score: 45, blocker_score: 60, share_count: 0, viewers_generated: 0, total_watch_depth: 20, replay_count: 0, cta_clicked: false },
      { name: "Camille Moreau", email: "camille.moreau@techvision.fr", title: "COO", company: "TechVision", status: "new", contact_score: 45, sponsor_score: 30, influence_score: 50, blocker_score: 20, share_count: 0, viewers_generated: 0, total_watch_depth: 35, replay_count: 0, cta_clicked: false },
      { name: "Lucas Petit", email: "lucas.petit@techvision.fr", title: "CFO", company: "TechVision", status: "engaged", contact_score: 70, sponsor_score: 55, influence_score: 80, blocker_score: 35, share_count: 1, viewers_generated: 0, total_watch_depth: 60, replay_count: 1, cta_clicked: true },
    ];

    const createdViewerIds: string[] = [];
    for (const vp of tvViewerProfiles) {
      const { data: viewer } = await admin.from("viewers").insert({
        campaign_id: tvParentId,
        viewer_hash: `vh_${vp.email.split("@")[0]}`,
        name: vp.name,
        email: vp.email,
        title: vp.title,
        company: vp.company,
        domain: "techvision.fr",
        is_known: true,
        status: vp.status,
        contact_score: vp.contact_score,
        sponsor_score: vp.sponsor_score,
        influence_score: vp.influence_score,
        blocker_score: vp.blocker_score,
        share_count: vp.share_count,
        viewers_generated: vp.viewers_generated,
        total_watch_depth: vp.total_watch_depth,
        replay_count: vp.replay_count,
        cta_clicked: vp.cta_clicked,
        first_seen_at: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
        last_event_at: new Date(Date.now() - Math.floor(Math.random() * 3) * 24 * 3600 * 1000).toISOString(),
      }).select().single();
      if (viewer) createdViewerIds.push(viewer.id);
    }

    // Viewer relationships (Sophie forwarded to Pierre, Marie forwarded to Camille)
    if (createdViewerIds.length >= 5) {
      await admin.from("viewer_relationships").insert([
        { campaign_id: tvParentId, source_viewer_id: createdViewerIds[0], target_viewer_id: createdViewerIds[2], relationship_type: "forwarded", forward_probability: 0.92, evidence: { type: "referral_link" } },
        { campaign_id: tvParentId, source_viewer_id: createdViewerIds[1], target_viewer_id: createdViewerIds[4], relationship_type: "forwarded", forward_probability: 0.78, evidence: { type: "same_domain_timing" } },
      ]);
    }

    // ── DEAL SCORES for TechVision ──────────────────────────────────
    await admin.from("deal_scores").insert({
      campaign_id: tvParentId,
      des: 72,
      viewer_count: 6,
      sponsor_count: 2,
      blocker_count: 1,
      avg_watch_depth: 0.58,
      breadth: 0.65,
      event_velocity: 3.2,
      engagement_half_life: 4.5,
      multi_threading_score: 4,
      momentum: "rising",
      cold_start_regime: "warm",
      stage_signal_gap: 0.15,
      graph_centralization: 0.42,
      alerts: [
        { type: "blocker_detected", message: "Thomas Dubois — faible engagement, rôle décisionnel", severity: "warning" },
        { type: "champion_active", message: "Sophie Martin — 3 partages, replay vidéo CEO", severity: "positive" },
      ],
      recommended_action: { action: "schedule_exec_call", label: "Planifier un call exec avec Thomas Dubois", confidence: 0.73, reason: "Blocker détecté avec faible watch depth" },
    });

    // ── DEAL SCORE for DataFlow (cold) ──────────────────────────────
    await admin.from("deal_scores").insert({
      campaign_id: dfParent!.id,
      des: 28,
      viewer_count: 0,
      sponsor_count: 0,
      blocker_count: 0,
      avg_watch_depth: 0,
      breadth: 0,
      event_velocity: 0,
      momentum: "stable",
      cold_start_regime: "cold_global",
      alerts: [
        { type: "no_engagement", message: "Aucun engagement — deal froid", severity: "critical" },
      ],
      recommended_action: { action: "send_intro_video", label: "Envoyer vidéo d'introduction", confidence: 0.85, reason: "Premier contact, aucune donnée d'engagement" },
    });

    // ── VIDEO EVENTS (recent signals for dashboard) ──────────────────
    // Find a TechVision video to attach events to
    const { data: tvVideos } = await admin.from("videos").select("id, campaign_id").in("campaign_id", createdSubIds).limit(3);
    if (tvVideos && tvVideos.length > 0) {
      const recentEvents = [];
      const eventTypes = ["play", "watch_25", "watch_50", "watch_75", "watch_100", "cta_click", "share", "replay"];
      for (const vid of tvVideos) {
        for (let i = 0; i < 4; i++) {
          recentEvents.push({
            video_id: vid.id,
            campaign_id: vid.campaign_id,
            viewer_hash: `vh_sophie.martin`,
            event_type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
            viewer_email: "sophie.martin@techvision.fr",
            viewer_name: "Sophie Martin",
            viewer_domain: "techvision.fr",
            device_type: "desktop",
            ip_country: "FR",
            session_id: `sess_${Date.now()}_${i}`,
            created_at: new Date(Date.now() - Math.floor(Math.random() * 3 * 24 * 3600 * 1000)).toISOString(),
          });
        }
      }
      await admin.from("video_events").insert(recentEvents);
    }

    // Configure Slack channel for the org (tous-getekko)
    const currentOrgSettings = (await admin.from("orgs").select("settings").eq("id", orgId).single()).data?.settings || {};
    await admin.from("orgs").update({
      settings: { ...(currentOrgSettings as Record<string, any>), slack_channel_id: "C0AK31ESJJ1" },
    }).eq("id", orgId);

    // Update exec profile to receive notifications via slack + email
    await admin.from("profiles").update({
      notification_channels: ["email", "slack"],
    }).eq("user_id", execUserId);

    // Trigger Slack notification for the approval
    let slackResult = null;
    if (approvalReq) {
      try {
        const notifyRes = await fetch(`${supabaseUrl}/functions/v1/notify-approval`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ approval_id: approvalReq.id }),
        });
        slackResult = await notifyRes.json();
      } catch {
        console.error("Notify failed");
        slackResult = { error: "notification failed" };
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Comptes démo créés — notification Slack envoyée",
        accounts: {
          sales: { email: DEMO_SALES_EMAIL, role: "org_owner", name: "Jean Dupont — VP Sales" },
          exec: { email: DEMO_EXEC_EMAIL, role: "org_admin", name: "Marc Lefevre — CEO" },
        },
        org: { name: "Acme Corp", id: orgId },
        notifications: slackResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Seed demo error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
