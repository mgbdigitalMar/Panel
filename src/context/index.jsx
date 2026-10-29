import { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import {
  showSystemNotification, playNotificationSound, notificationsEnabled,
  enablePush, disablePush, getRegistration, listenForNotificationClicks,
} from '../services/webPush'
import {
  workModeSyncUpdate, changeWorkMode as changeWorkModeSvc, REQUEST_WORK_MODE, localISODate,
} from '../../shared/services/workMode.js'
import { mapProfile, fetchDnis, withDni } from '../../shared/services/profiles.js'
import { signIn, isFirstAccess } from '../../shared/services/auth.js'
import {
  fetchReservations as fetchReservationsSvc, fetchRooms as fetchRoomsSvc, fetchVehicles as fetchVehiclesSvc,
  updateReservationStatus as updateReservationStatusSvc, deleteResource as deleteResourceSvc,
} from '../../shared/services/reservations.js'
import { fetchRequests as fetchRequestsSvc } from '../../shared/services/requests.js'
import { safeFileUrl } from '../../shared/utils/urls.js'
import { toUserMessage } from '../../shared/utils/errors.js'

export const ThemeCtx = createContext()

function resolveTheme(mode) {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

export function ThemeProvider({ children }) {
  // mode = 'light' | 'dark' | 'system'
  const [mode, setModeState] = useState(() => {
    try { return localStorage.getItem('app-theme-mode') || 'dark'; } catch { return 'dark'; }
  })

  const applyMode = (m) => {
    const resolved = resolveTheme(m);
    document.documentElement.setAttribute('data-theme', resolved);
    // Same colour as the canvas under the browser bars (global.scss --canvas)
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', resolved === 'dark' ? '#101936' : '#D8E1FA');
    });
    try { localStorage.setItem('app-theme-mode', m); } catch {}
  }

  useEffect(() => { applyMode(mode); }, []);

  useEffect(() => { applyMode(mode); }, [mode]);

  // Listen to OS preference changes when mode === 'system'
  useEffect(() => {
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyMode('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);

  // Remember where the last press happened so the theme reveal starts there
  useEffect(() => {
    const track = (e) => {
      const root = document.documentElement;
      root.style.setProperty('--vt-x', `${e.clientX}px`);
      root.style.setProperty('--vt-y', `${e.clientY}px`);
      const r = Math.hypot(Math.max(e.clientX, innerWidth - e.clientX), Math.max(e.clientY, innerHeight - e.clientY));
      root.style.setProperty('--vt-r', `${Math.ceil(r)}px`);
    };
    window.addEventListener('pointerdown', track, { passive: true });
    return () => window.removeEventListener('pointerdown', track);
  }, []);

  // Theme changes that alter the resolved theme play a circular reveal
  const withThemeTransition = (update) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!document.startViewTransition || reduce) { update(); return; }
    const root = document.documentElement;
    // Colour transitions would make the new snapshot start from the old palette
    root.classList.add('theme-switching');
    const vt = document.startViewTransition(() => {
      flushSync(update);
    });
    vt.finished.finally(() => root.classList.remove('theme-switching'));
  };

  const setMode = (m) => {
    if (resolveTheme(m) === resolveTheme(mode)) { setModeState(m); return; }
    withThemeTransition(() => { setModeState(m); applyMode(m); });
  };
  const theme = resolveTheme(mode);

  return <ThemeCtx.Provider value={{ theme, mode, setMode }}>{children}</ThemeCtx.Provider>
}
export function useTheme() { return useContext(ThemeCtx) }

export const DataCtx = createContext()
export const RequestsCtx = createContext()
export const ReservationsCtx = createContext()
export const DocumentsCtx = createContext()
export const HoursCtx = createContext()
export const PersonalDaysCtx = createContext()
export const NewsCtx = createContext()
export const NotifsCtx = createContext()
export const DataSyncCtx = createContext()

export function DataProvider({ children }) {
  const [requests, setRequestsState]         = useState([])
  const [reservations, setReservationsState] = useState([])
  const [rooms, setRooms]                    = useState([])
  const [vehicles, setVehicles]              = useState([])
  const [documents, setDocuments]            = useState([])
  const [hourCompensations, setHourCompensations] = useState([])
  const [news, setNews]                      = useState([])
  const [personalDays, setPersonalDays]      = useState([])
  const [notifications, setNotifications]    = useState([]) // Persistent DB notifications
  const [loadingData, setLoadingData]        = useState(true)
  // A list could not be loaded: Layout offers to retry instead of showing it as empty
  const [loadFailed, setLoadFailed]          = useState(false)
const [readIds, setReadIds] = useState(() => {
  try {
    return new Set(JSON.parse(localStorage.getItem('margube_readNotifs') || '[]'));
  } catch {
    return new Set();
  }
})
  const [liveNotifs, setLiveNotifs]        = useState([])  // Real-time toasts

  // Removes the file behind a public Storage URL from the documents bucket
  const removeStorageFile = async (fileUrl) => {
    if (!fileUrl || !fileUrl.includes('/storage/v1/object/public/documents/')) return
    try {
      // URL format: .../storage/v1/object/public/documents/<path>
      const marker = '/storage/v1/object/public/documents/'
      const idx = fileUrl.indexOf(marker)
      if (idx === -1) return
      let path = fileUrl.substring(idx + marker.length)
      // Remove any query params (e.g. ?t=123)
      const qIdx = path.indexOf('?')
      if (qIdx !== -1) path = path.substring(0, qIdx)
      if (!path) return
      const { error } = await supabase.storage.from('documents').remove([decodeURIComponent(path)])
      if (error) console.warn('Storage delete error:', error.message)
    } catch (e) {
      console.warn('removeStorageFile error:', e)
    }
  }

  const fetchNotifications = async (userId) => {
    if (!userId) return
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) { console.warn('Notifications table check:', error.message); return }
    setNotifications(data || [])
  }

  const markNotifRead = async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    await supabase.from('notifications').update({ read: true }).eq('id', id)
  }

  const markAllNotifsRead = async (userId) => {
    if (!userId) return
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
  }

  const createNotification = async ({ userId, title, body, type = 'info', entityType, entityId }) => {
    const { error } = await supabase.from('notifications').insert([{
      user_id: userId,
      title,
      body: body || null,
      type,
      entity_type: entityType || null,
      entity_id: entityId || null,
      read: false,
    }])
    if (error) {
      console.warn('Could not insert notification:', error.message)
    }
  }

  // Employees load only their own requests and personal days; admins load everyone's.
  const ownRowsOnly = (query) => (user?.role === 'admin' ? query : query.eq('employee_id', user?.id))

  // Same queries as the app (shared/services): requests carry who reviewed them, and rooms and
  // vehicles whether they can be booked (an admin can hide one from the app or the web)
  async function fetchRequests() {
    if (!user?.id) { setRequestsState([]); return }
    const data = await fetchRequestsSvc(supabase, user.role === 'admin' ? {} : { employeeId: user.id })
    if (data) setRequestsState(data)
    else setLoadFailed(true)
  }

  // Same query as the app: the reservations_full view has no employee_id
  async function fetchReservations() {
    const data = await fetchReservationsSvc(supabase)
    if (data) setReservationsState(data)
    else setLoadFailed(true)
  }

  async function fetchRooms() {
    const data = await fetchRoomsSvc(supabase)
    if (data) setRooms(data.map(r => ({ ...r, equipment: r.equipment || [] })))
    else setLoadFailed(true)
  }

  async function fetchVehicles() {
    const data = await fetchVehiclesSvc(supabase)
    if (data) setVehicles(data)
    else setLoadFailed(true)
  }

  async function fetchDocuments() {
    const { data, error } = await supabase
      .from('documents')
      .select(`
        id, title, description, file_url, status, created_at, updated_at,
        sender_id, recipient_id,
        sender:profiles!documents_sender_id_fkey(name),
        recipient:profiles!documents_recipient_id_fkey(name)
      `)
      .order('created_at', { ascending: false })
    // On error keep what is on screen: showing sample data would look real
    if (error || !data) {
      if (error) { console.error('documents:', error); setLoadFailed(true) }
      return
    }
    setDocuments(data.map(d => ({
      id: d.id,
      title: d.title,
      description: d.description,
      fileUrl: safeFileUrl(d.file_url),
      status: d.status,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
      senderId: d.sender_id,
      senderName: d.sender?.name || null,
      recipientId: d.recipient_id,
      recipientName: d.recipient?.name || null,
    })))
  }

  async function fetchHourCompensations() {
    const { data, error } = await supabase
      .from('hour_compensations')
      .select(`
        id, date, reason, hours, type, status, created_at, reviewed_at,
        employee_id, reviewed_by,
        employee:profiles!hour_compensations_employee_id_fkey(name),
        reviewer:profiles!hour_compensations_reviewed_by_fkey(name)
      `)
      .order('created_at', { ascending: false })
    if (error || !data) {
      if (error) { console.error('hour_compensations:', error); setLoadFailed(true) }
      return
    }
    setHourCompensations(data.map(h => ({
      id: h.id,
      employeeId: h.employee_id,
      employeeName: h.employee?.name || null,
      reviewerId: h.reviewed_by,
      reviewerName: h.reviewer?.name || null,
      date: h.date,
      reason: h.reason,
      hours: parseFloat(h.hours),
      type: h.type,
      status: h.status,
      reviewedAt: h.reviewed_at,
      createdAt: h.created_at,
    })))
  }

  async function fetchPersonalDays() {
    if (!user?.id) { setPersonalDays([]); return }
    const { data, error } = await ownRowsOnly(supabase
      .from('personal_days')
      .select(`
        id, date, reason, file_url, status, created_at, reviewed_at,
        employee_id, reviewed_by,
        employee:profiles!personal_days_employee_id_fkey(name),
        reviewer:profiles!personal_days_reviewed_by_fkey(name)
      `)
      .order('created_at', { ascending: false }))
    if (error || !data) {
      if (error) { console.error('personal_days:', error); setLoadFailed(true) }
      return
    }
    setPersonalDays(data.map(p => ({
      id: p.id,
      employeeId: p.employee_id,
      employeeName: p.employee?.name || null,
      reviewerId: p.reviewed_by,
      reviewerName: p.reviewer?.name || null,
      date: p.date,
      reason: p.reason,
      fileUrl: safeFileUrl(p.file_url),
      status: p.status,
      reviewedAt: p.reviewed_at,
      createdAt: p.created_at,
    })))
  }

  async function fetchNews() {
    const { data, error } = await supabase
      .from('news')
      .select('*, author:profiles!news_author_id_fkey(name, avatar_initials)')
      .order('published_at', { ascending: false })
    if (error) { console.error('news:', error); setLoadFailed(true); return }
    setNews(data.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      content: n.content,
      authorId: n.author_id,
      authorName: n.author?.name || 'Usuario eliminado',
      authorAvatar: n.author?.avatar_initials || '??',
      date: n.published_at,
      pinned: n.pinned,
      category: n.category,
      isActive: n.is_active,
      createdAt: n.created_at
    })))
  }

  const auth = useContext(AuthCtx)
  const user = auth?.user
  const employees = auth?.employees || []

  const notifyAdmins = async ({ title, body, type = 'info', entityType, entityId }) => {
    const admins = employees.filter(e => e.role === 'admin')
    const adminIds = admins.map(e => e.id)
    if (adminIds.length === 0) return
    
    const notifs = adminIds.map(adminId => ({
      user_id: adminId,
      title,
      body: body || null,
      type,
      entity_type: entityType || null,
      entity_id: entityId || null,
      read: false,
    }))
    
    const { error } = await supabase.from('notifications').insert(notifs)
    if (error) {
      console.warn('Could not notify admins:', error.message)
    }
  }

  useEffect(() => {
    if (user?.id) {
      fetchNotifications(user.id)
    } else {
      setNotifications([])
    }
  }, [user?.id])

  const refetchAll = () => {
    setLoadFailed(false)
    return Promise.all([
    fetchRequests(), fetchReservations(), fetchRooms(), fetchVehicles(),
    fetchDocuments(), fetchHourCompensations(), fetchPersonalDays(), fetchNews(),
    ])
  }

  useEffect(() => {
    // Signed out (login screen, after logout): the tables are closed to the anon role, so loading
    // would only fill the console with 401 / "permission denied". Clear what the last person saw.
    if (!user?.id) {
      setRequestsState([]); setReservationsState([]); setRooms([]); setVehicles([]); setDocuments([])
      setHourCompensations([]); setNews([]); setPersonalDays([]); setLiveNotifs([])
      setLoadFailed(false)
      setLoadingData(false)
      return undefined
    }
    setLoadingData(true)
    refetchAll().finally(() => setLoadingData(false))

    // One table change often produces two events (e.g. the request UPDATE and
    // its row in `notifications`): the blip plays once per burst.
    let lastSoundAt = 0
    const pushNotif = (icon, msg) => {
      const id = Date.now() + Math.random()
      setLiveNotifs(prev => [{ id, icon, msg }, ...prev.slice(0, 4)])
      setTimeout(() => setLiveNotifs(prev => prev.filter(n => n.id !== id)), 6000)

      if (Date.now() - lastSoundAt > 1500) {
        lastSoundAt = Date.now()
        playNotificationSound()
      }
    }

    // System notification while the intranet is not in front of the person.
    // Only rows of `notifications` trigger it: they are the per-person feed and
    // share the `margube-<id>` tag with Web Push, so nothing shows twice.
    const notifyInBackground = (row) => {
      if (document.visibilityState === 'visible' && document.hasFocus()) return
      showSystemNotification({ id: row.id, title: row.title, body: row.body, entityType: row.entity_type, entityId: row.entity_id, type: row.type })
    }

    // New requests, reviews and documents for one person already arrive as a row of
    // `notifications` (toast + system notification below, push on other devices). The table
    // channels only refresh the lists: toasting them too showed every event twice, and any
    // later update of an approved request (e.g. back at the office) toasted "aprobada" again.
    const requestChannel = supabase
      .channel('realtime-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
        fetchRequests()
      })
      .subscribe()

    const reservationChannel = supabase
      .channel('realtime-reservations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
        fetchReservations()
      })
      .subscribe()

    const roomChannel = supabase
      .channel('realtime-rooms')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, (payload) => {
        fetchRooms()
        if (payload.eventType === 'INSERT') pushNotif('🏢', 'Nueva sala disponible')
        else if (payload.eventType === 'UPDATE') pushNotif('🏢', 'Sala actualizada')
        else if (payload.eventType === 'DELETE') pushNotif('🏢', 'Una sala ha sido eliminada')
      })
      .subscribe()

    const vehicleChannel = supabase
      .channel('realtime-vehicles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, (payload) => {
        fetchVehicles()
        if (payload.eventType === 'INSERT') pushNotif('🚗', 'Nuevo vehículo disponible')
        else if (payload.eventType === 'UPDATE') pushNotif('🚗', 'Vehículo actualizado')
        else if (payload.eventType === 'DELETE') pushNotif('🚗', 'Un vehículo ha sido eliminado')
      })
      .subscribe()

    const documentChannel = supabase
      .channel('realtime-documents')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, (payload) => {
        fetchDocuments()
        // A document sent to one person comes with its notification; a general one
        // (no recipient) has none, so it is announced here
        if (payload.eventType === 'INSERT' && payload.new.sender_id !== user?.id && !payload.new.recipient_id
          && payload.new.title !== '__ONBOARDING_DOC__') {
          pushNotif('📄', `Nuevo documento disponible: ${payload.new?.title || ''}`)
        }
      })
      .subscribe()

    const hoursChannel = supabase
      .channel('realtime-hours')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hour_compensations' }, () => {
        fetchHourCompensations()
      })
      .subscribe()

    const personalDaysChannel = supabase
      .channel('realtime-personal-days')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'personal_days' }, () => {
        fetchPersonalDays()
      })
      .subscribe()

    const newsChannel = supabase
      .channel('realtime-news')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'news' }, () => {
        fetchNews()
      })
      .subscribe()

    const notifChannel = supabase
      .channel('realtime-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        if (payload.new.user_id === user?.id) {
          setNotifications(prev => [payload.new, ...prev.slice(0, 49)])
          const icon = payload.new.type === 'success' ? '✅' : payload.new.type === 'error' ? '❌' : '🔔'
          pushNotif(icon, payload.new.title)
          notifyInBackground(payload.new)
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, (payload) => {
        if (payload.new.user_id === user?.id) {
          setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new : n))
        }
      })
      .subscribe()

    // Back in the foreground: refetch what the socket may have missed
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refetchAll()
        if (user?.id) fetchNotifications(user.id)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // Network came back → reopen the realtime socket and catch up
    const handleOnline = () => {
      supabase.realtime.connect()
      refetchAll()
      if (user?.id) fetchNotifications(user.id)
    }
    window.addEventListener('online', handleOnline)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('online', handleOnline)
      supabase.removeChannel(requestChannel)
      supabase.removeChannel(reservationChannel)
      supabase.removeChannel(roomChannel)
      supabase.removeChannel(vehicleChannel)
      supabase.removeChannel(documentChannel)
      supabase.removeChannel(hoursChannel)
      supabase.removeChannel(personalDaysChannel)
      supabase.removeChannel(newsChannel)
      supabase.removeChannel(notifChannel)
    }
  }, [user?.id])

  // Work mode follows the telework schedule and the approved remote / external requests (shared/services/workMode.js)
  const [syncingMode, setSyncingMode] = useState(null)
  useEffect(() => {
    if (!user?.id || loadingData || syncingMode) return;
    const update = workModeSyncUpdate(requests, user);
    if (!update) return;
    setSyncingMode(update);
    supabase.from('profiles').update(update).eq('id', user.id).then(({ error }) => {
      if (error) console.error('syncWorkMode:', error);
      else auth?.patchUser?.({
        ...(update.work_mode && { workMode: update.work_mode }),
        ...(update.telework_applied_on && { teleworkAppliedOn: update.telework_applied_on }),
      });
      setSyncingMode(null);
    });
  }, [user?.id, user?.workMode, user?.teleworkAppliedOn, requests, loadingData]);

  // Employee (own profile) or admin (directory) changes a work mode
  const changeWorkMode = async (employeeId, mode) => {
    const employee = employees.find(e => e.id === employeeId) || (user?.id === employeeId ? user : { id: employeeId })
    const res = await changeWorkModeSvc(supabase, employees, { employee, mode, requests, actorId: user?.id })
    if (!res.error && employeeId === user?.id) auth?.patchUser?.({ workMode: mode })
    await Promise.all([fetchRequests(), auth?.refreshEmployees?.()])
    return res
  }

  // The create actions return { data } or { error } with a message for the person (the database
  // checks write theirs in Spanish): the form shows it and keeps what was typed.
  const createRequest = async (employeeId, payload) => {
    const { data, error } = await supabase.from('requests').insert([{
      employee_id: employeeId,
      ...payload,
    }]).select().single()
    if (error) { console.error('createRequest:', error); return { error: toUserMessage(error) } }
    await fetchRequests()
    
    const typeLabel = payload.type === 'remoto' ? 'Remoto' : payload.type === 'external' ? 'Trabajo Externo' : 'Compra'
    const empName = employees.find(e => e.id === employeeId)?.name || 'Un empleado'
    await notifyAdmins({
      title: `📋 Nueva solicitud: ${typeLabel}`,
      body: `${empName} ha enviado una solicitud de ${typeLabel.toLowerCase()} que requiere revisión.`,
      type: 'info',
      entityType: 'request',
      entityId: data?.id
    })

    return { data }
  }

  const updateRequestStatus = async (id, status, reviewedBy, employeeId) => {
    const { data: reqData } = await supabase.from('requests').select('type, start_date, end_date').eq('id', id).single();
    
    const { error } = await supabase.from('requests').update({
      status, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) { console.error(error); return reportError(error) }

    // Approving a remote / external request that covers today changes the work mode at once
    if (status === 'approved' && REQUEST_WORK_MODE[reqData?.type] && employeeId) {
      const today = localISODate();
      if (today >= reqData.start_date && today <= reqData.end_date) {
        await supabase.from('profiles').update({ work_mode: REQUEST_WORK_MODE[reqData.type] }).eq('id', employeeId);
      }
    }

    await fetchRequests()
    
    if (employeeId) {
      const typeLabel = reqData?.type === 'external' ? 'trabajo externo' : reqData?.type === 'remoto' ? 'remoto' : 'compra';
      await createNotification({
        userId: employeeId,
        title: status === 'approved' ? '✅ Solicitud aprobada' : '❌ Solicitud rechazada',
        body: status === 'approved' 
          ? `Tu solicitud de ${typeLabel} ha sido aprobada.` 
          : `Tu solicitud de ${typeLabel} ha sido rechazada.`,
        type: status === 'approved' ? 'success' : 'error',
        entityType: 'request', entityId: id
      })
    }
    return { error: null }
  }

  const deleteRequest = async (id, type) => {
    if (type === 'asuntos_propios') {
      const p = personalDays.find(d => String(d.id) === String(id));
      await removeStorageFile(p?.fileUrl)
      const { error } = await supabase.from('personal_days').delete().eq('id', id);
      if (error) { console.error('deleteRequest (personal_day):', error); return reportError(error) }
      await fetchPersonalDays();
    } else {
      const { error } = await supabase.from('requests').delete().eq('id', id);
      if (error) { console.error('deleteRequest:', error); return reportError(error) }
      await fetchRequests();
    }
    return { error: null }
  }

  const createPersonalDay = async ({ employeeId, date, reason, fileUrl }) => {
    const { data, error } = await supabase.from('personal_days').insert([{
      employee_id: employeeId,
      date,
      reason,
      file_url: fileUrl || null,
      status: 'pending',
    }]).select().single()
    if (error) { console.error('createPersonalDay:', error); return { error: toUserMessage(error) } }
    await fetchPersonalDays()

    const empName = employees.find(e => e.id === employeeId)?.name || 'Un empleado'
    await notifyAdmins({
      title: `📝 Día de asuntos propios`,
      body: `${empName} ha solicitado un día de asuntos propios.`,
      type: 'info',
      entityType: 'personal_day',
      entityId: data?.id
    })
    return { data }
  }

  const updatePersonalDayStatus = async (id, status, reviewedBy, employeeId) => {
    const { error } = await supabase.from('personal_days').update({
      status,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) { console.error('updatePersonalDayStatus:', error); return reportError(error) }
    await fetchPersonalDays()

    if (employeeId) {
      await createNotification({
        userId: employeeId,
        title: status === 'approved' ? '✅ Asuntos propios aprobados' : '❌ Asuntos propios rechazados',
        body: status === 'approved' ? 'Tu solicitud de día de asuntos propios ha sido aprobada.' : 'Tu solicitud ha sido rechazada.',
        type: status === 'approved' ? 'success' : 'error',
        entityType: 'personal_day', entityId: id
      })
    }
    return { error: null }
  }

  const createReservation = async (employeeId, payload) => {
    let rName = payload.resourceName;
    if (!rName) {
      if (payload.type === 'room') {
        rName = rooms.find(r => String(r.id) === String(payload.room_id))?.name || 'Sala';
      } else {
        rName = vehicles.find(v => String(v.id) === String(payload.vehicle_id))?.model || 'Vehículo';
      }
    }

    const roomId = payload.type === 'room' && payload.room_id ? parseInt(payload.room_id, 10) : null;
    const vehicleId = payload.type === 'vehicle' && payload.vehicle_id ? parseInt(payload.vehicle_id, 10) : null;
    const purpose = payload.purpose?.trim() || (payload.type === 'room' ? 'Reserva de sala' : 'Uso de vehículo');

    // Same resource, same day, overlapping times (start < other end and end > other start).
    // Asked to the database right before inserting, so the list on screen can't be stale.
    const resourceCol = payload.type === 'room' ? 'room_id' : 'vehicle_id'
    const { data: clash, error: clashErr } = await supabase.from('reservations')
      .select('time_start, time_end')
      .eq(resourceCol, payload.type === 'room' ? roomId : vehicleId)
      .eq('date', payload.date)
      .neq('status', 'cancelled') // reservation_status has no 'rejected'
      .lt('time_start', payload.time_end)
      .gt('time_end', payload.time_start)
      .limit(1)
    if (clashErr) {
      console.error('createReservation (overlap check):', clashErr)
      return { error: 'No se pudo comprobar la disponibilidad. Inténtalo de nuevo.' }
    }
    if (clash?.length) {
      const c = clash[0]
      return { error: `${rName} ya está reservado de ${c.time_start?.slice(0, 5)} a ${c.time_end?.slice(0, 5)} ese día. Elige otra franja u otro recurso.` }
    }

    const { data, error } = await supabase.from('reservations').insert([{
      employee_id: employeeId,
      type: payload.type,
      room_id: roomId,
      vehicle_id: vehicleId,
      date: payload.date,
      time_start: payload.time_start,
      time_end: payload.time_end,
      purpose,
      status: payload.status || 'pending'
    }]).select().single()
    if (error) { 
      console.error('createReservation error:', error); 
      return { error: toUserMessage(error, 'Error al crear la reserva') }
    }
    await fetchReservations()
    
    const empName = employees.find(e => e.id === employeeId)?.name || 'Un empleado'
    await notifyAdmins({
      title: `📅 Nueva reserva: ${rName}`,
      body: `${empName} ha realizado una reserva de ${payload.type === 'room' ? 'sala' : 'vehículo'}.`,
      type: 'info',
      entityType: 'reservation',
      entityId: data?.id ? String(data.id) : null
    })
    
    return { data }
  }

  // Shared with the app: the owner gets a notification (and push) with the decision
  const updateReservationStatus = async (id, status, reviewedBy) => {
    const reservation = reservations.find(r => String(r.id) === String(id))
    const { error } = await updateReservationStatusSvc(supabase, id, status, reviewedBy, reservation)
    if (error) return reportError(error)
    await fetchReservations()
    return { error: null }
  }

  const deleteReservation = async (id) => {
    const { error } = await supabase.from('reservations').delete().eq('id', id)
    if (error) { console.error(error); return reportError(error) }
    await fetchReservations()
    return { error: null }
  }

  // Admin: a room or vehicle goes with its reservations (same rule as the app)
  const deleteResource = async (type, id) => {
    const { error } = await deleteResourceSvc(supabase, type, id)
    await Promise.all([type === 'vehicle' ? fetchVehicles() : fetchRooms(), fetchReservations()])
    if (error) return reportError(error)
    return { error: null }
  }

  const sendDocument = async ({ title, description, fileUrl, senderId, recipientId }) => {
    const { data, error } = await supabase.from('documents').insert([{
      title,
      description,
      file_url: fileUrl || null,
      sender_id: senderId,
      recipient_id: recipientId,
      status: 'pending',
    }]).select().single()
    
    if (error) { 
      console.error('sendDocument error:', error); 
      return { error } 
    }
    
    await fetchDocuments()

    if (recipientId) {
      await createNotification({
        userId: recipientId,
        title: `📄 Nuevo documento: ${title}`,
        body: description || 'Tienes un nuevo documento disponible en tu perfil.',
        type: 'info',
        entityType: 'document', entityId: data?.id
      })
    }
    return { data }
  }

  // Upload a File object → first tries Supabase Storage, falls back to base64 data URL
  const uploadDocumentFile = async (file) => {
    if (!file) return { url: null }

    if (file.size > 15 * 1024 * 1024) {
      return { error: 'El archivo supera el tamaño máximo permitido (15 MB).' }
    }

    try {
      const ext  = file.name.split('.').pop()
      const path = `docs/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('documents')
        .upload(path, file, { cacheControl: '3600', upsert: false })
        
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
        return { url: publicUrl }
      }
      
      console.warn('Supabase Storage no disponible:', upErr.message)
      
      if (file.size > 15 * 1024 * 1024) {
        return { error: `Error en Storage: ${upErr.message}. Crea el bucket 'documents' como público en Supabase.` }
      }
    } catch (e) {
      console.warn('Storage error:', e)
      if (file.size > 15 * 1024 * 1024) {
        return { error: 'Error en Storage. Crea el bucket "documents" en Supabase.' }
      }
    }

    // Fallback without a bucket: a base64 data URL
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve({ url: e.target.result })
      reader.onerror = () => resolve({ error: 'Error leyendo archivo localmente' })
      reader.readAsDataURL(file)
    })
  }

  const updateDocumentStatus = async (id, status) => {
    const { error } = await supabase.from('documents').update({
      status,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) { console.error('updateDocumentStatus:', error); return reportError(error) }
    await fetchDocuments()
    return { error: null }
  }

  const deleteDocument = async (id) => {
    const doc = documents.find(d => String(d.id) === String(id));
    await removeStorageFile(doc?.fileUrl)
    const { error } = await supabase.from('documents').delete().eq('id', id)
    if (error) { console.error('deleteDocument:', error); return reportError(error) }
    await fetchDocuments()
    return { error: null }
  }

  const createHourCompensation = async ({ employeeId, date, reason, hours, type }) => {
    // 'ya' and 'debe' are auto-approved; 'bolsa' waits for admin
    const status = type === 'bolsa' ? 'pending' : 'approved'
    const { data, error } = await supabase.from('hour_compensations').insert([{
      employee_id: employeeId,
      date,
      reason,
      hours: parseFloat(hours),
      type,
      status,
      reviewed_at: type === 'ya' ? new Date().toISOString() : null,
    }]).select().single()
    if (error) { console.error('createHourCompensation:', error); return { error: toUserMessage(error) } }
    await fetchHourCompensations()

    if (type === 'bolsa') {
      const empName = employees.find(e => e.id === employeeId)?.name || 'Un empleado'
      await notifyAdmins({
        title: `⌛ Nueva bolsa de horas`,
        body: `${empName} solicita compensar ${hours}h en su bolsa.`,
        type: 'info',
        entityType: 'hour_compensation',
        entityId: data?.id
      })
    }

    return { data }
  }

  const updateHourCompensationStatus = async (id, status, reviewedBy, employeeId) => {
    const { error } = await supabase.from('hour_compensations').update({
      status,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) { console.error('updateHourCompensationStatus:', error); return reportError(error) }
    await fetchHourCompensations()

    if (employeeId) {
      await createNotification({
        userId: employeeId,
        title: status === 'approved' ? '✅ Horas aprobadas' : '❌ Horas rechazadas',
        body: status === 'approved' ? 'Tu solicitud de bolsa de horas ha sido aprobada.' : 'Tu solicitud ha sido rechazada.',
        type: status === 'approved' ? 'success' : 'error',
        entityType: 'hour_compensation', entityId: id
      })
    }
    return { error: null }
  }

  const deleteHourCompensation = async (id) => {
    const { error } = await supabase.from('hour_compensations').delete().eq('id', id);
    if (error) { console.error('deleteHourCompensation:', error); return reportError(error) }
    await fetchHourCompensations();
    return { error: null }
  }

  const createNews = async (payload) => {
    const { error } = await supabase.from('news').insert([payload])
    if (error) { console.error('createNews:', error); return reportError(error) }
    await fetchNews()
    return { error: null }
  }
  const updateNews = async (id, payload) => {
    const { error } = await supabase.from('news').update(payload).eq('id', id)
    if (error) { console.error('updateNews:', error); return reportError(error) }
    await fetchNews()
    return { error: null }
  }
  const deleteNews = async (id) => {
    const { error } = await supabase.from('news').delete().eq('id', id)
    if (error) { console.error('deleteNews:', error); return reportError(error) }
    await fetchNews()
    return { error: null }
  }

  const deleteEmployeeData = async (employeeId) => {
    const empDocs = documents.filter(d => String(d.senderId) === String(employeeId) || String(d.recipientId) === String(employeeId));
    for (const doc of empDocs) {
      await removeStorageFile(doc.fileUrl)
    }
    const empDays = personalDays.filter(p => String(p.employeeId) === String(employeeId));
    for (const p of empDays) {
      await removeStorageFile(p.fileUrl)
    }
  }

  // Confirms the person's own action (no sound: they just did it)
  const announce = (icon, msg, ms = 4000) => {
    const id = Date.now() + Math.random()
    setLiveNotifs(prev => [{ id, icon, msg }, ...prev.slice(0, 4)])
    setTimeout(() => setLiveNotifs(prev => prev.filter(n => n.id !== id)), ms)
  }

  // A write that failed (permissions, a database check, the network) is said on
  // screen: the pages calling these actions used to show nothing at all
  const reportError = (error) => {
    const msg = toUserMessage(error)
    // Longer than a confirmation: the person has to read what went wrong
    announce('❌', msg, 7000)
    return { error: msg }
  }

  const markRead = (id) => setReadIds(prev => {
    const next = new Set([...prev, id]);
    localStorage.setItem('margube_readNotifs', JSON.stringify(Array.from(next)));
    return next;
  });

  const markAllRead = (ids) => setReadIds(prev => {
    const next = new Set([...prev, ...ids]);
    localStorage.setItem('margube_readNotifs', JSON.stringify(Array.from(next)));
    return next;
  });

  useEffect(() => {
    localStorage.setItem('margube_readNotifs', JSON.stringify(Array.from(readIds)));
  }, [readIds]);

  // The actions read `employees` and `user` from this render: without them in the deps,
  // a value memoized before the employees loaded would notify no admin.
  const requestValue = useMemo(() => ({ requests, createRequest, updateRequestStatus, deleteRequest, changeWorkMode }), [requests, personalDays, employees, user]);
  const resValue = useMemo(() => ({ reservations, rooms, vehicles, createReservation, updateReservationStatus, deleteReservation, deleteResource }), [reservations, rooms, vehicles, employees]);
  const docValue = useMemo(() => ({ documents, sendDocument, updateDocumentStatus, uploadDocumentFile, deleteDocument, onboardingDocUrl: documents?.find(d => d.title === '__ONBOARDING_DOC__')?.fileUrl || null, deleteEmployeeData }), [documents, personalDays]);
  const hourValue = useMemo(() => ({ hourCompensations, createHourCompensation, updateHourCompensationStatus, deleteHourCompensation }), [hourCompensations, employees]);
  const pdValue = useMemo(() => ({ personalDays, createPersonalDay, updatePersonalDayStatus }), [personalDays, employees]);
  const newsValue = useMemo(() => ({ news, createNews, updateNews, deleteNews }), [news]);
  const notifValue = useMemo(() => ({ notifications, markNotifRead, markAllNotifsRead, readIds, markRead, markAllRead, liveNotifs, announce }), [notifications, readIds, liveNotifs]);
  const syncValue = useMemo(() => ({ loadingData, loadFailed, refresh: refetchAll }), [loadingData, loadFailed]);

  const contextValue = useMemo(() => ({
    ...requestValue, ...resValue, ...docValue, ...hourValue, ...pdValue, ...newsValue, ...notifValue, ...syncValue
  }), [requestValue, resValue, docValue, hourValue, pdValue, newsValue, notifValue, syncValue]);

  return (
    <DataSyncCtx.Provider value={syncValue}>
      <NotifsCtx.Provider value={notifValue}>
        <NewsCtx.Provider value={newsValue}>
          <PersonalDaysCtx.Provider value={pdValue}>
            <HoursCtx.Provider value={hourValue}>
              <DocumentsCtx.Provider value={docValue}>
                <ReservationsCtx.Provider value={resValue}>
                  <RequestsCtx.Provider value={requestValue}>
                    <DataCtx.Provider value={contextValue}>
                      {children}
                    </DataCtx.Provider>
                  </RequestsCtx.Provider>
                </ReservationsCtx.Provider>
              </DocumentsCtx.Provider>
            </HoursCtx.Provider>
          </PersonalDaysCtx.Provider>
        </NewsCtx.Provider>
      </NotifsCtx.Provider>
    </DataSyncCtx.Provider>
  )
}
export function useData() { return useContext(DataCtx) }
export function useRequests() { return useContext(RequestsCtx) }
export function useReservations() { return useContext(ReservationsCtx) }
export function useDocuments() { return useContext(DocumentsCtx) }
export function useHours() { return useContext(HoursCtx) }
export function usePersonalDays() { return useContext(PersonalDaysCtx) }
export function useNews() { return useContext(NewsCtx) }
export function useNotifs() { return useContext(NotifsCtx) }
export function useDataSync() { return useContext(DataSyncCtx) }

export const AuthCtx = createContext()

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser]                     = useState(null)
  const [employees, setEmployeesState]      = useState([])
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [authLoading, setAuthLoading]       = useState(true)

  const IDLE_TIMEOUT = 60 * 1000
  // The idle logout is announced this long before, so whatever is being typed can be kept
  const IDLE_WARNING = 15 * 1000
  // A ref, not state: activity events fire on every mouse move and must not re-render the app
  const lastActivityRef = useRef(Date.now())
  const markerWrittenRef = useRef(0)
  const setLastActivity = useCallback((t = Date.now()) => { lastActivityRef.current = t }, [])
  const [idleLeft, setIdleLeft] = useState(null) // seconds shown in the warning; null = hidden

  async function loadProfile(id) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error || !data) return null
    // The DNI is private (profile_private): the person sees their own
    const [profile] = withDni([mapProfile(data)], await fetchDnis(supabase))
    return profile
  }

  // Signed in: show the app (or the first-access password page)
  async function startSession(profile) {
    setUser(profile)
    const tabId = sessionStorage.getItem('margube_tabId') || 'tab_main'
    localStorage.setItem('margube_session', JSON.stringify({ id: profile.id, tabId, lastActivity: Date.now() }))
    await loadAllEmployees()
    navigate(isFirstAccess(profile) ? '/changePassword' : '/dashboard')
  }

  async function loadAllEmployees() {
    const [{ data, error }, dnis] = await Promise.all([
      supabase.from('profiles').select('*').order('name'),
      fetchDnis(supabase),
    ])
    if (error) { console.error('employees:', error); return }
    // Admins get every DNI, employees only their own
    setEmployeesState(withDni(data.map(mapProfile), dnis))
  }

  // Per-tab session + synchronized logout across tabs
  useEffect(() => {
    let tabId = sessionStorage.getItem('margube_tabId')
    if (!tabId) {
      tabId = 'tab_' + Math.random().toString(36).substr(2, 9)
      sessionStorage.setItem('margube_tabId', tabId)
    }
    
    const bc = new BroadcastChannel('margube_sessions')
    
    // Session restore: the identity comes from the Supabase Auth session, the
    // stored marker only says when this browser was last active.
    const restoreSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          localStorage.removeItem('margube_session')
          return
        }
        const stored = JSON.parse(localStorage.getItem('margube_session') || 'null')
        if (!stored || Date.now() - stored.lastActivity > IDLE_TIMEOUT) {
          clearSession()
          return
        }
        const profile = await loadProfile(session.user.id)
        if (profile) await startSession(profile)
        else clearSession()
      } catch (e) {
        console.error('Error restoring session:', e)
        clearSession()
      } finally {
        setAuthLoading(false)
      }
    }

    const clearSession = () => {
      supabase.auth.signOut({ scope: 'local' })
      localStorage.removeItem('margube_session')
      sessionStorage.removeItem('margube_tabId')
      bc.postMessage({ type: 'logout' })
      setUser(null)
      navigate('/login')
    }

    restoreSession()

    // Session ended elsewhere (another tab, or it could not be refreshed)
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('margube_session')
        setUser(null)
        navigate('/login')
      }
    })
    
    const handleBCMessage = (ev) => {
      if (ev.data.type === 'logout') {
        localStorage.removeItem('margube_session')
        sessionStorage.removeItem('margube_tabId')
        setUser(null)
        navigate('/login')
      }
    }
    
    bc.addEventListener('message', handleBCMessage)
    
    return () => {
      bc.removeEventListener('message', handleBCMessage)
      bc.close()
      authSub.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const profilesChannel = supabase
      .channel('realtime-profiles')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'profiles'
        }, 
        (payload) => {
          loadAllEmployees()
          // Own row (e.g. work mode set by an approved request): refresh the session user
          // profiles.phone no longer carries the DNI: keep the one already loaded
          setUser(prev => (prev && payload.new?.id === prev.id ? { ...prev, ...mapProfile(payload.new), phone: mapProfile(payload.new).phone || prev.phone } : prev))
        }
      )
      .subscribe()

    // Back from the background: catch profile changes the socket may have missed
    const handleVisibility = async () => {
      if (document.visibilityState !== 'visible') return
      let id = null
      try { id = JSON.parse(localStorage.getItem('margube_session') || 'null')?.id } catch { /* corrupt entry */ }
      // Signed out: profiles are closed to the anon role, nothing to refresh
      if (!id) return
      loadAllEmployees()
      const { data } = await supabase.from('profiles').select('*').eq('id', id).single()
      if (data) setUser(prev => (prev && prev.id === data.id ? { ...prev, ...mapProfile(data), phone: mapProfile(data).phone || prev.phone } : prev))
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      supabase.removeChannel(profilesChannel)
    }
  }, [])

  // Idle logout, paused while the tab is hidden. Checked every second so the warning can count down.
  useEffect(() => {
    if (!user) { setIdleLeft(null); return undefined }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') lastActivityRef.current = Date.now()
    }
    document.addEventListener('visibilitychange', onVisibility)

    const tick = () => {
      if (document.visibilityState !== 'visible') return
      // Reading inside an iframe (e.g. the mandatory policy PDF) sends no
      // mouse or key events to this page: don't count it as inactivity
      if (user.policyAccepted !== true || document.activeElement?.tagName === 'IFRAME') {
        lastActivityRef.current = Date.now()
        setIdleLeft(null)
        return
      }
      const last = lastActivityRef.current
      const left = IDLE_TIMEOUT - (Date.now() - last)
      if (left <= 0) { setIdleLeft(null); logout(); return }
      setIdleLeft(left <= IDLE_WARNING ? Math.ceil(left / 1000) : null)

      // restoreSession treats a marker older than IDLE_TIMEOUT as stale: without this,
      // a reload a minute after signing in would log every tab out.
      if (last - markerWrittenRef.current > 5000) {
        markerWrittenRef.current = last
        try {
          const stored = JSON.parse(localStorage.getItem('margube_session') || 'null')
          if (stored?.id === user.id) localStorage.setItem('margube_session', JSON.stringify({ ...stored, lastActivity: last }))
        } catch { /* corrupt or blocked storage */ }
      }
    }
    const interval = setInterval(tick, 1000)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [user])

  const stayActive = useCallback(() => { lastActivityRef.current = Date.now(); setIdleLeft(null) }, [])
  const idleValue = useMemo(() => ({ secondsLeft: idleLeft, stayActive }), [idleLeft, stayActive])

  // Signed in + "Alertas de escritorio" on → link this browser's Web Push
  // subscription to the current person (idempotent, safe on every load).
  useEffect(() => {
    if (!user?.id || !notificationsEnabled()) return
    getRegistration().then(() => enablePush(user.id))
  }, [user?.id])

  // Clicking a system notification focuses this tab on the right page
  useEffect(() => listenForNotificationClicks(path => navigate(path)), [])

  // Supabase Auth checks the password on the server; the browser never sees a hash.
  const login = async (email, pass) => {
    const res = await signIn(supabase, email, pass)
    if (!res.ok) return res

    const profile = await loadProfile(res.userId)
    if (!profile) {
      await supabase.auth.signOut({ scope: 'local' })
      return { ok: false, msg: 'Tu cuenta no tiene ficha de empleado. Contacta con RRHH.' }
    }
    setLastActivity(Date.now())
    await startSession(profile)
    return { ok: true }
  }

  const logout = async () => {
    // Unregister this browser's pushes first: the call needs the session
    await disablePush({ keepBrowserSubscription: true }).catch(() => {})
    supabase.auth.signOut({ scope: 'local' })
    localStorage.removeItem('margube_session')
    localStorage.removeItem('margube_tabId')
    sessionStorage.removeItem('margube_tabId')
    localStorage.removeItem('margube_readNotifs')
    const bc = new BroadcastChannel('margube_sessions')
    bc.postMessage({ type: 'logout' })
    bc.close()
    setUser(null)
    setEmployeesState([])
    setNeedsOnboarding(false)
    navigate('/login')
  }

  const setCurrentUser = async (updates) => {
    if (updates.firstLogin === false) {
      await supabase.from('profiles').update({ first_login: false }).eq('id', updates.id)
    }
    if (updates.workMode) {
      await supabase.from('profiles').update({ work_mode: updates.workMode }).eq('id', updates.id)
    }
    if (updates.policyAccepted === true) {
      await supabase.from('profiles').update({ policy_accepted: true }).eq('id', updates.id)
    }
    setUser(prev => ({ ...prev, ...updates }))
    await loadAllEmployees()
  }

  const setEmployees = (updater) => {
    if (typeof updater === 'function') {
      setEmployeesState(updater)
    } else {
      setEmployeesState(updater)
    }
  }

  // Local-only update of the session user (the row was already written)
  const patchUser = (updates) => setUser(prev => (prev ? { ...prev, ...updates } : prev))

  const contextValue = useMemo(() => ({
    user, login, logout, setLastActivity,
    employees, setEmployees,
    setCurrentUser, patchUser,
    refreshEmployees: loadAllEmployees,
    needsOnboarding, setNeedsOnboarding,
    authLoading,
  }), [user, employees, needsOnboarding, authLoading])

  return (
    <AuthCtx.Provider value={contextValue}>
      {/* Its own context: the countdown re-renders only the warning, not the app */}
      <IdleCtx.Provider value={idleValue}>
        {children}
      </IdleCtx.Provider>
    </AuthCtx.Provider>
  )
}
export function useAuth() { return useContext(AuthCtx) }

export const IdleCtx = createContext({ secondsLeft: null, stayActive: () => {} })
export function useIdle() { return useContext(IdleCtx) }

export const AppCtx = createContext()
