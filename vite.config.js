import { defineConfig } from 'vite';

// Static Three.js app. Vercel auto-detects Vite; no adapter needed.
// `manualChunks` keeps the three/postprocessing vendor bundle separate from
// game code so iterating on gameplay doesn't bust the vendor cache.
export default defineConfig({
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
