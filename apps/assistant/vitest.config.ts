import { defineConfig } from 'vitest/config';

// Scope test discovery to this app's own tests (not the bundled skill examples under .claude/).
export default defineConfig({
  test: { include: ['test/**/*.test.ts'] },
});
