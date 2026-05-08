import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_SHARE_MODES = ["direct", "email", "slack", "whatsapp"];
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const siteUrl = Deno.env.get("SITE_URL") || "https://getekko.eu";

  try {
    // ── Étape 1 : Auth JWT ──────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader)
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // ── Étape 2 : Validation inputs ─────────────────────────────────
    const body = await req.json();
    const {
      campaign_id,
      asset_id,
      share_mode = "direct",
      recipient_email,
      recipient_source,
    } = body;

    if (!campaign_id || !UUID_REGEX.test(campaign_id))
      return new Response(
        JSON.stringify({ error: "Valid campaign_id (UUID) required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );

    if (!asset_id || !UUID_REGEX.test(asset_id))
      return new Response(
        JSON.stringify({ error: "Valid asset_id (UUID) required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );

    if (!ALLOWED_SHARE_MODES.includes(share_mode))
      return new Response(
        JSON.stringify({
          error: `share_mode must be one of: ${ALLOWED_SHARE_MODES.join(", ")}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );

    // recipient_email optionnel — si invalide → null, ne pas bloquer
    const safeRecipientEmail =
      typeof recipient_email === "string" &&
      EMAIL_REGEX.test(recipient_email.trim())
        ? recipient_email.trim().toLowerCase()
        : null;

    // recipient_source optionnel — "suggested" | "manual" sinon null
    const safeRecipientSource =
      recipient_source === "suggested" || recipient_source === "manual"
        ? recipient_source
        : null;

    // ── Étape 3 : Vérification accès org ─────────────────────────────
    const { data: campaign, error: campaignError } = await userClient
      .from("campaigns")
      .select("org_id")
      .eq("id", campaign_id)
      .single();
    if (campaignError || !campaign)
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const { data: membership } = await userClient
      .from("org_memberships")
      .select("id")
      .eq("org_id", campaign.org_id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!membership)
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // ── Étape 4 : Vérification asset ∈ campaign ET valid ─────────────
    const { data: asset, error: assetError } = await userClient
      .from("deal_assets")
      .select("id, asset_status, asset_purpose, asset_type")
      .eq("id", asset_id)
      .eq("campaign_id", campaign_id)
      .eq("asset_status", "active")
      .maybeSingle();

    if (assetError || !asset)
      return new Response(
        JSON.stringify({
          error:
            "asset_id does not belong to this campaign or is not valid",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );

    // ── Étape 5 : INSERT asset_deliveries (legacy delivery tracking) ──
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const delivery_token = crypto.randomUUID();

    const { error: insertError } = await adminClient
      .from("asset_deliveries")
      .insert({
        campaign_id,
        asset_id,
        delivery_token,
        sent_at: new Date().toISOString(),
        share_mode,
        recipient_email: safeRecipientEmail,
        asset_purpose: asset.asset_purpose,
        recipient_source: safeRecipientSource,
      });

    if (insertError) {
      console.error("[create-tracked-link] Insert failed:", insertError);
      await adminClient
        .from("system_failures")
        .insert({
          campaign_id,
          failure_type: "execution",
          severity: "low",
          message: "create-tracked-link insert failed",
          reason: insertError.message,
        })
        .catch(() => {});
      return new Response(
        JSON.stringify({ success: false, error: "insert_failed" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const tracked_url = `${siteUrl}/lp/${campaign_id}?ref=${delivery_token}`;

    // ── Phase 1c-2 R2 (D54+D57) : double-write canonique + JSONB legacy ──
    // Idempotence via UNIQUE(deal_asset_id, target_url) WHERE archived_at IS NULL.
    // Si conflit -> on récupère le link_token existant (idempotent).
    const link_label =
      typeof body.link_label === "string" && body.link_label.trim().length > 0
        ? body.link_label.trim().slice(0, 200)
        : null;

    let canonical_link_token = delivery_token;
    let canonical_inserted = false;

    const { data: canonicalInsert, error: canonicalErr } = await adminClient
      .from("asset_tracked_links")
      .insert({
        org_id: campaign.org_id,
        campaign_id,
        deal_asset_id: asset_id,
        link_token: delivery_token,
        target_url: tracked_url,
        link_label,
        created_by_user_id: user.id,
      })
      .select("link_token")
      .maybeSingle();

    if (canonicalErr) {
      // 23505 = unique_violation -> idempotent : fetch existing
      if ((canonicalErr as { code?: string }).code === "23505") {
        const { data: existing } = await adminClient
          .from("asset_tracked_links")
          .select("link_token")
          .eq("deal_asset_id", asset_id)
          .eq("target_url", tracked_url)
          .is("archived_at", null)
          .maybeSingle();
        if (existing?.link_token) {
          canonical_link_token = existing.link_token;
          console.log(
            `[create-tracked-link] canonical_idempotent_hit asset=${asset_id} token=${canonical_link_token}`,
          );
        }
      } else {
        console.error("[create-tracked-link] canonical_insert_failed:", canonicalErr);
        await adminClient
          .from("system_failures")
          .insert({
            campaign_id,
            failure_type: "execution",
            severity: "low",
            message: "create-tracked-link canonical insert failed",
            reason: canonicalErr.message,
          })
          .catch(() => {});
      }
    } else if (canonicalInsert?.link_token) {
      canonical_link_token = canonicalInsert.link_token;
      canonical_inserted = true;
      console.log(
        `[create-tracked-link] canonical_insert asset=${asset_id} token=${canonical_link_token} target=${tracked_url}`,
      );
    }

    // Legacy JSONB append on deal_assets.tracked_links (best-effort, non bloquant)
    try {
      const { data: assetRow } = await adminClient
        .from("deal_assets")
        .select("tracked_links")
        .eq("id", asset_id)
        .maybeSingle();

      const current = (assetRow?.tracked_links ?? {}) as Record<string, unknown>;
      const list = Array.isArray((current as { links?: unknown }).links)
        ? ((current as { links: unknown[] }).links as Array<Record<string, unknown>>)
        : [];

      const alreadyPresent = list.some(
        (entry) =>
          entry &&
          typeof entry === "object" &&
          (entry as { token?: string }).token === canonical_link_token,
      );

      if (!alreadyPresent) {
        list.push({
          token: canonical_link_token,
          target_url: tracked_url,
          created_at: new Date().toISOString(),
        });
        const { error: legacyErr } = await adminClient
          .from("deal_assets")
          .update({ tracked_links: { ...current, links: list } })
          .eq("id", asset_id);
        if (legacyErr) {
          console.error("[create-tracked-link] legacy_jsonb_failed:", legacyErr);
        } else {
          console.log(
            `[create-tracked-link] legacy_jsonb_append asset=${asset_id} token=${canonical_link_token}`,
          );
        }
      } else {
        console.log(
          `[create-tracked-link] legacy_jsonb_idempotent_skip asset=${asset_id} token=${canonical_link_token}`,
        );
      }
    } catch (e) {
      console.error("[create-tracked-link] legacy_jsonb_unexpected:", e);
    }

    void canonical_inserted;

    // ── Phase 0 : Event tracking link_generated (fire-and-forget) ─────────
    // Ne jamais await — ne jamais bloquer la réponse principale
    adminClient.from("audit_logs").insert({
      event_type: "link_generated",
      user_id: user.id,
      entity_id: campaign_id,
      entity_type: "campaign",
      org_id: campaign.org_id,
      metadata: {
        asset_id,
        asset_purpose: asset.asset_purpose ?? null,
        asset_type: asset.asset_type ?? null,
        share_mode,
        recipient_source: safeRecipientSource,
        delivery_token,
        event_category: "activation",
      },
    }).catch((e: unknown) => console.error("audit_log_failed:link_generated", e));
    // ── fin Phase 0 ────────────────────────────────────────────────────────

    return new Response(
      JSON.stringify({ success: true, tracked_url, delivery_token }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[create-tracked-link] Unexpected error:", err);
    try {
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      await adminClient.from("system_failures").insert({
        campaign_id: null,
        failure_type: "execution",
        severity: "low",
        message: "create-tracked-link unexpected error",
        reason: String(err),
      });
    } catch (_) {
      /* best effort */
    }
    return new Response(
      JSON.stringify({ success: false, error: "internal_error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
