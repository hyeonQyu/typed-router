# @hyeonqyu/typed-router-react

[한국어](./README.ko.md)

Type-safe routing for React Router 6/7. If you're new to typed-router, [the project overview](../../README.md) covers why it exists and how the route tree works in general — this doc is the complete, React Router–specific guide: install → declare → use, nothing else required.

```bash
npm install @hyeonqyu/typed-router-react zod
```

Still deciding between this, `react-router-typesafe-routes`, `typesafe-routes`, or moving to TanStack Router? Start with [the React Router comparison](../../COMPARISON.md#if-youre-on-react-router).

## 1. Declare your tree

Same tree shape as any other typed-router adapter, plus one thing React Router actually needs: an element to render. Put it on `_metadata.element`; put a wrapping layout on `_metadata.layout`.

```tsx
// routes.tsx
import { defineRoutes } from '@hyeonqyu/typed-router-react';
import { z } from 'zod';
import { HomePage, ProductsPage, ProductDetailPage, ProfilePage, AccountLayout } from './pages';

export const routes = defineRoutes({
  home: {
    _metadata: { title: 'Home', element: <HomePage /> },
  },
  products: {
    _metadata: {
      title: 'Products',
      element: <ProductsPage />,
      searchParamsSchema: z.object({
        sort: z.enum(['price-asc', 'price-desc']).optional(),
        page: z.number().default(1),
      }),
    },
    '[id]': {
      _metadata: { title: 'Product detail', element: <ProductDetailPage /> },
    },
  },
  '(account)': {
    _metadata: { layout: <AccountLayout /> }, // wraps its children through <Outlet />, adds no URL segment
    profile: { _metadata: { title: 'Profile', element: <ProfilePage /> } },
  },
});

export const { TypedLink, useCurrentRoute, useTypedParams, useTypedRouter, useTypedSearchParams } = routes;
```

## 2. Generate the router

`toRouteObjects()` turns the tree into plain React Router `RouteObject[]` — the same data you'd otherwise hand-write:

```tsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { routes } from './routes';

const router = createBrowserRouter(routes.toRouteObjects());

export default function App() {
  return <RouterProvider router={router} />;
}
```

Because the result is ordinary data, generating it costs you no control — nest it under your own shell, add routes the tree doesn't know about, or filter it:

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

Every React Router route field on `_metadata` is forwarded to the generated route untouched:

| in `_metadata` | becomes |
| --- | --- |
| `element` / `Component` / `lazy` | this node's page. If the node has children, it moves into an `index` route so it still renders at the exact path |
| `layout` | wraps the node's children through `<Outlet />`. On a childless node it stands in for `element` |
| `loader` / `action` / `shouldRevalidate` / `handle` / `middleware` | forwarded to this node's page |
| `errorElement` / `ErrorBoundary` / `HydrateFallback` / `hydrateFallbackElement` / `caseSensitive` / `id` | forwarded to this node's route, not its page |
| `[id]` key | `path: ':id'` |
| `[...slug]` / `[[...slug]]` key | `path: '*'` — params still report `slug`, not `*` |
| `(group)` key | a pathless layout route |

Prefer not calling `toRouteObjects()` yourself? `<routes.TypedRoutes />` is a thin wrapper — it renders `useRoutes(routes.toRouteObjects())` for you, for use inside an existing `<BrowserRouter>`.

## 3. Navigate

```tsx
import { useTypedRouter } from './routes';

function Actions() {
  const router = useTypedRouter();

  router.push('/products/[id]', { params: { id: 42 } });
  router.replace('/products', { searchParams: { sort: 'price-asc' } });
  router.back();
  router.forward();
  router.refresh(); // re-navigates to the current entry, re-running loaders in a data router
}
```

`push`/`replace` require exactly the `params` and `searchParams` your tree declares for that pathname — see the project overview for the full list of what does and doesn't compile. `router.prefetch(...)` exists on the same object with the same typed signature, so navigation code ports to and from the Next.js adapter unchanged — but it's a no-op here, since React Router's library mode has no client-side prefetching.

## 4. Link

```tsx
import { TypedLink } from './routes';

<TypedLink href="/products/[id]" params={{ id: 42 }}>Detail</TypedLink>
<TypedLink href="/products" searchParams={{ sort: 'price-asc', page: 2 }} hash="top">Sorted</TypedLink>
```

`TypedLink` wraps React Router's `Link` and uses `href` instead of `to`, so this markup is identical to the Next.js adapter's. Every other prop (`className`, `replace`, `state`, …) is forwarded untouched.

## 5. Read the current route

```tsx
import { useTypedParams, useTypedSearchParams, useCurrentRoute } from './routes';

function ProductDetail() {
  const params = useTypedParams('/products/[id]');
  params.id; // string

  const { pathname, url, metadata } = useCurrentRoute();
  // on /products/42 → pathname: '/products/[id]', url: '/products/42'
}

function Products() {
  const searchParams = useTypedSearchParams('/products');
  searchParams.page; // number — ?page=2 really is 2 at runtime, not "2"
  searchParams.sort; // 'price-asc' | 'price-desc' | undefined
}
```

A dynamic segment reads back as a `string` unless it says otherwise. Give the segment's node a `paramSchema` — `'[id]': { _metadata: { title: 'Detail', paramSchema: z.number() } }` — and `params.id` is a `number`, validated, with `/products/abc` throwing `PathParamsParseError` instead of flowing in as a bad string. The name comes from the tree key, so the schema is bare rather than an object, and nested routes inherit it. It takes the same `onError` modes as `useTypedSearchParams`.

No Suspense boundary or client/server split to worry about here — `useTypedSearchParams` reads from React Router's `useLocation()` directly. See the project overview for the `onError` modes both hooks accept when a hand-edited URL fails validation. `useCurrentRouteNode()` and `useTypedPathname()` are also available if you only need the tree node or the declared pattern.

## Framework mode

This guide covers React Router's **library mode**, where your app owns the router configuration. In **framework mode** (`@react-router/dev`, an `app/routes.ts` config), `toRouteObjects()` is not usable: it emits `element` / `Component`, React elements resolved at runtime, while framework mode's `RouteConfigEntry` wants `file`, a module path it resolves at build time so it can code-split each route and generate its types.

Everything else about the tree carries over, because none of it depended on a router. Declare `file` on `_metadata` instead of `element`, and import from `@hyeonqyu/typed-router-core` rather than this package — the framework brings its own `<Link>` and hooks. [`examples/react-router-framework-example`](../../examples/react-router-framework-example) is a runnable version.

## Metadata

`title`, `label`, `description` and `accessible` may be plain values or functions of a context object; `resolveMetadata` (from `@hyeonqyu/typed-router-core`, re-exported here) resolves them. See the [project overview](../../README.md#route-metadata) for the full explanation, including `defineRoutes.withMeta`.

## Example

[`examples/react-example`](../../examples/react-example) is a complete app built on this guide — `yarn workspace react-example dev`.

## License

MIT
