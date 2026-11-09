import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/browser',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3107', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium', channel: 'chrome' },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 3107 --strictPort',
    url: 'http://127.0.0.1:3107',
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: 'https://supabase.example.test',
      VITE_SUPABASE_ANON_KEY: 'test-public-key',
      VITE_GEOAPIFY_API_KEY: '',
      VITE_DEBUG_LIFECYCLE: 'true',
    },
  },
});
