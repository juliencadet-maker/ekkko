import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEMO_EMAIL = "demo@ekko.app";
const DEMO_PASSWORD = "Demo2024!";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Delete existing demo user if exists
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    const existingDemo = existingUsers?.users?.find((u: any) => u.email === DEMO_EMAIL);
    if (existingDemo) {
      const { data: membership } = await admin
        .from("org_memberships")
        .select("org_id")
        .eq("user_id", existingDemo.id)
        .maybeSingle();

      if (membership) {
        const orgId = membership.org_id;
        const { data: campaigns } = await admin.from("campaigns").select("id").eq("org_id", orgId);
        const campaignIds = campaigns?.map((c: any) => c.id) || [];

        if (campaignIds.length > 0) {
          const { data: videos } = await admin.from("videos").select("id").in("campaign_id", campaignIds);
          const videoIds = videos?.map((v: any) => v.id) || [];
          if (videoIds.length > 0) {
            await admin.from("watch_progress").delete().in("video_id", videoIds);
            await admin.from("view_events").delete().in("video_id", videoIds);
          }
          await admin.from("videos").delete().in("campaign_id", campaignIds);
          await admin.from("video_jobs").delete().in("campaign_id", campaignIds);
          await admin.from("approval_requests").delete().in("campaign_id", campaignIds);
          await admin.from("recipients").delete().in("campaign_id", campaignIds);
        }
        await admin.from("campaigns").delete().eq("org_id", orgId);
        await admin.from("identities").delete().eq("org_id", orgId);
        await admin.from("providers").delete().eq("org_id", orgId);
        await admin.from("policies").delete().eq("org_id", orgId);
        await admin.from("audit_logs").delete().eq("org_id", orgId);
        await admin.from("org_memberships").delete().eq("org_id", orgId);
        await admin.from("profiles").delete().eq("user_id", existingDemo.id);
        await admin.from("orgs").delete().eq("id", orgId);
      }
      await admin.auth.admin.deleteUser(existingDemo.id);
    }

    // 2. Create demo user
    const { data: newUser, error: userError } = await admin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (userError) throw userError;
    const userId = newUser.user.id;

    // 3. Create org via handle_user_signup
    const { data: signupResult, error: signupError } = await admin.rpc("handle_user_signup", {
      p_user_id: userId,
      p_email: DEMO_EMAIL,
      p_org_name: "Acme Corp",
    });
    if (signupError) throw signupError;
    const orgId = (signupResult as any).org_id;

    // 4. Update profile
    await admin.from("profiles").update({
      first_name: "Jean",
      last_name: "Dupont",
      title: "VP Sales",
      company: "Acme Corp",
      onboarding_completed: false,
      onboarding_step: 0,
    }).eq("user_id", userId);

    // 5. Create identity
    const { data: identity } = await admin.from("identities").insert({
      org_id: orgId,
      owner_user_id: userId,
      display_name: "Jean Dupont",
      type: "executive",
      status: "ready",
      consent_given: true,
      consent_given_at: new Date().toISOString(),
      reference_video_duration: 45,
      metadata: { title: "VP Sales", company: "Acme Corp" },
    }).select().single();
    const identityId = identity!.id;

    await admin.from("profiles").update({ default_identity_id: identityId }).eq("user_id", userId);

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
      identity_id: identityId,
      created_by_user_id: userId,
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
        description: "Vidéo personnalisée accompagnant notre réponse à l'appel d'offres infrastructure. Ciblage CTO et VP Eng.",
        script: "Bonjour {{first_name}}, suite à votre RFP sur l'infrastructure cloud, j'ai souhaité vous adresser ce message personnel. Notre plateforme répond précisément à vos 3 critères clés : scalabilité, sécurité zero-trust, et réduction des coûts de 40%. J'aimerais vous en faire la démonstration.",
        status: "completed" as const,
        recipients: [
          { first_name: "Sophie", last_name: "Martin", email: "sophie.martin@techvision.fr", company: "TechVision", variables: { industry: "SaaS", title: "CTO" } },
          { first_name: "Pierre", last_name: "Lefebvre", email: "pierre.lefebvre@techvision.fr", company: "TechVision", variables: { industry: "SaaS", title: "VP Engineering" } },
        ],
      },
      {
        name: "Relance décideurs Q1",
        description: "Relance personnalisée pour les décideurs qui n'ont pas encore répondu après la démo initiale.",
        script: "Bonjour {{first_name}}, je me permets de revenir vers vous suite à notre échange du mois dernier. Nous avons depuis lancé une nouvelle fonctionnalité de monitoring IA qui pourrait particulièrement intéresser {{company}}. Seriez-vous disponible pour un point de 15 minutes ?",
        status: "completed" as const,
        recipients: [
          { first_name: "Thomas", last_name: "Dubois", email: "thomas.dubois@techvision.fr", company: "TechVision", variables: { industry: "SaaS", title: "Head of Sales" } },
          { first_name: "Marie", last_name: "Bernard", email: "marie.bernard@techvision.fr", company: "TechVision", variables: { industry: "SaaS", title: "CEO" } },
        ],
      },
      {
        name: "Mot de notre président",
        description: "Message du président d'Acme Corp pour renforcer la relation au niveau C-Level.",
        script: "Bonjour {{first_name}}, je suis Jean Dupont, président d'Acme Corp. Je tenais personnellement à vous remercier pour la confiance que TechVision nous accorde. Notre partenariat est stratégique et je m'engage à ce que nos équipes vous offrent le meilleur service possible.",
        status: "completed" as const,
        recipients: [
          { first_name: "Marie", last_name: "Bernard", email: "marie.bernard@techvision.fr", company: "TechVision", variables: { industry: "SaaS", title: "CEO" } },
        ],
      },
      {
        name: "Invitation Tech Summit 2026",
        description: "Invitation VIP à notre événement annuel Tech Summit pour les clients premium.",
        script: "Bonjour {{first_name}}, nous organisons le Tech Summit 2026 le 15 mars à Paris. En tant que partenaire privilégié, nous vous offrons une invitation VIP incluant l'accès aux keynotes, ateliers exclusifs et dîner networking. Confirmez votre présence !",
        status: "generating" as const,
        recipients: [
          { first_name: "Sophie", last_name: "Martin", email: "sophie.martin@techvision.fr", company: "TechVision", variables: { industry: "SaaS", title: "CTO" } },
          { first_name: "Camille", last_name: "Moreau", email: "camille.moreau@techvision.fr", company: "TechVision", variables: { industry: "SaaS", title: "COO" } },
          { first_name: "Thomas", last_name: "Dubois", email: "thomas.dubois@techvision.fr", company: "TechVision", variables: { industry: "SaaS", title: "Head of Sales" } },
        ],
      },
    ];

    const createdSubIds: string[] = [];

    for (const sub of subCampaigns) {
      const { data: subCampaign } = await admin.from("campaigns").insert({
        org_id: orgId,
        identity_id: identityId,
        created_by_user_id: userId,
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

      // Create recipients
      const { data: recipients } = await admin.from("recipients").insert(
        sub.recipients.map((r) => ({ ...r, campaign_id: subCampaign!.id, org_id: orgId }))
      ).select();

      // Create video jobs & videos & analytics for completed sub-campaigns
      if (sub.status === "completed") {
        for (const recipient of recipients!) {
          const { data: job } = await admin.from("video_jobs").insert({
            org_id: orgId,
            campaign_id: subCampaign!.id,
            recipient_id: recipient.id,
            identity_id: identityId,
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

          // Fake analytics
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

    // ── ACCOUNT 2: DataFlow (smaller, for variety) ──────────────────
    const { data: dfParent } = await admin.from("campaigns").insert({
      org_id: orgId,
      identity_id: identityId,
      created_by_user_id: userId,
      name: "DataFlow",
      description: "Prospect mid-market — Data analytics & BI. Premier contact initié via LinkedIn.",
      script: "",
      status: "draft",
      is_self_campaign: false,
      metadata: {},
    }).select().single();

    await admin.from("campaigns").insert({
      org_id: orgId,
      identity_id: identityId,
      created_by_user_id: userId,
      parent_campaign_id: dfParent!.id,
      name: "Introduction produit",
      description: "Première prise de contact vidéo personnalisée pour DataFlow.",
      script: "Bonjour {{first_name}}, je me permets de vous contacter car j'ai vu que DataFlow cherchait à moderniser sa stack data. Notre solution pourrait vous intéresser.",
      status: "draft",
      is_self_campaign: false,
      metadata: {},
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Compte démo créé avec succès — structure hiérarchique",
        credentials: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
        accounts: [
          { name: "TechVision", id: tvParentId, sub_campaigns: createdSubIds.length },
          { name: "DataFlow", id: dfParent!.id, sub_campaigns: 1 },
        ],
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
