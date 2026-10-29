// TEMPORARY visual check with sample data (deleted after use). No Supabase writes are made.
import ReactDOM from 'react-dom/client'
import { lazy, Suspense } from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import {
  ThemeProvider, AuthCtx, RequestsCtx, ReservationsCtx, DocumentsCtx, HoursCtx, PersonalDaysCtx,
  NewsCtx, NotifsCtx, DataSyncCtx, DataCtx,
} from './context'
import Layout from './components/Layout'
import './styles/global.scss'

const pages = {
  dashboard: lazy(() => import('./pages/DashboardPage')),
  reservations: lazy(() => import('./pages/ReservationsPage')),
  requests: lazy(() => import('./pages/RequestsPage')),
  horas: lazy(() => import('./pages/HorasPage')),
  news: lazy(() => import('./pages/NewsPage')),
  employees: lazy(() => import('./pages/EmployeesPage')),
  profile: lazy(() => import('./pages/ProfilePage')),
  settings: lazy(() => import('./pages/SettingsPage')),
  mas: lazy(() => import('./pages/MorePage')),
  admin: lazy(() => import('./pages/AdminPage')),
}

const q = new URLSearchParams(location.search)
const page = q.get('page') || 'dashboard'
const role = q.get('role') || 'admin'
const empty = q.get('empty') === '1'
localStorage.setItem('app-theme-mode', q.get('theme') || 'dark')
localStorage.setItem('app-appearance', 'glass')
document.documentElement.setAttribute('data-appearance', 'glass')

const iso = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const ts = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }
const names = ['MGB Digital', 'Bruno Díaz', 'Carla Ruiz', 'David Martín', 'Elena Sanz', 'Fernando Gil']
const modes = ['Office', 'remoto', 'Office', 'externo', 'Office', 'remoto']
const employees = names.map((n, i) => ({
  id: `u${i}`, name: n, email: `${n.split(' ')[0].toLowerCase()}@margube.com`, role: i === 0 ? role : 'employee', dept: ['Comercial - marketing', 'Administración', 'Ingeniería', 'Comercial - marketing', 'Logística', 'Ingeniería'][i],
  position: ['Responsable digital', 'Contable', 'Ingeniera de proyectos', 'Comercial', 'Coordinadora', 'Técnico'][i], phone: '600 123 456',
  avatar: n.split(' ').map((w) => w[0]).join(''), workMode: modes[i], policyAccepted: true, firstLogin: false, teleworkDays: i % 2 ? [1, 3] : [],
  birthdate: `1990-${String(((new Date().getMonth() + i) % 12) + 1).padStart(2, '0')}-1${i}`,
}))
const news = empty ? [] : [
  { id: 1, type: 'news', title: 'Gran celebración 15º Aniversario Margube — 15 Feb', content: 'Cena de gala en el Hotel NH. Confirma asistencia antes del 10 de febrero.', authorName: 'Josune Gutierrez', authorAvatar: 'JG', date: ts(-2), pinned: true, category: 'Empresa', isActive: true, createdAt: ts(-2) },
  { id: 2, type: 'news', title: 'Margube alcanza récord de ventas en Q4', content: 'Cerramos el trimestre con un incremento del 34%.', authorName: 'Josune Gutierrez', authorAvatar: 'JG', date: ts(-6), pinned: false, category: 'Empresa', isActive: true, createdAt: ts(-6) },
  { id: 3, type: 'event', title: 'Formación en seguridad laboral', content: 'Sala Bilbao, 10:00. Obligatoria para el equipo de obra.', authorName: 'Bruno Díaz', authorAvatar: 'BD', date: ts(5), pinned: false, category: 'Formación', isActive: true, createdAt: ts(-1) },
]
const rooms = [
  { id: 1, name: 'Sala Bilbao', capacity: 8, floor: '1ª', equipment: ['Pantalla', 'Videollamada'], isActive: true },
  { id: 2, name: 'Sala Donosti', capacity: 4, floor: '2ª', equipment: ['Pizarra'], isActive: true },
  { id: 3, name: 'Sala Gasteiz', capacity: 12, floor: '1ª', equipment: ['Proyector'], isActive: true },
]
const vehicles = [
  { id: 1, plate: '1234 KLM', model: 'Toyota Corolla', year: 2022, type: 'Turismo', isActive: true },
  { id: 2, plate: '5678 PQR', model: 'Renault Kangoo', year: 2021, type: 'Furgoneta', isActive: true },
]
const reservations = empty ? [] : [
  { id: 1, type: 'room', resourceName: 'Sala Bilbao', roomId: 1, employeeId: 'u0', employeeName: names[0], date: iso(0), timeStart: '10:00', timeEnd: '11:30', purpose: 'Reunión con cliente', status: 'confirmed', createdAt: ts(-3) },
  { id: 2, type: 'vehicle', resourceName: 'Toyota Corolla', vehicleId: 1, employeeId: 'u1', employeeName: names[1], date: iso(1), timeStart: '08:00', timeEnd: '14:00', purpose: 'Visita a obra', status: 'pending', createdAt: ts(-1) },
  { id: 3, type: 'room', resourceName: 'Sala Donosti', roomId: 2, employeeId: 'u0', employeeName: names[0], date: iso(2), timeStart: '16:00', timeEnd: '17:00', purpose: 'Planificación semanal', status: 'pending', createdAt: ts(0) },
  { id: 4, type: 'room', resourceName: 'Sala Gasteiz', roomId: 3, employeeId: 'u2', employeeName: names[2], date: iso(0), timeStart: '12:00', timeEnd: '13:00', purpose: 'Formación', status: 'confirmed', createdAt: ts(-4) },
]
const requests = empty ? [] : [
  { id: 1, type: 'remoto', status: 'pending', reason: 'Cita médica por la mañana', createdAt: ts(-1), employeeId: 'u1', employeeName: names[1], startDate: iso(3), endDate: iso(3), days: 1 },
  { id: 2, type: 'purchase', status: 'approved', reason: 'Monitor para puesto', createdAt: ts(-5), employeeId: 'u0', employeeName: names[0], item: 'Monitor 27"', amount: 240 },
  { id: 3, type: 'external', status: 'rejected', reason: 'Visita a proveedor', createdAt: ts(-9), employeeId: 'u2', employeeName: names[2], startDate: iso(-2), endDate: iso(-1), days: 2 },
  { id: 4, type: 'remoto', status: 'approved', reason: 'Teletrabajo', createdAt: ts(-12), employeeId: 'u0', employeeName: names[0], startDate: iso(-8), endDate: iso(-8), days: 1 },
]
const personalDays = empty ? [] : [
  { id: 11, employeeId: 'u0', employeeName: names[0], date: iso(7), reason: 'Asunto familiar', status: 'pending', createdAt: ts(-2) },
  { id: 12, employeeId: 'u3', employeeName: names[3], date: iso(-15), reason: 'Mudanza', status: 'approved', createdAt: ts(-20) },
]
const hourCompensations = empty ? [] : [
  { id: 1, employeeId: 'u0', employeeName: names[0], date: iso(-3), reason: 'Cierre de proyecto', hours: 2.5, type: 'bolsa', status: 'approved', createdAt: ts(-3) },
  { id: 2, employeeId: 'u0', employeeName: names[0], date: iso(-10), reason: 'Feria comercial', hours: 4, type: 'bolsa', status: 'pending', createdAt: ts(-10) },
  { id: 3, employeeId: 'u0', employeeName: names[0], date: iso(-14), reason: 'Salida antes', hours: 1, type: 'debe', status: 'approved', createdAt: ts(-14) },
  { id: 4, employeeId: 'u1', employeeName: names[1], date: iso(-4), reason: 'Inventario', hours: 3, type: 'bolsa', status: 'pending', createdAt: ts(-4) },
  { id: 5, employeeId: 'u0', employeeName: names[0], date: iso(-30), reason: 'Guardia', hours: 1.5, type: 'ya', status: 'approved', createdAt: ts(-30) },
]
const documents = empty ? [] : [
  { id: 1, title: 'Nómina octubre', description: 'Nómina del mes', fileUrl: null, status: 'pending', createdAt: ts(-1), senderId: 'u1', senderName: names[1], recipientId: 'u0', recipientName: names[0] },
]
const notifications = [
  { id: 1, title: 'Reserva confirmada', message: 'Sala Bilbao, hoy a las 10:00', read: false, createdAt: ts(0), type: 'reservation' },
]
const noop = async () => ({ error: null })
const auth = { user: employees[0], employees, login: noop, logout: noop, setLastActivity: () => {}, setEmployees: () => {}, setCurrentUser: noop, patchUser: () => {}, refreshEmployees: noop, needsOnboarding: false, setNeedsOnboarding: () => {}, authLoading: false, changeWorkMode: noop }
const all = {
  requests, createRequest: noop, updateRequestStatus: noop, deleteRequest: noop, changeWorkMode: noop,
  reservations, rooms, vehicles, createReservation: noop, updateReservationStatus: noop, deleteReservation: noop,
  documents, sendDocument: noop, updateDocumentStatus: noop, uploadDocumentFile: noop, deleteDocument: noop, onboardingDocUrl: null, deleteEmployeeData: noop,
  hourCompensations, createHourCompensation: noop, updateHourCompensationStatus: noop, deleteHourCompensation: noop,
  personalDays, createPersonalDay: noop, updatePersonalDayStatus: noop,
  news, createNews: noop, updateNews: noop, deleteNews: noop,
  notifications, markNotifRead: noop, markAllNotifsRead: noop, readIds: new Set(), markRead: () => {}, markAllRead: () => {}, liveNotifs: [], announce: () => {},
  loadingData: q.get('loading') === '1', loadFailed: q.get('failed') === '1', refresh: noop,
}
const P = ({ c, children }) => <c.Provider value={all}>{children}</c.Provider>
const Page = pages[page]

ReactDOM.createRoot(document.getElementById('root')).render(
  <ThemeProvider>
    <MemoryRouter initialEntries={[`/${page}${q.get('qs') ? `?${q.get('qs')}` : ''}`]}>
      <AuthCtx.Provider value={auth}>
        <P c={DataSyncCtx}><P c={NotifsCtx}><P c={NewsCtx}><P c={PersonalDaysCtx}><P c={HoursCtx}><P c={DocumentsCtx}>
          <P c={ReservationsCtx}><P c={RequestsCtx}><P c={DataCtx}>
            <Routes>
              <Route path="*" element={<Layout><Suspense fallback={null}><Page /></Suspense></Layout>} />
            </Routes>
          </P></P></P>
        </P></P></P></P></P></P>
      </AuthCtx.Provider>
    </MemoryRouter>
  </ThemeProvider>,
)

// Scroll the page for screenshots below the fold
const sy = Number(q.get('scroll') || 0)
if (sy) setTimeout(() => { window.scrollTo(0, sy); document.querySelector('#main-content')?.scrollTo(0, sy) }, 1800)
