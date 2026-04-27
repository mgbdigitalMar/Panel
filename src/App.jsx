import { useState } from 'react'
import { ThemeProvider, AuthProvider, AuthCtx, AppCtx, DataProvider, useAuth } from './context'

import Layout             from './components/Layout'
import LoginPage          from './pages/LoginPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import DashboardPage      from './pages/DashboardPage'
import ReservationsPage   from './pages/ReservationsPage'
import RequestsPage       from './pages/RequestsPage'
import NewsPage           from './pages/NewsPage'
import AdminPage          from './pages/AdminPage'
import EmployeesPage      from './pages/EmployeesPage'
import ProfilePage        from './pages/ProfilePage'
import HorasPage          from './pages/HorasPage'

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
                  </Layout>
                )}
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
