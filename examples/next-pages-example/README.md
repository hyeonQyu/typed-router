# next-pages-example

A Next.js **Pages Router** app built on `@hyeonqyu/typed-router-next/pages`.

```bash
yarn workspace next-pages-example dev   # http://localhost:3001
```

The route tree lives in [`src/shared/routes.ts`](./src/shared/routes.ts), declared with core's `defineRoutes` — standing in for a framework-free shared package several apps depend on. [`src/routes.ts`](./src/routes.ts) gives it this app's router with `bindRoutes`, and imports nothing from the package root, so `next/navigation` never reaches the bundle.

`src/pages/` mirrors the tree one for one, except `/blog`, which lives on another site: `src/routes.ts` attaches its URL and passes `useResolveHref`, so `push('/blog')` and `<TypedLink href="/blog">` go there. `tests/check-pages.test.ts` holds the tree and `src/pages/` together with `findPagesDirDrift`.

| page | shows |
| --- | --- |
| `/` | the derived `routes.paths`, `buildHref` outside any hook, and `push('/blog')` leaving the app |
| `/products?page=2&inStock=true` | search params coerced by the shared schema, behind a `<RouterReady>` boundary |
| `/products/42` | a statically optimized dynamic page: `id` arrives as a `number` once the router is ready |
| `/docs/a/b/c` | a `getServerSideProps` page, ready from the first render, so no gate |
