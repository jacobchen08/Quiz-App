import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Link previews need full addresses: most chat apps won't load a preview image from a
// relative path. The site's address comes from VITE_SITE_URL, or from RENDER_EXTERNAL_URL,
// which Render sets during its builds. Without either, the tags stay relative.
function absoluteShareLinks() {
  const site = (process.env.VITE_SITE_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '')
  return {
    name: 'absolute-share-links',
    transformIndexHtml(html) {
      if (!site) return html
      return html
        .replace('content="/og-image.png"', `content="${site}/og-image.png"`)
        .replace('<meta property="og:type"', `<meta property="og:url" content="${site}/" />\n    <meta property="og:type"`)
    },
  }
}

// Ask for the two Latin font files straight away, instead of after the CSS has been read,
// so text is drawn in its real face from the start and doesn't jump when the font arrives
function preloadFonts() {
  return {
    name: 'preload-fonts',
    transformIndexHtml(html, ctx) {
      if (!ctx.bundle) return html // dev server: nothing is bundled yet
      const fonts = Object.keys(ctx.bundle).filter((file) =>
        /sofia-sans(-condensed)?-latin-wght-normal-.*\.woff2$/.test(file)
      )
      return fonts.map((file) => ({
        tag: 'link',
        attrs: { rel: 'preload', href: `/${file}`, as: 'font', type: 'font/woff2', crossorigin: '' },
        injectTo: 'head',
      }))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), absoluteShareLinks(), preloadFonts()],
  server: {
    // Forward API calls and multiplayer WebSockets to the FastAPI server during development
    proxy: {
      // (the end-to-end tests point this at their own backend with API_PROXY_TARGET)
      '/api': { target: process.env.API_PROXY_TARGET || 'http://localhost:8000', ws: true },
    },
  },
  // `npm test`: components render in a simulated browser (jsdom)
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'], // e2e/ belongs to Playwright
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
})
