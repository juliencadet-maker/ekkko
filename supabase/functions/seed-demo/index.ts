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
      // Clean up data first
      const { data: profile } = await admin
        .from("profiles")
        .select("*")
        .eq("user_id", existingDemo.id)
        .maybeSingle();

      if (profile) {
        const { data: membership } = await admin
          .from("org_memberships")
          .select("org_id")
          .eq("user_id", existingDemo.id)
          .maybeSingle();

        if (membership) {
          const orgId = membership.org_id;
          // Delete in order: watch_progress, view_events, videos, video_jobs, recipients, campaigns, identities, providers, policies, org_memberships, profiles, orgs
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

    // 4. Update profile - keep onboarding_completed = false so user can demo onboarding
    // But we need a second "completed" state for the seeded data
    // Strategy: leave onboarding incomplete so user demos it first, then sees pre-seeded data
    await admin.from("profiles").update({
      first_name: "Jean",
      last_name: "Dupont",
      title: "VP Sales",
      company: "Acme Corp",
      onboarding_completed: false,
      onboarding_step: 0,
    }).eq("user_id", userId);

    // 5. Create a ready identity (will be visible after onboarding)
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

    // Link default identity to profile
    await admin.from("profiles").update({ default_identity_id: identityId }).eq("user_id", userId);

    // 6. Get provider
    const { data: provider } = await admin.from("providers").select("id").eq("org_id", orgId).single();
    const providerId = provider!.id;

    // 7. Create a completed demo campaign with landing page config and analytics
    const campaignMetadata = {
      landingPageConfig: {
        logoUrl: null,
        brandColor: "#1e3a5f",
        ctaText: "Réserver une démo",
        ctaUrl: "https://calendly.com/jean-dupont",
        headline: "Bonjour {{first_name}}, découvrez notre solution",
        subheadline: "Jean Dupont vous a préparé une vidéo personnalisée",
      },
    };

    const { data: campaign } = await admin.from("campaigns").insert({
      org_id: orgId,
      identity_id: identityId,
      created_by_user_id: userId,
      name: "Outreach Q1 — Série C Prospects",
      description: "Campagne de prospection ciblant les décideurs tech pour la série C. Vidéos personnalisées avec mention du nom, poste et entreprise du prospect.",
      script: "Bonjour {{first_name}}, je suis Jean Dupont, VP Sales chez Acme Corp. J'ai remarqué que {{company}} est en pleine croissance dans le secteur {{industry}}. J'aimerais vous montrer comment notre plateforme pourrait vous aider à accélérer vos ventes de 40% en 3 mois. Seriez-vous disponible pour un échange de 15 minutes cette semaine ?",
      status: "completed",
      is_self_campaign: false,
      metadata: campaignMetadata,
      completed_at: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
    }).select().single();
    const campaignId = campaign!.id;

    // 8. Create recipients
    const recipientData = [
      { first_name: "Sophie", last_name: "Martin", email: "sophie.martin@techvision.fr", company: "TechVision", variables: { industry: "SaaS", title: "CTO" } },
      { first_name: "Pierre", last_name: "Lefebvre", email: "pierre.lefebvre@dataflow.io", company: "DataFlow", variables: { industry: "Data Analytics", title: "VP Engineering" } },
      { first_name: "Marie", last_name: "Bernard", email: "marie.bernard@cloudnext.com", company: "CloudNext", variables: { industry: "Cloud Infrastructure", title: "CEO" } },
      { first_name: "Thomas", last_name: "Dubois", email: "thomas.dubois@growthlab.fr", company: "GrowthLab", variables: { industry: "Growth Marketing", title: "Head of Sales" } },
      { first_name: "Camille", last_name: "Moreau", email: "camille.moreau@finscale.io", company: "FinScale", variables: { industry: "FinTech", title: "COO" } },
    ];

    const { data: recipients } = await admin.from("recipients").insert(
      recipientData.map((r) => ({ ...r, campaign_id: campaignId, org_id: orgId }))
    ).select();

    // 9. Create video jobs & videos for each recipient
    for (const recipient of recipients!) {
      const { data: job } = await admin.from("video_jobs").insert({
        org_id: orgId,
        campaign_id: campaignId,
        recipient_id: recipient.id,
        identity_id: identityId,
        provider_id: providerId,
        status: "completed",
        started_at: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
        completed_at: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
      }).select().single();

      const { data: video } = await admin.from("videos").insert({
        org_id: orgId,
        campaign_id: campaignId,
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

      // 10. Create fake view events & watch progress for analytics
      const viewerProfiles = [
        { name: recipient.first_name + " " + recipient.last_name, email: recipient.email, title: (recipient.variables as any)?.title, company: recipient.company, hash: `v_${recipient.id.slice(0, 8)}`, watchPct: 75 + Math.floor(Math.random() * 25), sessions: 2 + Math.floor(Math.random() * 3) },
        // Add a "shared" viewer for some recipients (simulating virality)
        ...(Math.random() > 0.4
          ? [{
              name: "Collègue de " + recipient.first_name,
              email: `collegue.${recipient.first_name?.toLowerCase()}@${recipient.company?.toLowerCase().replace(/\s/g, "")}.com`,
              title: "Product Manager",
              company: recipient.company,
              hash: `s_${recipient.id.slice(0, 8)}`,
              watchPct: 30 + Math.floor(Math.random() * 40),
              sessions: 1,
            }]
          : []),
      ];

      for (const viewer of viewerProfiles) {
        // View events
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

        // Watch progress
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

    return new Response(
      JSON.stringify({
        success: true,
        message: "Compte démo créé avec succès",
        credentials: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
        campaign_id: campaignId,
        landing_page_url: `${supabaseUrl.replace('.supabase.co', '')}/landing/${campaignId}`,
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
