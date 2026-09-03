import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    // Opponent and economy suites simulate tens of minutes of match time on a 240 x 176 map.
    testTimeout: 60_000,
  },
});
