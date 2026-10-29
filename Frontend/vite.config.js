import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './', // Use relative paths for Chrome extension compatibility
  server: {
    host: true, // Exposes server to local network for mobile phone testing
    port: 5173,
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react/') || id.includes('react-dom/') || id.includes('react-router-dom/')) {
              return 'vendor-react';
            }
            if (id.includes('framer-motion')) {
              return 'vendor-framer';
            }
            if (id.includes('react-markdown')) {
              return 'vendor-markdown';
            }
            if (id.includes('lucide-react') || id.includes('react-icons')) {
              return 'vendor-icons';
            }
            if (id.includes('lenis') || id.includes('gsap')) {
              return 'vendor-animations';
            }
            if (id.includes('axios') || id.includes('zustand') || id.includes('clsx') || id.includes('tailwind-merge')) {
              return 'vendor-utils';
            }
          }
        }
      }
    }
  }
})
