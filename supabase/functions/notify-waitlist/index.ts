import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { record } = await req.json()

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const NOTIFY_EMAIL = Deno.env.get('NOTIFY_EMAIL') || 'julien.cadet@getekko.eu'

    const emailBody = `
Nouvelle demande d'accès Ekko
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Prénom     : ${record.first_name}
Nom        : ${record.last_name}
Entreprise : ${record.company}
Email      : ${record.email}
Téléphone  : ${record.phone || 'Non renseigné'}
Source     : ${record.source}
Date       : ${new Date(record.created_at).toLocaleString('fr-FR')}

Message :
${record.message || 'Aucun message'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Voir toutes les demandes : https://ekko.lovable.app
    `.trim()

    if (!RESEND_API_KEY) {
      console.log('RESEND_API_KEY manquante — log de la demande :', emailBody)
      return new Response(JSON.stringify({ ok: true, mode: 'log' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Ekko <noreply@getekko.eu>',
        to: [NOTIFY_EMAIL],
        subject: `🔔 Nouvelle demande — ${record.first_name} ${record.last_name} (${record.company})`,
        text: emailBody,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('Resend error:', errText)
      return new Response(JSON.stringify({ error: errText }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('notify-waitlist error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
