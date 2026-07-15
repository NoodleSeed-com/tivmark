import { defineConfig } from 'vitest/config';

// Scope discovery to this project's own tests — otherwise vitest also runs the bundled example tests
// under .claude/skills/noodle-seed/examples/*/test.
export default defineConfig({
  test: { include: ['test/**/*.test.ts'] },
});
