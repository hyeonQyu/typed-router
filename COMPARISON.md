# How typed-router compares

**English** | [한국어](./COMPARISON.ko.md)

There is no single table here, because there is no single comparison. If you are on Next.js, Next owns routing and every tool in reach is a typing layer on top of it. If you are on React Router, you can add types to the router you have, or replace the router outright. Those are different decisions with different candidates, so they get their own sections — [Next.js](#if-youre-on-nextjs), [React Router](#if-youre-on-react-router), and [TanStack Router](#why-not-tanstack-router), which belongs to neither list.

Capability claims below are written to stay true. Version numbers, release dates and download counts are not: they were checked on **2026-09-03** and are marked where they appear.

## What typed-router does that the others don't

Two things, in the libraries surveyed here.

**The declaration produces the router configuration.** Among tools that add types to a router you already use, typed-router is the only one that also emits that router's configuration. `toRouteObjects()` turns the tree into the array `createBrowserRouter` takes, so a route cannot exist in React Router without existing in the declaration. The other React Router tools give you typed path strings and leave the `<Route>` elements to you — `react-router-typesafe-routes` shows this in its own README, with `<Route path={root.user.$path()} element={<User />}>`. Nothing stops a `<Route>` you wrote by hand from having no counterpart in the typed tree.

**Metadata is typed per route, not per app.** Each node's `_metadata` keeps its own shape, and that shape survives both direct access and enumeration:

```ts
routes.getMetadata('/products').icon   // string — inferred from this node
routes.getMetadata('/cart').icon       // compile error — /cart declares no icon

for (const route of routes.collected) {
  route.metadata.title                 // still typed, not Record<string, unknown>
}
```

That second half matters more than it looks. Menus, breadcrumbs and sitemaps are the reason to attach metadata in the first place, and all three are built by walking the route list. The closest equivalents elsewhere are global: TanStack Router's `staticData` is typed by one `StaticDataRouteOption` interface that every route shares, so per-route fields have to be declared optional on the whole app.

## What typed-router does not do

It is a typing and information-architecture layer. It does no data loading — no loaders, no caching, no revalidation, no Suspense integration, no code splitting, and no loading or error UI. `prefetch` forwards to the host router's own prefetch on Next.js and is a no-op in React Router library mode; there is no prefetching of its own.

On Next.js the tree is hand-declared while `app/` is what actually gets served, so the two can disagree. `assertRoutesMatchAppDir()` reconciles them in both directions, but it is a check you run in CI, not something the type system enforces on its own.

In React Router's **framework mode** (`@react-router/dev`), `toRouteObjects()` is not usable — it emits `element` / `Component`, resolved at runtime, while framework mode wants `file`, a module path resolved at build time. The tree still drives the config, in about fifteen lines; [the root README explains the split](./README.md#react-router-7-framework-mode) and `examples/react-router-framework-example` runs it.

And it is small. 288 downloads a week against 31k–39k for the widely-used alternatives (2026-09-03). That is a real difference in how much production traffic has hit this code.

## If you're on Next.js

Next owns the router, so everything here adds types on top of it.

| | how routes are declared | search params | path params | per-route metadata | tree ↔ `app/` drift |
| --- | --- | --- | --- | --- | --- |
| Next's `typedRoutes` | generated from the filesystem | **untyped** | typed as `string`, not validated | — | n/a (filesystem *is* the tree) |
| `nextjs-routes` | generated from the filesystem | untyped bag | typed, not validated | — | n/a |
| `pathpida` | generated from the filesystem (CLI) | typed when writing a URL | typed, not validated | — | n/a |
| `next-typesafe-url` | paths generated, schemas hand-written | Zod, validated | Zod, validated | — | mostly prevented |
| `next-safe-navigation` | hand-declared, flat | Standard Schema, validated | validated | — | not checked |
| **typed-router** | hand-declared, **nested tree** | Standard Schema, validated | **schema per segment, validated** | **yes, per node** | **checked, both directions** |

**Next's own `typedRoutes` is opt-in, and stops at the pathname.** You set `typedRoutes: true` in `next.config`; the docs are explicit that it is something you opt into. What it then generates is checkable — in a built app, `.next/types/routes.d.ts` contains:

```ts
"/products/[id]": { "id": string; }
searchParams: Promise<Record<string, string | string[] | undefined>>
```

and the `href` type in Next's own typegen source defines the query portion as `` `?${string}` ``, so any query string at all satisfies it. Dynamic segments are typed as `string` and never validated. If you only need "this pathname exists", `typedRoutes` is enough and costs you nothing.

**Search-param validation and drift checking rarely come together.** `next-typesafe-url` is the one that does both, and it hasn't shipped since 6.1.0 (2025-10-24); its published `peerDependencies` are `next: ^13.4.12 || ^14.0.0 || ^15.0.0`, so Next 16 is outside its declared range. `nextjs-routes` last released 2024-12-31, and its `nextRoutes()` config wrapper installs its generator through `nextConfig.webpack`, which Next does not call under Turbopack — it also ships a CLI you can run yourself. `next-safe-navigation` last released 2025-06-24. `pathpida` is the most recently released of the four (0.26.1, 2026-03-25) and types URL construction only.

For the record on the same axis: typed-router's Next package declares `next: ^13 || ^14 || ^15 || ^16`, and its example app and CI run Next 15. A declared peer range is a claim, not a test — for us as much as for anyone.

## If you're on React Router

Here you have a real choice: type the router you have, or take a different router.

| | target router | generates the router config | search params | per-route metadata |
| --- | --- | --- | --- | --- |
| `react-router-typesafe-routes` | React Router | no — you write `<Route>` | Standard Schema / Zod / Yup, plus hash and state | — |
| `typesafe-routes` | router-agnostic | no | own parsers | — |
| `@zoontek/chicane` | its own router | n/a | strings | — |
| `type-route` | its own router | n/a | own types | — |
| **typed-router** | React Router 6/7 | **yes — `toRouteObjects()`** | Standard Schema, validated | **yes, per node** |

`react-router-typesafe-routes` is the most complete of the typing layers, and covers ground typed-router does not: the hash and `location.state` get schemas too, and it has relative-path handling for nested `<Routes>`. What it does not do is own the router configuration, so the tree it types and the routes React Router serves are two artifacts you keep in agreement by hand.

`@zoontek/chicane` and `type-route` replace React Router with a small router of their own, which is a different trade entirely — you get a coherent typed router and give up React Router's ecosystem.

Where things stood on 2026-09-03: `react-router-typesafe-routes` 31.4k downloads/week, last release 2.2.1 (2025-07-21); `typesafe-routes` 7.0k, 12.3.0 (2025-08-12, commits through 2026-08); `@zoontek/chicane` 422, 3.0.0 (2026-04-20); `type-route` 2.0k, 1.1.0 (2023-12-09); typed-router 288, 2.1.0 (2026-09-02).

## Why not TanStack Router?

The short answer is that they are not the same kind of thing. TanStack Router is a router: loaders, caching, preloading, code splitting, pending and error boundaries, and search-param state as a first-class router concern. typed-router is a typing and IA layer over a router you already have, and does none of that. It is also, by a wide margin, the more adopted of the two — `@tanstack/react-router-devtools`, the closest thing to an adoption signal that isn't inflated by TanStack Start pulling the router in as a fixed dependency, was at 3.3M downloads a week on 2026-09-03, against typed-router's 288.

Three things decide whether it is a substitute for you at all.

**On Next.js it is not an option.** Next owns routing, and TanStack does not ship an integration for it. `@tanstack/router-plugin` exports entry points for Vite, Rspack, esbuild and webpack, and none for Next or Turbopack. `@tanstack/react-start` requires `vite >=7` or `@rsbuild/core ^2` as peers. TanStack's only Next.js documentation is a guide for [migrating off it](https://tanstack.com/start/latest/docs/framework/react/migrate-from-next-js), which opens by telling you to uninstall Next.js. (Checked 2026-09-03 against `@tanstack/router-plugin` 1.168.35 and `@tanstack/react-start` 1.168.49.)

**On React Router the axis is blast radius, not ambition.** Adopting TanStack Router means replacing your router and taking on its runtime and its concepts; adopting typed-router means keeping React Router, adding types and a declared information architecture, and being able to delete it again without touching how anything renders.

**Metadata is typed differently.** TanStack's `staticData` is one shared interface across the whole app. typed-router infers each route's metadata from that route's own declaration. If you are attaching different fields to different routes — an icon here, a permission there, a breadcrumb label somewhere else — that difference is the one you will feel.

## How this was checked

Every claim above about typed-router was re-verified against the code in this repository, not taken from a previous draft: object and array search params round-tripping through `buildHref` → `parseSearchParams`, `parseParams` coercing `/products/[id]` to a number and throwing `PathParamsParseError` on `abc`, `routes.collected[n].metadata` staying typed under `tsc`, and `findRouteDrift` reporting a declared-but-missing route and an undeclared-but-served page from a real `app/` directory.

Competitor facts come from published artifacts rather than marketing pages: `peerDependencies` and release dates from the npm registry, commit dates from the GitHub API, `exports` maps read off the published packages, and — for `nextjs-routes` and Next's own typegen — the shipped source. Anything you want to re-check, you can, with `npm view <pkg> peerDependencies` and `gh api repos/<owner>/<repo>/commits?per_page=1`.

Dormancy and version-support claims are the ones that rot fastest. If you are reading this well after 2026-09-03, re-check those before relying on them.
