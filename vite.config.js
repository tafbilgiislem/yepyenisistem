import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        // Ana sayfa (Editor)
        main: resolve(__dirname, 'index.html'),
        // İkinci sayfa (Yayın Ekranı)
        yayin: resolve(__dirname, 'yayin.html')
      }
    }
  }
})