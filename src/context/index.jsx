import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'

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
  const [requests, setRequestsState]       = useState([])
  const [reservations, setReservationsState] = useState([])
  const [rooms, setRooms]                  = useState([])
  const [vehicles, setVehicles]            = useState([])
  const [loadingData, setLoadingData]      = useState(true)
  const [readIds, setReadIds]              = useState(new Set())
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

  useEffect(() => {
    Promise.all([fetchRequests(), fetchReservations(), fetchRooms(), fetchVehicles()])
      .finally(() => setLoadingData(false))
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
    if (error) { console.error(error); return null }
    await fetchReservations()
    return data
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

  // ── Notification read state ───────────────────────────────
  const markRead    = (id)  => setReadIds(prev => new Set([...prev, id]))
  const markAllRead = (ids) => setReadIds(prev => new Set([...prev, ...ids]))

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
      loadingData,
      createRequest, updateRequestStatus,
      createReservation, updateReservationStatus, deleteReservation,
      readIds, markRead, markAllRead,
      density, toggleDensity,
      refresh: () => Promise.all([fetchRequests(), fetchReservations()]),
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
      workMode:   profile.work_mode,
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

  // ── Session restore on mount ──────────────────────────────
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const stored = localStorage.getItem('margube_session')
        if (stored) {
          const profileId = JSON.parse(stored).id
          const { data, error } = await supabase.from('profiles').select('*').eq('id', profileId).single()
          if (!error && data) {
            const mapped = mapProfile(data)
            setUser(mapped)
            await loadAllEmployees()
            if (mapped.firstLogin === true || mapped.firstLogin === 'true') navigate('changePassword')
            else navigate('dashboard')
          } else {
            localStorage.removeItem('margube_session')
          }
        }
      } catch (e) {
        console.error('Error restoring session:', e)
      } finally {
        setAuthLoading(false)
      }
    }
    restoreSession()
  }, [])

  // ── Login ─────────────────────────────────────────────────
  const login = async (email, pass) => {
    const { data: profileRow, error } = await supabase.rpc('login_with_profile', { p_email: email, p_password: pass })
    
    if (error || !profileRow) {
      console.error('Auth error:', error?.message || 'Invalid credentials')
      return { ok: false, msg: 'Email o contraseña incorrectos. Verifica tus credenciales.' }
    }

    const mapped = mapProfile(profileRow)
    setUser(mapped)
    // Guardamos evidencia de conexión activa localmente
    localStorage.setItem('margube_session', JSON.stringify({ id: mapped.id }))
    
    await loadAllEmployees()
    if (mapped.firstLogin === true || mapped.firstLogin === 'true') navigate('changePassword')
    else navigate('dashboard')
    
    return { ok: true }
  }

  // ── Logout ────────────────────────────────────────────────
  const logout = async () => {
    localStorage.removeItem('margube_session')
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
      user, login, logout,
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
