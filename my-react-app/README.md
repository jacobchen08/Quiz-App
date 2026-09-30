# Quizzr frontend

The React + Vite app for Quizzr. See the [main README](../README.md) for what it does, how to run it and how it's tested.

```bash
npm install
npm run dev        # http://localhost:5173, forwards /api to the API on port 8000
npm test           # unit tests (Vitest)
npm run test:e2e   # end-to-end and accessibility tests (Playwright)
npm run build      # production build in dist/
```

Set `VITE_API_HOST` at build time to point the app at an API hosted somewhere else.
