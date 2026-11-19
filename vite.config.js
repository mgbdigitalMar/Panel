import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

function assistantApi() {
  const setup = async (server) => {
    const localEnv = loadEnv(server.config.mode, server.config.root, '')
    const { createNodeAssistantHandler } = await import('./server/assistant-http.mjs')
    server.middlewares.use('/api/assistant', createNodeAssistantHandler({
      env: (name) => process.env[name] || localEnv[name],
    }))
  }
  return { name: 'margube-assistant-api', configureServer: setup, configurePreviewServer: setup }
}

export default defineConfig({
  plugins: [
    react(),
    // Compiles src/styles/boardui/index.css (BoardUI components only; see that file)
    tailwindcss(),
    assistantApi(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Navigations to real files (PDFs in /public, push-sw.js...) must reach the
        // server; otherwise the SPA fallback serves index.html and the policy
        // iframe renders the intranet inside itself instead of the PDF.
        navigateFallbackDenylist: [/\/[^/?]+\.[^/?]+$/, /^\/api\//],
        // Fonts and images are cached as they are used rather than precached: the font package
        // ships subsets (Cyrillic, Greek…) a Spanish page never asks for.
        runtimeCaching: [
          {
            // Hashed files under /assets: a new version has a new name, so the cached copy is final
            urlPattern: ({ request, sameOrigin }) => sameOrigin && request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 16, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Shown from the cache at once and refreshed behind: /wallpaper.webp and the icons keep
            // their names when replaced, so a cache-first copy would never update
            urlPattern: ({ request, sameOrigin }) => sameOrigin && request.destination === 'image',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 40, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      manifest: {
        name: 'Margube Intranet',
        short_name: 'Margube',
        description: 'Intranet corporativa de Margube',
        // From the home screen it opens full screen, without Safari's bars (index.html adds
        // apple-mobile-web-app-capable + a black-translucent status bar for iOS)
        display: 'standalone',
        display_override: ['fullscreen', 'standalone'],
        start_url: '/',
        scope: '/',
        theme_color: '#0E0F14',
        background_color: '#101116',
        // maskable: Android cuts it to the launcher's shape (circle, squircle...) instead of
        // shrinking the rounded tile into a white disc. monochrome: the leaf alone, which Android
        // tints with the wallpaper colours when the user turns on themed icons.
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/pwa-monochrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'monochrome' }
        ]
      }
    })
  ],
  resolve: {
    // BoardUI imports through `@/` (src/). Anchored on the slash so scoped packages like @tanstack/... are untouched.
    alias: [{ find: /^@\//, replacement: fileURLToPath(new URL('./src/', import.meta.url)) }],
  },
  server: {
    watch: {
      ignored: ['**/mobile/**', '**/tests/**', '**/supabase/**']
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        silenceDeprecations: ['legacy-js-api', 'import']
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        // Only the libraries every page needs from the start get a shared chunk of their own.
        // Anything else (react-aria and its date library, the BoardUI pieces) is left out on
        // purpose: it then travels with the lazy code that imports it instead of being bundled
        // into the first download. A catch-all `return 'vendor'` had put ~200 kB of date picker
        // and tooltip into every first load.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // clsx and react-is are shared with recharts: left unassigned, the bundler put clsx in the
          // charts chunk and every first load then downloaded all of it to get a 1 kB helper
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|@tanstack|clsx|react-is)[\\/]/.test(id)) return 'vendor-react';
          // Motion: `motion/react` is framer-motion inside, with motion-dom and motion-utils
          if (/[\\/]node_modules[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'vendor-motion';
          if (/@supabase|supabase-js/.test(id)) return 'vendor-supabase';
          // Charts load on demand (components/charts/Recharts.jsx) with everything they pull in
          if (/recharts|[\\/]d3-|victory-vendor|es-toolkit|[\\/]immer[\\/]|decimal\.js|@reduxjs|[\\/]redux|reselect|eventemitter3/.test(id)) return 'vendor-recharts';
          if (/lucide-react/.test(id)) return 'vendor-icons';
          return undefined;
        }
      }
    }
  }
})
