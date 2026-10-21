// ================================================================
// EDGE FUNCTION: send-push
// Envía una notificación push cuando se inserta una fila en `notifications`:
//   • a la app móvil (Expo)            → tabla push_tokens
//   • a los navegadores (Web Push)     → tabla web_push_subscriptions
//   • por email (Resend)               → profiles.email, si email_notifications
//
// Contenido: el push lleva el título y el cuerpo reales de la notificación
// (decisión de producto, oct 2026). En Android el canal usa visibilidad
// PRIVATE, así que la pantalla bloqueada sigue ocultando el detalle.
//
// Despliegue:  supabase functions deploy send-push --no-verify-jwt
// Secretos Web Push:  supabase secrets set --env-file supabase/.env.push
//   (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)
// Secretos email:     RESEND_API_KEY, EMAIL_FROM, APP_URL
//   (ver supabase/migrations/20261021120000_email_notifications.sql)
// ================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// Opcional: token de acceso de Expo si se activa "Enhanced push security".
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN')

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@margube.com'
const webPushReady = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY)
if (webPushReady) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!)

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') ?? 'Margube Intranet <onboarding@resend.dev>'
const APP_URL = (Deno.env.get('APP_URL') ?? '').replace(/\/+$/, '')

const FALLBACK_TITLE = 'Margube Intranet'
const FALLBACK_BODY = 'Tienes una nueva notificación.'

type Notif = {
  title?: string | null; body?: string | null; type?: string | null
  entity_type?: string | null; entity_id?: string | number | null
}
type Profile = { email?: string | null; name?: string | null; role?: string | null; email_notifications?: boolean | null }
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Supabase = ReturnType<typeof createClient>

async function sendExpo(supabase: Supabase, tokens: { token: string }[], notificationId: unknown, notif: Notif, unread: number | null) {
  if (!tokens.length) return { sent: 0, removed: 0 }

  const messages = tokens.map((t) => ({
    to: t.token,
    title: notif.title || FALLBACK_TITLE,
    body: notif.body || FALLBACK_BODY,
    sound: 'default',
    badge: unread ?? undefined,
    channelId: 'default',
    priority: 'high',
    // La app usa estos datos para abrir el elemento correcto al tocar el aviso.
    data: {
      type: 'notification', hasNotification: true, notificationId,
      entity_type: notif.entity_type ?? null, entity_id: notif.entity_id ?? null,
    },
  }))

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${EXPO_ACCESS_TOKEN}`

  const res = await fetch(EXPO_PUSH_URL, { method: 'POST', headers, body: JSON.stringify(messages) })
  const result = await res.json().catch(() => ({}))

  // Limpieza de tokens caducados (app desinstalada, permisos revocados...).
  const tickets: Array<{ status: string; details?: { error?: string } }> = result?.data ?? []
  const dead = tickets
    .map((t, i) => (t.status === 'error' && t.details?.error === 'DeviceNotRegistered' ? messages[i].to : null))
    .filter((t): t is string => Boolean(t))
  if (dead.length) await supabase.from('push_tokens').delete().in('token', dead)

  return { sent: messages.length - dead.length, removed: dead.length, status: res.status }
}

async function sendWeb(
  supabase: Supabase,
  subs: { endpoint: string; p256dh: string; auth: string }[],
  notificationId: unknown,
  notif: Notif,
  unread: number | null,
) {
  if (!subs.length) return { sent: 0, removed: 0 }
  if (!webPushReady) return { sent: 0, removed: 0, skipped: 'missing VAPID secrets' }

  // Cifrado extremo a extremo hasta el navegador (RFC 8291); lo muestra public/push-sw.js.
  const payload = JSON.stringify({
    notificationId,
    unread,
    title: notif.title || FALLBACK_TITLE,
    body: notif.body || '',
    entityType: notif.entity_type ?? null,
  })
  const dead: string[] = []
  let sent = 0

  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        { TTL: 60 * 60 * 24, urgency: 'high' },
      )
      sent++
    } catch (err) {
      // 404/410: el navegador anuló la suscripción (permiso retirado, datos borrados...)
      const code = (err as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) dead.push(s.endpoint)
      else console.warn('web push failed', code, (err as Error).message)
    }
  }))

  if (dead.length) await supabase.from('web_push_subscriptions').delete().in('endpoint', dead)
  return { sent, removed: dead.length }
}

// Ruta web que abre la notificación.
// Mantener en sincronía con notificationWebPath (shared/config/constants.js) y public/push-sw.js.
function webPath(notif: Notif, isAdmin: boolean) {
  const type = notif.entity_type
  const map: Record<string, string> = {
    request: 'requests', personal_day: 'requests', document: 'profile',
    hour_compensation: isAdmin ? 'admin' : 'horas', reservation: 'reservations',
  }
  return '/' + (map[type ?? ''] ?? 'dashboard')
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

function emailHtml(notif: Notif, profile: Profile, link: string | null) {
  const title = escapeHtml(notif.title || FALLBACK_TITLE)
  const body = escapeHtml(notif.body || FALLBACK_BODY).replace(/\n/g, '<br>')
  const firstName = escapeHtml((profile.name || '').trim().split(/\s+/)[0] || '')
  const button = link
    ? `<p style="margin:28px 0 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#1f2937;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px">Abrir en la intranet</a></p>`
    : ''
  return `<!doctype html><html lang="es"><body style="margin:0;padding:0;background:#f4f5f7">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;padding:32px">
<tr><td style="color:#6b7280;font-size:13px;padding-bottom:20px">Margube Intranet</td></tr>
<tr><td style="color:#111827;font-size:15px;line-height:1.5">
${firstName ? `<p style="margin:0 0 16px">Hola ${firstName},</p>` : ''}
<h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#111827">${title}</h1>
<p style="margin:0;color:#374151">${body}</p>
${button}
</td></tr>
<tr><td style="color:#9ca3af;font-size:12px;line-height:1.5;padding-top:28px">Recibes este email porque tienes activados los avisos por email. Puedes desactivarlos en Ajustes &gt; Notificaciones.</td></tr>
</table>
</td></tr>
</table>
</body></html>`
}

async function sendEmail(notificationId: unknown, notif: Notif, profile: Profile | null) {
  if (!RESEND_API_KEY) return { sent: 0, skipped: 'missing RESEND_API_KEY' }
  const to = profile?.email?.trim()
  if (!to) return { sent: 0, skipped: 'no email' }
  if (profile?.email_notifications === false) return { sent: 0, skipped: 'disabled by user' }

  const link = APP_URL ? APP_URL + webPath(notif, profile?.role === 'admin') : null
  const text = [notif.body || FALLBACK_BODY, link ? `\nAbrir en la intranet: ${link}` : ''].join('\n')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      // Si la misma notificación llega dos veces, Resend no duplica el email.
      'Idempotency-Key': `notification-${notificationId}`,
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [to],
      subject: notif.title || FALLBACK_TITLE,
      html: emailHtml(notif, profile ?? {}, link),
      text,
    }),
  })
  if (!res.ok) {
    console.warn('email failed', res.status, await res.text().catch(() => ''))
    return { sent: 0, status: res.status }
  }
  return { sent: 1 }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // Solo el trigger de base de datos (con la service role key) puede llamar.
  const auth = req.headers.get('Authorization') ?? ''
  if (auth !== `Bearer ${SERVICE_KEY}`) return json({ error: 'Unauthorized' }, 401)

  let payload: { notification_id?: number | string; user_id?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }
  const { notification_id, user_id } = payload
  if (!notification_id || !user_id) return json({ skipped: true, reason: 'missing ids' })

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const [{ data: notif }, { data: tokens, error: tokErr }, { data: subs, error: subErr }, { count: unread }, { data: profile }] = await Promise.all([
    supabase.from('notifications').select('title, body, type, entity_type, entity_id').eq('id', notification_id).maybeSingle(),
    supabase.from('push_tokens').select('token').eq('user_id', user_id),
    supabase.from('web_push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', user_id),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .eq('read', false),
    // select('*'): sigue funcionando aunque no se haya ejecutado la migración email_notifications.
    supabase.from('profiles').select('*').eq('id', user_id).maybeSingle(),
  ])

  if (tokErr) return json({ error: tokErr.message }, 500)
  // La tabla web puede no existir aún si no se ejecutó la migración web_push.
  if (subErr) console.warn('web_push_subscriptions:', subErr.message)
  const n = (notif ?? {}) as Notif

  // El email no depende de que el usuario tenga dispositivos registrados.
  const [expo, web, email] = await Promise.all([
    sendExpo(supabase, tokens ?? [], notification_id, n, unread ?? null),
    sendWeb(supabase, subs ?? [], notification_id, n, unread ?? null),
    sendEmail(notification_id, n, profile as Profile | null).catch((err) => {
      console.warn('email failed', (err as Error).message)
      return { sent: 0, error: (err as Error).message }
    }),
  ])

  return json({ expo, web, email })
})
