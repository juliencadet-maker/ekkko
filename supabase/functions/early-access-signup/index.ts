import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CALENDLY_URL = "https://calendly.com/julien-cadet-getekko/discovery-call";
const FOUNDER_EMAIL = "julien@getekko.eu";
const NOTION_CRM_URL = "https://www.notion.so/35ea8d0fe0a0810d9732d595bd3354ee";

type Role = "vp" | "ae" | "exec" | "other";
const ROLES: Role[] = ["vp", "ae", "exec", "other"];

const ROLE_LABEL: Record<Role, string> = {
  vp: "VP Sales / CRO / Head of Sales",
  ae: "Account Executive (Senior, Enterprise)",
  exec: "Dirigeant (CEO, COO, DG)",
  other: "Autre rôle Sales",
};

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.warn("[early-access] RESEND_API_KEY missing — skipping email to", to);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Ekko <julien@getekko.eu>",
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error("[early-access] resend failed", res.status, txt);
  }
}

function buildLeadEmail(role: Role, prenom: string, effectif: string | null) {
  const safePrenom = escapeHtml(prenom);
  const safeEffectif = effectif ? escapeHtml(effectif) : "";
  const link = `<a href="${CALENDLY_URL}" style="color:#1AE08A;font-weight:bold">${CALENDLY_URL}</a>`;

  switch (role) {
    case "vp":
      return {
        subject: "Ekko · Confirmons votre créneau de démo",
        html: `
          <div style="font-family:Arial,sans-serif;color:#0D1B2A;line-height:1.6">
            <p>Bonjour ${safePrenom},</p>
            <p>Merci pour votre intérêt pour Ekko.</p>
            <p>Voici mon Calendly pour réserver 20 minutes : ${link}</p>
            <p>Je préparerai une démo personnalisée selon votre stack${safeEffectif ? ` et la taille de votre équipe (${safeEffectif} AE)` : ""}.</p>
            <p>À très vite,<br/><strong>Julien Cadet</strong><br/>Founder, Ekko</p>
          </div>`,
      };
    case "ae":
      return {
        subject: "Ekko · Bienvenue dans la liste pilote bêta",
        html: `
          <div style="font-family:Arial,sans-serif;color:#0D1B2A;line-height:1.6">
            <p>Salut ${safePrenom},</p>
            <p>Merci pour ton inscription. Tu fais partie des 20 AE Senior sélectionnés pour tester Ekko en pilote pendant 4 semaines à partir de juin.</p>
            <p>Je te recontacte d'ici 7 jours pour un échange de 20 min avant ton onboarding.</p>
            <p>En attendant, voici mon Calendly si tu veux booker direct : ${link}</p>
            <p><strong>Julien</strong></p>
          </div>`,
      };
    case "exec":
      return {
        subject: "Ekko · Note de positionnement pour dirigeants",
        html: `
          <div style="font-family:Arial,sans-serif;color:#0D1B2A;line-height:1.6">
            <p>Bonjour ${safePrenom},</p>
            <p>Merci pour votre intérêt.</p>
            <p>Je vous prépare une note de positionnement Ekko spécifique aux enjeux exécutifs (présence sur les deals stratégiques sans surcharge agenda) dans les 48h.</p>
            <p>Si vous préférez 20 min en visio : ${link}</p>
            <p><strong>Julien</strong>, founder Ekko</p>
          </div>`,
      };
    case "other":
    default:
      return {
        subject: "Ekko · Bienvenue",
        html: `
          <div style="font-family:Arial,sans-serif;color:#0D1B2A;line-height:1.6">
            <p>Bonjour ${safePrenom},</p>
            <p>Merci pour votre intérêt. Je reviens vers vous d'ici 48h avec une présentation Ekko adaptée à votre contexte.</p>
            <p>Si vous voulez avancer plus vite : ${link}</p>
            <p><strong>Julien</strong></p>
          </div>`,
      };
  }
}

function adminSubject(role: Role, entreprise: string) {
  const tag = role === "vp" ? "[VP LEAD] Démo demandée"
    : role === "ae" ? "[AE PILOTE] Inscription bêta"
    : role === "exec" ? "[EXEC LEAD] Note demandée"
    : "[AUTRE] Info demandée";
  return `${tag} - ${entreprise}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const prenom = String(body.prenom ?? "").trim().slice(0, 100);
    const nom = String(body.nom ?? "").trim().slice(0, 100);
    const email = String(body.email ?? "").trim().toLowerCase().slice(0, 255);
    const entreprise = String(body.entreprise ?? "").trim().slice(0, 200);
    const role = String(body.role ?? "").trim().toLowerCase().slice(0, 20) as Role;
    const effectif = String(body.effectif ?? "").trim().slice(0, 50) || null;

    if (!prenom || !nom || !email || !entreprise || !role) {
      return new Response(JSON.stringify({ error: "missing_fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!isEmail(email)) {
      return new Response(JSON.stringify({ error: "invalid_email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!ROLES.includes(role)) {
      return new Response(JSON.stringify({ error: "invalid_role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: inserted, error } = await supabase
      .from("early_access_leads")
      .insert({
        prenom,
        nom,
        email,
        entreprise,
        poste: ROLE_LABEL[role],
        role,
        effectif,
        source: "landing",
      })
      .select("id, created_at")
      .maybeSingle();

    const isDuplicate = !!error && (error.code === "23505" || /duplicate|unique/i.test(error.message));

    if (error && !isDuplicate) {
      console.error("[early-access] insert error", error);
      return new Response(JSON.stringify({ error: "server_error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    if (isDuplicate) return response;

    const createdAt = inserted?.created_at ?? new Date().toISOString();
    const safe = {
      prenom: escapeHtml(prenom),
      nom: escapeHtml(nom),
      email: escapeHtml(email),
      entreprise: escapeHtml(entreprise),
      role: escapeHtml(ROLE_LABEL[role]),
      effectif: escapeHtml(effectif ?? "—"),
      createdAt: escapeHtml(createdAt),
    };

    const adminHtml = `
      <div style="font-family:Arial,sans-serif;color:#0D1B2A;line-height:1.5">
        <p>Bonjour Julien,</p>
        <p>Nouveau lead landing :</p>
        <ul>
          <li><strong>Prénom Nom :</strong> ${safe.prenom} ${safe.nom}</li>
          <li><strong>Email :</strong> ${safe.email}</li>
          <li><strong>Entreprise :</strong> ${safe.entreprise}</li>
          <li><strong>Rôle :</strong> ${safe.role} (<code>${role}</code>)</li>
          <li><strong>Effectif équipe Sales :</strong> ${safe.effectif}</li>
          <li><strong>Date :</strong> ${safe.createdAt}</li>
        </ul>
        <p>CRM : <a href="${NOTION_CRM_URL}">${NOTION_CRM_URL}</a></p>
      </div>
    `;

    const leadEmail = buildLeadEmail(role, prenom, effectif);

    EdgeRuntime.waitUntil(
      Promise.all([
        sendEmail(FOUNDER_EMAIL, adminSubject(role, entreprise), adminHtml),
        sendEmail(email, leadEmail.subject, leadEmail.html),
      ]).catch((e) => console.error("[early-access] email error", e))
    );

    return response;
  } catch (err) {
    console.error("[early-access] fatal", err);
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
