import { defineConfig } from 'vitest/config';

// Deployed at https://<user>.github.io/edl-converter/
export default defineConfig({
  base: '/edl-converter/',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
