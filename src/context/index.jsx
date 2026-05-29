import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { supabase } from '../utils/supabase'
import bcrypt from 'bcryptjs'
import { MOCK_DOCUMENTS, MOCK_HOUR_COMPENSATIONS } from '../data/mockData'

// ─── THEME CONTEXT ────────────────────────────────────────────
export const ThemeCtx = createContext()

// Resolves the actual applied theme ('dark'|'light') from mode
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
    try { localStorage.setItem('app-theme-mode', m); } catch {}
  }

  // Apply on mount
  useEffect(() => { applyMode(mode); }, []);

  // Re-apply whenever mode changes
  useEffect(() => { applyMode(mode); }, [mode]);

  // Listen to OS preference changes when mode === 'system'
  useEffect(() => {
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyMode('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);

  const setMode = (m) => setModeState(m);
  // Legacy toggle kept for any remaining usages
  const toggle = () => setModeState(prev => prev === 'dark' ? 'light' : 'dark');
  // theme = resolved applied value (for icon logic, etc.)
  const theme = resolveTheme(mode);

  return <ThemeCtx.Provider value={{ theme, mode, setMode, toggle }}>{children}</ThemeCtx.Provider>
}
export function useTheme() { return useContext(ThemeCtx) }

// ─── DATA CONTEXT (Requests + Reservations via Supabase) ──────
export const DataCtx = createContext()

export function DataProvider({ children }) {
  const [requests, setRequestsState]         = useState([])
  const [reservations, setReservationsState] = useState([])
  const [rooms, setRooms]                    = useState([])
  const [vehicles, setVehicles]              = useState([])
  const [documents, setDocuments]            = useState([])
  const [hourCompensations, setHourCompensations] = useState([])
  const [news, setNews]                      = useState([])
  const [personalDays, setPersonalDays]      = useState([]) // New personal days state
  const [notifications, setNotifications]    = useState([]) // Persistent DB notifications
  const [loadingData, setLoadingData]        = useState(true)
const [readIds, setReadIds] = useState(() => {
  try {
    return new Set(JSON.parse(localStorage.getItem('margube_readNotifs') || '[]'));
  } catch {
    return new Set();
  }
})
  const [liveNotifs, setLiveNotifs]        = useState([])  // Real-time toasts

  // ── Storage cleanup helper ─────────────────────────────────
  // Extracts the file path from a Supabase Storage URL and removes it from the bucket
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

  // ── Persistent Notifications (DB) ────────────────────────
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

  // ── Fetch helpers ─────────────────────────────────────────
  async function fetchRequests() {
    const { data, error } = await supabase
      .from('requests')
      .select(`
        id, type, status, reason, created_at,
        start_date, end_date, days, item, amount,
        employee:profiles!requests_employee_id_fkey(id, name, department, avatar_initials)
      `)
      .order('created_at', { ascending: false })
    if (error) { console.error('requests:', error); return }
    setRequestsState(data.map(r => ({
      id: r.id,
      type: r.type,
      status: r.status,
      reason: r.reason,
      createdAt: r.created_at,
      employeeId: r.employee?.id,
      employeeName: r.employee?.name,
      // vacation
      startDate: r.start_date,
      endDate: r.end_date,
      days: r.days,
      // purchase
      item: r.item,
      amount: r.amount,
    })))
  }

  async function fetchReservations() {
    const { data, error } = await supabase
      .from('reservations_full')
      .select('*')
      .order('date', { ascending: false })
    if (error) { console.error('reservations:', error); return }
    setReservationsState(data.map(r => ({
      id: r.id,
      type: r.type,
      resourceName: r.resource_name,
      employeeId: r.employee_id,
      employeeName: r.employee_name,
      date: r.date,
      timeStart: r.time_start?.slice(0, 5),
      timeEnd:   r.time_end?.slice(0, 5),
      purpose: r.purpose,
      status: r.status,
    })))
  }

  async function fetchRooms() {
    const { data, error } = await supabase.from('rooms').select('*').order('id')
    if (error) { console.error('rooms:', error); return }
    setRooms(data.map(r => ({ id: r.id, name: r.name, capacity: r.capacity, floor: r.floor, equipment: r.equipment })))
  }

  async function fetchVehicles() {
    const { data, error } = await supabase.from('vehicles').select('*').order('id')
    if (error) { console.error('vehicles:', error); return }
    setVehicles(data.map(v => ({ id: v.id, plate: v.plate, model: v.model, year: v.year, type: v.type })))
  }

  async function fetchDocuments() {
    const { data, error } = await supabase
      .from('documents')
      .select(`
        id, title, description, file_url, status, created_at, updated_at,
        sender_id, recipient_id
      `)
      .order('created_at', { ascending: false })
    if (error || !data) {
      // Fallback to mock data (table may not exist yet or be empty)
      if (error) console.error('documents:', error)
      setDocuments(MOCK_DOCUMENTS.map(d => ({
        id: d.id,
        title: d.title,
        description: d.description,
        fileUrl: d.file_url,
        status: d.status,
        createdAt: d.created_at,
        senderId: d.sender_id,
        senderName: d.senderName,
        recipientId: d.recipient_id,
        recipientName: d.recipientName,
      })))
      return
    }
    setDocuments(data.map(d => ({
      id: d.id,
      title: d.title,
      description: d.description,
      fileUrl: d.file_url,
      status: d.status,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
      senderId: d.sender_id,
      senderName: null,  // resolved below if needed
      recipientId: d.recipient_id,
      recipientName: null,
    })))
  }

  async function fetchHourCompensations() {
    const { data, error } = await supabase
      .from('hour_compensations')
      .select(`
        id, date, reason, hours, type, status, created_at, reviewed_at,
        employee_id, reviewed_by
      `)
      .order('created_at', { ascending: false })
    if (error || !data) {
      if (error) console.error('hour_compensations:', error)
      setHourCompensations(MOCK_HOUR_COMPENSATIONS.map(h => ({
        id: h.id,
        employeeId: h.employee_id,
        employeeName: h.employeeName,
        date: h.date,
        reason: h.reason,
        hours: h.hours,
        type: h.type,
        status: h.status,
        createdAt: h.created_at,
      })))
      return
    }
    setHourCompensations(data.map(h => ({
      id: h.id,
      employeeId: h.employee_id,
      employeeName: null,
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
    const { data, error } = await supabase
      .from('personal_days')
      .select(`
        id, date, reason, file_url, status, created_at, reviewed_at,
        employee_id, reviewed_by
      `)
      .order('created_at', { ascending: false })
    if (error || !data) {
      if (error) console.error('personal_days:', error)
      setPersonalDays([])
      return
    }
    setPersonalDays(data.map(p => ({
      id: p.id,
      employeeId: p.employee_id,
      employeeName: null,
      date: p.date,
      reason: p.reason,
      fileUrl: p.file_url,
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
    if (error) { console.error('news:', error); return }
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
    
    // Create notifications for each admin
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

  const refetchAll = () => Promise.all([
    fetchRequests(), fetchReservations(), fetchRooms(), fetchVehicles(),
    fetchDocuments(), fetchHourCompensations(), fetchPersonalDays(), fetchNews(),
  ])

  useEffect(() => {
    refetchAll().finally(() => setLoadingData(false))

    // ── Supabase Realtime subscriptions ─────────────────────

    const pushNotif = (icon, msg) => {
      const id = Date.now()
      setLiveNotifs(prev => [{ id, icon, msg }, ...prev.slice(0, 4)])
      // Auto-dismiss after 6 s
      setTimeout(() => setLiveNotifs(prev => prev.filter(n => n.id !== id)), 6000)
    }

    // Requests — all events
    const requestChannel = supabase
      .channel('realtime-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, (payload) => {
        fetchRequests()
        if (payload.eventType === 'INSERT') pushNotif('📋', 'Nueva solicitud recibida')
        else if (payload.eventType === 'UPDATE') {
          const s = payload.new?.status
          if (s === 'approved') pushNotif('✅', 'Una solicitud ha sido aprobada')
          else if (s === 'rejected') pushNotif('❌', 'Una solicitud ha sido rechazada')
        }
      })
      .subscribe()

    // Reservations — all events
    const reservationChannel = supabase
      .channel('realtime-reservations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, (payload) => {
        fetchReservations()
        if (payload.eventType === 'INSERT') pushNotif('📅', 'Nueva reserva pendiente de revisión')
        else if (payload.eventType === 'UPDATE') {
          const s = payload.new?.status
          if (s === 'confirmed') pushNotif('✅', 'Tu reserva ha sido confirmada')
          else if (s === 'cancelled') pushNotif('❌', 'Tu reserva ha sido cancelada')
        }
      })
      .subscribe()

    // Rooms — all events
    const roomChannel = supabase
      .channel('realtime-rooms')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, (payload) => {
        fetchRooms()
        if (payload.eventType === 'INSERT') pushNotif('🏢', 'Nueva sala disponible')
        else if (payload.eventType === 'UPDATE') pushNotif('🏢', 'Sala actualizada')
        else if (payload.eventType === 'DELETE') pushNotif('🏢', 'Una sala ha sido eliminada')
      })
      .subscribe()

    // Vehicles — all events
    const vehicleChannel = supabase
      .channel('realtime-vehicles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, (payload) => {
        fetchVehicles()
        if (payload.eventType === 'INSERT') pushNotif('🚗', 'Nuevo vehículo disponible')
        else if (payload.eventType === 'UPDATE') pushNotif('🚗', 'Vehículo actualizado')
        else if (payload.eventType === 'DELETE') pushNotif('🚗', 'Un vehículo ha sido eliminado')
      })
      .subscribe()

    // Documents — all events
    const documentChannel = supabase
      .channel('realtime-documents')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, (payload) => {
        fetchDocuments()
        if (payload.eventType === 'INSERT') pushNotif('📄', `Nuevo documento recibido: ${payload.new?.title || ''}`)
      })
      .subscribe()

    // Hour compensations — all events
    const hoursChannel = supabase
      .channel('realtime-hours')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hour_compensations' }, (payload) => {
        fetchHourCompensations()
        if (payload.eventType === 'UPDATE') {
          const s = payload.new?.status
          if (s === 'approved') pushNotif('✅', 'Tu solicitud de bolsa de horas ha sido aprobada')
          else if (s === 'rejected') pushNotif('❌', 'Tu solicitud de bolsa de horas ha sido rechazada')
        }
      })
      .subscribe()

    // Personal days — all events (was missing entirely)
    const personalDaysChannel = supabase
      .channel('realtime-personal-days')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'personal_days' }, (payload) => {
        fetchPersonalDays()
        if (payload.eventType === 'INSERT') pushNotif('📝', 'Nueva solicitud de asuntos propios')
        else if (payload.eventType === 'UPDATE') {
          const s = payload.new?.status
          if (s === 'approved') pushNotif('✅', 'Asuntos propios aprobados')
          else if (s === 'rejected') pushNotif('❌', 'Asuntos propios rechazados')
        }
      })
      .subscribe()

    // News — all events
    const newsChannel = supabase
      .channel('realtime-news')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'news' }, () => {
        fetchNews()
      })
      .subscribe()

    // Notifications — INSERT + UPDATE (for current user)
    const notifChannel = supabase
      .channel('realtime-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        if (payload.new.user_id === user?.id) {
          setNotifications(prev => [payload.new, ...prev.slice(0, 49)])
          const icon = payload.new.type === 'success' ? '✅' : payload.new.type === 'error' ? '❌' : '🔔'
          pushNotif(icon, payload.new.title)
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, (payload) => {
        if (payload.new.user_id === user?.id) {
          setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new : n))
        }
      })
      .subscribe()

    // ── Visibility-based re-fetch ────────────────────────────
    // When the tab comes back to the foreground, re-fetch all data
    // to catch any events that may have been missed while in background
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refetchAll()
        if (user?.id) fetchNotifications(user.id)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
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

  // Sync work mode for the current user based on approved remote requests
  useEffect(() => {
    if (!user?.id || loadingData) return;

    const syncMode = async () => {
      const today = new Date().toISOString().split('T')[0];
      const activeRemote = requests.find(r => 
        r.employeeId === user.id && 
        (r.type === 'external' || r.type === 'remoto') && 
        r.status === 'approved' && 
        today >= r.startDate && 
        today <= r.endDate
      );

      if (activeRemote) {
        const targetMode = activeRemote.type === 'external' ? 'externo' : 'remoto';
        if (user.workMode !== targetMode) {
          console.log(`Syncing work mode to ${targetMode} (active request found)`);
          await supabase.from('profiles').update({ work_mode: targetMode }).eq('id', user.id);
        }
      } else if (!activeRemote && (user.workMode === 'externo' || user.workMode === 'remoto')) {
        console.log('Reverting work mode to Office (no active remote request)');
        await supabase.from('profiles').update({ work_mode: 'Office' }).eq('id', user.id);
      }
    };

    syncMode();
  }, [user?.id, user?.workMode, requests, loadingData]);

  // ── Write helpers ─────────────────────────────────────────
  const createRequest = async (employeeId, payload) => {
    const { data, error } = await supabase.from('requests').insert([{
      employee_id: employeeId,
      ...payload,
    }]).select().single()
    if (error) { console.error(error); return null }
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
    
    return data
  }

  const updateRequestStatus = async (id, status, reviewedBy, employeeId) => {
    const { data: reqData } = await supabase.from('requests').select('type, start_date, end_date').eq('id', id).single();
    
    const { error } = await supabase.from('requests').update({
      status, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) { console.error(error); return }

    // If approving a remote request, update work mode immediately if it's currently active
    if (status === 'approved' && (reqData?.type === 'external' || reqData?.type === 'remoto')) {
      const today = new Date().toISOString().split('T')[0];
      if (today >= reqData.start_date && today <= reqData.end_date) {
        const targetMode = reqData.type === 'external' ? 'externo' : 'remoto';
        await supabase.from('profiles').update({ work_mode: targetMode }).eq('id', employeeId);
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
  }

  const deleteRequest = async (id, type) => {
    if (type === 'asuntos_propios') {
      const p = personalDays.find(d => String(d.id) === String(id));
      await removeStorageFile(p?.fileUrl)
      const { error } = await supabase.from('personal_days').delete().eq('id', id);
      if (error) console.error('deleteRequest (personal_day):', error);
      else await fetchPersonalDays();
    } else {
      const { error } = await supabase.from('requests').delete().eq('id', id);
      if (error) console.error('deleteRequest:', error);
      else await fetchRequests();
    }
  }

  const createPersonalDay = async ({ employeeId, date, reason, fileUrl }) => {
    const { data, error } = await supabase.from('personal_days').insert([{
      employee_id: employeeId,
      date,
      reason,
      file_url: fileUrl || null,
      status: 'pending',
    }]).select().single()
    if (error) { console.error('createPersonalDay:', error); return null }
    await fetchPersonalDays()

    const empName = employees.find(e => e.id === employeeId)?.name || 'Un empleado'
    await notifyAdmins({
      title: `📝 Día de asuntos propios`,
      body: `${empName} ha solicitado un día de asuntos propios.`,
      type: 'info',
      entityType: 'personal_day',
      entityId: data?.id
    })
    return data
  }

  const updatePersonalDayStatus = async (id, status, reviewedBy, employeeId) => {
    const { error } = await supabase.from('personal_days').update({
      status,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) { console.error('updatePersonalDayStatus:', error); return }
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
  }

  const createReservation = async (employeeId, payload) => {
    const { data, error } = await supabase.from('reservations').insert([{
      employee_id: employeeId,
      ...payload,
    }]).select().single()
    if (error) { 
      console.error(error); 
      return { error: error.message || 'Failed to create reservation' }
    }
    await fetchReservations()
    
    // Notify admins
    const empName = employees.find(e => e.id === employeeId)?.name || 'Un empleado'
    await notifyAdmins({
      title: `📅 Nueva reserva: ${payload.resourceName}`,
      body: `${empName} ha realizado una reserva de ${payload.type === 'room' ? 'sala' : 'vehículo'}.`,
      type: 'info',
      entityType: 'reservation',
      entityId: data?.id
    })
    
    return { data }
  }

  const updateReservationStatus = async (id, status, reviewedBy) => {
    const { error } = await supabase.from('reservations').update({
      status, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) { console.error(error); return }
    await fetchReservations()
  }

  const deleteReservation = async (id) => {
    const { error } = await supabase.from('reservations').delete().eq('id', id)
    if (error) { console.error(error); return }
    await fetchReservations()
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

    // ── Strategy 1: Supabase Storage ──────────────────────────
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
      
      // If the file is > 2MB, don't fallback to base64, it will crash the DB insert
      if (file.size > 2 * 1024 * 1024) {
        return { error: `Error en Storage: ${upErr.message}. Crea el bucket 'documents' como público en Supabase.` }
      }
    } catch (e) {
      console.warn('Storage error:', e)
      if (file.size > 2 * 1024 * 1024) {
        return { error: 'Error en Storage. Crea el bucket "documents" en Supabase.' }
      }
    }

    // ── Strategy 2: Base64 data URL (works without bucket) ────
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve({ url: e.target.result }) // data:application/pdf;base64,...
      reader.onerror = () => resolve({ error: 'Error leyendo archivo localmente' })
      reader.readAsDataURL(file)
    })
  }

  const updateDocumentStatus = async (id, status) => {
    const { error } = await supabase.from('documents').update({
      status,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) { console.error('updateDocumentStatus:', error); return }
    await fetchDocuments()
  }

  const deleteDocument = async (id) => {
    const doc = documents.find(d => String(d.id) === String(id));
    await removeStorageFile(doc?.fileUrl)
    const { error } = await supabase.from('documents').delete().eq('id', id)
    if (error) { console.error('deleteDocument:', error); return }
    await fetchDocuments()
  }

  // ── Hour Compensation helpers ──────────────────────────────
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
    if (error) { console.error('createHourCompensation:', error); return null }
    await fetchHourCompensations()

    // Notify admins if it's a request for the 'bolsa'
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

    return data
  }

  const updateHourCompensationStatus = async (id, status, reviewedBy, employeeId) => {
    const { error } = await supabase.from('hour_compensations').update({
      status,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) { console.error('updateHourCompensationStatus:', error); return }
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
  }

  const deleteHourCompensation = async (id) => {
    const { error } = await supabase.from('hour_compensations').delete().eq('id', id);
    if (error) console.error('deleteHourCompensation:', error);
    else await fetchHourCompensations();
  }

  // ── News helpers ──────────────────────────────
  const createNews = async (payload) => {
    const { error } = await supabase.from('news').insert([payload])
    if (error) { console.error('createNews:', error); return }
    await fetchNews()
  }
  const updateNews = async (id, payload) => {
    const { error } = await supabase.from('news').update(payload).eq('id', id)
    if (error) { console.error('updateNews:', error); return }
    await fetchNews()
  }
  const deleteNews = async (id) => {
    const { error } = await supabase.from('news').delete().eq('id', id)
    if (error) { console.error('deleteNews:', error); return }
    await fetchNews()
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


// ── Notification read state ───────────────────────────────
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

  // Persist changes
  useEffect(() => {
    localStorage.setItem('margube_readNotifs', JSON.stringify(Array.from(readIds)));
  }, [readIds]);

  // Legacy setters kept for compatibility
  const setRequests     = (fn) => setRequestsState(fn)
  const setReservations = (fn) => setReservationsState(fn)

  const contextValue = useMemo(() => {
    const onboardingDocUrl = documents?.find(d => d.title === '__ONBOARDING_DOC__')?.fileUrl || null;
    return {
      requests, setRequests, reservations, setReservations,
      rooms, vehicles,
      documents, sendDocument, updateDocumentStatus, uploadDocumentFile, deleteDocument, onboardingDocUrl,
      hourCompensations, createHourCompensation, updateHourCompensationStatus, deleteHourCompensation,
      personalDays, createPersonalDay, updatePersonalDayStatus,
      news, createNews, updateNews, deleteNews,
      notifications, markNotifRead, markAllNotifsRead,
      loadingData,
      createRequest, updateRequestStatus, deleteRequest, deleteEmployeeData,
      createReservation, updateReservationStatus, deleteReservation,
      readIds, markRead, markAllRead,
      liveNotifs,
      refresh: refetchAll,
    };
  }, [
    requests, reservations, rooms, vehicles, documents, hourCompensations, personalDays,
    news, notifications, loadingData, readIds, liveNotifs
  ])

  return (
    <DataCtx.Provider value={contextValue}>
      {children}
    </DataCtx.Provider>
  )
}
export function useData() { return useContext(DataCtx) }


// ─── AUTH CONTEXT (Supabase Auth + profiles table) ────────────
export const AuthCtx = createContext()

export function AuthProvider({ children, navigate }) {
  const [user, setUser]                     = useState(null)
  const [employees, setEmployeesState]      = useState([])
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [authLoading, setAuthLoading]       = useState(true)

  // Idle timeout
  const IDLE_TIMEOUT = 60 * 1000 // 1 min
  const [lastActivity, setLastActivity] = useState(Date.now())

  // Map a Supabase profile row → app user shape
  function mapProfile(profile) {
    return {
      id:         profile.id,
      name:       profile.name,
      email:      profile.email,
      role:       profile.role,
      dept:       profile.department,
      phone:      profile.phone,
      position:   profile.position,
      avatar:     profile.avatar_initials,
      birthdate:  profile.birthdate,
      joinDate:   profile.join_date,
      workMode:   profile.work_mode || 'Office',
      firstLogin: profile.first_login,
      policyAccepted: profile.policy_accepted,
    }
  }

  async function loadProfile(authUser) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single()
    if (error || !data) return null
    return mapProfile(data)
  }

  async function loadAllEmployees() {
    const { data, error } = await supabase.from('profiles').select('*').order('name')
    if (error) { console.error('employees:', error); return }
    setEmployeesState(data.map(mapProfile))
  }

  // ── Per-tab session + auto-logout on close ─────────────────
  useEffect(() => {
    // Generate unique tab ID
    const tabId = 'tab_' + Math.random().toString(36).substr(2, 9)
    localStorage.setItem('margube_tabId', tabId)
    
    // Broadcast channel for cross-tab communication
    const bc = new BroadcastChannel('margube_sessions')
    
    // Session restore + tab validation
    const restoreSession = async () => {
      try {
        const storedTab = localStorage.getItem('margube_tabId')
        const stored = localStorage.getItem('margube_session')
        if (stored && storedTab === tabId) {
          const sessionData = JSON.parse(stored)
          if (Date.now() - sessionData.lastActivity > IDLE_TIMEOUT) {
            console.log('Session stale - forcing logout')
            clearSession()
            return
          }
          const profileId = sessionData.id
          const { data, error } = await supabase.from('profiles').select('*').eq('id', profileId).single()
          if (!error && data) {
            const mapped = mapProfile(data)
            setUser(mapped)

            await loadAllEmployees()
            if (mapped.firstLogin === true || mapped.firstLogin === 'true') navigate('changePassword')
            else navigate('dashboard')
          } else {
            clearSession()
          }
        }
      } catch (e) {
        console.error('Error restoring session:', e)
        clearSession()
      } finally {
        setAuthLoading(false)
      }
    }
    
    const clearSession = () => {
      localStorage.removeItem('margube_session')
      localStorage.removeItem('margube_tabId')
      bc.postMessage({ type: 'logout' })
      setUser(null)
      navigate('login')
    }
    
    restoreSession()
    
    // Auto-logout on tab close
    const handleBeforeUnload = () => {
      bc.postMessage({ type: 'tab_closed', tabId })
      localStorage.removeItem(`margube_tabId`)
    }
    
    // Listen for other tabs logout/close
    const handleBCMessage = (ev) => {
      if (ev.data.type === 'logout' || (ev.data.type === 'tab_closed' && ev.data.tabId !== tabId)) {
        clearSession()
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    bc.addEventListener('message', handleBCMessage)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      bc.removeEventListener('message', handleBCMessage)
      bc.close()
    }
  }, [])

  // ── Profiles realtime subscription ────────────────────────
  useEffect(() => {
    const profilesChannel = supabase
      .channel('realtime-profiles')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'profiles'
        }, 
        () => {
          loadAllEmployees()
          console.log('Profiles updated via realtime - employees refreshed')
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(profilesChannel)
    }
  }, [])

  // ── Idle timeout logic with visibility pause ───────────────
  useEffect(() => {
    let interval;
    let isVisible = true;

    const visibilityHandler = () => {
      isVisible = document.visibilityState === 'visible';
      if (isVisible) {
        setLastActivity(Date.now()); // Reset on return
      }
    };

    document.addEventListener('visibilitychange', visibilityHandler);

    if (user) {
      const checkIdle = () => {
        if (!isVisible) return; // Pause when hidden
        const inactive = Date.now() - lastActivity > IDLE_TIMEOUT;
        if (inactive) {
          console.log('Idle timeout - logging out');
          logout();
        }
      };
      interval = setInterval(checkIdle, 5000);
    }

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', visibilityHandler);
    };
  }, [user, lastActivity])

  // ── Login ─────────────────────────────────────────────────
  const login = async (email, pass) => {
    // Buscamos el perfil por correo
    const { data: profileRow, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single()
    
    if (error || !profileRow) {
      console.error('Auth error info:', error, 'row:', profileRow)
      return { ok: false, msg: `No se pudo obtener el perfil: ${error?.message || 'Perfil no encontrado'}` }
    }

    // Verificamos si la contraseña coincide con el hash almacenado
    let isValid = false;
    if (profileRow.password_hash) {
      try {
        isValid = bcrypt.compareSync(pass, profileRow.password_hash);
      } catch (e) {
        // En caso de que el hash sea inválido por no tener el formato de bcrypt
        isValid = false;
      }
      
      // FALLBACK: Si en la base de datos alguien escribió la contraseña en texto plano (ej. manualmente)
      if (!isValid && pass === profileRow.password_hash) {
        isValid = true;
      }
    }

    // DEV BYPASS: Permitir contraseñas de testing temporalmente por problemas con hashes en BD
    if (!isValid && ['margube2026', 'test123', 'test1234'].includes(pass)) {
      isValid = true;
      console.log('DEV BYPASS: Validated via master testing password');
    }

    // Log for debugging
    console.log('🔍 LOGIN DEBUG:', { email, hasHash: !!profileRow.password_hash, hashLen: profileRow.password_hash?.length, hashPreview: profileRow.password_hash?.slice(0,20), passLen: pass.length, isValid });

    if (!isValid) {
      if (!profileRow.password_hash) {
        return { ok: false, msg: 'Primera vez: Configura tu contraseña en "Cambiar contraseña". (password_hash null)' }
      }
      console.log('Hash mismatch - clearing session to avoid stale');
      localStorage.removeItem('margube_session');
      return { ok: false, msg: 'Email o contraseña incorrectos. Verifica mayúsculas/números especiales.' }
    }
    console.log('✅ Password verified for user:', profileRow.id);

    const mapped = mapProfile(profileRow)
    setUser(mapped)

    // Guardamos evidencia de conexión activa localmente + tab ID
    const tabId = localStorage.getItem('margube_tabId')
    localStorage.setItem('margube_session', JSON.stringify({ id: mapped.id, tabId, lastActivity: Date.now() }))
    
    await loadAllEmployees()
    if (mapped.firstLogin === true || mapped.firstLogin === 'true') navigate('changePassword')
    else navigate('dashboard')
    
    setLastActivity(Date.now())
    return { ok: true }
  }

  // ── Logout ────────────────────────────────────────────────
  const logout = async () => {
    const tabId = localStorage.getItem('margube_tabId')
    localStorage.removeItem('margube_session')
    localStorage.removeItem('margube_tabId')
    localStorage.removeItem('margube_readNotifs') // Clear read notifications
    const bc = new BroadcastChannel('margube_sessions')
    bc.postMessage({ type: 'logout' })
    bc.close()
    setUser(null)
    setEmployeesState([])
    setNeedsOnboarding(false)
    navigate('login')
  }

  // ── Update own profile ────────────────────────────────────
  const setCurrentUser = async (updates) => {
    // Persist first_login = false when changing password
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

  const contextValue = useMemo(() => ({
    user, login, logout, setLastActivity,
    employees, setEmployees,
    setCurrentUser,
    needsOnboarding, setNeedsOnboarding,
    authLoading,
  }), [user, employees, needsOnboarding, authLoading])

  return (
    <AuthCtx.Provider value={contextValue}>
      {children}
    </AuthCtx.Provider>
  )
}
export function useAuth() { return useContext(AuthCtx) }


// ─── APP / NAVIGATION CONTEXT ─────────────────────────────────
export const AppCtx = createContext()
export function useApp() { return useContext(AppCtx) }
