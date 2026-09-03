import { defineConfig } from 'vitest/config';

// Scope discovery to this project's own tests — otherwise vitest also runs the bundled example tests
// under .claude/skills/noodle-seed/examples/*/test.
export default defineConfig({
  // The SDK ships its own React copy. Inline its UI exports so the test renderer
  // and semantic components resolve the same React runtime, as the widget bundler does.
  resolve: { dedupe: ['react', 'react-dom'] },
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    setupFiles: ['./test/setup.ts'],
    server: {
      deps: {
        inline: [
          /@noodleseed\/one\/dist\/react\.js/,
          /@noodle-borg\/authoring\/dist\/react(?:\/|\.js)/,
          /@radix-ui\//,
        ],
      },
    },
  },
});
