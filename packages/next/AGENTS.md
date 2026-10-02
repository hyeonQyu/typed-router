# @hyeonqyu/typed-router-next — agent guide

**Mental model:** the route tree object is the source of truth for the application's information architecture — its pathnames, params, search-param types and metadata. You declare the IA once as a nested object whose keys mirror `src/app/`; pathnames, path params, search-param types, navigation, and route metadata are all *derived* from that declaration and checked by the compiler. Writing a URL string by hand, or keeping a second list of routes anywhere, defeats the entire point of the library.

**One caveat, and it matters.** On the Next.js App Router the tree does not decide which routes *exist* — the `src/app/` directory does. The tree mirrors it by hand, and the compiler does not check the two agree: delete a page from `app/` and the tree still type-checks its pathname, so a `TypedLink` to it compiles cleanly and 404s at runtime. Add a page to `app/` without declaring it and the route is live but invisible to `routes.paths`. So, by default: **the tree is authoritative for types and metadata; `app/` is authoritative for route existence.** (This caveat is specific to Next — on the React Router adapter, `toRouteObjects()` builds the router *from* the tree, so a route cannot exist without being declared.)

**Close it with `assertRoutesMatchAppDir`.** `@hyeonqyu/typed-router-next/check` compares the two sides and reports both directions of drift, so a project that adopts it *does* get the guarantee — enforced by its own test suite rather than by types. Recommend it whenever a consumer asks how to keep the tree and `app/` in step; the caveat above only stands for projects that have not adopted it. See "Checking the tree against `app/`" below.

Import **everything** from `@hyeonqyu/typed-router-next` — or, on the Pages Router, from `@hyeonqyu/typed-router-next/pages` (see "Pages Router" below; never mix the two in one app). Each re-exports the core surface — never add `@hyeonqyu/typed-router-core` to a consumer's dependencies. Peer deps: `next ^13 || ^14 || ^15 || ^16` and `react`/`react-dom` `^16.8 || ^17 || ^18 || ^19`; `zod` is an *optional* peer dep: schemas are matched structurally, so Zod v3/v4 or any [Standard Schema](https://standardschema.dev) validator works, and routes without a query string need no schema at all — a route that only names its keys uses `searchParamKeys<'a' | 'b'>()`, no validator needed.

## Setup (the whole thing)

```ts
// src/routes.ts — NO 'use client' here. This module must stay importable from server components.
import { defineRoutes } from '@hyeonqyu/typed-router-next';
import { z } from 'zod';

export const routes = defineRoutes({
  home: { _metadata: { title: 'Home' } },
  products: {
    _metadata: {
      title: 'Products',
      searchParamsSchema: z.object({
        q: z.string().optional(),
        page: z.number().default(1),
        tags: z.array(z.string()).optional(),
      }),
    },
    '[id]': {
      _metadata: { title: 'Product detail' },
      reviews: { _metadata: { title: 'Reviews', searchParamsSchema: z.object({ star: z.number().default(5) }) } },
    },
  },
  docs: { '[...slug]': { _metadata: { title: 'Docs' } } },
  files: { '[[...path]]': { _metadata: { title: 'Files' } } },
  '(account)': { profile: { _metadata: { title: 'Profile' } } }, // route group → lives at /profile
  internal: { stats: { _metadata: { title: 'Stats' } } }, // `internal` itself is NOT a destination
});

export const {
  TypedLink,
  useCurrentRoute,
  useCurrentRouteNode,
  useTypedParams,
  useTypedPathname,
  useTypedRouter,
  useTypedSearchParams,
} = routes;

export type AppPathname = typeof routes.$types.pathname;
// '/home' | '/products' | '/products/[id]' | '/products/[id]/reviews' | '/docs/[...slug]'
// | '/files/[[...path]]' | '/profile' | '/internal/stats'
```

There is no provider, no generic, nothing to mount. Segment keys are Next.js syntax: `products` static, `[id]` dynamic, `[...slug]` catch-all, `[[...path]]` optional catch-all, `(group)` contributes no URL segment. **A node is a navigable destination only when it carries a `_metadata` block** — nodes without one only namespace their children (add `_metadata: {}` to make one navigable).

## Server components — the data half

`routes` is plain data. Use these anywhere a hook cannot run: server components, `generateMetadata`, route handlers, `middleware`.

```tsx
import { redirect } from 'next/navigation';
import { routes } from '@/routes';

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params; // Next 15+ only — in Next 13/14 `params` and `searchParams` are plain objects, so drop the `await`
  const raw = await searchParams;

  // Next types values as `string | string[] | undefined`; strip undefined before parsing.
  const clean: Record<string, string | string[]> = Object.fromEntries(
    Object.entries(raw).filter((e): e is [string, string | string[]] => e[1] !== undefined),
  );

  const query = routes.parseSearchParams('/products', clean, { onError: 'default' }); // { q?: string; page: number; tags?: string[] }
  const href = routes.buildHref('/products/[id]/reviews', { params: { id }, searchParams: { star: 5 }, hash: 'top' });

  const matched = routes.match('/products/42?q=x#y'); // { path: '/products/[id]', node, metadata, params: { id: '42' } }
  if (!matched) redirect(routes.buildHref('/home'));

  return <a href={href}>{routes.getMetadata('/products').title}</a>;
}
```

`parseSearchParams` also takes an entries iterable directly: `routes.parseSearchParams('/products', new URLSearchParams(search))`.

## Client components — hooks and links

Every hook needs `'use client'` **in the consuming file** (not in `routes.ts`). `TypedLink` does not: it calls no hooks and wraps `next/link`, so it renders in server components too.

```tsx
'use client';
import { TypedLink, useTypedRouter } from '@/routes';

export function Nav() {
  const router = useTypedRouter();

  router.push('/home'); // no args object needed
  router.push('/products/[id]', { params: { id: 42 }, scroll: false });
  router.replace('/products', { searchParams: { q: 'a', page: 2 } });
  router.prefetch('/products/[id]/reviews', { params: { id: 7 }, searchParams: { star: 4 } });
  router.back(); router.forward(); router.refresh();

  return (
    <nav>
      <TypedLink href="/products/[id]" params={{ id: 42 }} className="link" prefetch={false}>Product 42</TypedLink>
      <TypedLink href="/products" searchParams={{ q: 'shoes', page: 2 }} hash="top">Search</TypedLink>
      <TypedLink href="/docs/[...slug]" params={{ slug: ['guide', 'intro'] }}>Docs</TypedLink>
      <TypedLink href="/files/[[...path]]">All files</TypedLink>
      <TypedLink href="/profile">Profile</TypedLink>
    </nav>
  );
}
```

**Reading the current location:**

```tsx
'use client';
import { useCurrentRoute, useCurrentRouteNode, useTypedParams, useTypedPathname } from '@/routes';

export function Info() {
  const pattern = useTypedPathname();          // '/products/[id]' — the DECLARED pattern, or null
  const current = useCurrentRoute();           // { pathname, url, node, metadata, params } — pathname/node/metadata are `null` when nothing matches
  const node = useCurrentRouteNode('/products/[id]');   // checked against the live URL; narrows to that node
  const { id } = useTypedParams('/products/[id]');      // { id: string } — or the segment's paramSchema output
  const { slug } = useTypedParams('/docs/[...slug]');   // { slug: string[] }

  return <p>{pattern} {current.url} {id} {slug.join('/')}</p>; // current.url is the live '/products/42'
}
```

**Search params require a `<Suspense>` boundary** — the hook builds on Next's `useSearchParams`, and without a boundary the build fails with a CSR-bailout error.

```tsx
'use client';
import { Suspense } from 'react';
import { useTypedSearchParams } from '@/routes';

function ProductsView() {
  const { q, page, tags } = useTypedSearchParams('/products', { onError: 'default' });
  return <p>{q} {page} {tags?.length}</p>; // `page` really is the number 2 for ?page=2
}

export default function ProductsPage() {
  return <Suspense fallback={null}><ProductsView /></Suspense>;
}
```

## Shared metadata contract (optional)

```ts
import { defineRoutes, resolveMetadataValue } from '@hyeonqyu/typed-router-next';

type AppMeta = { title: string; roles?: string[] };
type AuthContext = { isAdmin: boolean };

export const metaRoutes = defineRoutes.withMeta<AppMeta, AuthContext>()({
  dashboard: { _metadata: { title: 'Dashboard' } },
  admin: { _metadata: { title: 'Admin', roles: ['owner'], accessible: (ctx) => ctx.isAdmin } },
});

// Builtin resolvable keys — title, label, description, accessible — may be functions of the context.
export const canSeeAdmin = (ctx: AuthContext) => resolveMetadataValue(metaRoutes.getMetadata('/admin').accessible, ctx);

// Nav generated from the tree, never from a hand-written array — enumeration keeps metadata typed.
export const navItems = metaRoutes.collected.map((route) => ({ path: route.path, title: route.metadata.title }));
```

Use `withMeta` **only** when every node must satisfy one contract; plain `defineRoutes` infers each node's metadata individually and keeps custom fields.

## Checking the tree against `app/`

A separate, Node-only entry point. It reads the filesystem, so it must never be imported from application code — only from a test or a script.

```ts
// routes.test.ts
import { assertRoutesMatchAppDir } from '@hyeonqyu/typed-router-next/check';
import { routes } from '@/routes';

test('the route tree matches src/app', () => {
  assertRoutesMatchAppDir(routes, 'src/app');
});
```

`assertRoutesMatchAppDir(routes, appDir, options?)` throws `RouteDriftError` when the two disagree; `findRouteDrift(routes, appDir, options?)` returns `{ missingFromAppDir, missingFromTree, inSync }` instead of throwing. `appDir` resolves from the current working directory. `RouteDriftError.report` carries the same object, so never parse the message.

**Transparent, not skipped:** route groups `(shop)` and parallel-route slots `@modal` contribute no URL segment, but the walk still descends into them — `dashboard/@team/settings/page.tsx` is checked as `/dashboard/settings`, which is the route Next's own build emits for it. Never tell a consumer that a page under a slot is exempt; declare it in the tree like any other route.

**Skipped entirely,** because they address no pathname of their own: intercepting routes (`(.)`, `(..)`, `(...)`), private folders (`_folder`), and every non-page file (`route.ts`, `default.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `template.tsx`).

Options: `pageExtensions` mirrors Next's own config (default `['tsx', 'ts', 'jsx', 'js']`); `ignore` takes **pathnames**, not folder names — `'/coming-soon'` for one route, `'/admin/*'` for a route and its subtree. The skipped conventions above never need an `ignore` entry.

## A tree declared elsewhere — `bindRoutes`

When the tree lives in a shared package declared with core's `defineRoutes` (framework-free, so any app can depend on it), give it the hooks with `bindRoutes` rather than declaring it again:

```ts
import { bindRoutes } from '@hyeonqyu/typed-router-next';
import { routes as shared } from '@acme/shop-routes';

export const routes = bindRoutes(shared); // same paths, schemas and parsers; hooks and TypedLink added
```

`bindRoutes` takes any core route tree, including core's `attachMetadata` result. If the app also attaches metadata, this package's `attachMetadata(shared)(patch)` does both in one step. Never copy the shared tree's keys into a second `defineRoutes` call.

When a route is in the tree but served elsewhere (a blog on another domain), pass `bindRoutes(tree, { useResolveHref })`. `useResolveHref` is a hook returning `({ pathname, metadata, params, searchParams, hash }) => string | undefined`. `push`, `replace`, `prefetch` and `TypedLink` use the returned URL, or the route's own href on `undefined`. `prefetch` skips absolute URLs. The library reads no metadata key: the app picks the field that holds the destination. Return a stable function (`useCallback`). With the option set, render `TypedLink` from client components. `/pages`'s `bindRoutes` takes the same option.

## Pages Router

`@hyeonqyu/typed-router-next/pages` exposes the same surface plus `RouterReady` / `useRouterReady` — `defineRoutes`, `attachMetadata`, `bindRoutes`, `TypedLink`, `useTypedRouter`, `useTypedParams`, `useTypedSearchParams`, `useTypedPathname`, `useCurrentRoute`, `useCurrentRouteNode`, and the same core re-exports — backed by `next/router`. It never loads the package root, so `next/navigation` stays out of the bundle. A Pages Router app imports **only** from `/pages`.

```ts
// src/routes.ts
import { bindRoutes, defineRoutes } from '@hyeonqyu/typed-router-next/pages';
export const routes = defineRoutes({ '': { _metadata: {} }, products: { '[id]': { _metadata: {} } } }); // or bindRoutes(shared)
```

Keys mirror `pages/`: `pages/products/[id].tsx` → `products: { '[id]': … }`, `pages/index.tsx` → `''`, `pages/blog/index.tsx` → `blog: { _metadata }`. There is no `'use client'` anywhere on the Pages Router.

Where it differs from the App Router:

- **The route is `router.pathname`**, the page Next rendered, not a match of `asPath`, so rewrites cannot mislead it. `useCurrentRoute().url` is `asPath` without query and hash.
- **`<RouterReady>` replaces `<Suspense>`.** `useTypedSearchParams` throws `RouteNotReadyError` whenever `router.isReady` is false; `useTypedParams` throws it when `isReady` is false *and* a required segment is missing (a statically optimized dynamic page before hydration — a `getStaticProps` page keeps its segments and reads fine). Wrap those components in `<RouterReady fallback={…}>` or gate them on `useRouterReady()`; `getServerSideProps` pages need no boundary. **Never gate on `router.isReady` directly** — on a statically rendered page without a query string it is `false` in the HTML and `true` on the first client render, which fails hydration. Never catch `RouteNotReadyError` to substitute defaults.
- **Router:** `push`/`replace(pattern, { params, searchParams, hash, scroll, shallow })` return `Promise<boolean>`; `prefetch` returns `Promise<void>`; `refresh()` is `router.replace(router.asPath, undefined, { scroll: false })`; `forward()` is `history.forward()`.

Drift check: `assertRoutesMatchPagesDir(routes, 'src/pages')` / `findPagesDirDrift(...)` from `/check` → `{ missingFromPagesDir, missingFromTree, inSync }`, throwing `PagesDirDriftError`. It skips `_app`, `_document`, `_error`, `404`, `500` and `api/` at the root, and treats `(group)` / `@slot` / `_folder` as literal segments, because those are App Router conventions.

## Rules

**The root route is the empty key.** `app/page.tsx` serves `/`, and a path is built by joining a key onto its parent — so `''` joins to exactly `/`.
```ts
defineRoutes({ '': { _metadata: { title: 'Index' } }, home: { _metadata: { title: 'Home' } } });
routes.buildHref('/');          // ✓ the pathname is '/', even though the key is ''
<TypedLink href="/" />          // ✓
```
Omit it and `/` is a live route the typed API cannot name — which `assertRoutesMatchAppDir` reports as `missingFromTree: ['/']`.

The root key takes **no children**. `app/page.tsx` is a file, so everything else in `app/` is its sibling, not its child — declare those as top-level keys of the tree. Nesting under `''` currently yields a doubled `//dashboard` pathname that matches nothing on disk; `assertRoutesMatchAppDir` reports it as `missingFromAppDir`, but write it as a sibling and the question never arises.
```ts
defineRoutes({ '': { _metadata: {} }, dashboard: { _metadata: {} } });         // ✓ /, /dashboard
defineRoutes({ '': { _metadata: {}, dashboard: { _metadata: {} } } });         // ✗ /, //dashboard
```

**Never hand-write a URL.** Pass the declared pattern plus `params`.
```ts
router.push('/products/42');                              // ✗ compile error — not a declared pattern
<TypedLink href={`/products/${id}`}>                      // ✗ compile error
router.push('/products/[id]', { params: { id: 42 } });    // ✓
<TypedLink href="/products/[id]" params={{ id }} />       // ✓
redirect(routes.buildHref('/products/[id]', { params: { id } })); // ✓ server side
```

**Path params go in `params`, never in `searchParams`.** (This compiled in 1.x; it does not in 2.0.)
```ts
router.push('/products/[id]/reviews', { searchParams: { id: 42, star: 4 } });          // ✗
router.push('/products/[id]/reviews', { params: { id: 42 }, searchParams: { star: 4 } }); // ✓
```
`searchParams` is *only* the query string described by `_metadata.searchParamsSchema`; on a route with no schema the key is typed `?: never` and rejected outright. `params` is typed from each segment's `paramSchema` where one is declared, and `string | number` where none is — so a segment declaring `z.number()` refuses a string at the call site.

**A node without `_metadata` is not a destination.**
```ts
router.push('/internal');       // ✗ — `internal` only namespaces `/internal/stats`
<TypedLink href="/files" />     // ✗ — the metadata sits on `[[...path]]`
<TypedLink href="/files/[[...path]]" />                     // ✓ params optional
<TypedLink href="/files/[[...path]]" params={{ path: ['a'] }} /> // ✓
```
Just as in Next's filesystem router, an optional catch-all also serves the bare parent URL — you simply address it by its declared pattern: `buildHref('/files/[[...path]]')` returns `/files`, and `match('/files')` resolves back to `/files/[[...path]]`. What does not exist is a separate `/files` entry in the pathname union, which is why `href="/files"` above is a compile error.

**The link prop is `href`, flat.** Not `to` (React Router), not a nested object (1.x).
```tsx
<TypedLink to="/home" />                                  // ✗
<TypedLink href={{ pathname: '/products', searchParams }} />  // ✗
<TypedLink href="/products" searchParams={{ q: 'books' }} hash="top" /> // ✓
```

**Do not invent a provider or a factory.** There is no `<RoutesProvider>`, no `useAppRoutes()`, no `createAppRoutes<M, C>()(...)`. `export const routes = defineRoutes({...})` at module scope, then import it.

**Do not put `'use client'` in `routes.ts`.** It would drag the tree and its Zod schemas into the client bundle. Put it on the files that call hooks or render `TypedLink`. Conversely, never call `useTypedRouter` / `useTypedSearchParams` / `useTypedParams` / `useCurrentRoute` from a server component.

**Search-param parsing throws by default.** A stale or hand-edited `?page=abc` will crash the component.
```ts
useTypedSearchParams('/products');                          // onError: 'throw' → SearchParamsParseError
useTypedSearchParams('/products', { onError: 'default' });  // drop invalid fields, keep schema defaults
useTypedSearchParams('/products', { onError: 'raw' });      // on failure, return the coerced values instead of throwing
useTypedSearchParams('/products', { onError: 'ignore' });   // ✗ not a valid mode
```
`onError` is the only option key. Catch with `error instanceof SearchParamsParseError`.

**Only call `useTypedSearchParams` on routes that declare a `searchParamsSchema`.** Without one the output type resolves to `never` and the runtime values are uncoerced raw strings.

**`useTypedPathname()` returns the pattern, not the URL.** `useTypedPathname()` → `/products/[id]`; `useCurrentRoute().url` → `/products/42`. String-comparing the former against a live URL silently never matches.

**`useTypedParams(pathname)` returns the *current* route's params, typed from the pathname you pass.** The argument does not select which URL is read — that is always the live one — but it does select the types and which `paramSchema`s are applied. It is therefore **checked**: pass a route the URL did not come from and it throws `RouteMismatchError` rather than handing you another route's params under this route's types. An ancestor is accepted (`useTypedParams('/products/[id]')` under `/products/42/reviews`), because such a component really is underneath that route. `useCurrentRouteNode(pathname)` takes the same argument and makes the same check; called with no argument it stays unchecked and returns the union of every node.

**Type a dynamic segment with `paramSchema` on the segment's own node.** `'[id]': { _metadata: { paramSchema: z.number() } }` makes `useTypedParams('/products/[id]').id` a `number` and rejects `/products/abc` with a `PathParamsParseError`. The name comes from the tree key, so the schema is bare (`z.number()`), not an object, and nested routes inherit it — `/products/[id]/reviews` gets `id: number` without redeclaring anything. Catch-alls declare the whole list (`z.array(z.string())`). A segment with no `paramSchema` stays `string` / `string[]`, exactly as before. Same `onError` modes as search params: `useTypedParams('/products/[id]', { onError: 'default' })`.

**Never re-declare routes elsewhere.** No `type AppRoute = '/home' | ...`, no `paths.ts` of constants, no hand-written nav array. Derive: `typeof routes.$types.pathname` or `Pathname<typeof routes>` for the union, `routes.paths` for the runtime list, `SearchParams<typeof routes, '/products'>` for a query type, `routes.getMetadata(path)` for titles.

**Two type-helper families, easy to mix up.** `Pathname` / `SearchParams` / `RouteNodeOf` / `RouteMetadataOf` take `typeof routes`; `CurrentRoute<TTree>` / `TypedRoutes<TTree>` / `RouteArgs<TTree, TPath>` take the **tree** (`typeof routes.$types.tree`).

**The tree is frozen.** `routes.routes` is deep-frozen (except `_metadata` objects); runtime mutation no-ops or throws.

**A few core types are not re-exported here.** `ParseSearchParamsOptions`, `ParsePathParamsOptions`, `RawSearchParams`, `BuildHrefArgs`, `CollectedRoute` and `GetCollectedRoute` (their routes-object-taking counterpart `CollectedRouteOf` **is** re-exported), `GetRouteNode`, `RouteArgsTuple`, `SearchParamsInput/Output`, `RouteTreeInput`, and the `TypedRouter` type are absent from this package's index. `ParseSearchParamsOptions` and `ParsePathParamsOptions` are themselves absent, but their one member type **is** re-exported in each case: write `{ onError?: SearchParamsErrorMode }` / `{ onError?: PathParamsErrorMode }` rather than inlining the literals. Prefer that, or deriving the shape (`ReturnType<typeof routes.useTypedRouter>`) rather than adding a core dependency.

## API reference

Everything below is a member of the object returned by `defineRoutes`, unless marked *(export)*.

| Name | Signature | Notes |
| --- | --- | --- |
| `defineRoutes` *(export)* | `(tree) => TypedRoutes<TTree>` | Entry point. `.withMeta<TMetadata, TContext>()(tree)` for a shared metadata contract. |
| `bindRoutes` *(export)* | `(source: RouteTree<TTree>, options?: { useResolveHref?: () => ResolveHref<TTree> }) => TypedRoutes<TTree>` | Adds the hooks and `TypedLink` to a tree built elsewhere (core's `defineRoutes` / `attachMetadata`, a shared package). Reuses the source's tree, paths and parsers. `useResolveHref` sends chosen routes to another URL. `/pages` has its own, backed by `next/router`. |
| `attachMetadata` *(export)* | `(source) => (patch) => TypedRoutes`, also `.withMeta<TMetadata, TContext>()(patch)` | For a tree declared in a shared package (usually with core's `defineRoutes`, structure only): attaches this app's metadata by pathname and returns this package's full routes object, so hooks and `TypedLink` see it. Keys are the source's pathnames — an undeclared one is a compile error. Entries merge over the source's `_metadata`; `paramSchema` / `searchParamsSchema` stay the source's. The source is not mutated. |
| `TypedLink` | `<TPath>(props: TypedLinkProps<TTree, TPath>) => ReactElement` | Server-safe (no hooks). Wraps `next/link`; forwards every other prop. Props: `href`, `params`, `searchParams`, `hash`. |
| `useTypedRouter()` | `() => { push, replace, prefetch, back, forward, refresh }` | `'use client'`. `push/replace/prefetch(pattern, args?)`; `args` also takes `scroll` (ignored by `prefetch`). |
| `useTypedParams(pattern, opts?)` | `(pattern, { onError? }?) => PathParamsOutput<TPath, TTree>` | `'use client'`. Reads the live URL; the pattern picks the types and the `paramSchema`s applied, and is checked against the matched route — a mismatch throws `RouteMismatchError`, an ancestor is fine. Undeclared segments are `string` / `string[]`. |
| `useTypedSearchParams(pattern, opts?)` | `(pattern, { onError? }?) => SearchParamsOutput<TTree, TPath>` | `'use client'` + `<Suspense>`. Returns the schema **output** type (defaults applied). |
| `useTypedPathname()` | `() => RoutePaths<TTree> \| null` | `'use client'`. The declared pattern of the current URL. |
| `useCurrentRoute()` | `() => { pathname, url, node, metadata, params }` | `'use client'`. `pathname` / `node` / `metadata` are `null` when the URL matches no declared route; `metadata` is loose `Record<string, unknown>` — narrow it yourself. |
| `useCurrentRouteNode(pattern?)` | `<TPath>(pattern: TPath) => GetRouteNode<TTree, TPath> \| null` / `() => GetRouteNode<TTree, RoutePaths<TTree>> \| null` | `'use client'`. Works on dynamic routes. With a pattern it is checked against the live URL and narrows to that node; without one it is unchecked and returns the union. |
| `buildHref(pattern, args?)` | `(pattern, args?) => string` | Server-safe. URL-encodes params, `Date` → ISO, objects and nested search params → JSON. Throws on a missing required param, and on any value it cannot serialise faithfully. |
| `parseSearchParams(pattern, raw, opts?)` | `(pattern, raw, { onError? }?) => SearchParamsOutput<...>` | Server-safe. `raw` is `Record<string, string \| string[]>` or an entries iterable. |
| `parseParams(pattern, raw, opts?)` | `(pattern, raw, { onError? }?) => PathParamsOutput<...>` | Server-safe. Run `match().params` — or a server component's own `params` — through the segments' schemas. |
| `match(url)` | `(url) => { path, node, metadata, params } \| null` | Server-safe. Strips `?`/`#`, decodes params, ranks static > dynamic > catch-all. |
| `paths` | `readonly RoutePaths<TTree>[]` | Every navigable pathname — sitemaps, nav, enumeration. |
| `collected` | `readonly GetCollectedRoute<TTree>[]` | Navigable routes with compiled segment patterns; each entry keeps its literal `path` and typed `metadata`. |
| `routes` | `TTree` | The declared tree, frozen. |
| `getNode(pattern)` / `getMetadata(pattern)` | `(pattern) => node` / `=> metadata` | Typed per node, so custom `_metadata` fields survive. |
| `$types` | `{ tree; pathname }` | Type-only carrier (empty at runtime). |
| `resolveMetadata` / `resolveMetadataValue` *(export)* | `(metadata \| value, context) => resolved` | Resolves only `title`, `label`, `description`, `accessible`; other fields (e.g. your own `loader`) pass through untouched. |
| `SearchParamsParseError` *(export)* | `class extends Error { cause }` | Thrown under `onError: 'throw'`. |
| `SearchParamsErrorMode` *(type)* | `'throw' \| 'default' \| 'raw'` | The `onError` modes; `ParseSearchParamsOptions` itself is not re-exported. |
| `PathParamsParseError` *(export)* | `class extends Error { param, cause }` | Thrown by `useTypedParams` / `parseParams` under `onError: 'throw'`. |
| `RouteMismatchError` *(export)* | `class extends Error { declared, matched }` | Thrown when `useTypedParams` / `useCurrentRouteNode` is given a pathname the live URL did not come from. |
| `PathParamsErrorMode` *(type)* | `'throw' \| 'default' \| 'raw'` | The same three modes for path params; `ParsePathParamsOptions` is not re-exported either. |
| `Pathname<typeof routes>` *(type)* | union of navigable pathnames | Same as `typeof routes.$types.pathname`. |
| `SearchParams<typeof routes, TPath>` *(type)* | parsed query type of one route | |
| `RouteNodeOf` / `RouteMetadataOf` *(type)* | `<typeof routes, TPath>` | Node / `_metadata` behind one pathname. |
| `CollectedRouteOf` *(type)* | `<typeof routes, TPath?>` | The `collected` element union; pass a pathname to pick one entry. |
| `RouteArgs<TTree, TPath>` *(type)* | `params & searchParams & { hash? }` | The rule behind every call site; absent kinds are typed `?: never`. |
| `PathParams` / `PathParamsOutput` *(type)* | `<TPath, TTree = unknown>` | What you *write* vs. what you *read back*. Without the tree both fall back to the undeclared defaults (`string \| number` / `string`); pass `typeof routes.$types.tree` to see declared `paramSchema`s. |
| `Params` *(type)* | `<typeof routes, TPath>` | The read side, tree already applied — prefer this to `PathParamsOutput`. |
| `NavigateArgs` / `NavigateArgsTuple` / `NavigateOptions` *(type)* | Next-specific navigation args | `NavigateOptions = { scroll?: boolean }`. |
| `BuiltinMetadata` / `RouteMetadata` / `MetadataValue` / `AnySchema` / `RouteMatch` / `RoutePaths` / `RouteChildren` / `SearchParamKeysSchema` *(type)* | core types, re-exported | `AnySchema` is structural — that is why `zod` stays optional. |
| `searchParamKeys` *(export)* | `<TKey extends string>() => SearchParamKeysSchema<TKey>` | Declares a route's query keys with no schema library: `searchParamsSchema: searchParamKeys<'redirectUrl'>()`. Each key optional and `string \| string[]`; any other key is a compile error. Validates nothing, so reading returns the raw values. Keys go in the type argument — calling it without one does not compile. |
| `children` *(export)* | `(node) => RouteChildren<TNode>` | One node's children with `_metadata` gone from the value **and** the type — for a menu level, a breadcrumb's siblings or a section index, where `Object.values(node)` would otherwise yield the metadata block. Returns an object, so `keys`/`values`/`entries` all work; `(group)` keys are children like any other. There is no `routes.` equivalent — use this one. |
| `matchRoute` / `collectRoutes` / `isRouteGroup` / `METADATA_KEY` / `toSearchParamsString` *(export)* | low-level core utilities | App code should use `routes.match` / `routes.paths` instead. |

Exported from `@hyeonqyu/typed-router-next/check` — a Node-only entry point, never importable from application code. Nothing here is re-exported from the main entry, and nothing from the main entry is available here:

| Name | Signature | Notes |
| --- | --- | --- |
| `assertRoutesMatchAppDir` | `(routes, appDir, options?) => void` | Throws `RouteDriftError` on drift. Use from a test. |
| `findRouteDrift` | `(routes, appDir, options?) => RouteDriftReport` | The same comparison as data. Throws only when `appDir` does not exist. |
| `RouteDriftError` | `class extends Error { report }` | `report` is the `RouteDriftReport`; the message lists both directions. |
| `RouteDriftReport` *(type)* | `{ missingFromAppDir, missingFromTree, inSync }` | Declared-but-absent, present-but-undeclared, and whether both are empty. |
| `FindRouteDriftOptions` *(type)* | `{ ignore?, pageExtensions? }` | `ignore` takes pathnames (`'/admin/*'`), not folder names. |
| `RoutesLike` *(type)* | `{ paths: readonly string[] }` | All the checker needs; a `defineRoutes()` result satisfies it structurally. |
| `assertRoutesMatchPagesDir` | `(routes, pagesDir, options?) => void` | Pages Router counterpart; throws `PagesDirDriftError`. |
| `findPagesDirDrift` | `(routes, pagesDir, options?) => PagesDirDriftReport` | `{ missingFromPagesDir, missingFromTree, inSync }`. |
| `PagesDirDriftError` | `class extends Error { report }` | `report` is the `PagesDirDriftReport`. |
| `PagesDirDriftReport` / `FindPagesDirDriftOptions` *(type)* | as above | Options are `{ ignore?, pageExtensions? }`; the longest matching extension wins (`'page.tsx'` before `'tsx'`). |

Exported only from `@hyeonqyu/typed-router-next/pages`, beside the surface it shares with the main entry:

| Name | Signature | Notes |
| --- | --- | --- |
| `RouteNotReadyError` | `class extends Error { pathname }` | Thrown before `router.isReady` by `useTypedSearchParams`, and by `useTypedParams` when a required segment is still missing. |
| `RouterReady` | `({ children, fallback? }) => ReactElement` | Renders `children` once `useRouterReady()` is true. |
| `useRouterReady` | `() => boolean` | `router.isReady`, but `false` through hydration so the first client render matches the HTML. |
| `TypedRoutes` *(type)* | `TypedRoutes<TTree>` | As the main entry's, with the Pages `useTypedRouter`. |
| `PagesNavigateOptions` / `PagesNavigateArgs` / `PagesNavigateArgsTuple` *(type)* | `{ scroll?, shallow? }` | The Pages Router's navigation options. |
