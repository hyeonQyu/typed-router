/**
 * The framework-free half of the runtime suite: everything that needs no DOM.
 *
 * It runs on `vitest` (so `yarn test` covers it) but keeps `node:assert/strict` for
 * the assertions themselves, which say what they mean without a matcher vocabulary.
 * The imports below are aliased to `src` by `vitest.config.mts`, so a green run always
 * describes the code that is in the tree right now.
 */
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { z } from 'zod';
import { assertRouteMatches, children, defineRoutes, isSameOrAncestorRoute } from '@hyeonqyu/typed-router-core';
import { toRouteObjects } from '@hyeonqyu/typed-router-react';

const routes = defineRoutes({
  home: { _metadata: { title: 'Home' } },
  '(shop)': {
    products: {
      _metadata: {
        title: 'Products',
        searchParamsSchema: z.object({
          sort: z.enum(['price-asc', 'price-desc']).optional(),
          page: z.number().default(1),
          inStock: z.boolean().optional(),
          tags: z.array(z.string()).optional(),
          code: z.string().optional(),
        }),
      },
      '[id]': {
        _metadata: { title: 'Detail' },
        reviews: { _metadata: { title: 'Reviews', searchParamsSchema: z.object({ star: z.number() }) } },
      },
    },
  },
  docs: { '[...slug]': { _metadata: { title: 'Docs' } } },
  files: { '[[...path]]': { _metadata: { title: 'Files' } } },
});

test('pathnames collapse route groups and skip metadata-less nodes', () => {
  assert.deepEqual([...routes.paths].sort(), [
    '/docs/[...slug]',
    '/files/[[...path]]',
    '/home',
    '/products',
    '/products/[id]',
    '/products/[id]/reviews',
  ]);
});

test('buildHref fills dynamic segments and serialises search params', () => {
  assert.equal(routes.buildHref('/home'), '/home');
  assert.equal(routes.buildHref('/products/[id]', { params: { id: 42 } }), '/products/42');
  assert.equal(routes.buildHref('/products/[id]/reviews', { params: { id: 'a b' } }), '/products/a%20b/reviews');
  assert.equal(routes.buildHref('/docs/[...slug]', { params: { slug: ['a', 'b'] } }), '/docs/a/b');
  assert.equal(routes.buildHref('/files/[[...path]]'), '/files');
  assert.equal(routes.buildHref('/products', { searchParams: { page: 2, sort: 'price-asc' } }), '/products?page=2&sort=price-asc');
  assert.equal(routes.buildHref('/products', { searchParams: { tags: ['a', 'b'] } }), '/products?tags=a&tags=b');
  assert.equal(routes.buildHref('/products', { searchParams: { page: 1 }, hash: 'top' }), '/products?page=1#top');
});

test('buildHref refuses to emit a literal [param] placeholder', () => {
  assert.throws(() => routes.buildHref('/products/[id]', {}), /missing route param "id"/);
});

test('match resolves a live URL back to its declared route', () => {
  assert.equal(routes.match('/products/123')?.path, '/products/[id]');
  assert.deepEqual(routes.match('/products/123')?.params, { id: '123' });
  assert.equal(routes.match('/products/123/reviews')?.path, '/products/[id]/reviews');
  assert.equal(routes.match('/products')?.path, '/products');
  assert.deepEqual(routes.match('/docs/a/b/c')?.params, { slug: ['a', 'b', 'c'] });
  assert.equal(routes.match('/files')?.path, '/files/[[...path]]');
  assert.equal(routes.match('/nope'), null);
});

test('static segments outrank dynamic ones', () => {
  const withStatic = defineRoutes({
    products: { '[id]': { _metadata: { title: 'Detail' } }, new: { _metadata: { title: 'New' } } },
  });
  assert.equal(withStatic.match('/products/new')?.path, '/products/new');
  assert.equal(withStatic.match('/products/9')?.path, '/products/[id]');
});

test('search params are coerced to the types the schema declares', () => {
  const parsed = routes.parseSearchParams('/products', { page: '2', inStock: 'true', sort: 'price-asc' });
  assert.deepEqual(parsed, { page: 2, inStock: true, sort: 'price-asc' });
  assert.equal(typeof parsed.page, 'number');
  assert.equal(typeof parsed.inStock, 'boolean');
});

test('a numeric-looking string stays a string when the schema asks for one', () => {
  const parsed = routes.parseSearchParams('/products', { code: '0123' });
  assert.equal(parsed.code, '0123');
  assert.equal(typeof parsed.code, 'string');
});

test('defaults are applied on read', () => {
  assert.equal(routes.parseSearchParams('/products', {}).page, 1);
});

test('a single value satisfies an array schema', () => {
  assert.deepEqual(routes.parseSearchParams('/products', { tags: 'solo' }).tags, ['solo']);
  assert.deepEqual(routes.parseSearchParams('/products', { tags: ['a', 'b'] }).tags, ['a', 'b']);
});

test('repeated keys are folded into an array from URLSearchParams', () => {
  const url = new URLSearchParams('tags=a&tags=b&page=3');
  assert.deepEqual(routes.parseSearchParams('/products', url.entries()), { tags: ['a', 'b'], page: 3 });
});

test('a URLSearchParams object can be passed directly, as the README shows', () => {
  const url = new URLSearchParams('?tags=a&tags=b&page=3&inStock=true');
  assert.deepEqual(routes.parseSearchParams('/products', url), { tags: ['a', 'b'], page: 3, inStock: true });
});

test('onError modes', () => {
  const bad = { star: 'not-a-number' };
  assert.throws(() => routes.parseSearchParams('/products/[id]/reviews', bad), /failed validation/);
  assert.deepEqual(routes.parseSearchParams('/products/[id]/reviews', bad, { onError: 'raw' }), bad);

  // `page` has a default, so dropping the invalid `sort` still yields a valid object.
  const salvaged = routes.parseSearchParams('/products', { sort: 'nonsense', page: '5' }, { onError: 'default' });
  assert.deepEqual(salvaged, { page: 5 });
});

test('routes without a schema pass values through untouched', () => {
  assert.deepEqual(routes.parseSearchParams('/home', { anything: '1' }), { anything: '1' });
});

test('toRouteObjects mirrors the tree as plain React Router data', () => {
  const tree = defineRoutes({
    '(app)': {
      _metadata: { layout: 'AppLayout', errorElement: 'AppError' },
      products: {
        _metadata: { element: 'ProductList', loader: 'productsLoader' },
        '[id]': { _metadata: { element: 'ProductDetail' } },
      },
      docs: { '[...slug]': { _metadata: { element: 'Docs' } } },
    },
  });

  assert.deepEqual(toRouteObjects(tree.routes), [
    {
      element: 'AppLayout',
      errorElement: 'AppError',
      children: [
        {
          path: 'products',
          children: [
            // The node has both a page and children, so its page becomes an index route.
            { index: true, element: 'ProductList', loader: 'productsLoader' },
            { path: ':id', element: 'ProductDetail' },
          ],
        },
        { path: 'docs', children: [{ path: '*', element: 'Docs' }] },
      ],
    },
  ]);
});

test('on a childless node, layout stands in for element but never overrides it', () => {
  const tree = defineRoutes({
    onlyLayout: { _metadata: { layout: 'Layout' } },
    both: { _metadata: { layout: 'Layout', element: 'Page' } },
  });

  assert.deepEqual(toRouteObjects(tree.routes), [
    { path: 'onlyLayout', element: 'Layout' },
    { path: 'both', element: 'Page' },
  ]);
});

test('a node with no page field becomes a route that matches and renders nothing', () => {
  // Intended, and pinned here so it stays a decision rather than a surprise: the tree
  // declares information architecture, and a node may name a place without naming a
  // page this router draws. React Router renders `<Outlet />` for an element-less
  // route, which is empty when the node has no children — so such a path matches
  // instead of falling through to a trailing `*`. Give the node an `element`, or drop
  // it from the config, if it should 404.
  const tree = defineRoutes({
    home: { _metadata: { title: 'Home', element: 'HomePage' } },
    about: { _metadata: { title: 'About' } },
  });

  assert.deepEqual(toRouteObjects(tree.routes), [{ path: 'home', element: 'HomePage' }, { path: 'about' }]);
});

test('metadata is readable and route nodes are frozen', () => {
  assert.equal(routes.getMetadata('/products/[id]/reviews').title, 'Reviews');
  assert.equal(Object.isFrozen(routes.routes.home), true);
});

// --- search param serialisation (issue #3) ------------------------------------

const serial = defineRoutes({
  search: {
    _metadata: {
      title: 'Search',
      searchParamsSchema: z.object({
        f: z.object({ min: z.number(), max: z.number() }).optional(),
        grid: z.array(z.array(z.number())).optional(),
        tags: z.array(z.string()).optional(),
        nums: z.array(z.number()).optional(),
        raw: z.string().optional(),
        n: z.number().optional(),
        since: z.coerce.date().optional(),
        plainDate: z.date().optional(),
      }),
    },
  },
  plain: { _metadata: { title: 'Plain' } },
  item: { '[id]': { _metadata: { title: 'Item' } } },
});

/** Writes the params to a URL, then reads that URL back the way a consumer would. */
const roundTrip = (searchParams) => {
  const href = serial.buildHref('/search', { searchParams });
  return serial.parseSearchParams('/search', new URLSearchParams(href.split('?')[1] ?? ''));
};

test('objects round-trip through buildHref and parseSearchParams', () => {
  assert.equal(
    serial.buildHref('/search', { searchParams: { f: { min: 1, max: 9 } } }),
    '/search?f=%7B%22min%22%3A1%2C%22max%22%3A9%7D',
  );
  assert.deepEqual(roundTrip({ f: { min: 1, max: 9 } }), { f: { min: 1, max: 9 } });
});

test('nested arrays round-trip instead of comma-joining', () => {
  assert.equal(
    serial.buildHref('/search', { searchParams: { grid: [[1, 2], [3]] } }),
    '/search?grid=%5B1%2C2%5D&grid=%5B3%5D',
  );
  assert.deepEqual(roundTrip({ grid: [[1, 2], [3]] }), { grid: [[1, 2], [3]] });
  assert.deepEqual(roundTrip({ grid: [[1, 2]] }), { grid: [[1, 2]] });
});

test('flat primitive arrays keep their existing repeated-key form', () => {
  assert.equal(serial.buildHref('/search', { searchParams: { tags: ['a', 'b'] } }), '/search?tags=a&tags=b');
  assert.equal(serial.buildHref('/search', { searchParams: { nums: [1, 2] } }), '/search?nums=1&nums=2');
  assert.deepEqual(roundTrip({ tags: ['a', 'b'] }), { tags: ['a', 'b'] });
  assert.deepEqual(roundTrip({ nums: [1, 2] }), { nums: [1, 2] });
  assert.deepEqual(roundTrip({ tags: ['solo'] }), { tags: ['solo'] });
});

test('a JSON-shaped string stays a string when the schema asks for one', () => {
  assert.deepEqual(roundTrip({ raw: '{"a":1}' }), { raw: '{"a":1}' });
  assert.deepEqual(roundTrip({ raw: '[1,2]' }), { raw: '[1,2]' });
});

test('values with no faithful text form fail loudly instead of corrupting the URL', () => {
  const cases = [
    [{ n: NaN }, /the number NaN/],
    [{ n: Infinity }, /the number Infinity/],
    [{ f: Symbol('nope') }, /a symbol/],
    [{ f: new Map([['a', 1]]) }, /a Map/],
    [{ f: new Set([1]) }, /a Set/],
    [{ f: () => 1 }, /a function/],
    [{ f: new Date('nonsense') }, /a Date/],
  ];

  for (const [searchParams, message] of cases) {
    assert.throws(() => serial.buildHref('/search', { searchParams }), message);
    assert.throws(() => serial.buildHref('/search', { searchParams }), /cannot be serialised/);
  }
});

test('a cyclic object fails loudly rather than throwing out of JSON.stringify', () => {
  const cyclic = { a: 1 };
  cyclic.self = cyclic;
  assert.throws(() => serial.buildHref('/search', { searchParams: { f: cyclic } }), /cannot be serialised/);
});

test('an unserialisable value inside an array fails loudly too', () => {
  assert.throws(() => serial.buildHref('/search', { searchParams: { nums: [1, NaN] } }), /cannot be serialised/);
});

test('a bigint is written as its decimal form, like a Date is written as ISO', () => {
  assert.equal(serial.buildHref('/plain', { searchParams: { big: 9007199254740993n } }), '/plain?big=9007199254740993');
});

test('a custom toJSON is honoured', () => {
  class Range {
    constructor(min, max) {
      this.min = min;
      this.max = max;
    }
    toJSON() {
      return { min: this.min, max: this.max };
    }
  }
  assert.deepEqual(roundTrip({ f: new Range(1, 9) }), { f: { min: 1, max: 9 } });
});

test('path params reject values a segment cannot carry', () => {
  assert.throws(() => serial.buildHref('/item/[id]', { params: { id: { a: 1 } } }), /route param "id" for "\/item\/\[id\]"/);
  assert.throws(() => serial.buildHref('/item/[id]', { params: { id: NaN } }), /cannot be serialised/);
  assert.equal(serial.buildHref('/item/[id]', { params: { id: 42 } }), '/item/42');
  assert.equal(serial.buildHref('/item/[id]', { params: { id: true } }), '/item/true');
});

test('Date is written as ISO, and z.coerce.date() is what reads it back', () => {
  const since = new Date('2026-08-28T00:00:00.000Z');
  assert.equal(serial.buildHref('/search', { searchParams: { since } }), '/search?since=2026-08-28T00%3A00%3A00.000Z');
  assert.deepEqual(roundTrip({ since }), { since });

  // A plain z.date() field cannot read back a URL typed-router itself produced.
  assert.throws(() => roundTrip({ plainDate: since }), /failed validation/);
});

test('routes without a schema still serialise objects as JSON', () => {
  assert.equal(serial.buildHref('/plain', { searchParams: { f: { a: 1 } } }), '/plain?f=%7B%22a%22%3A1%7D');
});

test('a value that declares its own text form keeps it, as String(value) used to give it', () => {
  class Slug {
    constructor(value) {
      this.value = value;
    }
    toString() {
      return this.value;
    }
  }

  assert.equal(serial.buildHref('/item/[id]', { params: { id: new Slug('hello') } }), '/item/hello');
  assert.equal(serial.buildHref('/plain', { searchParams: { slug: new Slug('hello') } }), '/plain?slug=hello');

  // Boxed primitives declare a text form too.
  assert.equal(serial.buildHref('/plain', { searchParams: { a: new String('hi'), b: new Number(5) } }), '/plain?a=hi&b=5');

  // An object that declares nothing is still refused — `[object Object]` is not a text form.
  assert.throws(() => serial.buildHref('/item/[id]', { params: { id: { a: 1 } } }), /cannot be serialised/);
  assert.throws(() => serial.buildHref('/search', { searchParams: { f: new Map([['a', 1]]) } }), /a Map/);
});

test('toJSON wins over toString, so such an object still round-trips', () => {
  class Range {
    toJSON() {
      return { min: 1, max: 9 };
    }
    toString() {
      return 'range';
    }
  }
  assert.deepEqual(roundTrip({ f: new Range() }), { f: { min: 1, max: 9 } });
});

test('an invalid Date still throws rather than writing its "Invalid Date" text', () => {
  assert.throws(() => serial.buildHref('/search', { searchParams: { since: new Date('nonsense') } }), /a Date/);
  assert.throws(() => serial.buildHref('/item/[id]', { params: { id: new Date('nonsense') } }), /cannot be serialised/);
});

test('collected keeps the runtime shape adapters rely on', () => {
  const reviews = routes.collected.find((route) => route.path === '/products/[id]/reviews');
  assert.equal(reviews.metadata.title, 'Reviews');
  assert.deepEqual(
    routes.collected.map((route) => route.path),
    routes.paths,
  );
});

// --- the root path ------------------------------------------------------------

/**
 * `/` is declared with the empty key, because a path is built by joining a node's key
 * onto its parent's and `''` joins to exactly `/`. `tests/root-route.test-d.ts` pins
 * the types; these pin the runtime, so the root cannot quietly stop working.
 */
const withRoot = defineRoutes({
  '': { _metadata: { title: 'Index' } },
  home: { _metadata: { title: 'Home' } },
  products: { _metadata: { title: 'Products' }, '[id]': { _metadata: { title: 'Detail' } } },
});

test('the empty key is the root, and appears in paths as "/"', () => {
  assert.deepEqual([...withRoot.paths].sort(), ['/', '/home', '/products', '/products/[id]']);
});

test('the root matches the bare URL and nothing else', () => {
  assert.equal(withRoot.match('/')?.path, '/');
  assert.deepEqual(withRoot.match('/')?.params, {});
  assert.equal(withRoot.match('/home')?.path, '/home');
  assert.equal(withRoot.match('/nope'), null);
});

test('buildHref and getMetadata treat the root as any other route', () => {
  assert.equal(withRoot.buildHref('/'), '/');
  assert.equal(withRoot.buildHref('/', { searchParams: { q: 'x' } }), '/?q=x');
  assert.equal(withRoot.getMetadata('/').title, 'Index');
  assert.equal(withRoot.getNode('/')._metadata.title, 'Index');
});

test('a tree without a root leaves "/" unmatched rather than inventing one', () => {
  const noRoot = defineRoutes({ home: { _metadata: { title: 'Home' } } });
  assert.equal(noRoot.match('/'), null);
  assert.deepEqual([...noRoot.paths], ['/home']);
});

test('the root is a sibling of every other route, not their ancestor', () => {
  // Which is why `useTypedParams('/')` under `/products/42` is a mismatch, not a
  // parent read: `''` names a page, and nesting under it doubles the separator.
  assert.equal(isSameOrAncestorRoute('/', '/'), true);
  assert.equal(isSameOrAncestorRoute('/', '/products'), false);
});

// --- pathname arguments are checked, not assumed (issue #5) --------------------

test('a route is its own ancestor, and a real ancestor is accepted', () => {
  assert.equal(isSameOrAncestorRoute('/products/[id]', '/products/[id]'), true);
  assert.equal(isSameOrAncestorRoute('/products/[id]', '/products/[id]/reviews'), true);
  assert.equal(isSameOrAncestorRoute('/products', '/products/[id]/reviews'), true);
});

test('a descendant, a sibling and a shared text prefix are all rejected', () => {
  assert.equal(isSameOrAncestorRoute('/products/[id]/reviews', '/products/[id]'), false);
  assert.equal(isSameOrAncestorRoute('/products/[id]', '/docs/[...slug]'), false);
  // `/product` is a prefix of the *string* `/products`, but not of the route.
  assert.equal(isSameOrAncestorRoute('/product', '/products'), false);
});

test('assertRouteMatches names both routes, and reports an unmatched URL separately', () => {
  assert.throws(() => assertRouteMatches('useTypedParams', '/products/[id]', '/docs/[...slug]'), {
    name: 'RouteMismatchError',
    declared: '/products/[id]',
    matched: '/docs/[...slug]',
  });
  assert.throws(() => assertRouteMatches('useTypedParams', '/products/[id]', '/docs/[...slug]'), /was called under "\/docs/);
  assert.throws(() => assertRouteMatches('useTypedParams', '/products/[id]', null), /matches no declared route/);

  // The accepted cases return nothing rather than throwing.
  assert.equal(assertRouteMatches('useTypedParams', '/products/[id]', '/products/[id]/reviews'), undefined);
});

// --- path param schemas (issue #7) --------------------------------------------

const typed = defineRoutes({
  orgs: {
    '[orgId]': {
      _metadata: { title: 'Org', paramSchema: z.number() },
      projects: {
        _metadata: { title: 'Projects' },
        '[projectId]': { _metadata: { title: 'Project', paramSchema: z.string().min(3) } },
      },
    },
  },
  posts: { '[slug]': { _metadata: { title: 'Post' } } },
  archive: { '[...date]': { _metadata: { title: 'Archive', paramSchema: z.array(z.number()).length(3) } } },
  gallery: { '[[...filters]]': { _metadata: { title: 'Gallery', paramSchema: z.array(z.string()).default([]) } } },
  tags: { '[[...names]]': { _metadata: { title: 'Tags', paramSchema: z.array(z.string()).optional() } } },
  flags: { '[on]': { _metadata: { title: 'Flag', paramSchema: z.boolean() } } },
  codes: { '[code]': { _metadata: { title: 'Code', paramSchema: z.string() } } },
});

/** Reads a live URL the way a consumer would: match it, then parse what it matched. */
const readParams = (url, options) => {
  const matched = typed.match(url);
  return typed.parseParams(matched.path, matched.params, options);
};

test('a segment declared as a number reads back as a number', () => {
  const parsed = readParams('/orgs/42');
  assert.deepEqual(parsed, { orgId: 42 });
  assert.equal(typeof parsed.orgId, 'number');
});

test('a nested route inherits every ancestor segment declaration', () => {
  const parsed = readParams('/orgs/42/projects/abc');
  assert.deepEqual(parsed, { orgId: 42, projectId: 'abc' });
  assert.equal(typeof parsed.orgId, 'number');
  assert.equal(typeof parsed.projectId, 'string');

  // The intermediate route inherits `orgId` while declaring nothing itself.
  assert.deepEqual(readParams('/orgs/42/projects'), { orgId: 42 });
});

test('a URL that does not satisfy the declaration is rejected, not passed through', () => {
  assert.throws(() => readParams('/orgs/abc'), /path param "orgId" for "\/orgs\/\[orgId\]" failed validation/);
  assert.throws(() => readParams('/orgs/abc'), { name: 'PathParamsParseError', param: 'orgId' });
});

test('a segment that declares nothing keeps reading as a string, in the same tree', () => {
  const parsed = readParams('/posts/123');
  assert.deepEqual(parsed, { slug: '123' });
  assert.equal(typeof parsed.slug, 'string');
});

test('a numeric-looking segment stays a string when the schema asks for one', () => {
  const parsed = readParams('/codes/0123');
  assert.equal(parsed.code, '0123');
  assert.equal(typeof parsed.code, 'string');
});

test('a boolean segment reads back as a boolean', () => {
  assert.deepEqual(readParams('/flags/true'), { on: true });
  assert.throws(() => readParams('/flags/yes'), /path param "on"/);
});

test('a catch-all is validated as the whole list it reads back as', () => {
  const parsed = readParams('/archive/2026/8/30');
  assert.deepEqual(parsed, { date: [2026, 8, 30] });
  assert.equal(typeof parsed.date[0], 'number');

  assert.throws(() => readParams('/archive/2026/8'), /path param "date"/);
  assert.throws(() => readParams('/archive/2026/8/oops'), /path param "date"/);
});

test('an optional catch-all that matched nothing still gets its schema default', () => {
  assert.deepEqual(readParams('/gallery'), { filters: [] });
  assert.deepEqual(readParams('/gallery/red/large'), { filters: ['red', 'large'] });

  // `.optional()` produces no value, so the key stays absent as it was before schemas.
  assert.deepEqual(readParams('/tags'), {});
  assert.deepEqual(readParams('/tags/a/b'), { names: ['a', 'b'] });
});

test('onError modes tell the same story as parseSearchParams', () => {
  assert.throws(() => readParams('/orgs/abc'), /failed validation/);
  assert.deepEqual(readParams('/orgs/abc', { onError: 'raw' }), { orgId: 'abc' });

  // `default` drops the offending segment, keeping what the schema still produces alone.
  assert.deepEqual(readParams('/orgs/abc', { onError: 'default' }), {});
  assert.deepEqual(readParams('/archive/1/2', { onError: 'default' }), {});
  assert.deepEqual(readParams('/gallery/a/b/c', { onError: 'raw' }), { filters: ['a', 'b', 'c'] });
});

test('a mixed route reports the segment that failed, not the whole route', () => {
  assert.throws(() => readParams('/orgs/42/projects/ab'), { param: 'projectId' });
  assert.deepEqual(readParams('/orgs/42/projects/ab', { onError: 'default' }), { orgId: 42 });
});

test('a segment is validated after decoding, not before', () => {
  assert.deepEqual(readParams('/orgs/4%32'), { orgId: 42 });
  assert.deepEqual(typed.parseParams('/posts/[slug]', { slug: 'a b' }), { slug: 'a b' });
});

test('a declared segment round-trips through buildHref and parseParams', () => {
  const href = typed.buildHref('/orgs/[orgId]/projects/[projectId]', { params: { orgId: 42, projectId: 'abc' } });
  assert.equal(href, '/orgs/42/projects/abc');
  assert.deepEqual(readParams(href), { orgId: 42, projectId: 'abc' });

  const catchAll = typed.buildHref('/archive/[...date]', { params: { date: [2026, 8, 30] } });
  assert.equal(catchAll, '/archive/2026/8/30');
  assert.deepEqual(readParams(catchAll), { date: [2026, 8, 30] });
});

test('a route whose segments declare nothing behaves exactly as it did before', () => {
  assert.deepEqual(routes.parseParams('/products/[id]', { id: '123' }), { id: '123' });
  assert.deepEqual(routes.parseParams('/docs/[...slug]', { slug: ['a', 'b'] }), { slug: ['a', 'b'] });
  assert.deepEqual(routes.parseParams('/files/[[...path]]', {}), {});
  assert.deepEqual(routes.parseParams('/home', {}), {});
});

/* ── children() ──────────────────────────────────────────────────────────── */

test('children drops the metadata block and nothing else', () => {
  assert.deepEqual(Object.keys(children(routes.routes)), ['home', '(shop)', 'docs', 'files']);
  assert.deepEqual(Object.keys(children(routes.routes['(shop)'].products)), ['[id]']);

  // A leaf declares only metadata, so it has no children at all.
  assert.deepEqual(Object.keys(children(routes.routes.home)), []);
});

test('children is a shallow view: the child nodes come back untouched', () => {
  const products = routes.routes['(shop)'].products;

  assert.equal(children(routes.routes['(shop)']).products, products);
  assert.deepEqual(children(products)['[id]']._metadata, { title: 'Detail' });

  // The node itself is not rewritten — metadata is still enumerable on the tree.
  assert.ok(Object.keys(products).includes('_metadata'));
});

test('children returns the same frozen object for the same node', () => {
  const first = children(routes.routes);

  assert.equal(children(routes.routes), first);
  assert.ok(Object.isFrozen(first));
});
