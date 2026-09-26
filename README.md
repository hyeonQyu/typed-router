# typed-router

**English** | [한국어](./README.ko.md)

## When you need this

Route paths and search params are usually just strings — the compiler cannot tell you that `/products/[id]` needs an `id`, or that `?sort=` only accepts three values, or that a page you renamed still has three dangling links pointing at the old path. Those bugs show up at runtime, if they show up at all.

typed-router turns your route map into a single typed object. You declare it once; pathnames, path params, search-param types, navigation, and (for React Router) the router configuration itself are all derived from that one declaration and checked by the compiler.

```bash
npm install @hyeonqyu/typed-router-next zod   # Next.js App Router
npm install @hyeonqyu/typed-router-react zod  # React Router
```

`zod` is optional — only routes that declare a search-param schema need it, and any [Standard Schema](https://standardschema.dev) validator works too.

**Already know your stack?** Each guide is self-contained — read only yours:

- **[Next.js App Router →](./packages/next/README.md)**
- **[React Router →](./packages/react/README.md)**

The rest of this page explains the ideas both guides build on.

## The route tree

A route tree is a nested object. Each key is a URL segment; a node becomes a real, navigable route the moment it has a `_metadata` block:

```ts
// import from '@hyeonqyu/typed-router-next' or '@hyeonqyu/typed-router-react' —
// the declaration below is identical either way.
import { defineRoutes } from '@hyeonqyu/typed-router-next';
import { z } from 'zod';

export const routes = defineRoutes({
  cart: {
    _metadata: { title: 'Cart' },
  },
  products: {
    _metadata: {
      title: 'Products',
      searchParamsSchema: z.object({
        sort: z.enum(['price-asc', 'price-desc']).optional(),
        page: z.number().default(1),
      }),
    },
    '[id]': {
      _metadata: { title: 'Product detail' },
    },
  },
});
```

No generics, no currying, no provider to wrap your app in. The key syntax is borrowed directly from Next.js, so the tree can mirror your `app/` directory one for one:

| key | means |
| --- | --- |
| `products` | a static segment |
| `[id]` | a required dynamic segment |
| `[...slug]` | a required catch-all (one or more segments) |
| `[[...slug]]` | an optional catch-all (zero or more segments) |
| `(group)` | organises the tree without adding a URL segment |
| `''` (empty key) | the root, `/` |
| node with no `_metadata` | namespaces its children but is not itself a destination |

### The root route

A path is built by joining a node's key onto its parent's, so the empty key joins to exactly `/`:

```ts
const routes = defineRoutes({
  '': { _metadata: { title: 'Home' } },
  products: { _metadata: { title: 'Products' } },
});

routes.paths;               // ['/', '/products']
routes.buildHref('/');      // '/'
routes.getMetadata('/');    // { title: 'Home' }
routes.match('/')?.path;    // '/'
```

The key is `''`, but the pathname is `/` — that is how you write it versus how you call it. Declare it and `/` becomes an ordinary route; leave it out and `/` is a live URL your tree cannot name, which is exactly the drift `assertRoutesMatchAppDir` reports on Next.

The root takes no children: `app/page.tsx` is a file, so every other route is its sibling rather than its descendant. Nesting under `''` doubles the separator (`//dashboard`) and matches nothing.

## Type-safe navigation

From that declaration, `routes` derives every pathname (`/products`, `/products/[id]`, `/cart`, …) as a compile-time string union, and — the part that actually catches bugs — ties each pathname to exactly the arguments it needs. `useTypedRouter()` is one of the hooks `routes` gives you; both framework guides show the rest.

```ts
const router = useTypedRouter();

router.push('/products/[id]', { params: { id: 42 } });          // ✅
router.push('/products', { searchParams: { sort: 'price-asc' } }); // ✅
router.push('/cart');                                            // ✅ nothing required

router.push('/products/[id]');            // ❌ params.id is required
router.push('/produtcs');                 // ❌ no such route
router.push('/products', { searchParams: { sort: 'cheap' } });  // ❌ not in the enum
router.push('/products', { searchParams: { pge: 1 } });         // ❌ unknown key
router.push('/cart', { searchParams: { anything: 1 } });        // ❌ /cart declares no schema
router.push('/products', { params: { id: 1 } });                // ❌ no dynamic segments here
```

Path params (`params`) and search params (`searchParams`) are always separate arguments, so it's never ambiguous which one fills the URL and which one fills the query string.

## Reading params back

Reading search params runs your schema for real — values arrive from the URL as strings, so each field's own schema is asked which reading it accepts. A `z.number()` field gets `2`, not `"2"`; a `z.string()` field keeps `"0123"` intact; `.default()` values are filled in.

The write side matches it: objects and nested arrays go into the query string as JSON, so `{ f: { min: 1, max: 9 } }` reads back as that same object. A value with no faithful text form — `NaN`, a symbol, a `Map`, a cyclic object — throws where you build the URL rather than landing in it as `[object Object]`. `Date` is written as an ISO string, so declare those fields `z.coerce.date()`; a plain `z.date()` cannot read back a URL typed-router itself produced.

### Path params get the same treatment

A dynamic segment reads back as a string unless you say otherwise. Give it a `paramSchema` and it reads back as whatever that schema produces, validated. The segment's *name* already comes from the tree key, so only its type is written down:

```ts
const routes = defineRoutes({
  orgs: {
    '[orgId]': {
      _metadata: { title: 'Org', paramSchema: z.number() },

      projects: {
        _metadata: { title: 'Projects' },     // declares nothing; still inherits orgId: number
      },
    },
  },
});

const { orgId } = useTypedParams('/orgs/[orgId]/projects');
//      ^? number — no `Number(orgId)` at the call site

routes.buildHref('/orgs/[orgId]', { params: { orgId: 'abc' } });  // ❌ orgId declares z.number()
// /orgs/abc in the browser → PathParamsParseError
```

Nested routes inherit every ancestor segment's declaration, so each dynamic segment is declared exactly once. A catch-all declares the whole list it reads back as — `paramSchema: z.array(z.number())` on `[...date]` gives `{ date: number[] }`.

This is opt-in per segment: a segment with no `paramSchema` still reads back as `string` (or `string[]`), exactly as before.

### When a URL doesn't validate

Both halves of the URL answer this the same way, with the same three modes:

```ts
useTypedSearchParams('/search', { onError: 'throw' });   // default — surfaces bad links early
useTypedSearchParams('/search', { onError: 'default' }); // drop bad fields, keep the rest
useTypedSearchParams('/search', { onError: 'raw' });     // return the coerced values instead of throwing

useTypedParams('/orgs/[orgId]', { onError: 'default' }); // same modes, same meanings
```

`throw` raises `SearchParamsParseError` or `PathParamsParseError`; the latter names the segment that failed in `.param`.

### The pathname you pass is checked

`useTypedParams('/products/[id]')` reads params *as* that route, so the route has to be the one you are actually rendered under. It is checked against the URL rather than believed:

```ts
// Rendered under /products/42/reviews:
useTypedParams('/products/[id]');          // ✅ an ancestor — `id` really is in this URL
useTypedParams('/products/[id]/reviews');  // ✅ the matched route itself
useTypedParams('/docs/[...slug]');         // ❌ RouteMismatchError
```

An ancestor is accepted because a shared component rendered deeper down may legitimately read a parent route's params. Anything else throws `RouteMismatchError`, naming both the route you passed and the one the URL matched — as does a URL that matches no declared route at all. Without the check the call would return another route's params under this route's types, which type-checks and is simply wrong.

`useCurrentRouteNode(pathname)` takes the same argument and makes the same check. Called with no argument it stays unchecked, and its return type is then the union of every declared node — which is all an unchecked call can honestly promise.

## Route metadata

`_metadata` is inferred per node, so different routes can carry different fields — `title`, `label`, `description` and `accessible` may be plain values or functions of an app context:

```ts
import { resolveMetadata } from '@hyeonqyu/typed-router-core';

const meta = resolveMetadata(routes.getMetadata('/cart'), { locale, userId });
```

Want every node to share one metadata contract instead? Opt in explicitly:

```ts
const routes = defineRoutes.withMeta<{ name: string }, { locale: string }>()({ ... });
```

The contract is enforced, at every depth: any node that declares `_metadata` must satisfy it in full, while per-node inference still keeps each route's own literal types and any extra fields it declared.

```ts
const routes = defineRoutes.withMeta<{ title: string; icon: string }>()({
  home: { _metadata: { title: 'Home', icon: 'house', badge: 'new' } },  // ✅ extras are kept
  products: {
    _metadata: { title: 'Products', icon: 'box' },
    '[id]': { _metadata: { title: 'Detail' } },                          // ❌ icon is missing
  },
});

routes.getMetadata('/home').title;   // 'Home' — still the literal, not `string`
routes.getMetadata('/home').badge;   // 'new'  — the contract is a floor, not a ceiling
```

A node with no `_metadata` at all is organisational rather than a route, so the contract has nothing to enforce on it.

### Walking one level of the tree

`paths` and `collected` flatten the whole tree. A menu level, a breadcrumb's siblings and a section index are the other shape — the children of *one* node — and reaching for `Object.values(node)` there hands back the `_metadata` block alongside the real children, which renders as a phantom entry. `children()` returns the children and nothing else:

```ts
import { children } from '@hyeonqyu/typed-router-core';

const support = routes.routes.support;

Object.keys(support);              // ['_metadata', 'ask', 'notice'] — metadata leaks in
Object.keys(children(support));    // ['ask', 'notice']

Object.entries(children(support)).map(([key, node]) => ({
  key,
  title: node._metadata.title,     // typed per node, no cast
}));
```

It returns an object rather than an array, so `keys`, `values` and `entries` all keep working, and the type — `RouteChildren<TNode>` — drops `_metadata` from the node while each child keeps the literal types it was declared with. A union of nodes, which is what an unchecked `useCurrentRouteNode()` gives you, is stripped member by member rather than collapsing to the keys they happen to share. Route group keys `(name)` are children like any other: they organise the tree, so what a group means for a given menu is yours to decide.

The tree itself is untouched — `_metadata` stays an ordinary enumerable property, so a node still survives a spread, a `structuredClone` and a `toEqual`. Calling `children()` twice on the same node of a declared tree returns the same frozen object, so the result can sit in a dependency array without re-rendering.

## Framework-agnostic use

The route tree is plain data. `@hyeonqyu/typed-router-core` exposes the same declaration with no React dependency at all — for scripts, tests, or a sitemap generator — and the `routes` object from either framework package carries these same methods alongside its hooks:

```ts
import { defineRoutes } from '@hyeonqyu/typed-router-core';

const routes = defineRoutes({ /* same shape as above */ });

routes.paths;                        // every declared pathname
routes.buildHref('/products/[id]', { params: { id: 42 } }); // '/products/42'
routes.match('/products/42');        // → { path: '/products/[id]', params: { id: '42' }, node, metadata }
routes.getMetadata('/products');
routes.parseSearchParams('/products', new URLSearchParams(search));
routes.parseParams('/orgs/[orgId]', { orgId: '42' });       // { orgId: 42 }, per the segment's schema
```

## Which routes exist

On React Router the tree settles this by itself: `toRouteObjects()` builds the router configuration *from* the tree, so a route cannot exist without being declared.

A node whose `_metadata` names no page — no `element`, `Component` or `lazy` — still becomes a route, and one that matches while rendering nothing. That is deliberate: the tree declares information architecture, and a node may name a place without naming a page this router draws. If such a path should 404 instead, give the node a page or leave it out of the config; a trailing `{ path: '*' }` will not catch it, because the route matched.

Next's App Router is the other way round — `src/app/` decides which routes exist and the tree mirrors it by hand, which the compiler cannot check. `@hyeonqyu/typed-router-next/check` does:

```ts
import { assertRoutesMatchAppDir } from '@hyeonqyu/typed-router-next/check';
import { routes } from './routes';

test('the route tree matches src/app', () => {
  assertRoutesMatchAppDir(routes, 'src/app');
});
```

It reports both directions — a declared route whose page was deleted, and a page the tree never declared — and reads Next's conventions the way Next does: `(group)` and `@slot` folders add no URL segment while pages under them still count, and `(.)` intercepts, `_folder`, `route.ts` and `default.tsx` address no pathname at all. It reads the filesystem, so it lives on its own entry point and never reaches your browser bundle. [Details in the Next guide](./packages/next/README.md#7-keep-the-tree-and-srcapp-in-step).

## Packages

| package | for |
| --- | --- |
| [`@hyeonqyu/typed-router-core`](./packages/core/README.md) | the tree, types and URL helpers — framework-free |
| [`@hyeonqyu/typed-router-next`](./packages/next/README.md) | Next.js App Router |
| [`@hyeonqyu/typed-router-react`](./packages/react/README.md) | React Router 6/7 library mode |

### React Router 7 framework mode

The React adapter is built for React Router's **library mode** — the one where you own the router configuration. In **framework mode** (`@react-router/dev`, an `app/routes.ts` config), `toRouteObjects()` is not usable: it emits `element` / `Component`, React elements resolved at runtime, while framework mode's `RouteConfigEntry` wants `file`, a module path it resolves at build time so it can code-split each route and generate its types. The two describe the same routes in units the other cannot read.

Everything else carries over, because none of it ever depended on a router: `paths`, `buildHref`, `match`, `parseParams`, `parseSearchParams`, `getMetadata` and `collected` all work unchanged. Declare `file` on `_metadata` instead of `element` and the tree builds the framework config in about fifteen lines — see [`examples/react-router-framework-example`](./examples/react-router-framework-example), which does exactly that and is pinned by `tests/framework-mode.test.ts`.

In framework mode, import from `@hyeonqyu/typed-router-core` rather than the React adapter: the framework brings its own `<Link>` and hooks, so the adapter's would be a second answer to a question already answered.

## Examples

Three runnable apps. The first two declare the *same* tree and share component code verbatim — proof that the API is genuinely identical across adapters:

```bash
yarn workspace next-example dev                      # http://localhost:3000
yarn workspace react-example dev                     # http://localhost:5173
yarn workspace react-router-framework-example dev    # http://localhost:5174
```

The React example also carries a permission-gated menu built from `routes.collected` and `resolveMetadata`, so the `accessible` metadata built-in is demonstrated rather than only described.

## Upgrading from 1.x

2.0 is a breaking rewrite. See [MIGRATION.md](./MIGRATION.md).

## Development

```bash
yarn install
yarn build   # all packages + the examples
yarn type    # type-checks every workspace (builds the packages first — the examples resolve `dist`)
yarn test    # type-level assertions, then the runtime and rendering suites
yarn lint
```

`yarn test` is two suites. `tsc -p tests/tsconfig.json` runs the type-level assertions — half positive, half `@ts-expect-error` — so it fails both when something that should compile stops compiling *and* when something that should be rejected starts slipping through. Then `vitest` runs everything that only exists at runtime: the framework-free suite, both adapters rendered under jsdom with Testing Library, and the drift check against throwaway `app/` directories on disk. Every one of them resolves the packages to `src`, so a green run can never describe code that is no longer there.

CI runs `lint`, `type`, `test` and `build` on Node 20 and 22 for every pull request.

## License

MIT
