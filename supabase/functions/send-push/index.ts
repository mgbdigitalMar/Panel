// ================================================================
// EDGE FUNCTION: send-push
// Envía una notificación push GENÉRICA a todos los dispositivos de un
// usuario cuando se inserta una fila en `notifications`.
//
// Privacidad: el título y el cuerpo reales NUNCA salen del backend.
// El push solo lleva un texto genérico y el id de la notificación;
// la app descarga el contenido completo tras abrirse.
//
// Despliegue:  supabase functions deploy send-push --no-verify-jwt
// (la autenticación se valida aquí comparando con la service role key)
// ================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// Opcional: token de acceso de Expo si se activa "Enhanced push security".
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN')

const GENERIC_TITLE = 'Nueva notificación'
const GENERIC_BODY = 'Has recibido una nueva notificación.'
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

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

  const [{ data: tokens, error: tokErr }, { count: unread }] = await Promise.all([
    supabase.from('push_tokens').select('token').eq('user_id', user_id),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .eq('read', false),
  ])

  if (tokErr) return json({ error: tokErr.message }, 500)
  if (!tokens?.length) return json({ skipped: true, reason: 'no devices' })

  const messages = tokens.map((t) => ({
    to: t.token,
    title: GENERIC_TITLE,
    body: GENERIC_BODY,
    sound: 'default',
    badge: unread ?? undefined,
    channelId: 'default',
    priority: 'high',
    // Payload mínimo. notificationId es un número opaco que solo sirve para
    // abrir el elemento correcto tras iniciar sesión; no revela tipo ni contenido.
    data: { type: 'generic_notification', hasNotification: true, notificationId: notification_id },
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

  return json({ sent: messages.length - dead.length, removed: dead.length, status: res.status })
})
