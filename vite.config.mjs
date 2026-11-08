import { defineConfig } from 'vite';

// Zwei Varianten:
//   npm run build        → dist/       für Vercel (Seite liegt im Wurzelverzeichnis, Bestenliste unter /api)
//   npm run build:itch   → dist-itch/  für itch.io (liegt dort in einem Unterordner einer fremden Adresse):
//                          relative Pfade, Bestenliste und geteilte Links zeigen auf wrack-ikarus.vercel.app,
//                          ohne Vercel-Statistik und ohne Link zur klassischen Fassung (die gibt es dort nicht)
export default defineConfig(({ mode }) => {
  const itch = mode === 'itch';
  return {
    base: itch ? './' : '/',
    define: {
      __TARGET__: JSON.stringify(itch ? 'itch' : 'web'),
      // ITCH_SITE nur für Tests (lokaler Server statt der echten Seite)
      __SITE__: JSON.stringify(itch ? (process.env.ITCH_SITE || 'https://wrack-ikarus.vercel.app') : ''),
    },
    plugins: itch ? [{
      name: 'itch-html',
      transformIndexHtml: html => html
        .replace(/<script>\s*window\.va[\s\S]*?<\/script>\s*<script defer src="\/_vercel\/insights\/script\.js"><\/script>\s*/, '')
        .replace(/(href|src)="\/(?!\/)/g, '$1="./'),
    }] : [],
    build: {
      target: 'es2020',
      outDir: itch ? 'dist-itch' : 'dist',
      chunkSizeWarningLimit: 1600, // Phaser allein ist ca. 1,2 MB
      rollupOptions: {
        // Phaser in eine eigene Datei: Ändert sich nur das Spiel, bleibt Phaser im Browser-Cache.
        output: { manualChunks: { phaser: ['phaser'] } },
      },
    },
  };
});
