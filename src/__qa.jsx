// TEMPORARY QA harness (deleted after use): real pages, sample data, no writes.
import ReactDOM from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import {
  ThemeProvider, AuthCtx, RequestsCtx, ReservationsCtx, DocumentsCtx, HoursCtx, PersonalDaysCtx,
  NewsCtx, NotifsCtx, DataSyncCtx, DataCtx, IdleCtx,
} from './context'
import RequestsPage from './pages/RequestsPage'
import ReservationsPage from './pages/ReservationsPage'
import EmployeesPage from './pages/EmployeesPage'
import AdminPage from './pages/AdminPage'
import { Wallpaper } from './components/Wallpaper'
import './styles/global.scss'

const q = new URLSearchParams(location.search)
try { localStorage.setItem('app-theme-mode', q.get('theme') || 'light') } catch { /* */ }
document.documentElement.setAttribute('data-theme', q.get('theme') || 'light')
const role = q.get('role') || 'admin'
const pad = (n) => String(n).padStart(2, '0')
const now = new Date()
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const day = (n) => iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + n))
const today = iso(now)
const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
const ago = (n) => new Date(now.getTime() - n * 86400000).toISOString()

const people = [
  ['Ana Martínez', 'Administración - RRHH', 'Responsable de RRHH', 'admin', 'Office'],
  ['Bruno Díaz', 'Técnico', 'Técnico de campo', 'employee', 'externo'],
  ['Carla Ruiz', 'Comercial - HEF', 'Comercial', 'employee', 'remoto'],
  ['David Martín', 'Formación', 'Formador', 'employee', 'Office'],
  ['Elena Gómez', 'Planificación', 'Planificadora', 'employee', 'Office'],
  ['Fernando López', 'Técnico', 'Jefe técnico', 'employee', 'remoto'],
  ['Gloria Sanz', 'Comunicación - marketing', 'Community manager', 'employee', 'Office'],
  ['Hugo Prieto', 'Verificación (CAE)', 'Verificador', 'employee', 'Office'],
]
const employees = people.map(([name, dept, position, r, workMode], i) => ({
  id: `u${i}`, name, email: `${name.split(' ')[0].toLowerCase()}@margube.com`, role: r, dept, position, workMode,
  avatar: name.split(' ').map((w) => w[0]).join(''), policyAccepted: i !== 3, firstLogin: i === 7, teleworkDays: i === 2 ? [1, 3] : [], phone: i === 0 ? '12345678A' : '',
}))
const user = role === 'admin' ? employees[0] : employees[2]
window.__calls = []
const slow = (name) => async (...args) => { window.__calls.push([name, ...args]); await new Promise(r => setTimeout(r, 400)); return { error: null } }

const requests = [
  { id: 1, type: 'remoto', status: 'pending', reason: 'Obra en casa, necesito estar para recibir al electricista', createdAt: ago(0), employeeId: 'u2', employeeName: 'Carla Ruiz', startDate: day(2), endDate: day(3), days: 2 },
  { id: 2, type: 'purchase', status: 'approved', reason: 'Licencia anual para planos', createdAt: ago(3), employeeId: 'u5', employeeName: 'Fernando López', item: 'Licencia CAD', amount: 1200, reviewerId: 'u0', reviewerName: 'Ana Martínez', reviewedAt: ago(2) },
  { id: 3, type: 'external', status: 'rejected', reason: 'Visita a cliente en Bilbao', createdAt: ago(6), employeeId: 'u1', employeeName: 'Bruno Díaz', startDate: day(-4), endDate: day(-4), days: 1, reviewerId: 'u0', reviewerName: 'Ana Martínez', reviewedAt: ago(5) },
  { id: 4, type: 'remoto', status: 'approved', reason: 'Teletrabajo semanal', createdAt: ago(8), employeeId: 'u2', employeeName: 'Carla Ruiz', startDate: day(-1), endDate: day(1), days: 3, reviewerId: 'u0', reviewerName: 'Ana Martínez', reviewedAt: ago(7) },
]
const personalDays = [
  { id: 9, date: day(5), reason: 'Gestiones médicas', status: 'pending', createdAt: ago(1), employeeId: 'u3', employeeName: 'David Martín' },
]
const t = (h, m = 0) => `${pad(h)}:${pad(m)}`
const nh = now.getHours()
const reservations = [
  { id: 50, type: 'vehicle', vehicleId: 10, roomId: null, resourceName: 'Renault Clio', employeeId: 'u1', employeeName: 'Bruno Díaz', date: today, timeStart: hm(new Date(now - 3600000)), timeEnd: hm(new Date(now.getTime() + 3600000)), purpose: 'Visita a obra', status: 'confirmed' },
  { id: 51, type: 'room', roomId: 1, vehicleId: null, resourceName: 'Sala Azul', employeeId: 'u2', employeeName: 'Carla Ruiz', date: today, timeStart: t(9), timeEnd: t(10, 30), purpose: 'Reunión con cliente', status: 'confirmed' },
  { id: 52, type: 'room', roomId: 1, vehicleId: null, resourceName: 'Sala Azul', employeeId: 'u4', employeeName: 'Elena Gómez', date: today, timeStart: t(Math.min(nh + 1, 18)), timeEnd: t(Math.min(nh + 2, 19)), purpose: 'Planificación semanal', status: 'pending' },
  { id: 53, type: 'room', roomId: 3, vehicleId: null, resourceName: 'Sala Verde', employeeId: 'u0', employeeName: 'Ana Martínez', date: day(1), timeStart: t(11), timeEnd: t(12), purpose: 'Entrevistas', status: 'confirmed' },
  { id: 54, type: 'room', roomId: 3, vehicleId: null, resourceName: 'Sala Verde', employeeId: 'u2', employeeName: 'Carla Ruiz', date: today, timeStart: t(15), timeEnd: t(17), purpose: 'Formación interna', status: 'confirmed' },
  { id: 55, type: 'vehicle', vehicleId: 12, roomId: null, resourceName: 'Ford Transit', employeeId: 'u5', employeeName: 'Fernando López', date: day(-2), timeStart: t(8), timeEnd: t(14), purpose: 'Traslado de material', status: 'confirmed' },
]
const rooms = [
  { id: 1, name: 'Sala Azul', capacity: 8, floor: 1, equipment: ['TV', 'Videoconferencia'], isActive: true },
  { id: 3, name: 'Sala Verde', capacity: 12, floor: 2, equipment: ['Proyector'], isActive: true },
  { id: 2, name: 'Sala Pequeña', capacity: 4, floor: 0, equipment: [], isActive: false },
]
const vehicles = [
  { id: 10, model: 'Renault Clio', plate: '1111AAA', year: 2022, type: 'Turismo', isActive: true },
  { id: 11, model: 'Renault Clio', plate: '2222BBB', year: 2023, type: 'Turismo', isActive: true },
  { id: 12, model: 'Ford Transit', plate: '3333CCC', year: 2021, type: 'Furgoneta', isActive: true },
]
const hourCompensations = [
  { id: 70, type: 'bolsa', status: 'pending', hours: 3, date: day(-1), reason: 'Cierre de proyecto', employeeId: 'u4', employeeName: 'Elena Gómez', createdAt: ago(1) },
]
const auth = { user, employees, login: slow('login'), logout: slow('logout'), setLastActivity: () => {}, setEmployees: () => {}, setCurrentUser: slow('x'), patchUser: () => {}, refreshEmployees: slow('x'), needsOnboarding: false, setNeedsOnboarding: () => {}, authLoading: false }
const all = {
  requests, createRequest: slow('createRequest'), updateRequestStatus: slow('updateRequestStatus'), deleteRequest: slow('deleteRequest'), changeWorkMode: slow('changeWorkMode'),
  reservations, rooms, vehicles, createReservation: slow('createReservation'), updateReservationStatus: slow('updateReservationStatus'), deleteReservation: slow('deleteReservation'), deleteResource: slow('deleteResource'),
  documents: [], uploadDocumentFile: slow('upload'), sendDocument: slow('send'), deleteDocument: slow('delDoc'), deleteEmployeeData: slow('x'), onboardingDocUrl: null,
  hourCompensations, updateHourCompensationStatus: slow('hours'), deleteHourCompensation: slow('delHours'),
  personalDays, createPersonalDay: slow('createPersonalDay'), updatePersonalDayStatus: slow('updatePersonalDayStatus'),
  news: [], notifications: [], liveNotifs: [], announce: (icon, msg) => window.__calls.push(['announce', msg]),
  loadingData: false, loadFailed: false, refresh: slow('refresh'),
}
const P = ({ c, children }) => <c.Provider value={all}>{children}</c.Provider>
const Page = { requests: RequestsPage, reservations: ReservationsPage, employees: EmployeesPage, admin: AdminPage }[q.get('page') || 'requests']
const idle = { secondsLeft: null, stayActive: () => {} }

ReactDOM.createRoot(document.getElementById('root')).render(
  <ThemeProvider>
    <MemoryRouter>
      <AuthCtx.Provider value={auth}>
        <IdleCtx.Provider value={idle}>
          <P c={DataSyncCtx}><P c={NotifsCtx}><P c={NewsCtx}><P c={PersonalDaysCtx}><P c={HoursCtx}><P c={DocumentsCtx}>
            <P c={ReservationsCtx}><P c={RequestsCtx}><P c={DataCtx}>
              <div className="app-shell" style={{ minHeight: '100vh' }}>
                <Wallpaper />
                <main style={{ position: 'relative', padding: '28px 32px', maxWidth: 1440, margin: '0 auto' }}><Page /></main>
              </div>
            </P></P></P>
          </P></P></P></P></P></P>
        </IdleCtx.Provider>
      </AuthCtx.Provider>
    </MemoryRouter>
  </ThemeProvider>,
)
