// TEMPORARY visual check with sample data (deleted after use). No Supabase calls are made.
import ReactDOM from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import {
  ThemeProvider, AuthCtx, RequestsCtx, ReservationsCtx, DocumentsCtx, HoursCtx, PersonalDaysCtx,
  NewsCtx, NotifsCtx, DataSyncCtx, DataCtx,
} from './context'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
const isLogin = new URLSearchParams(location.search).get('page') === 'login'
import './styles/global.scss'

const q = new URLSearchParams(location.search)
localStorage.setItem('app-theme-mode', q.get('theme') || 'dark')
localStorage.setItem('app-appearance', 'glass')
document.documentElement.setAttribute('data-appearance', 'glass')

const iso = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const names = ['MGB Digital', 'Bruno Díaz', 'Carla Ruiz', 'David Martín']
const employees = names.map((n, i) => ({
  id: `u${i}`, name: n, email: 'x@margube.com', role: i === 0 ? 'admin' : 'employee', dept: 'Comercial - marketing',
  position: '', avatar: n.split(' ').map((w) => w[0]).join(''), workMode: 'Office', policyAccepted: true, firstLogin: false, teleworkDays: [],
}))
const news = [
  { id: 1, type: 'news', title: 'Gran celebración 15º Aniversario Margube — 15 Feb', content: 'Cena de gala en el Hotel NH. Confirma asistencia antes del 10 de febrero.', authorName: 'Josune Gutierrez', authorAvatar: 'JG', date: iso(-2), pinned: true, category: 'Empresa' },
  { id: 2, type: 'news', title: 'Margube alcanza récord de ventas en Q4 2024', content: 'Cerramos el trimestre con un incremento del 34%.', authorName: 'Josune Gutierrez', authorAvatar: 'JG', date: iso(-6), pinned: true, category: 'Empresa' },
]
const noop = async () => ({ error: null })
const auth = { user: employees[0], employees, login: noop, logout: noop, setLastActivity: () => {}, setEmployees: () => {}, setCurrentUser: noop, patchUser: () => {}, refreshEmployees: noop, needsOnboarding: false, setNeedsOnboarding: () => {}, authLoading: false }
const all = {
  requests: [], createRequest: noop, updateRequestStatus: noop, deleteRequest: noop, changeWorkMode: noop,
  reservations: [], rooms: [], vehicles: [], createReservation: noop, updateReservationStatus: noop, deleteReservation: noop,
  documents: [], sendDocument: noop, updateDocumentStatus: noop, uploadDocumentFile: noop, deleteDocument: noop, onboardingDocUrl: null, deleteEmployeeData: noop,
  hourCompensations: [{ id: 1, status: 'pending', type: 'bolsa', hours: 2, employeeId: 'u1' }], createHourCompensation: noop, updateHourCompensationStatus: noop, deleteHourCompensation: noop,
  personalDays: [], createPersonalDay: noop, updatePersonalDayStatus: noop,
  news, createNews: noop, updateNews: noop, deleteNews: noop,
  notifications: [], markNotifRead: noop, markAllNotifsRead: noop, readIds: new Set(), markRead: () => {}, markAllRead: () => {}, liveNotifs: [], announce: () => {},
  loadingData: false, loadFailed: false, refresh: noop,
}
const P = ({ c, children }) => <c.Provider value={all}>{children}</c.Provider>

ReactDOM.createRoot(document.getElementById('root')).render(
  <ThemeProvider>
    <MemoryRouter initialEntries={['/dashboard']}>
      <AuthCtx.Provider value={auth}>
        <P c={DataSyncCtx}><P c={NotifsCtx}><P c={NewsCtx}><P c={PersonalDaysCtx}><P c={HoursCtx}><P c={DocumentsCtx}>
          <P c={ReservationsCtx}><P c={RequestsCtx}><P c={DataCtx}>
            {isLogin ? <LoginPage /> : <Layout><DashboardPage /></Layout>}
          </P></P></P>
        </P></P></P></P></P></P>
      </AuthCtx.Provider>
    </MemoryRouter>
  </ThemeProvider>,
)

// Open a menu for the screenshot
setTimeout(() => {
  const open = q.get('open')
  if (open === 'more') document.querySelector('[aria-label^="Más secciones"]')?.click()
  if (open === 'avatar') document.querySelector('[aria-label*="Jornada al"]')?.click()
}, 1500)
setTimeout(() => {
  const el = document.querySelector('[class*="moreSheet"]') || document.querySelector('[class*="_menu_"]')
  const bar = document.querySelector('[class*="tabBar"]')
  const cs = el && getComputedStyle(el)
  document.body.dataset.probe = el ? `opacity=${cs.opacity} bg=${cs.backgroundImage.slice(-40)}|${cs.backgroundColor} barBg=${getComputedStyle(bar).backgroundColor}` : 'none'
}, 4000)
// headless Chrome freezes the entrance fade: show the final frame
const st = document.createElement('style')
st.textContent = '[class*="moreSheet"],[class*="_menu_"]{opacity:1!important;transform:none!important}'
document.head.appendChild(st)
