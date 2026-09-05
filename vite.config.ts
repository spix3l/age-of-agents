import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // The game is a static bundle with no backend, so it deploys to a domain root by default.
  // Set BASE_PATH at build time to serve it from a sub-path instead (e.g. BASE_PATH=/game/).
  base: process.env.BASE_PATH ?? '/',
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    // Opponent and economy suites simulate tens of minutes of match time on a 240 x 176 map.
    testTimeout: 60_000,
  },
});
