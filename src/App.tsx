import { Suspense, lazy, useState } from 'react'
import { ThemeProvider, AuthProvider, AuthCtx, AppCtx, DataProvider, startBootPrefetch } from './context'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence, MotionConfig } from 'motion/react'
import Layout from './components/Layout'
import { AssistantProvider } from './context/AssistantContext'
import { BootLoader } from './components/ui'

import { loadPage, readyPage, hasPage } from './pageLoaders'

/**
 * A route's page, loaded when first shown. A page whose code is already here (preloaded at start-up
 * or while signing in) is drawn at once: through lazy() it would still suspend for a moment, and
 * React keeps a fallback on screen for ~300 ms before revealing what replaces it.
 */
function page(name: string) {
  const Lazy = lazy(() => loadPage(name))
  return function Page(props: Record<string, unknown>) {
    // Decided once per mount: switching from Lazy to the loaded component would remount the page
    const [Ready] = useState(() => readyPage(name))
    return Ready ? <Ready {...props} /> : <Lazy {...props} />
  }
}

const LoginPage          = page('login')
const ChangePasswordPage = page('changePassword')
const DashboardPage      = page('dashboard')
const ReservationsPage   = page('reservations')
const RequestsPage       = page('requests')
const NewsPage           = page('news')
const AdminPage          = page('admin')
const EmployeesPage      = page('employees')
const ProfilePage        = page('profile')
const HorasPage          = page('horas')
const FichajePage        = page('fichaje')
const SettingsPage       = page('settings')
const MorePage           = page('mas')
const AssistantPage      = page('assistant')

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
  const route = window.location.pathname.slice(1)
  const notif = new URLSearchParams(window.location.search).has('notif')
  const name = !active ? 'login' : notif && hasPage(route) ? route : 'dashboard'
  loadPage(name).catch(() => { /* the route's own lazy() retries and shows the error */ })
}
preloadFirstPage()
// The profile and lists of a session about to be restored, in parallel with the code above
startBootPrefetch()

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
                      <Route path="/fichaje" element={<ProtectedRoute><FichajePage /></ProtectedRoute>} />
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
