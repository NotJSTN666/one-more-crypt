// Bundles scripts/cards.ts into one file for the Crypt Census dashboard: npm run build:cards
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist-cards',
    emptyOutDir: true,
    lib: { entry: 'scripts/cards.ts', name: 'OMCCards', formats: ['iife'], fileName: () => 'cards.js' },
  },
});
