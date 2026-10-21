// ================================================================
// EDGE FUNCTION: send-push
// Envía una notificación push cuando se inserta una fila en `notifications`:
//   • a la app móvil (Expo)            → tabla push_tokens
//   • a los navegadores (Web Push)     → tabla web_push_subscriptions
//
// Contenido: el push lleva el título y el cuerpo reales de la notificación
// (decisión de producto, oct 2026). En Android el canal usa visibilidad
// PRIVATE, así que la pantalla bloqueada sigue ocultando el detalle.
//
// Despliegue:  supabase functions deploy send-push --no-verify-jwt
// Secretos Web Push:  supabase secrets set --env-file supabase/.env.push
//   (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)
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

const FALLBACK_TITLE = 'Margube Intranet'
const FALLBACK_BODY = 'Tienes una nueva notificación.'

type Notif = { title?: string | null; body?: string | null; entity_type?: string | null; entity_id?: string | number | null }
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

  const [{ data: notif }, { data: tokens, error: tokErr }, { data: subs, error: subErr }, { count: unread }] = await Promise.all([
    supabase.from('notifications').select('title, body, entity_type, entity_id').eq('id', notification_id).maybeSingle(),
    supabase.from('push_tokens').select('token').eq('user_id', user_id),
    supabase.from('web_push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', user_id),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .eq('read', false),
  ])

  if (tokErr) return json({ error: tokErr.message }, 500)
  // La tabla web puede no existir aún si no se ejecutó la migración web_push.
  if (subErr) console.warn('web_push_subscriptions:', subErr.message)
  if (!tokens?.length && !subs?.length) return json({ skipped: true, reason: 'no devices' })

  const [expo, web] = await Promise.all([
    sendExpo(supabase, tokens ?? [], notification_id, (notif ?? {}) as Notif, unread ?? null),
    sendWeb(supabase, subs ?? [], notification_id, (notif ?? {}) as Notif, unread ?? null),
  ])

  return json({ expo, web })
})
