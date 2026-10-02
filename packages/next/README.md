# @hyeonqyu/typed-router-next

[한국어](./README.ko.md)

Type-safe routing for the Next.js App Router and Pages Router. Sections 1–7 cover the App Router; [section 9](#9-the-pages-router) covers the Pages Router, which has the same surface on its own entry point. If you're new to typed-router, [the project overview](../../README.md) covers why it exists and how the route tree works in general — this doc is the complete, Next-specific guide: install → declare → use, nothing else required.

```bash
npm install @hyeonqyu/typed-router-next zod
```

## 1. Declare your tree

Keys are path segments, so the tree mirrors your `src/app/` directory one for one — `[id]`, `[...slug]` and `(group)` mean exactly what they mean in Next.js. The root, `app/page.tsx`, is the empty key `''`; you still reach it as `routes.buildHref('/')`.

```ts
// routes.ts
import { defineRoutes } from '@hyeonqyu/typed-router-next';
import { z } from 'zod';

export const routes = defineRoutes({
  home: {
    _metadata: { title: 'Home' },
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
  '(account)': {
    // a route group: organises the tree, adds nothing to the URL
    profile: { _metadata: { title: 'Profile' } },
  },
});

export const { TypedLink, useCurrentRoute, useTypedParams, useTypedRouter, useTypedSearchParams } = routes;
```

Your `src/app/` folders — `home/`, `products/`, `products/[id]/`, `(account)/profile/` — stay exactly as Next.js expects. `routes` doesn't render anything; it only describes the shape you already have.

## 2. Navigate

```tsx
'use client';
import { useTypedRouter } from './routes';

function Actions() {
  const router = useTypedRouter();

  router.push('/products/[id]', { params: { id: 42 }, scroll: false }); // Next's `scroll` option, alongside params/searchParams
  router.replace('/products', { searchParams: { sort: 'price-asc' } });
  router.prefetch('/products/[id]', { params: { id: 42 } });
  router.back();
  router.forward();
  router.refresh();
}
```

`push`/`replace`/`prefetch` require exactly the `params` and `searchParams` your tree declares for that pathname — see the project overview for the full list of what does and doesn't compile.

## 3. Link

```tsx
import { TypedLink } from './routes';

<TypedLink href="/products/[id]" params={{ id: 42 }}>Detail</TypedLink>
<TypedLink href="/products" searchParams={{ sort: 'price-asc', page: 2 }} hash="top">Sorted</TypedLink>
```

`TypedLink` wraps `next/link` and forwards every other prop (`className`, `prefetch`, `scroll`, …) untouched.

## 4. Read the current route

```tsx
'use client';
import { useTypedParams, useCurrentRoute } from './routes';

function ProductDetail() {
  const params = useTypedParams('/products/[id]');
  params.id; // string

  const { pathname, url, metadata } = useCurrentRoute();
  // on /products/42 → pathname: '/products/[id]', url: '/products/42'
}
```

A dynamic segment reads back as a `string` unless it says otherwise. Give the segment's node a `paramSchema` — `'[id]': { _metadata: { title: 'Detail', paramSchema: z.number() } }` — and `params.id` is a `number`, validated, with `/products/abc` throwing `PathParamsParseError` instead of flowing in as a bad string. The name comes from the tree key, so the schema is bare rather than an object, and nested routes inherit it. It takes the same `onError` modes as `useTypedSearchParams`.

`useCurrentRouteNode()` and `useTypedPathname()` are also available if you only need the tree node or the declared pattern.

## 5. Read search params — and the Suspense rule

```tsx
'use client';
import { Suspense } from 'react';
import { useTypedSearchParams } from './routes';

export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductsView />
    </Suspense>
  );
}

function ProductsView() {
  const searchParams = useTypedSearchParams('/products');
  searchParams.page; // number — ?page=2 really is 2 at runtime, not "2"
  searchParams.sort; // 'price-asc' | 'price-desc' | undefined
}
```

`useTypedSearchParams` builds on Next's `useSearchParams`, which opts a page out of static prerendering — Next requires a `<Suspense>` boundary around any component that calls it, the same rule as calling `useSearchParams` directly. Skip the split above and Next's build will tell you exactly where. See [`examples/next-example/src/app/products/page.tsx`](../../examples/next-example/src/app/products/page.tsx) for the full pattern, and the project overview for the `onError` modes this hook accepts.

## 6. Server components and non-hook use

`routes` is plain data, so importing it from a server component is safe. Only the hooks are client-side:

```ts
// app/page.tsx — a server component
import { redirect } from 'next/navigation';
import { routes } from './routes';

export default function Index() {
  redirect(routes.buildHref('/home'));
}
```

Calling a hook like `useTypedSearchParams` from a server component fails exactly the way calling `useSearchParams` there would — the client-only code lives behind its own `'use client'` boundary, so it never leaks into your server bundle just because you imported `routes`.

## 7. Keep the tree and `src/app/` in step

The tree gives you typed pathnames, but on the App Router it is `src/app/` that decides which routes actually exist. Nothing in the type system connects the two: delete a page and links to it still compile, then 404. Add a page without declaring it and the route is live but missing from `routes.paths`.

`assertRoutesMatchAppDir` closes that gap. It reads the filesystem, so it ships on its own entry point and never reaches your browser bundle:

```ts
// routes.test.ts
import { assertRoutesMatchAppDir } from '@hyeonqyu/typed-router-next/check';
import { routes } from './routes';

test('the route tree matches src/app', () => {
  assertRoutesMatchAppDir(routes, 'src/app');
});
```

A failure names both directions — routes whose page is gone, and pages the tree never declared. `findRouteDrift` returns the same information as data (`{ missingFromAppDir, missingFromTree, inSync }`) when you would rather report than throw.

Next's own conventions are read the way Next reads them, so they never raise a false alarm. Route groups `(shop)` and parallel-route slots `@modal` add no URL segment, but pages *under* them do — `dashboard/@team/settings/page.tsx` is checked as `/dashboard/settings`, because that is the route Next actually serves. Intercepting routes (`(.)`, `(..)`, `(...)`), private folders (`_folder`) and every non-page file — `route.ts`, `default.tsx`, `layout.tsx`, `loading.tsx` and the rest — address no pathname of their own and are ignored entirely. Pass `pageExtensions` if you have configured Next's, and `ignore` for pathnames you want left alone:

```ts
assertRoutesMatchAppDir(routes, 'src/app', {
  ignore: ['/admin/*', '/coming-soon'],
  pageExtensions: ['mdx', 'tsx'],
});
```

This is opt-in by design. A check that blocks your build gets switched off; a check that fails in your own test suite is tuned by the person who knows the app. The React Router adapter needs none of this — `toRouteObjects()` builds the router *from* the tree, so a route there cannot exist without being declared.

## 8. A tree declared elsewhere — `bindRoutes`

A tree can live in a shared package that several apps depend on, declared with `@hyeonqyu/typed-router-core` so it carries no framework. `bindRoutes` gives such a tree this adapter's hooks and `TypedLink` without declaring it again:

```ts
// routes.ts
import { bindRoutes } from '@hyeonqyu/typed-router-next';
import { routes as shared } from '@acme/shop-routes'; // declared with core's defineRoutes

export const routes = bindRoutes(shared);
export const { TypedLink, useTypedRouter, useTypedParams, useTypedSearchParams, useCurrentRoute } = routes;
```

It takes any core route tree — including one that went through core's `attachMetadata` — and reuses its paths and parsers as they are. When the app also attaches metadata, `attachMetadata` from this package does both steps at once.

### Routes that live elsewhere — `useResolveHref`

Some entries belong in the tree, because menus, breadcrumbs and access rules are built from it, yet are served somewhere else: a blog on another domain, a support portal. Give `bindRoutes` a `useResolveHref` hook and `push`, `replace`, `prefetch` and `TypedLink` ask its resolver before building the route's own href:

```ts
// routes.ts
import { attachMetadata } from '@hyeonqyu/typed-router-core';
import { bindRoutes } from '@hyeonqyu/typed-router-next';
import { useCallback } from 'react';
import { routes as shared } from '@acme/shop-routes';
import { useLocale } from './locale';

const linked = attachMetadata(shared).withMeta<{ href?: (context: { language: string }) => string }>()({
  '/blog': { href: ({ language }) => `https://blog.example.com/${language}` },
});

export const routes = bindRoutes(linked, {
  useResolveHref: () => {
    const { language } = useLocale();
    return useCallback(({ metadata }) => (typeof metadata.href === 'function' ? metadata.href({ language }) : undefined), [language]);
  },
});
```

- The resolver receives `{ pathname, metadata, params, searchParams, hash }`. Return a URL to go there, or `undefined` to keep the route's own href. The library reads no metadata key: `href` above is the app's own field.
- An absolute URL needs nothing special. `push` hard-navigates to it, `TypedLink` renders a plain anchor, and `prefetch` skips it.
- Because it is a hook, the resolver can depend on the locale or any other context. Return the same function across renders (`useCallback`): `useTypedRouter` hands out a new router object whenever it changes.
- With the option set, `TypedLink` runs the hook too, so render it from client components. Without the option nothing changes.
- `bindRoutes` from `/pages` takes the same option. The drift checks still see the route, so list it under `ignore`.

## 9. The Pages Router

`@hyeonqyu/typed-router-next/pages` is the same surface backed by `next/router`: `defineRoutes`, `attachMetadata`, `bindRoutes`, the same hooks with the same arguments, `TypedLink`, and the same re-exports. Import everything from it. It never loads the package root, so `next/navigation` never reaches a Pages Router bundle.

```ts
// routes.ts
import { bindRoutes } from '@hyeonqyu/typed-router-next/pages';
import { routes as shared } from '@acme/shop-routes';

export const { TypedLink, useTypedRouter, useTypedParams, useTypedSearchParams, useCurrentRoute } = bindRoutes(shared);
```

Keys mirror `pages/`: `pages/products/[id].tsx` is `products: { '[id]': { _metadata: {} } }`, and `pages/index.tsx` is the empty key `''`. The current route is `router.pathname`, the page Next actually rendered, so it stays right under rewrites. `useTypedParams` checks it just as on the App Router and throws `RouteMismatchError` on a mismatch.

Three things differ from the App Router:

- **`<RouterReady>` takes the place of `<Suspense>`.** A page without `getServerSideProps` is prerendered with an empty `router.query` and learns its query string after hydration — and, on a statically optimized dynamic route, its segments too. Until then `useTypedSearchParams`, and `useTypedParams` wherever a segment is still missing, throw `RouteNotReadyError` instead of returning defaults the URL may contradict. Wrap those components in `RouterReady`, or gate them on `useRouterReady()`:

  ```tsx
  import { RouterReady } from '@hyeonqyu/typed-router-next/pages';

  <RouterReady fallback={<Spinner />}>
    <ProductsView />
  </RouterReady>
  ```

  Don't gate on `router.isReady` directly. On a statically rendered page with no query string it is `false` in the prerendered HTML and already `true` on the first client render, so `isReady ? <View /> : null` fails hydration. `useRouterReady()` stays `false` until hydration is over. `getServerSideProps` pages are ready from the first render and need no boundary. `useCurrentRoute`, `useTypedPathname` and `useCurrentRouteNode` never throw for this — the page is known before hydration.
- **`push` and `replace` take `shallow` too**, and return `next/router`'s promise.
- **`refresh()` re-navigates to the current URL** (`router.replace(router.asPath)`), which runs the page's data fetching again while keeping client state. The Pages Router has no `refresh` of its own.

The drift check has a `pages/` counterpart:

```ts
import { assertRoutesMatchPagesDir } from '@hyeonqyu/typed-router-next/check';

test('the route tree matches src/pages', () => {
  assertRoutesMatchPagesDir(routes, 'src/pages');
});
```

It reads `pages/` the way Next does. Every page file is a route, and an `index` file serves its folder. `_app`, `_document`, `_error`, `404`, `500` and `api/` at the root are skipped. `(group)`, `@slot` and `_folder` are ordinary segments there, because they are App Router conventions. `findPagesDirDrift` returns `{ missingFromPagesDir, missingFromTree, inSync }`, and `ignore` and `pageExtensions` work as above, with the longest extension matching first, so `pageExtensions: ['page.tsx']` reads `about.page.tsx` as `/about`.

## Metadata

`title`, `label`, `description` and `accessible` may be plain values or functions of a context object; `resolveMetadata` (from `@hyeonqyu/typed-router-core`, re-exported here) resolves them. See the [project overview](../../README.md#route-metadata) for the full explanation, including `defineRoutes.withMeta`.

## Example

[`examples/next-example`](../../examples/next-example) is a complete App Router app built on this guide — `yarn workspace next-example dev`. [`examples/next-pages-example`](../../examples/next-pages-example) is its Pages Router counterpart, binding a tree declared with core — `yarn workspace next-pages-example dev`.

## License

MIT
