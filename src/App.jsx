import { useState } from 'react'
import { ThemeProvider, AuthProvider, AuthCtx, AppCtx, DataProvider, useAuth } from './context'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

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

function ProtectedRoute({ children }) {
  return (
    <AuthCtx.Consumer>
      {({ user, authLoading }) => {
        if (authLoading) return <LoadingScreen />
        if (!user) return <Navigate to="/login" replace />
        return (
          <Layout>
            {children}
          </Layout>
        )
      }}
    </AuthCtx.Consumer>
  )
}

function AdminRoute({ children }) {
  return (
    <AuthCtx.Consumer>
      {({ user }) => {
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
          {({ authLoading }) => {
            if (authLoading) return <LoadingScreen />
            return (
              <AppCtx.Provider value={{}}> {/* AppCtx ya no maneja navegación, pero lo mantenemos si algo más lo requiere */}
                <DataProvider>
                  <Suspense fallback={<LoadingScreen />}>
                    <Routes>
                      {/* Rutas Públicas */}
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/changePassword" element={<ChangePasswordPage />} />
                      
                      {/* Rutas Protegidas */}
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      
                      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                      <Route path="/reservations" element={<ProtectedRoute><ReservationsPage /></ProtectedRoute>} />
                      <Route path="/requests" element={<ProtectedRoute><RequestsPage /></ProtectedRoute>} />
                      <Route path="/horas" element={<ProtectedRoute><HorasPage /></ProtectedRoute>} />
                      <Route path="/news" element={<ProtectedRoute><NewsPage /></ProtectedRoute>} />
                      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                      <Route path="/employees" element={<ProtectedRoute><EmployeesPage /></ProtectedRoute>} />
                      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                      
                      {/* Ruta Admin */}
                      <Route path="/admin" element={<ProtectedRoute><AdminRoute><AdminPage /></AdminRoute></ProtectedRoute>} />
                      
                      {/* Fallback */}
                      <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                  </Suspense>
                </DataProvider>
              </AppCtx.Provider>
            )
          }}
        </AuthCtx.Consumer>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  )
}
