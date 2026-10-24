import type { Options } from 'tsup';
import { defineConfig } from 'tsup';

/**
 * `src/client.tsx` carries a `'use client'` directive and must stay a module of its own:
 * if it were inlined into the entry, the directive would apply to `defineRoutes` too and
 * server components could no longer import the route tree.
 *
 * So the entry is bundled with `./client` left external, resolved to the real file name
 * for each format (Node ESM does no extension guessing).
 */
const keepClientBoundary = (extension: string): NonNullable<Options['esbuildPlugins']>[number] => ({
  name: 'keep-client-boundary',
  setup(build) {
    build.onResolve({ filter: /^\.\/client$/ }, () => ({ path: `./client${extension}`, external: true }));
  },
});

const shared = {
  external: ['react', 'react-dom', 'next', '@hyeonqyu/typed-router-core'],
  bundle: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  keepNames: true,
  treeshake: true,
} satisfies Options;

export default defineConfig([
  {
    ...shared,
    entry: { client: 'src/client.tsx' },
    format: ['esm', 'cjs'],
    clean: true,
    dts: false,
    // esbuild drops module-level directives when bundling, and tsup's rollup-based
    // treeshaking strips them again — so re-attach the boundary and skip that pass.
    banner: { js: '"use client";' },
    treeshake: false,
  },
  {
    ...shared,
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    dts: true,
    esbuildPlugins: [keepClientBoundary('.mjs')],
  },
  {
    ...shared,
    entry: { index: 'src/index.ts' },
    format: ['cjs'],
    dts: true,
    esbuildPlugins: [keepClientBoundary('.js')],
  },
  // The Pages Router entry. It imports `TypedLink` and the core, never `./client` or the
  // package root, so `next/navigation` cannot reach a Pages Router bundle through it.
  {
    ...shared,
    entry: { pages: 'src/pages/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
  },
  // `src/check.ts` reads the filesystem, so it ships as its own entry point and is
  // never reachable from `.` — that is what keeps `node:fs` out of browser bundles.
  {
    ...shared,
    entry: { check: 'src/check.ts' },
    format: ['esm', 'cjs'],
    platform: 'node',
    dts: true,
  },
]);
