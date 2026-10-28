import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import { supabaseConfigured } from './utils/supabase'
import { LeafMark } from './components/ui'
import './styles/global.scss'

const queryClient = new QueryClient()

// Shown instead of a blank page when the Supabase env vars are missing
function SetupRequired() {
  return (
    <main style={{
      minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24,
      background: 'var(--bg)', color: 'var(--text)',
    }}>
      <div style={{ maxWidth: 460, display: 'grid', gap: 14, justifyItems: 'start' }}>
        <LeafMark size={48} animate={false} />
        <h1 style={{ fontSize: 24 }}>Falta la conexión con Supabase</h1>
        <p style={{ color: 'var(--text-sec)' }}>
          Crea un archivo <code>.env.local</code> en la raíz del proyecto con
          <code> VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>,
          y reinicia el servidor con <code>npm run dev</code>.
        </p>
      </div>
    </main>
  )
}

// Dev only: a PWA worker left by an old build keeps serving the cached app. Remove it and
// its caches once; the notifications worker under /push/ stays.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  (async () => {
    const regs = await navigator.serviceWorker.getRegistrations()
    const stale = regs.filter(r => !new URL(r.scope).pathname.startsWith('/push/'))
    const cacheKeys = 'caches' in window ? await caches.keys() : []
    if (!stale.length && !cacheKeys.length) return
    await Promise.all([...stale.map(r => r.unregister()), ...cacheKeys.map(k => caches.delete(k))])
    if (!sessionStorage.getItem('margube-sw-cleaned')) {
      sessionStorage.setItem('margube-sw-cleaned', '1')
      location.reload()
    }
  })().catch(() => {})
}

// Set before the first paint so the wallpaper and panels don't flash (see ThemeProvider)
document.documentElement.setAttribute(
  'data-appearance',
  (() => { try { return localStorage.getItem('app-appearance') === 'classic' ? 'classic' : 'glass' } catch { return 'glass' } })()
)

document.documentElement.setAttribute(
  'data-theme',
  (() => {
    try {
      const m = localStorage.getItem('app-theme-mode') || 'dark'
      return m === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : m
    } catch { return 'dark' }
  })()
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {supabaseConfigured ? (
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    ) : <SetupRequired />}
  </React.StrictMode>
)
