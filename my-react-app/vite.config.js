import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Forward API calls and multiplayer WebSockets to the FastAPI server during development
    proxy: {
      '/api': { target: 'http://localhost:8000', ws: true },
    },
  },
  // `npm test`: components render in a simulated browser (jsdom)
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
})
