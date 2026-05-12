import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CALENDLY_URL = "https://calendly.com/julien-cadet-getekko/discovery-call";
const FOUNDER_EMAIL = "julien@getekko.eu";
const NOTION_CRM_URL = "https://www.notion.so/35ea8d0fe0a0810d9732d595bd3354ee";

const POSTES = [
  "Account Executive",
  "Account Executive Senior",
  "VP Sales",
  "Head of Sales",
  "CRO",
  "Sales Enablement",
  "Sales Ops / RevOps",
  "Autre",
];

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
    const poste = String(body.poste ?? "").trim().slice(0, 100);

    if (!prenom || !nom || !email || !entreprise || !poste) {
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
    if (!POSTES.includes(poste)) {
      return new Response(JSON.stringify({ error: "invalid_poste" }), {
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
      .insert({ prenom, nom, email, entreprise, poste, source: "landing" })
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

    // Always respond success (do not leak duplicate info to client)
    const response = new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    if (isDuplicate) return response;

    // Fire-and-forget emails
    const createdAt = inserted?.created_at ?? new Date().toISOString();

    const safe = {
      prenom: escapeHtml(prenom),
      nom: escapeHtml(nom),
      email: escapeHtml(email),
      entreprise: escapeHtml(entreprise),
      poste: escapeHtml(poste),
      createdAt: escapeHtml(createdAt),
    };

    const adminHtml = `
      <div style="font-family:Arial,sans-serif;color:#0D1B2A;line-height:1.5">
        <p>Bonjour Julien,</p>
        <p>Nouvelle inscription pilote :</p>
        <ul>
          <li><strong>Prénom Nom :</strong> ${safe.prenom} ${safe.nom}</li>
          <li><strong>Email :</strong> ${safe.email}</li>
          <li><strong>Entreprise :</strong> ${safe.entreprise}</li>
          <li><strong>Poste :</strong> ${safe.poste}</li>
          <li><strong>Source :</strong> landing</li>
          <li><strong>Date :</strong> ${safe.createdAt}</li>
        </ul>
        <p>Mettre à jour dans le CRM Ekko :<br/>
        <a href="${NOTION_CRM_URL}">${NOTION_CRM_URL}</a></p>
        <p style="color:#3D5166">Ekko bot</p>
      </div>
    `;

    const leadHtml = `
      <div style="font-family:Arial,sans-serif;color:#0D1B2A;line-height:1.6">
        <p>Bonjour ${safe.prenom},</p>
        <p>Merci pour votre inscription au pilote Ekko.</p>
        <p>On lance le pilote avec 20 AE triés sur le volet en juin 2026. Vous recevrez un email dès qu'il sera prêt.</p>
        <p>Si entre-temps vous voulez qu'on échange 20 minutes pour comprendre votre quotidien et vos besoins :<br/>
        <a href="${CALENDLY_URL}" style="color:#1AE08A;font-weight:bold">${CALENDLY_URL}</a></p>
        <p>À très vite,</p>
        <p><strong>Julien Cadet</strong><br/>
        Founder, Ekko<br/>
        <a href="mailto:julien@getekko.eu">julien@getekko.eu</a></p>
      </div>
    `;

    EdgeRuntime.waitUntil(
      Promise.all([
        sendEmail(
          FOUNDER_EMAIL,
          `Nouveau lead pilote Ekko : ${prenom} ${nom} (${entreprise})`,
          adminHtml
        ),
        sendEmail(email, "Bienvenue dans le pilote Ekko", leadHtml),
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
