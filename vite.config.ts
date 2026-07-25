import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '家計簿アプリ',
        short_name: '家計簿',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#4CAF50',
        icons: [
          // 実装フェーズでアプリアイコン画像(192x192, 512x512)を
          // public/ 配下に配置し、パスをここに指定してください
        ]
      }
    })
  ]
})
