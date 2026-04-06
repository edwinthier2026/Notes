import type { Plugin } from 'vite';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import packageJson from './package.json';
import { handleNotesApiRequest } from './server/notes-api.ts';

function notesApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'notes-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const handled = await handleNotesApiRequest(req, res, { ...process.env, ...env });
        if (!handled) {
          next();
        }
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const handled = await handleNotesApiRequest(req, res, { ...process.env, ...env });
        if (!handled) {
          next();
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), notesApiPlugin(env)],
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },

    // DEV (lokaal)
    server: {
      host: true,
      port: 8080,
      allowedHosts: true, // 🔥 voorkomt blocked requests
    },

    // PREVIEW (Coolify / productie)
    preview: {
      host: true,
      port: 8080,
      allowedHosts: true, // 🔥 dit is de fix voor jouw probleem
    },
  };
});
