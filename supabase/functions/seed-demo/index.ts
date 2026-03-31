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

    // ── ACCOUNT 1: TotalEnergies ──────────────────────────────────────
    const totalEnergiesMeta = {
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
      name: "TotalEnergies",
      description: "Compte stratégique — Transformation digitale & efficacité opérationnelle. Décision attendue Q2 2026.",
      script: "",
      status: "completed",
      is_self_campaign: false,
      metadata: totalEnergiesMeta,
    }).select().single();
    const tvParentId = tvParent!.id;

    // Sub-campaigns for TotalEnergies
    const subCampaigns = [
      {
        name: "Réponse RFP — Plateforme Data",
        description: "Vidéo personnalisée accompagnant notre réponse à l'appel d'offres data.",
        script: "Bonjour Sophie, suite à votre RFP sur la plateforme data, j'ai souhaité vous adresser ce message personnel. Notre solution répond précisément à vos 3 critères clés : scalabilité, sécurité zero-trust, et réduction des coûts de 40%.",
        status: "completed" as const,
        identity_id: salesIdentityId,
        recipients: [
          { first_name: "Sophie", last_name: "Renard", email: "sophie.renard@totalenergies.fr", company: "TotalEnergies", variables: { industry: "Énergie", title: "DRH" } },
          { first_name: "Marc", last_name: "Duval", email: "marc.duval@totalenergies.fr", company: "TotalEnergies", variables: { industry: "Énergie", title: "COO" } },
        ],
      },
      {
        name: "Relance décideurs Q1",
        description: "Relance personnalisée pour les décideurs qui n'ont pas encore répondu.",
        script: "Bonjour Pierre, je me permets de revenir vers vous suite à notre échange du mois dernier. Nous avons depuis lancé une nouvelle fonctionnalité qui pourrait particulièrement intéresser TotalEnergies.",
        status: "completed" as const,
        identity_id: salesIdentityId,
        recipients: [
          { first_name: "Pierre", last_name: "Blanc", email: "pierre.blanc@totalenergies.fr", company: "TotalEnergies", variables: { industry: "Énergie", title: "CFO" } },
        ],
      },
      {
        name: "Mot du CEO — Sponsor Deal",
        description: "Message du CEO pour renforcer la relation au niveau C-Level.",
        script: "Bonjour Sophie, je suis Marc Lefevre, CEO d'Acme Corp. Je tenais personnellement à vous remercier pour la confiance que TotalEnergies nous accorde.",
        status: "completed" as const,
        identity_id: execIdentityId,
        recipients: [
          { first_name: "Sophie", last_name: "Renard", email: "sophie.renard@totalenergies.fr", company: "TotalEnergies", variables: { industry: "Énergie", title: "DRH" } },
        ],
      },
      {
        name: "Invitation Executive Briefing",
        description: "Invitation VIP à notre événement annuel pour les clients premium.",
        script: "Bonjour Marc, nous organisons un Executive Briefing le 15 mars à Paris. En tant que partenaire privilégié, nous vous offrons une invitation VIP.",
        status: "generating" as const,
        identity_id: salesIdentityId,
        recipients: [
          { first_name: "Marc", last_name: "Duval", email: "marc.duval@totalenergies.fr", company: "TotalEnergies", variables: { industry: "Énergie", title: "COO" } },
          { first_name: "Thomas", last_name: "Girard", email: "thomas.girard@totalenergies.fr", company: "TotalEnergies", variables: { industry: "Énergie", title: "DSI" } },
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
        metadata: totalEnergiesMeta,
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
                  email: `collegue.${recipient.first_name?.toLowerCase()}@totalenergies.fr`,
                  title: "Product Manager",
                  company: "TotalEnergies",
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

    // ── ACCOUNT 2: Schneider Electric ──────────────────────────────────────
    const { data: schneiderParent } = await admin.from("campaigns").insert({
      org_id: orgId,
      identity_id: salesIdentityId,
      created_by_user_id: salesUserId,
      name: "Schneider Electric — ERP",
      description: "Modernisation ERP — migration SAP vers solution cloud. Sponsor identifié côté achats.",
      script: "",
      status: "completed",
      is_self_campaign: false,
      metadata: {},
    }).select().single();

    // ── ACCOUNT 3: Airbus ──────────────────────────────────────
    const { data: airbusParent } = await admin.from("campaigns").insert({
      org_id: orgId,
      identity_id: salesIdentityId,
      created_by_user_id: salesUserId,
      name: "Airbus — Transformation SI",
      description: "Transformation SI — refonte de l'architecture applicative. Comité d'achat mobilisé.",
      script: "",
      status: "completed",
      is_self_campaign: false,
      metadata: {},
    }).select().single();

    // ── Pending approval request (exec must approve) ──────────────
    const { data: execCampaign } = await admin.from("campaigns").insert({
      org_id: orgId,
      identity_id: execIdentityId,
      created_by_user_id: salesUserId,
      parent_campaign_id: tvParentId,
      name: "Engagement CEO — Sponsor Deal",
      description: "Message personnalisé du CEO pour réaffirmer l'engagement d'Acme Corp sur le deal TotalEnergies.",
      script: "Bonjour Sophie, je suis Marc Lefevre, CEO d'Acme Corp. Je souhaitais personnellement vous assurer de notre engagement total sur ce partenariat stratégique avec TotalEnergies. Nos équipes sont mobilisées pour garantir le succès de cette collaboration.",
      status: "pending_approval",
      is_self_campaign: false,
      metadata: totalEnergiesMeta,
    }).select().single();

    await admin.from("recipients").insert({
      org_id: orgId,
      campaign_id: execCampaign!.id,
      email: "sophie.renard@totalenergies.fr",
      first_name: "Sophie",
      last_name: "Renard",
      company: "TotalEnergies",
      variables: { title: "DRH" },
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

    // ── VIEWERS for TotalEnergies (buying committee) ──────────────────
    const tvViewerProfiles = [
      { name: "Sophie Renard", email: "sophie.renard@totalenergies.fr", title: "DRH", company: "TotalEnergies", status: "sponsor_actif", contact_score: 92, sponsor_score: 85, influence_score: 78, blocker_score: 5, share_count: 3, viewers_generated: 2, total_watch_depth: 88, replay_count: 2, cta_clicked: true, is_known: true, last_event_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString() },
      { name: "Marc Duval", email: "marc.duval@totalenergies.fr", title: "COO", company: "TotalEnergies", status: "sponsor_actif", contact_score: 78, sponsor_score: 70, influence_score: 65, blocker_score: 0, share_count: 1, viewers_generated: 1, total_watch_depth: 72, replay_count: 1, cta_clicked: false, is_known: true, last_event_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString() },
      { name: "Pierre Blanc", email: "pierre.blanc@totalenergies.fr", title: "CFO", company: "TotalEnergies", status: "neutre", contact_score: 38, sponsor_score: 15, influence_score: 40, blocker_score: 20, share_count: 0, viewers_generated: 0, total_watch_depth: 45, replay_count: 0, cta_clicked: false, is_known: true, last_event_at: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString() },
      { name: "Thomas Girard", email: "thomas.girard@totalenergies.fr", title: "DSI", company: "TotalEnergies", status: "bloqueur_potentiel", contact_score: 18, sponsor_score: 0, influence_score: 30, blocker_score: 80, share_count: 0, viewers_generated: 0, total_watch_depth: 8, replay_count: 0, cta_clicked: false, is_known: true, last_event_at: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString() },
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
        domain: "totalenergies.fr",
        is_known: vp.is_known,
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
        last_event_at: vp.last_event_at,
      }).select().single();
      if (viewer) createdViewerIds.push(viewer.id);
    }

    // Unknown contact
    await admin.from("viewers").insert({
      campaign_id: tvParentId,
      viewer_hash: "unknown_1",
      name: null,
      email: null,
      title: null,
      company: null,
      domain: null,
      is_known: false,
      status: "inconnu",
      contact_score: 52,
      sponsor_score: 0,
      influence_score: 20,
      blocker_score: 10,
      share_count: 0,
      viewers_generated: 0,
      total_watch_depth: 60,
      replay_count: 1,
      cta_clicked: false,
      first_seen_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
      last_event_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
    });

    // Viewer relationships (Sophie forwarded to Marc)
    if (createdViewerIds.length >= 2) {
      await admin.from("viewer_relationships").insert([
        { campaign_id: tvParentId, source_viewer_id: createdViewerIds[0], target_viewer_id: createdViewerIds[1], relationship_type: "forwarded", forward_probability: 0.92, evidence: { type: "referral_link" } },
      ]);
    }

    // ── DEAL SCORES for TotalEnergies ──────────────────────────────────
    await admin.from("deal_scores").insert({
      campaign_id: tvParentId,
      des: 54,
      viewer_count: 5,
      sponsor_count: 2,
      blocker_count: 1,
      avg_watch_depth: 55,
      breadth: 60,
      event_velocity: 2,
      multi_threading_score: 3,
      momentum: "declining",
      cold_start_regime: "warm_account",
      risk_level: "critical",
      priority_score: 78,
      days_since_last_signal: 12,
      alerts: [
        { type: "danger", text: "Thomas Girard — bloqueur potentiel (score 80)" },
        { type: "warning", text: "Pierre Blanc — silence depuis 12 jours" },
        { type: "info", text: "Sophie Renard — champion actif, 3 partages" },
      ],
      recommended_action: { action: "address_blockers", label: "Traiter les bloqueurs — DSI non engagé", confidence: 0.82 },
    });

    // ── DEAL SCORE for Schneider Electric ──────────────────────────────
    await admin.from("deal_scores").insert({
      campaign_id: schneiderParent!.id,
      des: 71,
      viewer_count: 3,
      sponsor_count: 1,
      blocker_count: 0,
      avg_watch_depth: 62,
      breadth: 45,
      event_velocity: 4,
      multi_threading_score: 2,
      momentum: "stable",
      cold_start_regime: "cold_account",
      risk_level: "watch",
      priority_score: 45,
      days_since_last_signal: 3,
      alerts: [
        { type: "warning", text: "Sponsor unique — comité encore étroit" },
      ],
      recommended_action: { action: "expand_committee", label: "Élargir le buying committee", confidence: 0.7 },
    });

    // ── DEAL SCORE for Airbus ──────────────────────────────────
    await admin.from("deal_scores").insert({
      campaign_id: airbusParent!.id,
      des: 87,
      viewer_count: 4,
      sponsor_count: 2,
      blocker_count: 0,
      avg_watch_depth: 78,
      breadth: 75,
      event_velocity: 8,
      multi_threading_score: 4,
      momentum: "rising",
      cold_start_regime: "warm_account",
      risk_level: "healthy",
      priority_score: 20,
      days_since_last_signal: 1,
      alerts: [
        { type: "info", text: "Signaux favorables — pousser vers la clôture" },
      ],
      recommended_action: { action: "push_for_close", label: "Pousser vers la clôture — signaux favorables", confidence: 0.88 },
    });

    // ── VIDEO EVENTS (recent signals for dashboard) ──────────────────
    const { data: tvVideos } = await admin.from("videos").select("id, campaign_id").in("campaign_id", createdSubIds).limit(3);
    if (tvVideos && tvVideos.length > 0) {
      const recentEvents = [];
      const eventTypes = ["play", "watch_25", "watch_50", "watch_75", "watch_100", "cta_click", "share", "replay"];
      for (const vid of tvVideos) {
        for (let i = 0; i < 4; i++) {
          recentEvents.push({
            video_id: vid.id,
            campaign_id: vid.campaign_id,
            viewer_hash: `vh_sophie.renard`,
            event_type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
            viewer_email: "sophie.renard@totalenergies.fr",
            viewer_name: "Sophie Renard",
            viewer_domain: "totalenergies.fr",
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
