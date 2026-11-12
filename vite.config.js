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
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
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
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts') || id.includes('d3')) {
              return 'vendor-recharts';
            }
            if (id.includes('framer-motion')) {
              return 'vendor-framer';
            }
            if (id.includes('@supabase') || id.includes('supabase-js')) {
              return 'vendor-supabase';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            return 'vendor';
          }
        }
      }
    }
  }
})
