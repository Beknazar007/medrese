import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Кутайба ибн Муслим Ислам институту',
        short_name: 'Медресе',
        description: 'Кутайба ибн Муслим Ислам институтунун окуу процессин башкаруу тутуму',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f5f5f5',
        theme_color: '#2f5fb3',
        orientation: 'portrait-primary',
        lang: 'ky',
        icons: [
          { src: 'pwa-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
})
