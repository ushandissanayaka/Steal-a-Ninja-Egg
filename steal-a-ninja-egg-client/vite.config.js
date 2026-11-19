import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Boxity environments: the platform tells the game where it runs (window.BLOXITY_ENV / the portal
// handshake); the build never bakes one in. For a standalone page against a LOCAL Boxity stack, start
// the dev server with BLOXITY_LOCAL=1 and it injects the local environment (dev server only, never in
// a production build). Without it, local dev talks to prod Boxity like any page Boxity does not serve.
const LOCAL_ENV = {
  env: 'local',
  apiUrl: 'http://localhost:4000',
  playUrl: 'http://localhost:2567',
  portalUrl: 'http://localhost:3000',
  staticUrl: 'https://static.bloxity.io',
};

const boxityLocalEnv = {
  name: 'boxity-local-env',
  apply: 'serve',
  transformIndexHtml: () => (process.env.BLOXITY_LOCAL === '1'
    ? [{ tag: 'script', children: `window.BLOXITY_ENV = ${JSON.stringify(LOCAL_ENV)}`, injectTo: 'head-prepend' }]
    : []),
};

export default defineConfig({
  plugins: [react(), boxityLocalEnv],
  base: './',
  server: { port: 5180, strictPort: true, host: true }, // its own port, so it never clashes with the other games' dev servers on 5173
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: { manualChunks: { three: ['three'] } },
    },
  },
});
