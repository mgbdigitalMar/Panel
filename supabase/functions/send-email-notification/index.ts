// ================================================================
// EDGE FUNCTION: send-email-notification
// Supabase Dashboard → Edge Functions → New function
// ================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── RESEND API KEY ──────────────────────────────────────────────
// Secret en: Supabase Dashboard → Edge Functions → Manage Secrets → RESEND_API_KEY
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || 're_WHnR6erq_4xDGFpM6rUd9wU4misCNizye'
const FROM_EMAIL     = 'Margube Intranet <onboarding@resend.dev>'
const APP_URL        = 'https://panel.margube.com'

// ── SUPABASE (inyectadas automáticamente, no tocar) ─────────────
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// ================================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const payload = await req.json()

    // Supabase webhook envía: { type, table, schema, record, old_record }
    const record = payload?.record ?? payload
    const { user_id, title, body, type: notifType } = record

    if (!user_id || !title) {
      return ok({ skipped: true, reason: 'Missing user_id or title' })
    }

    // Leer email del usuario con service role key
    // - SERVICE_ROLE_KEY ignora RLS completamente
    // - persistSession:false y autoRefreshToken:false son necesarios en Edge Functions
    //   (no hay browser, no hay storage de sesión)
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        // Asegura que se envía el service role key en cada petición
        headers: { Authorization: 'Bearer ' + SERVICE_KEY },
      },
    })

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('email, name')
      .eq('id', user_id)
      .single()

    if (error || !profile?.email) {
      console.warn('Sin email para usuario:', user_id, error?.message)
      return ok({ skipped: true, reason: 'No email for user' })
    }

    // Colores según tipo de notificación
    const colors = {
      success: { accent: '#22c55e', emoji: '✅' },
      error:   { accent: '#ef4444', emoji: '❌' },
      warning: { accent: '#f59e0b', emoji: '⚠️' },
      info:    { accent: '#6366f1', emoji: '🔔' },
    }
    const { accent, emoji } = colors[notifType] || colors.info

    // Enviar con Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + RESEND_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    FROM_EMAIL,
        to:      [profile.email],
        subject: emoji + ' ' + title + ' — Margube Intranet',
        html:    emailHtml({
          title,
          body:    body || '',
          name:    profile.name || 'Usuario',
          accent,
          emoji,
        }),
      }),
    })

    const resendData = await resendRes.json()

    if (!resendRes.ok) {
      console.error('Resend error:', JSON.stringify(resendData))
      return ok({ error: resendData }, 502)
    }

    console.log('Email enviado a', profile.email, '| id:', resendData?.id)
    return ok({ sent: true, id: resendData?.id })

  } catch (err) {
    console.error('Error:', err)
    return ok({ error: String(err) }, 500)
  }
})

// ── Helper respuesta ────────────────────────────────────────────
function ok(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ── Plantilla email ─────────────────────────────────────────────
function emailHtml({ title, body, name, accent, emoji }) {
  const bodySection = body
    ? '<div style="background:#f8fafc;border-left:4px solid ' + accent + ';border-radius:0 8px 8px 0;padding:14px 18px;margin:0 0 24px;">' +
      '<p style="margin:0;font-size:14px;color:#334155;line-height:1.7;">' + body + '</p></div>'
    : ''

  return (
    '<!DOCTYPE html><html lang="es"><head>' +
    '<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>' +
    '<title>' + title + '</title></head>' +
    '<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">' +
    '<tr><td align="center">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">' +

    // Logo
    '<tr><td align="center" style="padding-bottom:24px;">' +
    '<div style="display:inline-block;background:#0f172a;border-radius:12px;padding:10px 22px;">' +
    '<span style="color:#fff;font-size:20px;font-weight:800;">M</span>' +
    '<span style="color:rgba(255,255,255,0.5);font-size:13px;margin-left:8px;">Margube Intranet</span>' +
    '</div></td></tr>' +

    // Tarjeta
    '<tr><td style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">' +
    '<div style="height:4px;background:' + accent + ';"></div>' +
    '<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:28px 32px;">' +

    // Icono + título
    '<table cellpadding="0" cellspacing="0" style="margin-bottom:18px;"><tr>' +
    '<td align="center" style="width:48px;height:48px;background:' + accent + '20;border-radius:12px;font-size:24px;vertical-align:middle;">' +
    emoji + '</td>' +
    '<td style="padding-left:14px;vertical-align:middle;">' +
    '<p style="margin:0 0 2px;font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Nueva notificación</p>' +
    '<p style="margin:0;font-size:18px;font-weight:700;color:#0f172a;">' + title + '</p>' +
    '</td></tr></table>' +

    // Saludo
    '<p style="margin:0 0 16px;font-size:15px;color:#475569;">Hola <strong style="color:#0f172a;">' + name + '</strong>,</p>' +

    // Cuerpo
    bodySection +

    // Botón
    '<table cellpadding="0" cellspacing="0"><tr>' +
    '<td style="background:' + accent + ';border-radius:8px;">' +
    '<a href="' + APP_URL + '" style="display:block;padding:12px 26px;color:#fff;text-decoration:none;font-weight:600;font-size:14px;">Ver en la intranet &rarr;</a>' +
    '</td></tr></table>' +

    '</td></tr></table></td></tr>' +

    // Footer
    '<tr><td style="padding:18px 0;text-align:center;">' +
    '<p style="margin:0;font-size:12px;color:#94a3b8;">Notificación automática de Margube Intranet</p>' +
    '</td></tr>' +

    '</table></td></tr></table>' +
    '</body></html>'
  )
}
