import { Suspense, lazy } from 'react'
import { ThemeProvider, AuthProvider, AuthCtx, AppCtx, DataProvider } from './context'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence, MotionConfig } from 'framer-motion'
import Layout from './components/Layout'
import { AssistantProvider } from './context/AssistantContext'
import { BootLoader } from './components/ui'

// Each page's code, loaded when its route is first shown
const pages = {
  login:          () => import('./pages/LoginPage'),
  changePassword: () => import('./pages/ChangePasswordPage'),
  dashboard:      () => import('./pages/DashboardPage'),
  reservations:   () => import('./pages/ReservationsPage'),
  requests:       () => import('./pages/RequestsPage'),
  news:           () => import('./pages/NewsPage'),
  admin:          () => import('./pages/AdminPage'),
  employees:      () => import('./pages/EmployeesPage'),
  profile:        () => import('./pages/ProfilePage'),
  horas:          () => import('./pages/HorasPage'),
  settings:       () => import('./pages/SettingsPage'),
  mas:            () => import('./pages/MorePage'),
  assistant:      () => import('./pages/AssistantPage'),
}

const LoginPage          = lazy(pages.login)
const ChangePasswordPage = lazy(pages.changePassword)
const DashboardPage      = lazy(pages.dashboard)
const ReservationsPage   = lazy(pages.reservations)
const RequestsPage       = lazy(pages.requests)
const NewsPage           = lazy(pages.news)
const AdminPage          = lazy(pages.admin)
const EmployeesPage      = lazy(pages.employees)
const ProfilePage        = lazy(pages.profile)
const HorasPage          = lazy(pages.horas)
const SettingsPage       = lazy(pages.settings)
const MorePage           = lazy(pages.mas)
const AssistantPage      = lazy(pages.assistant)

/**
 * The first screen's code starts downloading now, while the session is checked, instead of after:
 * the check takes a round trip to Supabase and the page's code was only requested once it ended.
 * A restored session always opens /dashboard (or the page a tapped notification points to), and
 * one idle for more than a minute is closed (context/index.jsx), as is a visit with no session:
 * those open /login.
 */
function preloadFirstPage() {
  let active = false
  try {
    const stored = JSON.parse(localStorage.getItem('margube_session') || 'null')
    active = Boolean(stored?.id) && Date.now() - stored.lastActivity <= 60 * 1000
  } catch { /* private mode or a corrupt entry: treat as signed out */ }
  const route = window.location.pathname.slice(1) as keyof typeof pages
  const notif = new URLSearchParams(window.location.search).has('notif')
  const load = !active ? pages.login : notif && pages[route] ? pages[route] : pages.dashboard
  load().catch(() => { /* the route's own lazy() retries and shows the error */ })
}
preloadFirstPage()

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <AuthCtx.Consumer>
      {({ user, authLoading }: any) => {
        if (authLoading) return <BootLoader />
        if (!user) return <Navigate to="/login" replace />
        // First access: the temporary password must be replaced before using the intranet
        if (user.firstLogin === true || user.firstLogin === 'true') return <Navigate to="/changePassword" replace />
        return (
          <Layout>
            {children}
          </Layout>
        )
      }}
    </AuthCtx.Consumer>
  )
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  return (
    <AuthCtx.Consumer>
      {({ user }: any) => {
        if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />
        return children
      }}
    </AuthCtx.Consumer>
  )
}

function AppShell() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthCtx.Consumer>
          {({ authLoading }: any) => (
            <>
            {/* Boot loader dissolves over the app once the session is restored */}
            <AnimatePresence>
              {authLoading && <BootLoader key="boot" />}
            </AnimatePresence>
            {!authLoading && (
              <AppCtx.Provider value={{}}> {/* AppCtx ya no maneja navegación */}
                <DataProvider>
                  <AssistantProvider><Suspense fallback={<BootLoader label="Cargando…" />}>
                    <Routes>
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/changePassword" element={<ChangePasswordPage />} />
                      
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      
                      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                      <Route path="/reservations" element={<ProtectedRoute><ReservationsPage /></ProtectedRoute>} />
                      <Route path="/requests" element={<ProtectedRoute><RequestsPage /></ProtectedRoute>} />
                      <Route path="/horas" element={<ProtectedRoute><HorasPage /></ProtectedRoute>} />
                      <Route path="/news" element={<ProtectedRoute><NewsPage /></ProtectedRoute>} />
                      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                      <Route path="/employees" element={<ProtectedRoute><EmployeesPage /></ProtectedRoute>} />
                      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                      <Route path="/mas" element={<ProtectedRoute><MorePage /></ProtectedRoute>} />
                      <Route path="/assistant" element={<ProtectedRoute><AssistantPage /></ProtectedRoute>} />
                      
                      <Route path="/admin" element={<ProtectedRoute><AdminRoute><AdminPage /></AdminRoute></ProtectedRoute>} />
                      
                      <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                  </Suspense></AssistantProvider>
                </DataProvider>
              </AppCtx.Provider>
            )}
            </>
          )}
        </AuthCtx.Consumer>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      {/* Framer Motion honours prefers-reduced-motion app-wide */}
      <MotionConfig reducedMotion="user">
        <AppShell />
      </MotionConfig>
    </ThemeProvider>
  )
}
