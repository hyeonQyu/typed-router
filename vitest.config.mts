import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  // Resolved to source, not `dist`, so these tests need no prior build — the same
  // choice `tests/tsconfig.json` already makes for the type tests. It also means a
  // green run can never describe code that is no longer in `src`.
  resolve: {
    alias: [
      // Next's navigation hooks assert that an App Router is mounted, and `next/link`
      // drags that runtime in with it. The repo also installs `next` twice, so a
      // `vi.mock` from a test file would not bind the copy the adapter resolves —
      // these aliases do. See the stubs for what they stand in for.
      { find: 'next/navigation', replacement: source('./tests/stubs/next-navigation.ts') },
      { find: 'next/link', replacement: source('./tests/stubs/next-link.tsx') },
      { find: 'next/router', replacement: source('./tests/stubs/next-router.ts') },

      { find: '@hyeonqyu/typed-router-next/check', replacement: source('./packages/next/src/check.ts') },
      { find: '@hyeonqyu/typed-router-next/pages', replacement: source('./packages/next/src/pages/index.ts') },
      { find: '@hyeonqyu/typed-router-next', replacement: source('./packages/next/src/index.ts') },
      { find: '@hyeonqyu/typed-router-react', replacement: source('./packages/react/src/index.ts') },
      { find: '@hyeonqyu/typed-router-core', replacement: source('./packages/core/src/index.ts') },
    ],
  },
  // `examples/next-example/tsconfig.json` sets `jsx: 'preserve'`, which is what Next
  // wants and what the transformer refuses to hand back as JS. The tests render those
  // pages, so the runner compiles JSX itself rather than passing it through untouched.
  oxc: { jsx: { runtime: 'automatic' } },

  test: {
    // `tests/*.test-d.ts` are compile-only assertions owned by `tsc -p tests/tsconfig.json`
    // and are deliberately not picked up here. Everything else that runs at runtime is:
    // `.mjs` for the framework-free suite, `.tsx` for the two adapters' rendering tests.
    include: ['tests/**/*.test.{ts,tsx,mjs}'],
    // Node by default; the rendering suites opt in per file with a
    // `@vitest-environment jsdom` docblock, so the framework-free tests stay fast.
    environment: 'node',
  },
});
