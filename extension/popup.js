// ── Config ──────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://kqpbsznldzrklnnbqtwq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxcGJzem5sZHpya2xubmJxdHdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzM4NDcsImV4cCI6MjA4NTk0OTg0N30.udzrVg4mtX45hlzC3rq6efz0I4Nk9EtDFmu7Ukfuj9E";
const EKKO_APP_URL = "https://getekko.eu";

const PURPOSE_LABELS = {
  intro: "Introduction",
  pricing: "Proposition commerciale",
  technical: "Détails techniques",
  legal: "Éléments juridiques",
  closing: "Closing",
  followup: "Suivi",
};

// ── Helpers ──────────────────────────────────────────────────────────────
async function apiGet(path, token) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "apikey": SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiPost(path, body, token) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "apikey": SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

function showFeedback(id, message, isError = false) {
  const el = document.getElementById(id);
  el.textContent = message;
  el.className = `feedback ${isError ? "feedback-error" : "feedback-ok"}`;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2500);
}

function showState(state) {
  ["state-auth", "state-main", "state-loading"].forEach((id) => {
    document.getElementById(id).classList.add("hidden");
  });
  document.getElementById(state).classList.remove("hidden");
}

// ── Init ────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  showState("state-loading");

  const { access_token, user_id } = await chrome.storage.local.get([
    "access_token",
    "user_id",
  ]);

  if (!access_token || !user_id) {
    showState("state-auth");
    document.getElementById("btn-login").addEventListener("click", () => {
      chrome.tabs.create({ url: EKKO_APP_URL });
    });
    return;
  }

  // Vérification JWT
  try {
    await apiGet(
      `/rest/v1/org_memberships?user_id=eq.${user_id}&is_active=eq.true&limit=1`,
      access_token
    );
  } catch {
    showState("state-auth");
    document.getElementById("btn-login").addEventListener("click", () => {
      chrome.tabs.create({ url: EKKO_APP_URL });
    });
    return;
  }

  showState("state-main");
  await loadDeals(access_token, user_id);
  setupListeners(access_token, user_id);
});

// ── Deals ───────────────────────────────────────────────────────────────
async function loadDeals(token, userId) {
  const dealSelect = document.getElementById("deal-select");
  try {
    const memberships = await apiGet(
      `/rest/v1/org_memberships?user_id=eq.${userId}&is_active=eq.true&select=org_id&limit=1`,
      token
    );
    if (!memberships?.length) return;

    const orgId = memberships[0].org_id;
    const deals = await apiGet(
      `/rest/v1/campaigns?org_id=eq.${orgId}&deal_status=neq.closed&select=id,name&order=name.asc`,
      token
    );

    deals.forEach((deal) => {
      const opt = document.createElement("option");
      opt.value = deal.id;
      opt.textContent = deal.name;
      dealSelect.appendChild(opt);
    });
  } catch {
    /* silencieux */
  }
}

// ── Assets ──────────────────────────────────────────────────────────────
async function loadAssets(campaignId, token) {
  const assetSelect = document.getElementById("asset-select");
  assetSelect.innerHTML = "<option value=''>Chargement...</option>";
  assetSelect.disabled = true;

  try {
    const assets = await apiGet(
      `/rest/v1/deal_assets?campaign_id=eq.${campaignId}&asset_status=eq.valid&select=id,asset_purpose&order=created_at.desc`,
      token
    );
    assetSelect.innerHTML = "";

    if (!assets?.length) {
      assetSelect.innerHTML = "<option value=''>Aucun asset prêt</option>";
    } else {
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Choisir un asset...";
      assetSelect.appendChild(placeholder);

      assets.forEach((asset) => {
        const opt = document.createElement("option");
        opt.value = asset.id;
        opt.textContent =
          PURPOSE_LABELS[asset.asset_purpose] || asset.asset_purpose;
        assetSelect.appendChild(opt);
      });
      assetSelect.disabled = false;
    }
  } catch {
    assetSelect.innerHTML = "<option value=''>Erreur</option>";
  }
}

// ── Listeners ───────────────────────────────────────────────────────────
function setupListeners(token, userId) {
  const dealSelect = document.getElementById("deal-select");
  const assetSelect = document.getElementById("asset-select");
  const btnShare = document.getElementById("btn-share");
  const btnMessage = document.getElementById("btn-message");
  const btnSignal = document.getElementById("btn-signal");
  const signalInput = document.getElementById("signal-input");

  dealSelect.addEventListener("change", async () => {
    const id = dealSelect.value;
    const has = !!id;

    btnMessage.disabled = !has;
    btnSignal.disabled = !has;
    signalInput.disabled = !has;

    if (has) {
      await loadAssets(id, token);
    } else {
      assetSelect.innerHTML =
        "<option value=''>Sélectionner un deal d'abord...</option>";
      assetSelect.disabled = true;
      btnShare.disabled = true;
    }
  });

  assetSelect.addEventListener("change", () => {
    btnShare.disabled = !assetSelect.value;
  });

  // Feature 1 — Lien tracké
  btnShare.addEventListener("click", async () => {
    const campaignId = dealSelect.value;
    const assetId = assetSelect.value;
    if (!campaignId || !assetId) return;

    btnShare.disabled = true;
    btnShare.textContent = "Génération...";

    try {
      const data = await apiPost(
        "/functions/v1/create-tracked-link",
        { campaign_id: campaignId, asset_id: assetId },
        token
      );
      if (data?.tracked_url) {
        await copyToClipboard(data.tracked_url);
        showFeedback("feedback-share", "✓ Lien tracké copié");
      } else throw new Error("no tracked_url");
    } catch {
      await copyToClipboard(`${EKKO_APP_URL}/lp/${campaignId}`);
      showFeedback("feedback-share", "Lien copié (non tracké)");
    } finally {
      btnShare.disabled = false;
      btnShare.textContent = "Générer un lien tracké";
    }
  });

  // Feature 2 — Message prêt
  btnMessage.addEventListener("click", async () => {
    const campaignId = dealSelect.value;
    if (!campaignId) return;

    btnMessage.disabled = true;
    btnMessage.textContent = "Génération...";
    const msgOutput = document.getElementById("message-output");
    const btnCopy = document.getElementById("btn-copy-message");
    msgOutput.classList.add("hidden");
    btnCopy.classList.add("hidden");

    const FALLBACK =
      "Bonjour, suite à notre échange je me permets de revenir vers vous. N'hésitez pas à me faire part de vos questions.";
    let messageText = FALLBACK;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ekko-agent`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campaign_id: campaignId,
          user_id: userId,
          messages: [
            {
              role: "user",
              content:
                "Génère un message court à envoyer à mon prospect. 2-3 phrases maximum. Factuel. Pas d'emojis.",
            },
          ],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const content = data?.content;
        if (Array.isArray(content)) {
          const block = content.find((b) => b.type === "text");
          if (block?.text) messageText = block.text;
        } else if (typeof data?.message === "string") {
          messageText = data.message;
        }
      }
    } catch {
      /* fallback */
    }

    msgOutput.textContent = messageText;
    msgOutput.classList.remove("hidden");
    btnCopy.classList.remove("hidden");
    btnCopy.onclick = async () => {
      await copyToClipboard(messageText);
      showFeedback("feedback-message", "✓ Message copié");
    };

    btnMessage.disabled = false;
    btnMessage.textContent = "Générer un message";
  });

  // Feature 3 — Signal
  btnSignal.addEventListener("click", async () => {
    const campaignId = dealSelect.value;
    const label = signalInput.value.trim();
    if (!campaignId || !label) return;

    btnSignal.disabled = true;
    btnSignal.textContent = "Enregistrement...";

    try {
      await apiPost(
        "/functions/v1/log-offline-signal",
        {
          campaign_id: campaignId,
          event_type: "offline_signal",
          event_layer: "declared",
          event_data: { signal: "ae_input", label },
        },
        token
      );
      signalInput.value = "";
      showFeedback("feedback-signal", "✓ Signal enregistré");
    } catch {
      showFeedback(
        "feedback-signal",
        "Non enregistré — réessayez depuis l'app",
        true
      );
    } finally {
      btnSignal.disabled = false;
      btnSignal.textContent = "Enregistrer";
    }
  });
}