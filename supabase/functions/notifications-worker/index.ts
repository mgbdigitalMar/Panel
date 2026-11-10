import { NOTIFICATION_SELECT, notificationPresentation } from '../../../shared/services/notificationPresentation.js'
// EDGE FUNCTION: notifications-worker (ver docs/NOTIFICACIONES.md)
// Vacía la cola notification_jobs y consulta los recibos de Expo. No guarda nada en memoria:
// si muere a mitad, los trabajos reaparecen al caducar su tiempo de visibilidad.
// La llaman el aviso de la base de datos y, como recuperación, pg_cron (secreto en Vault).
//
import { createClient } from 'npm:@supabase/supabase-js@2.117.3'
import webpush from 'npm:web-push@3.6.7'
import {
  type Classified, classifyExpoError, classifyExpoHttp, classifyWebPush, parseRetryAfter,
} from './classify.ts'

const PUSH_TTL_SECONDS = 60 * 60 * 24
const ANDROID_CHANNEL_ID = 'default' // mobile/src/services/pushNotifications.js

const BATCH_SIZE = 20
const CONCURRENCY = 4
const VISIBILITY_SECONDS = 120
const PROVIDER_TIMEOUT_MS = 15_000
const EXPO_MAX_MESSAGES = 100
const EXPO_MAX_RECEIPTS = 1000
// El plan Free corta a los 150 s. Lo que no quepa aquí sigue en la cola para la siguiente ejecución.
const TIME_BUDGET_MS = 90_000

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const WORKER_SECRET = Deno.env.get('NOTIFICATIONS_WORKER_SECRET') ?? ''
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN')
const EXPO_API_BASE = Deno.env.get('EXPO_API_BASE') ?? 'https://exp.host/--/api/v2/push'
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@margube.com'

function serverKey(): string {
  const named = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (named) {
    try {
      const key = JSON.parse(named).default
      if (key) return key
    } catch { /* se usa la variable clásica */ }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? ''
}

const supabase = createClient(SUPABASE_URL, serverKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
})

type Delivery = {
  id: string
  channel: 'expo' | 'web'
  token: string | null
  endpoint: string | null
  p256dh: string | null
  auth: string | null
}
type Prepared = {
  title?: string
  body?: string
  state: 'ready' | 'done' | 'gone'
  notification_id?: unknown
  entity_type?: string | null
  url?: string
  unread?: number
  deliveries?: Delivery[]
}
type Result = {
  id: string
  outcome: Classified['outcome']
  code?: string
  message?: string
  http_status?: number
  ticket_id?: string
  retry_after?: number
}
type Stats = { jobs: number; accepted: number; retries: number; invalid: number; failed: number; receipts: number }

async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(`${fn}: ${error.message}`)
  return data as T
}

function logConfigProblem(provider: string, code?: string) {
  console.error('provider_config', provider, code)
  return rpc('notif_worker_log', {
    p_level: 'error', p_kind: 'provider_config', p_detail: { provider, code },
  }).catch((err) => console.error(err.message))
}

function errorResults(rows: Delivery[], c: Classified, message: string, http?: number): Result[] {
  return rows.map((d) => ({ id: d.id, outcome: c.outcome, code: c.code, message, http_status: http }))
}

async function sendExpo(rows: Delivery[], job: Prepared): Promise<Result[]> {
  if (!rows.length) return []
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${EXPO_ACCESS_TOKEN}`

  const results: Result[] = []
  for (let i = 0; i < rows.length; i += EXPO_MAX_MESSAGES) {
    const chunk = rows.slice(i, i + EXPO_MAX_MESSAGES)
    const messages = chunk.map((d) => ({
      to: d.token,
      title: job.title,
      body: job.body,
      sound: 'default',
      channelId: ANDROID_CHANNEL_ID,
      priority: 'high',
      ttl: PUSH_TTL_SECONDS,
      // Un reintento sustituye al aviso ya mostrado en vez de sumarse
      tag: `margube-${job.notification_id}`,
      data: { notificationId: job.notification_id, deliveryId: d.id },
    }))

    let res: Response
    try {
      res = await fetch(`${EXPO_API_BASE}/send`, {
        method: 'POST', headers, body: JSON.stringify(messages), signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      })
    } catch (err) {
      results.push(...errorResults(chunk, { outcome: 'retry', code: 'network' }, (err as Error).message))
      continue
    }

    const body = await res.json().catch(() => null)
    const tickets: Array<{ status: string; id?: string; message?: string; details?: { error?: string } }> | null =
      res.ok && Array.isArray(body?.data) ? body.data : null

    if (!tickets) {
      const c = res.ok ? { outcome: 'retry' as const, code: 'bad_response' } : classifyExpoHttp(res.status)
      if (c.config) await logConfigProblem('expo', c.code)
      const retry = parseRetryAfter(res.headers.get('retry-after'))
      results.push(...errorResults(chunk, c, JSON.stringify(body?.errors ?? body ?? null), res.status)
        .map((r) => ({ ...r, retry_after: retry })))
      continue
    }

    // Los tickets llegan en el mismo orden que los mensajes
    for (const [index, d] of chunk.entries()) {
      const ticket = tickets[index]
      if (ticket?.status === 'ok' && ticket.id) {
        results.push({ id: d.id, outcome: 'accepted', ticket_id: ticket.id, http_status: res.status })
        continue
      }
      const c = classifyExpoError(ticket?.details?.error)
      if (c.config) await logConfigProblem('expo', c.code)
      results.push({ id: d.id, outcome: c.outcome, code: c.code, message: ticket?.message, http_status: res.status })
    }
  }
  return results
}

async function sendWeb(rows: Delivery[], job: Prepared): Promise<Result[]> {
  if (!rows.length) return []
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    await logConfigProblem('web', 'vapid_missing')
    return errorResults(rows, { outcome: 'retry', code: 'vapid_missing' }, 'Faltan los secretos VAPID')
  }

  return await Promise.all(rows.map(async (d): Promise<Result> => {
    // Cifrado de extremo a extremo hasta el navegador (RFC 8291); lo muestra public/push-sw.js
    const payload = JSON.stringify({
      title: job.title,
      body: job.body,
      notificationId: job.notification_id,
      deliveryId: d.id,
      url: job.url,
      entityType: job.entity_type ?? null,
      unread: job.unread,
    })
    try {
      const request = webpush.generateRequestDetails(
        { endpoint: d.endpoint!, keys: { p256dh: d.p256dh!, auth: d.auth! } },
        payload,
        {
          TTL: PUSH_TTL_SECONDS,
          urgency: 'high',
          vapidDetails: { subject: VAPID_SUBJECT, publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY },
        },
      )
      const res = await fetch(request.endpoint, {
        method: request.method,
        headers: request.headers as Record<string, string>,
        body: request.body,
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      })
      await res.body?.cancel()
      const c = classifyWebPush(res.status)
      if (c.config) await logConfigProblem('web', c.code)
      return {
        id: d.id, outcome: c.outcome, code: c.code, http_status: res.status,
        retry_after: parseRetryAfter(res.headers.get('retry-after')),
      }
    } catch (err) {
      return { id: d.id, outcome: 'retry', code: 'network', message: (err as Error).message }
    }
  }))
}

async function processJob(msgId: number, eventId: string, stats: Stats) {
  const job = await rpc<Prepared>('notif_worker_prepare', {
    p_event_id: eventId, p_lock_seconds: VISIBILITY_SECONDS,
  })

  if (job.state === 'ready') {
    const rows = job.deliveries ?? []
    if (rows.length) {
      const { data, error } = await supabase.from('notifications').select(NOTIFICATION_SELECT)
        .eq('id', job.notification_id).single()
      if (error) throw new Error(`notification details: ${error.message}`)
      Object.assign(job, notificationPresentation(data))
    }
    const results = (await Promise.all([
      sendExpo(rows.filter((d) => d.channel === 'expo'), job),
      sendWeb(rows.filter((d) => d.channel === 'web'), job),
    ])).flat()
    if (results.length) await rpc('notif_worker_report', { p_results: results })
    for (const r of results) {
      if (r.outcome === 'accepted') stats.accepted++
      else if (r.outcome === 'retry') stats.retries++
      else if (r.outcome === 'invalid') stats.invalid++
      else stats.failed++
    }
  }

  // Sin entregas (preferencia, sin dispositivos, fila borrada) finish solo archiva el trabajo
  await rpc('notif_worker_finish', { p_msg_id: msgId, p_event_id: eventId })
  stats.jobs++
}

async function drainQueue(deadline: number, stats: Stats) {
  while (Date.now() < deadline) {
    const jobs = await rpc<Array<{ msg_id: number; event_id: string }>>('notif_worker_claim', {
      p_batch: BATCH_SIZE, p_vt: VISIBILITY_SECONDS,
    })
    if (!jobs?.length) return

    for (let i = 0; i < jobs.length; i += CONCURRENCY) {
      await Promise.all(jobs.slice(i, i + CONCURRENCY).map(async (j) => {
        try {
          await processJob(j.msg_id, j.event_id, stats)
        } catch (err) {
          // El trabajo sigue en la cola y reaparece al caducar su visibilidad
          console.error('job failed', j.event_id, (err as Error).message)
          await rpc('notif_worker_log', {
            p_level: 'error', p_kind: 'job_error',
            p_detail: { event_id: j.event_id, message: (err as Error).message },
          }).catch(() => {})
        }
      }))
    }
  }
}

async function checkReceipts(stats: Stats) {
  const due = await rpc<Array<{ delivery_id: string; ticket_id: string }>>('notif_worker_due_receipts', { p_limit: EXPO_MAX_RECEIPTS })
  if (!due?.length) return

  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${EXPO_ACCESS_TOKEN}`

  const res = await fetch(`${EXPO_API_BASE}/getReceipts`, {
    method: 'POST', headers, body: JSON.stringify({ ids: due.map((d) => d.ticket_id) }),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  })
  if (!res.ok) {
    await res.body?.cancel()
    console.warn('getReceipts', res.status) // se vuelve a pedir en la siguiente pasada
    return
  }
  const body = await res.json()
  const receipts: Record<string, { status: string; message?: string; details?: { error?: string } }> = body?.data ?? {}

  const results: Array<Record<string, unknown>> = []
  for (const d of due) {
    const receipt = receipts[d.ticket_id]
    if (!receipt) continue // aún no hay recibo
    if (receipt.status === 'ok') {
      results.push({ id: d.delivery_id, status: 'ok' })
      continue
    }
    const c = classifyExpoError(receipt.details?.error)
    if (c.config) await logConfigProblem('expo', c.code)
    results.push({ id: d.delivery_id, status: 'error', outcome: c.outcome, code: c.code, message: receipt.message })
  }
  if (results.length) await rpc('notif_worker_report_receipts', { p_results: results })
  stats.receipts += results.length
}

async function run(source: string) {
  const started = Date.now()
  const stats: Stats = { jobs: 0, accepted: 0, retries: 0, invalid: 0, failed: 0, receipts: 0 }
  let error: string | undefined
  try {
    await drainQueue(started + TIME_BUDGET_MS, stats)
    await checkReceipts(stats)
  } catch (err) {
    error = (err as Error).message
    console.error('worker run failed', error)
  }
  await rpc('notif_worker_heartbeat', {
    p_detail: { source, ms: Date.now() - started, ...stats, ...(error ? { error } : {}) },
  }).catch((err) => console.error(err.message))
}

async function secretMatches(given: string): Promise<boolean> {
  if (!WORKER_SECRET || !given) return false
  const digest = async (s: string) =>
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))
  const [a, b] = await Promise.all([digest(given), digest(WORKER_SECRET)])
  return a.reduce((diff, byte, i) => diff | (byte ^ b[i]), 0) === 0
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  if (!(await secretMatches(req.headers.get('x-notifications-secret') ?? ''))) {
    return new Response('Unauthorized', { status: 401 })
  }

  const source = (await req.json().catch(() => null))?.source ?? 'unknown'
  // pg_net espera 5 s como mucho: se responde ya y se sigue trabajando en segundo plano
  // @ts-ignore EdgeRuntime lo proporciona Supabase
  EdgeRuntime.waitUntil(run(String(source)))
  return Response.json({ accepted: true }, { status: 202 })
})
