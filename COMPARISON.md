# How typed-router compares

**English** | [한국어](./COMPARISON.ko.md)

Your realistic alternatives depend on which framework you're already on. Next owns routing, so everything you can reach for there is a typing layer over it. On React Router you can add types to the router you have, or swap the router out. Those are different decisions, and a single merged table would serve neither, so they're split:

- [If you're on Next.js](#if-youre-on-nextjs)
- [If you're on React Router](#if-youre-on-react-router)
- [Why not TanStack Router?](#why-not-tanstack-router)

The capability descriptions should stay accurate. Version numbers, release dates and download counts won't. Those were all checked on **2026-09-03**, and the date is repeated wherever they appear.

## What only typed-router does

Two things, among the libraries surveyed here.

### The tree you declare produces the router config

Plenty of tools add types to a router you already use. Only typed-router also builds that router's configuration. `toRouteObjects()` turns the tree into the array you hand `createBrowserRouter`, so there's no way for a route to exist in React Router without existing in the tree.

The others stop at typed path strings and leave the `<Route>` elements to you. Here's the pattern straight from `react-router-typesafe-routes`' own README:

```tsx
<Route path={root.user.$path()} element={<User />}>
```

The path string is safe. But nothing catches you if you forget one of these, or add one the tree never mentions.

### Metadata is typed per route, not per app

Every node's `_metadata` keeps its own shape, and it survives both direct access and enumeration:

```ts
routes.getMetadata('/products').icon   // string, inferred from this node
routes.getMetadata('/cart').icon       // compile error: /cart has no icon

for (const route of routes.collected) {
  route.metadata.title                 // still typed here too
}
```

That second case matters more than it looks. People attach metadata mostly to build menus, breadcrumbs and sitemaps, and all three walk the route list to do it. If the types fall away at that point, half the reason to attach it is gone.

The nearest equivalents elsewhere are global. TanStack Router's `staticData` is typed by a single `StaticDataRouteOption` interface shared by every route, so anything that varies per route has to be optional across the whole app.

## What typed-router doesn't do

It stays out of data entirely. No loaders, no caching, no revalidation, no Suspense integration, no code splitting, no loading or error UI. There is a `prefetch`, but on Next it just forwards to the host router and in React Router library mode it does nothing at all.

On Next you declare the tree by hand while `app/` is what actually gets served, so the two can drift apart. `assertRoutesMatchAppDir()` compares them in both directions, but it's a check you run in CI. The type system won't catch it on its own.

In React Router's **framework mode** (`@react-router/dev`), `toRouteObjects()` doesn't apply. It emits `element`, resolved at runtime, and framework mode wants `file`, a module path it resolves at build time. Driving the config from the tree still works and takes about fifteen lines. [The root README covers the split](./README.md#react-router-7-framework-mode), and `examples/react-router-framework-example` runs it.

It's also small: 288 downloads a week, against 31k–39k for the widely used alternatives (2026-09-03). That's a real gap in how much production traffic this code has seen.

## If you're on Next.js

Next owns the router, so everything here layers types on top of it.

| | how routes are declared | search params | path params | per-route metadata | tree ↔ `app/` check |
| --- | --- | --- | --- | --- | --- |
| Next's `typedRoutes` | generated from the filesystem | **untyped** | `string`, not validated | no | n/a |
| `nextjs-routes` | generated from the filesystem | untyped | typed, not validated | no | n/a |
| `pathpida` | generated from the filesystem (CLI) | only when building a URL | typed, not validated | no | n/a |
| `next-typesafe-url` | paths generated, schemas by hand | validated with Zod | validated with Zod | no | mostly covered |
| `next-safe-navigation` | by hand, flat | validated, Standard Schema | validated | no | no |
| **typed-router** | by hand, **nested tree** | validated, Standard Schema | **validated, schema per segment** | **yes, per node** | **yes, both directions** |

**Next's own `typedRoutes` is off by default, and stops at the pathname.** You turn it on with `typedRoutes: true` in `next.config`; the docs describe it as something you opt into. What it generates is easy to inspect — open `.next/types/routes.d.ts` in a built app:

```ts
"/products/[id]": { "id": string; }
searchParams: Promise<Record<string, string | string[] | undefined>>
```

Search params are a plain string map. The `href` side is the same story: Next's typegen source defines the query portion as `` `?${string}` ``, so anything you put there passes. Dynamic segments come through as `string` with no value checking. Which also means: if all you want is "does this pathname exist", `typedRoutes` already covers it and you don't need anything else.

**Search-param validation and drift checking rarely ship together.** `next-typesafe-url` does both, but hasn't released since 6.1.0 (2025-10-24), and its published `peerDependencies` read `next: ^13.4.12 || ^14.0.0 || ^15.0.0`, which puts Next 16 outside its declared range. `nextjs-routes` last released 2024-12-31, and its `nextRoutes()` wrapper installs the generator through `nextConfig.webpack` — a callback Next doesn't invoke under Turbopack. It does ship a CLI you can run yourself. `next-safe-navigation` last released 2025-06-24. `pathpida` is the most recent of the four (0.26.1, 2026-03-25) and types URL construction only.

Holding ourselves to the same standard: typed-router's Next package declares `next: ^13 || ^14 || ^15 || ^16`, while the example app and CI both run Next 15. A declared peer range is a claim, not a test. If we're going to press others on that, it applies here too.

## If you're on React Router

This is where the choice actually branches: type the router you have, or take a different one.

| | target router | builds the router config | search params | per-route metadata |
| --- | --- | --- | --- | --- |
| `react-router-typesafe-routes` | React Router | no, you write `<Route>` | Standard Schema / Zod / Yup, plus hash and state | no |
| `typesafe-routes` | router-agnostic | no | own parsers | no |
| `@zoontek/chicane` | its own router | n/a | strings | no |
| `type-route` | its own router | n/a | own types | no |
| **typed-router** | React Router 6/7 | **yes, `toRouteObjects()`** | validated, Standard Schema | **yes, per node** |

`react-router-typesafe-routes` is the strongest of the typing layers, and it covers ground typed-router doesn't: schemas reach the hash and `location.state`, and it handles relative paths for nested `<Routes>`. What it leaves alone is the router configuration. So you end up maintaining two artifacts — the typed tree, and the routes React Router actually serves — and keeping them in agreement is on you.

`@zoontek/chicane` and `type-route` put their own small router where React Router was. That's a different bargain: a coherently typed router, at the cost of React Router's ecosystem.

Where things stood on 2026-09-03:

| | weekly downloads | last release |
| --- | --- | --- |
| `react-router-typesafe-routes` | 31.4k | 2.2.1 (2025-07-21) |
| `typesafe-routes` | 7.0k | 12.3.0 (2025-08-12, commits through 2026-08) |
| `type-route` | 2.0k | 1.1.0 (2023-12-09) |
| `@zoontek/chicane` | 422 | 3.0.0 (2026-04-20) |
| typed-router | 288 | 2.1.0 (2026-09-02) |

## Why not TanStack Router?

They aren't the same kind of thing. TanStack Router is a router: loaders, caching, preloading, code splitting, pending and error boundaries, and search-param state handled by the router itself. typed-router is a typing and IA layer over a router you already have, and does none of what's on that list.

The adoption gap is just as lopsided. `@tanstack/react-router-devtools` sits at 3.3M downloads a week — that's the package to look at, since TanStack Start pulls the router in as a fixed dependency and inflates the router's own count. typed-router is at 288.

Whether it's a substitute for you comes down to three things.

**On Next.js it isn't on the table.** Next owns routing and TanStack doesn't ship an integration for it. `@tanstack/router-plugin` exports entry points for Vite, Rspack, esbuild and webpack, and none for Next or Turbopack. `@tanstack/react-start` requires `vite >=7` or `@rsbuild/core ^2` as peers. TanStack's only Next.js documentation is a guide for [migrating away from it](https://tanstack.com/start/latest/docs/framework/react/migrate-from-next-js), and step one is uninstalling Next.js. (Checked 2026-09-03 against `@tanstack/router-plugin` 1.168.35 and `@tanstack/react-start` 1.168.49.)

**On React Router the question is blast radius, not ambition.** Adopting TanStack Router means replacing your router and taking on its runtime and its concepts along with it. Adopting typed-router means React Router stays where it is and you add types and a declared information architecture on top. Nothing about rendering changes, which also makes it easy to pull back out.

**Metadata is typed differently.** TanStack's `staticData` is one interface shared app-wide. typed-router infers each route's metadata from that route's own declaration. If you're attaching an icon here, a permission there, a breadcrumb label somewhere else, that's the difference you'll notice.

## How this was checked

Everything above about typed-router was re-run against the code in this repository rather than carried over from an earlier draft:

- object and array search params round-tripping through `buildHref` → `parseSearchParams`
- `parseParams` coercing `/products/[id]` to a number and throwing `PathParamsParseError` on `abc`
- `routes.collected[n].metadata` staying typed under `tsc`
- `findRouteDrift` catching both a declared route with no page and a served page the tree never declared, against a real `app/` directory

Facts about the other libraries come from what they publish, not from their marketing pages. `peerDependencies` and release dates from the npm registry, commit dates from the GitHub API, `exports` maps read off the published packages, and for `nextjs-routes` and Next's typegen, the shipped source. Two commands get you most of it:

```bash
npm view <pkg> peerDependencies
gh api repos/<owner>/<repo>/commits?per_page=1
```

The claims that go stale fastest are "this library has stopped" and "this version isn't supported". If you're reading this well after 2026-09-03, check those before relying on them.
