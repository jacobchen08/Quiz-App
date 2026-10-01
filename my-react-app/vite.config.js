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

// Offline support: a service worker written at build time, when the exact (hashed) file names
// are known. It saves the whole built app on first visit so the page opens without a
// connection. Pages are fetched network-first (so new releases arrive straight away) and
// fall back to the saved copy; hashed assets are served from the cache. The API is never
// cached: answers, rooms and leaderboards always come from the server.
function serviceWorker() {
  return {
    name: 'service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter((file) => !file.endsWith('.map'))
      const statics = ['favicon.svg', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']
      const precache = ['/', ...files.map((f) => `/${f}`), ...statics.map((f) => `/${f}`)]
      // the cache name changes whenever any built file does, so old caches get cleared out
      let hash = 0
      for (const ch of files.sort().join('|')) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
      const source = `// Generated at build time by vite.config.js. Don't edit by hand.
const CACHE = 'quizzr-${hash.toString(36)}';
const PRECACHE = ${JSON.stringify(precache)};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('quizzr-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // only this site's own files; never the API, never other sites
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    // the page: the network first, so new releases show up; the saved copy when offline
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('/', copy));
          return response;
        })
        .catch(() => caches.match('/', { ignoreVary: true }))
    );
    return;
  }

  // everything else is a built file whose name changes when its content does: cache first.
  // ignoreVary: scripts and fonts are requested with an Origin header (crossorigin) that the
  // install-time copies lacked; with hashed names, a saved copy is right whatever the headers.
  event.respondWith(
    caches.match(request, { ignoreVary: true }).then((hit) => hit || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    }))
  );
});
`
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), absoluteShareLinks(), preloadFonts(), serviceWorker()],
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
