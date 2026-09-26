# @hyeonqyu/typed-router-react — agent guide

The route tree object is the single source of truth for this app's information architecture. You declare the IA once as a nested object, and pathnames, path params, search-param types, navigation, route metadata **and the React Router configuration itself** are all derived from it and checked by the compiler. Never hand-write a URL string, and never keep a second list of routes (a `<Route>` config, a `paths.ts` constants file) alongside the tree — that defeats the entire point of the library.

That claim needs no qualifying here, and there is nothing to check: `toRouteObjects()` *builds* the router configuration from the tree, so a route cannot exist without being declared in it. The Next adapter ships `assertRoutesMatchAppDir` precisely because it has no equivalent — there, `src/app/` decides route existence and the tree only mirrors it. Never suggest that helper for a React Router app; it does not apply, and there is no filesystem for it to read.

**This guide is React Router's library mode**, the one where the app owns its router configuration. React Router 7 also has a **framework mode** (`@react-router/dev`, an `app/routes.ts` config), and there `toRouteObjects()` does not apply: it emits `element` / `Component`, React elements resolved at runtime, while framework mode's `RouteConfigEntry` wants `file`, a module path resolved at build time so the framework can code-split each route and generate its types. Never suggest feeding one to the other. Everything else about the tree still works there — `paths`, `buildHref`, `match`, `parseParams`, `parseSearchParams`, `collected` — and in that mode the right import **is** `@hyeonqyu/typed-router-core`, because the framework brings its own `<Link>` and hooks. See `examples/react-router-framework-example`.

Otherwise, import **everything** from `@hyeonqyu/typed-router-react`. It re-exports the part of the core surface consumers need (see the API reference below for the exact list), so `@hyeonqyu/typed-router-core` must never be added to the consumer's `package.json`. If a core type is not in that list, it is internal — reach for the documented equivalent rather than importing from core.

```bash
npm install @hyeonqyu/typed-router-react react-router-dom zod   # zod is OPTIONAL
```

Peer deps: `react-router-dom` **6 or 7** (v5 is not supported — no `createBrowserRouter`), `react` / `react-dom` 16.8+, and `zod` only if you use schemas.

## Minimal correct setup (end to end)

```tsx
// src/routes.tsx
import { defineRoutes } from '@hyeonqyu/typed-router-react';
import { z } from 'zod';
import { AccountLayout, DocsPage, ErrorPage, HomePage, ProductDetailPage, ProductsLayout, ProductsPage, ProfilePage, ReviewsPage, StatsPage } from './pages';

export const routes = defineRoutes({
  // A node is a navigable destination ONLY if it declares `_metadata` (even `_metadata: {}`).
  home: { _metadata: { title: 'Home', element: <HomePage /> } },

  products: {
    _metadata: {
      title: 'Products',
      element: <ProductsPage />,          // this node's own page
      layout: <ProductsLayout />,         // wraps children through <Outlet />
      errorElement: <ErrorPage />,        // any React Router route field passes through verbatim
      searchParamsSchema: z.object({
        sort: z.enum(['price-asc', 'price-desc']).optional(),
        page: z.number().default(1),
      }),
    },
    '[id]': {
      _metadata: { title: 'Product detail', element: <ProductDetailPage /> },
      reviews: { _metadata: { title: 'Reviews', element: <ReviewsPage /> } },
    },
  },

  docs: { '[...slug]': { _metadata: { title: 'Docs', element: <DocsPage /> } } },

  '(account)': {                          // route group: contributes NO URL segment
    _metadata: { layout: <AccountLayout /> },
    profile: { _metadata: { title: 'Profile', element: <ProfilePage /> } },
  },

  internal: {                             // no `_metadata` -> namespaces children only.
    stats: { _metadata: { title: 'Stats', element: <StatsPage /> } },  // /internal/stats is navigable, /internal is not
  },
});

// No provider, no hook, no generic call. `routes` is a plain module-level object.
export const { TypedLink, useCurrentRoute, useTypedParams, useTypedRouter, useTypedSearchParams } = routes;
```

```tsx
// src/App.tsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { routes } from './routes';

const router = createBrowserRouter(routes.toRouteObjects()); // built ONCE, at module scope

export const App = () => <RouterProvider router={router} />;
```

Segment key syntax mirrors Next.js: `products` static, `[id]` dynamic, `[...slug]` catch-all, `[[...path]]` optional catch-all, `(group)` route group.

## `routes.toRouteObjects()` — derive the router config

**Before** — a hand-maintained config that silently drifts from the tree:

```tsx
const router = createBrowserRouter([
  { path: 'home', element: <HomePage /> },
  {
    path: 'products',
    element: <ProductsLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <ProductsPage /> },
      { path: ':id', children: [{ index: true, element: <ProductDetailPage /> }, { path: 'reviews', element: <ReviewsPage /> }] },
    ],
  },
  { path: 'docs', children: [{ path: '*', element: <DocsPage /> }] },
  { element: <AccountLayout />, children: [{ path: 'profile', element: <ProfilePage /> }] },
  { path: 'internal', children: [{ path: 'stats', element: <StatsPage /> }] },
]);
```

**After** — the exact same config, generated from the tree above:

```tsx
const router = createBrowserRouter(routes.toRouteObjects());
```

The result is plain `RouteObject[]`, so you keep full control — nest it, add routes the tree doesn't know about, or filter by feature flag:

```tsx
const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Navigate to="/home" replace /> },
      ...routes.toRouteObjects(),
      { path: '*', element: <NotFound /> },
    ],
  },
]);
```

Inside an existing `<BrowserRouter>`, `<routes.TypedRoutes />` renders the same thing (it is `useRoutes(routes.toRouteObjects())`).

How `_metadata` maps onto the generated route:

| in `_metadata` | becomes |
| --- | --- |
| `element` / `Component` / `lazy` | this node's page. If the node has children, it moves into an `{ index: true }` child so it still renders at the exact path |
| `layout` | the parent route's `element`, wrapping children through `<Outlet />`. On a childless node with no `element`, it stands in for `element` |
| `loader` / `action` / `shouldRevalidate` / `handle` / `middleware` | forwarded to this node's **page** (the index route when split) |
| `errorElement` / `ErrorBoundary` / `HydrateFallback` / `hydrateFallbackElement` / `caseSensitive` / `id` | forwarded to this node's **route**, not its page |
| `[id]` key | `path: ':id'` |
| `[...slug]` / `[[...slug]]` key | `path: '*'` — but `useTypedParams` still reports `slug`, not `*`, and runs its `paramSchema` |
| no page field at all | `{ path }` with nothing to render — the route **matches** and draws nothing, rather than falling through to a trailing `*`. Intended: a node may name a place in the IA without naming a page. Give it a page, or leave it out of the config, if it should 404 |
| `(group)` key | a pathless layout route |

## Common operations

**Navigate** — always the declared pattern plus values, never a concrete URL:

```tsx
const router = useTypedRouter();

router.push('/home');
router.push('/products/[id]', { params: { id: 42 } });
router.push('/products/[id]/reviews', { params: { id: 42 }, hash: 'top' });
router.push('/docs/[...slug]', { params: { slug: ['guide', 'intro'] } });
router.replace('/products', { searchParams: { sort: 'price-asc', page: 2 }, state: { from: 'nav' } });
router.prefetch('/products'); // NO-OP here; exists only so code ports to the Next.js adapter
router.back();
router.forward();
router.refresh();             // navigate(0) — re-runs loaders in a data router
```

**Link** — the prop is `href`, not React Router's `to`:

```tsx
<TypedLink href="/products/[id]" params={{ id: 42 }} className="link">Detail</TypedLink>
<TypedLink href="/products" searchParams={{ sort: 'price-asc', page: 2 }} hash="top" replace>Sorted</TypedLink>
<TypedLink href="/docs/[...slug]" params={{ slug: ['guide', 'intro'] }}>Docs</TypedLink>
```

**Read the current route:**

```tsx
const { id } = useTypedParams('/products/[id]');          // id: string — or the segment's paramSchema output
const { slug } = useTypedParams('/docs/[...slug]');       // slug: string[]
// The pathname is checked against the route the live URL matched. An ancestor is fine —
// `useTypedParams('/products/[id]')` under /products/42/reviews — anything else throws
// `RouteMismatchError` rather than returning another route's params under these types.

const search = useTypedSearchParams('/products');         // schema OUTPUT type
search.page;  // number — `?page=2` really is 2, and the default 1 is applied
search.sort;  // 'price-asc' | 'price-desc' | undefined

const { pathname, url, node, metadata, params } = useCurrentRoute();
// on /products/42 -> pathname: '/products/[id]' (DECLARED pattern), url: '/products/42'

routes.useTypedPathname();      // === useCurrentRoute().pathname
routes.useCurrentRouteNode('/products/[id]');  // checked, and narrowed to that route's node
routes.useCurrentRouteNode();   // unchecked; === useCurrentRoute().node, typed as the union of all nodes
```

**Outside components** (loaders, actions, tests, plain modules) — same object, no hooks:

```ts
routes.buildHref('/products/[id]', { params: { id: 7 }, hash: 'reviews' }); // '/products/7#reviews'
routes.paths;                                   // every navigable pathname — navs, sitemaps, exhaustive tests
routes.match('/products/42?page=2');            // -> { path, node, metadata, params } | null
routes.getNode('/products');                    // precisely typed tree node
routes.getMetadata('/products').title;          // precisely typed metadata (unlike useCurrentRoute().metadata)

const productsLoader = ({ request }: LoaderFunctionArgs) =>
  routes.parseSearchParams('/products', new URL(request.url).searchParams, { onError: 'default' });
```

**Types without extra imports:**

```ts
type AppPathname = typeof routes.$types.pathname;           // union of declared pathnames
type ProductsSearch = SearchParams<typeof routes, '/products'>;
type ProductsMeta = RouteMetadataOf<typeof routes, '/products'>;
```

**Shared metadata contract** — declare only your own fields; `title`/`label`/`description`/`accessible` come from `BuiltinMetadata` and already accept `value | (context) => value`, and `searchParamsSchema` / `paramSchema` come from it too (always plain schemas, never functions of context). `withMeta` closes `_metadata` to `TMetadata & BuiltinMetadata<TContext>` exactly, so list any React Router fields you use:

```tsx
type Meta = { icon: string; element?: ReactElement };
type Ctx = { locale: 'en' | 'ko'; isAdmin: boolean };

export const routes = defineRoutes.withMeta<Meta, Ctx>()({
  dashboard: {
    _metadata: {
      icon: 'chart',
      element: <Dashboard />,
      title: (ctx) => (ctx.locale === 'ko' ? '대시보드' : 'Dashboard'),
      accessible: (ctx) => ctx.isAdmin,
    },
  },
});

// Resolves title/label/description/accessible only; `element`, `loader` and your own functions are untouched.
resolveMetadata(routes.getMetadata('/dashboard'), { locale: 'ko', isAdmin: true });
```

## Rules

1. **Pass the declared pattern, supply values separately.** `push('/products/42')` and `<TypedLink href="/products/42">` are compile errors — `RoutePaths` is the union of declared patterns only.
   ```tsx
   router.push('/products/42');                              // WRONG
   router.push('/products/[id]', { params: { id: 42 } });    // RIGHT
   ```
2. **`params` is for dynamic segments, `searchParams` is for the query string.** They were merged in 1.x; in 2.0 they are separate keys.
   ```tsx
   router.push('/products/[id]', { searchParams: { id: 42 } }); // WRONG
   router.push('/products/[id]', { params: { id: 42 } });       // RIGHT
   ```
3. **Only routes declaring `searchParamsSchema` accept `searchParams`.** Elsewhere the key is typed `?: never`. Add the schema to that node's `_metadata`, or drop the key.
4. **A node is navigable only with a `_metadata` block.** `/internal` above is not a pathname, is not in `routes.paths`, and `push('/internal')` will not compile. Add `_metadata: {}` if you want it navigable.
5. **Never wrap the app in a provider or call `defineRoutes<Meta, Ctx>(...)`.** `AppRoutesProvider` / `useAppRoutes()` were removed in 2.0. `defineRoutes({...})` at module scope; the only curried form is `defineRoutes.withMeta<TMetadata, TContext>()({...})`.
6. **`TypedLink` takes `href`, not `to`.** `to` is deliberately removed from the prop type so the same markup compiles against the Next.js adapter. All other `Link` props pass through.
7. **Never hand-write the React Router config.** Generate it with `routes.toRouteObjects()` and compose around it.
8. **`element` vs `layout`:** `element` is the node's own page; `layout` is the wrapper that renders children through `<Outlet />`. Put a wrapper in `element` on a node with children and it becomes that node's `index` route: it renders at the exact path but never wraps anything, so the children render unwrapped. Put a page in `layout` and the opposite happens — it renders at every descendant path and swallows the children, because a page component has no `<Outlet />`.
9. **Never read dynamic segments with React Router's `useParams()`.** Catch-alls compile to `*`, so `useParams()` gives you an anonymous `'*'` key. `useTypedParams('/docs/[...slug]')` returns `{ slug: string[] }`.
10. **`useTypedSearchParams` THROWS by default** (`SearchParamsParseError`) when the URL fails the schema. For user-editable URLs pass `{ onError: 'default' }` (drop bad fields, keep the rest) or `{ onError: 'raw' }` (on failure, return the coerced values instead of throwing). Same option on `routes.parseSearchParams`, and on `useTypedParams` / `routes.parseParams` (which throw `PathParamsParseError`).
11. **Type a dynamic segment with `paramSchema` on the segment's own node.** `'[id]': { _metadata: { paramSchema: z.number() } }` makes `useTypedParams('/products/[id]').id` a `number`, and `/products/abc` throws instead of flowing in as a bad string. The name comes from the tree key, so the schema is bare (`z.number()`), not an object; nested routes inherit it, so `/products/[id]/reviews` needs no redeclaration; a catch-all declares the whole list (`z.array(z.string())`). Segments with no `paramSchema` stay `string` / `string[]`, so this changes nothing until you use it.
11. **Search params are already coerced; path params never are.** `Number(search.page)` is a double conversion — it is already a `number`. Path params are always `string` / `string[]` when read back (`PathParams` accepts `string | number` when you WRITE them).
12. **`pathname` is the declared pattern, not the live URL.** `useTypedPathname()` / `useCurrentRoute().pathname` give `/products/[id]`; the live URL is `useCurrentRoute().url`. String-comparing `pathname` to a real URL silently never matches.
13. **`prefetch` is a no-op** in React Router library mode. Do not build a performance story on it.
14. **zod is an OPTIONAL peer dep.** Schemas are matched structurally, so Zod v3, Zod v4 and any [Standard Schema](https://standardschema.dev) validator work. Never import zod inside library types. The validator must be **synchronous** — an async Standard Schema throws at runtime.
15. **Import only from `@hyeonqyu/typed-router-react`.** Adding `@hyeonqyu/typed-router-core` to dependencies invites version skew.
16. **`Pathname` / `SearchParams` / `RouteNodeOf` / `RouteMetadataOf` take the routes OBJECT** (`Pathname<typeof routes>`); `RoutePaths` takes the raw tree (`RoutePaths<typeof routes.$types.tree>`). Mixing them does not give you the pathname union: passing the routes object to `RoutePaths` silently produces a bogus `'/routes/home' | '/routes/products' | …` union, and passing the raw tree to `Pathname` produces a confusing TS2589 "excessively deep" error. `GetRouteNode` and `SearchParamsOutput` are internal to the core package and are not importable from the adapter — use `RouteNodeOf<typeof routes, '/products/[id]'>` and `SearchParams<typeof routes, '/products'>` instead.
17. **Use `routes.getMetadata(path)` for typed metadata.** `useCurrentRoute().metadata` is the loose `RouteMetadata` (`Record<string, unknown>`).
18. **`toRouteObjects()` rebuilds a fresh array on every call.** Call it once and store the result before handing it to `createBrowserRouter`; calling it during render would recreate the router. Only the tree *structure* is frozen — `_metadata` contents are not.

## API reference

| Name | Signature | What it does |
| --- | --- | --- |
| `defineRoutes` | `(tree) => TypedRoutes<TTree>` | Entry point. Declares the tree, returns hooks + components + router config. |
| `defineRoutes.withMeta` | `<TMetadata, TContext>() => (tree) => TypedRoutes<TTree>` | Curried variant enforcing a shared `_metadata` contract. |
| `routes.toRouteObjects` | `() => RouteObject[]` | Generates React Router's config from the tree. |
| `routes.TypedRoutes` | `() => ReactElement \| null` | `useRoutes(toRouteObjects())`, for use inside `<BrowserRouter>`. |
| `routes.TypedLink` | `(props: TypedLinkProps<TTree, TPath>) => ReactElement` | `Link` taking `href` + `params` / `searchParams` / `hash`. |
| `routes.useTypedRouter` | `() => TypedRouter<TTree>` | `push` / `replace` / `prefetch` / `back` / `forward` / `refresh`. |
| `routes.useTypedParams` | `(pathname, options?) => PathParamsOutput<TPath, TTree>` | Path params of the current URL, typed from the pattern and validated by the segments' `paramSchema`s. Undeclared segments are `string` / `string[]`. |
| `routes.useTypedSearchParams` | `(pathname, options?) => SearchParamsOutput<TTree, TPath>` | Query string coerced + validated by the route's schema. |
| `routes.useCurrentRoute` | `() => CurrentRoute<TTree>` | `{ pathname (declared), url (live), node, metadata, params }`. |
| `routes.useTypedPathname` | `() => RoutePaths<TTree> \| null` | Declared pattern of the current URL. |
| `routes.useCurrentRouteNode` | `<TPath>(pattern: TPath) => GetRouteNode<TTree, TPath> \| null` / `() => GetRouteNode<TTree, RoutePaths<TTree>> \| null` | Tree node behind the current URL. With a pattern it is checked against the live URL and narrows; without one it is unchecked and returns the union. |
| `routes.buildHref` | `(path, args?) => string` | Concrete URL from a pattern. URI-encodes; `Date` -> ISO; objects and nested search params -> JSON. Throws on a missing param, and on any value it cannot serialise faithfully. |
| `routes.match` | `(url) => RouteMatch \| null` | Live URL -> declared route. Static > dynamic > catch-all. |
| `routes.parseSearchParams` | `(path, raw, options?) => SearchParamsOutput<TTree, TPath>` | Non-hook search-param parse, for loaders/actions. |
| `routes.parseParams` | `(path, raw, options?) => PathParamsOutput<TPath, TTree>` | Non-hook path-param parse, for loaders/actions: `routes.parseParams(path, args.params)`. |
| `routes.paths` | `readonly RoutePaths<TTree>[]` | Every navigable pathname. |
| `routes.collected` | `readonly GetCollectedRoute<TTree>[]` | Navigable routes with compiled segment patterns; each entry keeps its literal `path` and typed `metadata`. |
| `routes.routes` | `TTree` | The declared tree, structure-frozen. |
| `routes.getNode` / `getMetadata` | `(path) => node / metadata` | Precisely typed node / `_metadata`. |
| `routes.$types` | `{ tree; pathname }` | Type-only carrier: `typeof routes.$types.pathname`. |
| `toRouteObjects` | `(tree: unknown) => RouteObject[]` | Standalone form, takes a raw tree (`routes.routes`). |
| `toReactRouterSegment` | `(segment: string) => string` | `[id]` -> `:id`, `[...slug]` -> `*`. |
| `resolveMetadata` / `resolveMetadataValue` | `(metadata \| value, context) => …` | Resolves `title`/`label`/`description`/`accessible` against a context. |
| `SearchParamsParseError` | `class extends Error` | Thrown by `onError: 'throw'` (the default). |
| `PathParamsParseError` | `class extends Error { param, cause }` | The path-param equivalent; `.param` names the segment that failed. |
| `children` | `(node) => RouteChildren<TNode>` | One node's children with `_metadata` gone from the value **and** the type — for a menu level, a breadcrumb's siblings or a section index, where `Object.values(node)` would otherwise yield the metadata block. Returns an object, so `keys`/`values`/`entries` all work; `(group)` keys are children like any other. There is no `routes.` equivalent — use this one. |
| `buildHref`, `matchRoute`, `collectRoutes`, `parseSearchParams`, `parsePathParams`, `toSearchParamsString`, `isRouteGroup`, `METADATA_KEY` | — | Untyped core primitives, re-exported. Prefer the methods on `routes`. |
| Types | `Pathname`, `SearchParams`, `RouteNodeOf`, `RouteMetadataOf`, `CollectedRouteOf`, `RouteArgs`, `RouteChildren`, `PathParams`, `PathParamsOutput`, `RouteMatch`, `RoutePaths`, `RouteMetadata`, `BuiltinMetadata`, `MetadataValue`, `AnySchema`, `SearchParamsErrorMode`, `TypedLinkProps`, `TypedRouter`, `TypedRoutes`, `CurrentRoute`, `NavigateArgs`, `NavigateArgsTuple`, `NavigateOptions` | All exported from `@hyeonqyu/typed-router-react`. |
