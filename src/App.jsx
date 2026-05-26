import { useState } from 'react'
import { ThemeProvider, AuthProvider, AuthCtx, AppCtx, DataProvider, useAuth } from './context'

import Layout             from './components/Layout'
import { Suspense, lazy } from 'react'

const LoginPage          = lazy(() => import('./pages/LoginPage'))
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'))
const DashboardPage      = lazy(() => import('./pages/DashboardPage'))
const ReservationsPage   = lazy(() => import('./pages/ReservationsPage'))
const RequestsPage       = lazy(() => import('./pages/RequestsPage'))
const NewsPage           = lazy(() => import('./pages/NewsPage'))
const AdminPage          = lazy(() => import('./pages/AdminPage'))
const EmployeesPage      = lazy(() => import('./pages/EmployeesPage'))
const ProfilePage        = lazy(() => import('./pages/ProfilePage'))
const HorasPage          = lazy(() => import('./pages/HorasPage'))
const SettingsPage       = lazy(() => import('./pages/SettingsPage'))

// Loading screen while Supabase restores the session
function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', flexDirection: 'column', gap: 16,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, background: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 800, fontSize: 20,
      }}>M</div>
      <p style={{ color: 'var(--text-mut)', fontSize: 13 }}>Cargando sesión…</p>
    </div>
  )
}

function AppShell() {
  const [page, setPage] = useState('login')
  const navigate = p => setPage(p)

  return (
    <AuthProvider navigate={navigate}>
      <AuthCtx.Consumer>
        {({ user, authLoading }) => {
          if (authLoading) return <LoadingScreen />
          return (
            <AppCtx.Provider value={{ page, navigate }}>
              <DataProvider>
                <Suspense fallback={<LoadingScreen />}>
                  {page === 'login'          && <LoginPage />}
                  {page === 'changePassword' && <ChangePasswordPage />}
                  {page !== 'login' && page !== 'changePassword' && (
                    <Layout>
                      {page === 'dashboard'    && <DashboardPage />}
                      {page === 'reservations' && <ReservationsPage />}
                      {page === 'requests'     && <RequestsPage />}
                      {page === 'horas'        && <HorasPage />}
                      {page === 'news'         && <NewsPage />}
                      {page === 'profile'      && <ProfilePage />}
                      {page === 'employees'    && <EmployeesPage />}
                      {page === 'admin'        && (user?.role === 'admin' ? <AdminPage /> : <DashboardPage />)}
                      {page === 'settings'     && <SettingsPage />}
                    </Layout>
                  )}
                </Suspense>
              </DataProvider>
            </AppCtx.Provider>
          )
        }}
      </AuthCtx.Consumer>
    </AuthProvider>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  )
}
