import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Default env is node (server actions / pure logic). Component tests opt into
    // jsdom per-file with a `// @vitest-environment jsdom` comment.
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
