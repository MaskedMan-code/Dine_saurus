import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const frontendKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_ANON_KEY;
  let legacyRole: string | undefined;
  try {
    legacyRole = JSON.parse(
      Buffer.from(frontendKey?.split('.')[1] || '', 'base64url').toString(),
    ).role;
  } catch {
    /* Publishable keys are not JWTs. */
  }
  if (frontendKey?.startsWith('sb_secret_') || legacyRole === 'service_role')
    throw new Error(
      'Supabase secret/service-role keys cannot be used in Vite. Use a publishable or anon key.',
    );
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch:
        process.env.DISABLE_HMR === 'true'
          ? null
          : {
              ignored: [
                '**/.cache/**',
                '**/test-results/**',
                '**/playwright-report/**',
                '**/node_modules.locked/**',
              ],
            },
    },
  };
});
