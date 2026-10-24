import { assertRoutesMatchPagesDir, findPagesDirDrift, PagesDirDriftError } from '@hyeonqyu/typed-router-next/check';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { routes as exampleRoutes } from '../examples/next-pages-example/src/routes';

/**
 * The Pages Router half of `./check`. `pages/` reads differently from `app/`: every page
 * file is a route of its own, `index` serves its folder, and the special files sit at
 * the root — so it has its own walk, and these tests pin it to what Next serves.
 */

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** Materialises a `pages/` shape from a list of relative file paths. Contents never matter. */
const pagesDir = (files: readonly string[]): string => {
  const root = mkdtempSync(join(tmpdir(), 'typed-router-pages-'));
  roots.push(root);

  for (const file of files) {
    const full = join(root, file);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, '');
  }

  return root;
};

const tree = (...paths: string[]) => ({ paths });

// --- both directions of drift ---------------------------------------------------

test('reports nothing when the tree and pages/ agree', () => {
  const dir = pagesDir(['index.tsx', 'about.tsx', 'products/[id].tsx']);

  expect(findPagesDirDrift(tree('/', '/about', '/products/[id]'), dir)).toEqual({
    missingFromPagesDir: [],
    missingFromTree: [],
    inSync: true,
  });
});

test('reports both directions at once, sorted', () => {
  const dir = pagesDir(['checkout.tsx', 'about.tsx']);
  const report = findPagesDirDrift(tree('/search', '/home'), dir);

  expect(report.missingFromPagesDir).toEqual(['/home', '/search']);
  expect(report.missingFromTree).toEqual(['/about', '/checkout']);
  expect(report.inSync).toBe(false);
});

// --- how Next reads pages/ -------------------------------------------------------

test('an index file serves its folder, and pages/index is the root', () => {
  const dir = pagesDir(['index.tsx', 'products/index.tsx', 'products/[id]/index.tsx', 'products/[id]/reviews.tsx']);

  expect(findPagesDirDrift(tree('/', '/products', '/products/[id]', '/products/[id]/reviews'), dir).inSync).toBe(true);
});

test('a file and an index file for the same folder are one route', () => {
  const dir = pagesDir(['blog.tsx', 'blog/index.tsx']);

  expect(findPagesDirDrift(tree('/blog'), dir).inSync).toBe(true);
});

test('dynamic, catch-all and optional catch-all files compare verbatim', () => {
  const dir = pagesDir(['products/[id].tsx', 'docs/[...slug].tsx', 'files/[[...path]].tsx']);

  expect(findPagesDirDrift(tree('/products/[id]', '/docs/[...slug]', '/files/[[...path]]'), dir).inSync).toBe(true);
});

test('an optional catch-all is its own route, not the bare folder it also serves', () => {
  const dir = pagesDir(['files/[[...path]].tsx']);

  expect(findPagesDirDrift(tree('/files'), dir)).toMatchObject({
    missingFromPagesDir: ['/files'],
    missingFromTree: ['/files/[[...path]]'],
  });
});

test('_app, _document, _error, 404 and 500 are not routes', () => {
  const dir = pagesDir(['_app.tsx', '_document.tsx', '_error.tsx', '404.tsx', '500.tsx', 'home.tsx']);

  expect(findPagesDirDrift(tree('/home'), dir).inSync).toBe(true);
});

test('those names are only special at the root', () => {
  const dir = pagesDir(['docs/_app.tsx', 'errors/404.tsx']);

  expect(findPagesDirDrift(tree(), dir).missingFromTree).toEqual(['/docs/_app', '/errors/404']);
});

test('pages/api is API routes, not pages — but only at the root', () => {
  const dir = pagesDir(['api.ts', 'api/users.ts', 'api/users/[id].ts', 'docs/api.tsx', 'home.tsx']);

  expect(findPagesDirDrift(tree('/home', '/docs/api'), dir).inSync).toBe(true);
});

test('route groups, slots and private folders are app/ conventions, read literally here', () => {
  const dir = pagesDir(['(shop)/cart.tsx', '_lib/helper.tsx']);

  expect(findPagesDirDrift(tree('/cart'), dir)).toMatchObject({
    missingFromPagesDir: ['/cart'],
    missingFromTree: ['/(shop)/cart', '/_lib/helper'],
  });
});

test('declaration files and non-page extensions are not pages', () => {
  const dir = pagesDir(['home.tsx', 'types.d.ts', 'styles.css', 'readme.md']);

  expect(findPagesDirDrift(tree('/home'), dir).inSync).toBe(true);
});

test('pageExtensions decides what counts as a page, longest extension first', () => {
  const dir = pagesDir(['about.page.tsx', 'about.test.tsx', 'index.page.tsx']);

  expect(findPagesDirDrift(tree('/', '/about'), dir, { pageExtensions: ['page.tsx'] }).inSync).toBe(true);
  expect(findPagesDirDrift(tree('/', '/about'), dir, { pageExtensions: ['tsx', 'page.tsx'] }).missingFromTree).toEqual(['/about.test']);
});

test('ignore takes pathnames, including trailing-star prefixes', () => {
  const dir = pagesDir(['admin/index.tsx', 'admin/users.tsx', 'home.tsx']);

  expect(findPagesDirDrift(tree('/home'), dir, { ignore: ['/admin/*'] }).inSync).toBe(true);
});

// --- the assert wrapper ----------------------------------------------------------

test('assertRoutesMatchPagesDir throws PagesDirDriftError carrying the report', () => {
  const dir = pagesDir(['checkout.tsx']);

  try {
    assertRoutesMatchPagesDir(tree('/search'), dir);
    expect.unreachable('expected a PagesDirDriftError');
  } catch (error) {
    expect(error).toBeInstanceOf(PagesDirDriftError);
    const drift = error as PagesDirDriftError;
    expect(drift.name).toBe('PagesDirDriftError');
    expect(drift.report).toEqual({ missingFromPagesDir: ['/search'], missingFromTree: ['/checkout'], inSync: false });
    expect(drift.message).toContain('/search');
    expect(drift.message).toContain('/checkout');
  }
});

test('assertRoutesMatchPagesDir stays silent when the two agree', () => {
  const dir = pagesDir(['home.tsx']);

  expect(() => assertRoutesMatchPagesDir(tree('/home'), dir)).not.toThrow();
});

test('a missing pages directory is a thrown error, not an empty report', () => {
  expect(() => findPagesDirDrift(tree('/home'), 'does/not/exist')).toThrow(/typed-router: pages directory/);
});

// --- the real example app --------------------------------------------------------

test('the Pages Router example s tree matches its own src/pages', () => {
  // `/blog` is served by another site, which the example's `useResolveHref` sends it to.
  expect(findPagesDirDrift(exampleRoutes, 'examples/next-pages-example/src/pages', { ignore: ['/blog'] })).toEqual({
    missingFromPagesDir: [],
    missingFromTree: [],
    inSync: true,
  });
});
