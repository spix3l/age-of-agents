import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // `model-lab.html` is a standalone art-review page: one model at a time, next to the crop
      // it was reconstructed from. It ships separately from the game entry.
      input: {
        game: fileURLToPath(new URL('index.html', import.meta.url)),
        'model-lab': fileURLToPath(new URL('model-lab.html', import.meta.url)),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    // Opponent and economy suites simulate tens of minutes of match time on a 240 x 176 map.
    testTimeout: 60_000,
  },
});
