import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['papers/*.json', 'vocab/*.json'],
      manifest: {
        name: '考研英语一真题题库',
        short_name: '英语一题库',
        description: '考研英语（一）2005-2025 真题客观题练习、解析、单词本与批注',
        theme_color: '#1e3a5f',
        background_color: '#f8fafc',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\.json$/,
            handler: 'CacheFirst',
            options: { cacheName: 'papers-cache', expiration: { maxEntries: 60, maxAgeSeconds: 365 * 24 * 3600 } }
          }
        ]
      }
    })
  ],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  server: { host: true, port: 5173 }
})
