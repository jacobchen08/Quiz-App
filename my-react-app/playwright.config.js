import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// End-to-end tests: real browsers against the real backend.
//
// Playwright starts its own FastAPI server (on 8010, with Open Trivia DB swapped for
// predictable offline questions and a throwaway database) and its own Vite dev server
// (on 5180) that proxies to it, so a dev setup already running on 8000/5173 is untouched.
//
//   npm run test:e2e          uses the Microsoft Edge already on this machine
//   CI=1 npm run test:e2e     uses Playwright's own Chromium (npx playwright install chromium)

const API_PORT = 8010;
const WEB_PORT = 5180;
const python = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // the tests share one backend and its rate limits
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    channel: process.env.CI ? undefined : 'msedge',
  },
  webServer: [
    {
      command: `${python} -m uvicorn --app-dir ../backend apicall:app --port ${API_PORT}`,
      url: `http://localhost:${API_PORT}/api/health`,
      env: {
        QUIZZR_OFFLINE_TRIVIA: '1',
        QUIZZR_DB: join(tmpdir(), `quizzr-e2e-${Date.now()}.db`),
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
