import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600, // Phaser allein ist ca. 1,2 MB
    rollupOptions: {
      // Phaser in eine eigene Datei: Ändert sich nur das Spiel, bleibt Phaser im Browser-Cache.
      output: { manualChunks: { phaser: ['phaser'] } },
    },
  },
});
