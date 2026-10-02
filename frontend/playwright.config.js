import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// End-to-end tests: real browsers against the real backend.
//
// Playwright starts its own FastAPI server (on 8010, with Open Trivia DB swapped for
// predictable offline questions and a throwaway database) and its own Vite dev server
// (on 5180) that proxies to it, so a dev setup already running on 8000/5173 is untouched.
//
// Every test runs in Chromium (Chrome, Edge), Firefox and WebKit (Safari).
//
//   npm run test:e2e                         Chromium (the Microsoft Edge on this machine) and WebKit
//   npm run test:e2e -- --project=webkit     just one engine
//   CI=1 npm run test:e2e                    all three, with Playwright's own Chromium instead of Edge
//
// The first time, install the engines: npx playwright install chromium firefox webkit

const API_PORT = 8010;
const WEB_PORT = 5180;
// Which engines run. CI runs all three; locally Firefox is opt-in, because some Windows
// security settings (such as Smart App Control) refuse to start Playwright's Firefox build.
// E2E_BROWSERS=chromium,firefox,webkit npm run test:e2e   runs all three anyway
const engines = (process.env.E2E_BROWSERS ?? (process.env.CI ? 'chromium,firefox,webkit' : 'chromium,webkit')).split(',');
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
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: process.env.CI ? undefined : 'msedge' },
    },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ].filter((project) => engines.includes(project.name)),
  webServer: [
    {
      command: `${python} -m uvicorn --app-dir ../backend main:app --port ${API_PORT} --no-access-log`,
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
      // save the offline question pack quickly, so the offline test needn't wait 15 seconds
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}`, VITE_OFFLINE_PACK_DELAY: '300' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
