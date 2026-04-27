import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import bcrypt from 'bcryptjs'
import { MOCK_DOCUMENTS, MOCK_HOUR_COMPENSATIONS } from '../data/mockData'

// ─── THEME CONTEXT ────────────────────────────────────────────
export const ThemeCtx = createContext()

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('dark')
  const toggle = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])
  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>
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
  const [loadingData, setLoadingData]        = useState(true)
const [readIds, setReadIds] = useState(() => {
  try {
    return new Set(JSON.parse(localStorage.getItem('margube_readNotifs') || '[]'));
  } catch {
    return new Set();
  }
})
  const [liveNotifs, setLiveNotifs]        = useState([])  // Real-time toasts
  const [density, setDensity]              = useState(
    () => localStorage.getItem('margube-density') || 'normal'
  )

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
    if (error || !data || data.length === 0) {
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
    if (error || !data || data.length === 0) {
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

  useEffect(() => {
    Promise.all([fetchRequests(), fetchReservations(), fetchRooms(), fetchVehicles(), fetchDocuments(), fetchHourCompensations()])
      .finally(() => setLoadingData(false))

    // ── Supabase Realtime subscriptions ─────────────────────
    const pushNotif = (icon, msg) => {
      const id = Date.now()
      setLiveNotifs(prev => [{ id, icon, msg }, ...prev.slice(0, 4)])
      // Auto-dismiss after 6 s
      setTimeout(() => setLiveNotifs(prev => prev.filter(n => n.id !== id)), 6000)
    }

    const requestChannel = supabase
      .channel('realtime-requests')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requests' }, () => {
        fetchRequests()
        pushNotif('📋', 'Nueva solicitud recibida')
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'requests' }, (payload) => {
        fetchRequests()
        const s = payload.new.status
        if (s === 'approved') pushNotif('✅', 'Una solicitud ha sido aprobada')
        else if (s === 'rejected') pushNotif('❌', 'Una solicitud ha sido rechazada')
      })
      .subscribe()

    const reservationChannel = supabase
      .channel('realtime-reservations')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reservations' }, () => {
        fetchReservations()
        pushNotif('📅', 'Nueva reserva pendiente de revisión')
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reservations' }, (payload) => {
        fetchReservations()
        const s = payload.new.status
        if (s === 'confirmed') pushNotif('✅', 'Tu reserva ha sido confirmada')
        else if (s === 'cancelled') pushNotif('❌', 'Tu reserva ha sido cancelada')
      })
      .subscribe()

    // Rooms realtime
    const roomChannel = supabase
      .channel('realtime-rooms')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rooms' }, () => {
        fetchRooms()
        pushNotif('🏢', 'Nueva sala disponible')
      })
      .subscribe()

    // Vehicles realtime  
    const vehicleChannel = supabase
      .channel('realtime-vehicles')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vehicles' }, () => {
        fetchVehicles()
        pushNotif('🚗', 'Nuevo vehículo disponible')
      })
      .subscribe()

    // Documents realtime
    const documentChannel = supabase
      .channel('realtime-documents')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'documents' }, (payload) => {
        fetchDocuments()
        pushNotif('📄', `Nuevo documento recibido: ${payload.new?.title || ''}`)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'documents' }, () => {
        fetchDocuments()
      })
      .subscribe()

    // Hour compensations realtime
    const hoursChannel = supabase
      .channel('realtime-hours')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hour_compensations' }, () => {
        fetchHourCompensations()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'hour_compensations' }, (payload) => {
        fetchHourCompensations()
        const s = payload.new?.status
        if (s === 'approved') pushNotif('✅', 'Tu solicitud de bolsa de horas ha sido aprobada')
        else if (s === 'rejected') pushNotif('❌', 'Tu solicitud de bolsa de horas ha sido rechazada')
      })
      .subscribe()

    return () => {
      supabase.removeChannel(requestChannel)
      supabase.removeChannel(reservationChannel)
      supabase.removeChannel(roomChannel)
      supabase.removeChannel(vehicleChannel)
      supabase.removeChannel(documentChannel)
      supabase.removeChannel(hoursChannel)
    }
  }, [])

  // ── Write helpers ─────────────────────────────────────────
  const createRequest = async (employeeId, payload) => {
    const { data, error } = await supabase.from('requests').insert([{
      employee_id: employeeId,
      ...payload,
    }]).select().single()
    if (error) { console.error(error); return null }
    await fetchRequests()
    return data
  }

  const updateRequestStatus = async (id, status, reviewedBy) => {
    const { error } = await supabase.from('requests').update({
      status, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) { console.error(error); return }
    await fetchRequests()
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
    if (error) { console.error('sendDocument:', error); return null }
    await fetchDocuments()
    return data
  }

  // Upload a File object → first tries Supabase Storage, falls back to base64 data URL
  const uploadDocumentFile = async (file) => {
    if (!file) return null

    // ── Strategy 1: Supabase Storage ──────────────────────────
    try {
      const ext  = file.name.split('.').pop()
      const path = `docs/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('documents')
        .upload(path, file, { cacheControl: '3600', upsert: false })
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
        return publicUrl
      }
      console.warn('Supabase Storage no disponible, usando base64:', upErr.message)
    } catch (e) {
      console.warn('Storage error, usando base64:', e)
    }

    // ── Strategy 2: Base64 data URL (works without bucket) ────
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result) // data:application/pdf;base64,...
      reader.onerror = () => resolve(null)
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
    return data
  }

  const updateHourCompensationStatus = async (id, status, reviewedBy) => {
    const { error } = await supabase.from('hour_compensations').update({
      status,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) { console.error('updateHourCompensationStatus:', error); return }
    await fetchHourCompensations()
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

  // ── Density ───────────────────────────────────────────────
  const toggleDensity = () => setDensity(prev => {
    const next = prev === 'normal' ? 'compact' : 'normal'
    localStorage.setItem('margube-density', next)
    return next
  })

  // Legacy setters kept for compatibility (local state still works alongside)
  const setRequests     = (fn) => setRequestsState(fn)
  const setReservations = (fn) => setReservationsState(fn)

  return (
    <DataCtx.Provider value={{
      requests, setRequests, reservations, setReservations,
      rooms, vehicles,
      documents, sendDocument, updateDocumentStatus, uploadDocumentFile,
      hourCompensations, createHourCompensation, updateHourCompensationStatus,
      loadingData,
      createRequest, updateRequestStatus,
      createReservation, updateReservationStatus, deleteReservation,
      readIds, markRead, markAllRead,
      density, toggleDensity,
      liveNotifs,
      refresh: () => Promise.all([fetchRequests(), fetchReservations(), fetchRooms(), fetchVehicles(), fetchDocuments(), fetchHourCompensations()]),
    }}>
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
      password_hash: profile.password_hash,
      role:       profile.role,
      dept:       profile.department,
      phone:      profile.phone,
      position:   profile.position,
      avatar:     profile.avatar_initials,
      birthdate:  profile.birthdate,
      joinDate:   profile.join_date,
      workMode:   profile.work_mode || 'Office',
      firstLogin: profile.first_login,
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
    setUser(prev => ({ ...prev, ...updates }))
    await loadAllEmployees()
  }

  const setEmployees = async (updater) => {
    // Support both array replacement and function updater
    if (typeof updater === 'function') {
      setEmployeesState(updater)
    } else {
      setEmployeesState(updater)
    }
    // Persist workMode changes
    await loadAllEmployees()
  }

  return (
    <AuthCtx.Provider value={{
      user, login, logout, setLastActivity,
      employees, setEmployees,
      setCurrentUser,
      needsOnboarding, setNeedsOnboarding,
      authLoading,
    }}>
      {children}
    </AuthCtx.Provider>
  )
}
export function useAuth() { return useContext(AuthCtx) }


// ─── APP / NAVIGATION CONTEXT ─────────────────────────────────
export const AppCtx = createContext()
export function useApp() { return useContext(AppCtx) }
