# How typed-router compares

**English** | [한국어](./COMPARISON.ko.md)

Your realistic alternatives depend on which framework you're already on. Next owns routing, so everything you can reach for there is a typing layer over it. On React Router you can add types to the router you have, or swap the router out. Those are different decisions, and a single merged table would serve neither, so they're split:

- [If you're on Next.js](#if-youre-on-nextjs)
- [If you're on React Router](#if-youre-on-react-router)
- [Why not TanStack Router?](#why-not-tanstack-router)

The capability descriptions should stay accurate. Version numbers, release dates and download counts won't. Those were all checked on **2026-10-24** against typed-router 2.4.1, and the date is repeated wherever they appear.

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

Every node's `_metadata` keeps its own shape, and it survives direct access, enumeration, and walking a single level:

```ts
routes.getMetadata('/products').icon   // string, inferred from this node
routes.getMetadata('/cart').icon       // compile error: /cart has no icon

for (const route of routes.collected) {
  route.metadata.title                 // still typed here too
}

Object.entries(children(routes.routes.support)).map(([key, node]) => node._metadata.title);
```

Enumeration matters more than it looks. People attach metadata mostly to build menus, breadcrumbs and sitemaps, and all three walk the tree to do it. If the types fall away at that point, half the reason to attach it is gone.

The nearest equivalents elsewhere are global. TanStack Router's `staticData` is typed by a single `StaticDataRouteOption` interface shared by every route, so anything that varies per route has to be optional across the whole app.

Because the metadata is separable, a monorepo can declare the structure once in a shared package and let each app attach its own metadata by pathname — translation keys in one app, lazily loaded elements in another, from the same tree. `attachMetadata()` keeps the attached values typed per route, and rejects a pathname the shared tree doesn't declare both at compile time and at runtime, so deleting a shared route breaks every app still pointing at it. None of the alternatives have metadata to share in the first place.

## What typed-router doesn't do

It stays out of data entirely. No loaders, no caching, no revalidation, no Suspense integration, no code splitting, no loading or error UI. There is a `prefetch`, but on Next it just forwards to the host router and in React Router library mode it does nothing at all.

On Next you declare the tree by hand while the filesystem is what actually gets served, so the two can drift apart. `assertRoutesMatchAppDir()` and `assertRoutesMatchPagesDir()` compare them in both directions, but they're checks you run in CI. The type system won't catch it on its own.

In React Router's **framework mode** (`@react-router/dev`), `toRouteObjects()` doesn't apply. It emits `element`, resolved at runtime, and framework mode wants `file`, a module path it resolves at build time. Driving the config from the tree still works and takes about fifteen lines. [The root README covers the split](./README.md#react-router-7-framework-mode), and `examples/react-router-framework-example` runs it.

It's also small: about 200 downloads a week, against 17k–27k for the widely used alternatives (2026-10-24). That's a real gap in how much production traffic this code has seen.

## If you're on Next.js

Next owns the router, so everything here layers types on top of it.

| | Next routers | routes declared by | search params | path params | per-route metadata | drift check |
| --- | --- | --- | --- | --- | --- | --- |
| Next's `typedRoutes` | App + Pages, partly | the filesystem | **untyped** | `string`, not validated | no | n/a |
| `nextjs-routes` | App + Pages | the filesystem | untyped | typed, not validated | no | n/a |
| `pathpida` | App + Pages | the filesystem (CLI) | only when building a URL | typed, not validated | no | n/a |
| `next-typesafe-url` | App + Pages | paths generated, schemas by hand | validated with Zod | validated with Zod | no | mostly covered |
| `next-safe-navigation` | **App only** | by hand, flat | validated, Standard Schema | validated | no | no |
| **typed-router** | App + Pages | by hand, **nested tree** | validated, or **just key names** | **validated, schema per segment** | **yes, per node** | **yes, both directions, both routers** |

The generators get "n/a" for drift because they read the filesystem, so there's nothing to drift from. That's a genuine advantage of their approach, and the reason typed-router needs a check at all.

**Next's own `typedRoutes` is off by default, and stops at the pathname.** You turn it on with `typedRoutes: true` in `next.config`; the docs describe it as something you opt into. It types the `href` on `next/link` in both routers, and on the App Router it also types `next/navigation`'s `push`, `replace` and `prefetch` — but it does not type `next/router`'s methods on the Pages Router, which is the "partly" in the table. What it generates is easy to inspect — open `.next/types/routes.d.ts` in a built app:

```ts
"/products/[id]": { "id": string; }
searchParams: Promise<Record<string, string | string[] | undefined>>
```

Search params are a plain string map. The `href` side is the same story: Next's typegen source defines the query portion as `` `?${string}` ``, so anything you put there passes. Dynamic segments come through as `string` with no value checking. Which also means: if all you want is "does this pathname exist", `typedRoutes` already covers it and you don't need anything else.

**You don't need a schema library to get typed query keys.** This used to be the trade in the search-param column — an untyped bag on one side, a Zod dependency on the other. `searchParamKeys<'redirectUrl'>()` declares the names and nothing else: unknown keys are a compile error, values go in as plain text, and reading returns `string | string[]`, the shape a raw query already has. Nothing is coerced or rejected, and it's a plain Standard Schema, so swapping in a real validator later is a one-line change.

**Search-param validation and a drift check rarely ship together.** `next-typesafe-url` does both, but hasn't released since 6.1.0 (2025-10-24), and its published `peerDependencies` read `next: ^13.4.12 || ^14.0.0 || ^15.0.0`, which puts Next 16 outside its declared range. `nextjs-routes` last released 2024-12-31, and its `nextRoutes()` wrapper installs the generator through `nextConfig.webpack` — a callback Next doesn't invoke under Turbopack. It does ship a CLI you can run yourself. `next-safe-navigation` last released 2025-06-24 and only imports `next/navigation`, so it's App Router only. `pathpida` is the most actively released of the four (0.28.0, 2026-10-03) and types URL construction only.

Holding ourselves to the same standard: typed-router's Next package declares `next: ^13 || ^14 || ^15 || ^16`, while the examples and CI run Next 15. A declared peer range is a claim, not a test. If we're going to press others on that, it applies here too.

## If you're on React Router

This is where the choice actually branches: type the router you have, or take a different one.

| | target router | builds the router config | search params | per-route metadata |
| --- | --- | --- | --- | --- |
| `react-router-typesafe-routes` | React Router | no, you write `<Route>` | Standard Schema / Zod / Yup, plus hash and state | no |
| `typesafe-routes` | router-agnostic | no | own parsers | no |
| `@zoontek/chicane` | its own router | n/a | strings | no |
| `type-route` | its own router | n/a | own types | no |
| **typed-router** | React Router 6/7 | **yes, `toRouteObjects()`** | validated, or just key names | **yes, per node** |

`react-router-typesafe-routes` is the strongest of the typing layers, and it covers ground typed-router doesn't: schemas reach the hash and `location.state`, and it handles relative paths for nested `<Routes>`. What it leaves alone is the router configuration. So you end up maintaining two artifacts — the typed tree, and the routes React Router actually serves — and keeping them in agreement is on you.

`@zoontek/chicane` and `type-route` put their own small router where React Router was. That's a different bargain: a coherently typed router, at the cost of React Router's ecosystem.

Where things stood on 2026-10-24:

| | weekly downloads | last release |
| --- | --- | --- |
| `nextjs-routes` | 27.3k | 2.2.5 (2024-12-31) |
| `pathpida` | 19.0k | 0.28.0 (2026-10-03) |
| `react-router-typesafe-routes` | 17.0k | 2.2.1 (2025-07-21) |
| `next-typesafe-url` | 8.2k | 6.1.0 (2025-10-24) |
| `typesafe-routes` | 4.1k | 12.3.0 (2025-08-12, commits through 2026-08) |
| `type-route` | 2.5k | 1.1.0 (2023-12-09) |
| `next-safe-navigation` | 1.8k | 0.4.0 (2025-06-24) |
| `@zoontek/chicane` | 482 | 3.0.0 (2026-04-20) |
| typed-router | ~200 | 2.4.1 (2026-10-18) |

## Why not TanStack Router?

They aren't the same kind of thing. TanStack Router is a router: loaders, caching, preloading, code splitting, pending and error boundaries, and search-param state handled by the router itself. typed-router is a typing and IA layer over a router you already have, and does none of what's on that list.

The adoption gap is just as lopsided. `@tanstack/react-router-devtools` sits at 2.6M downloads a week — that's the package to look at, since TanStack Start pulls the router in as a fixed dependency and inflates the router's own count. typed-router is at about 200.

Whether it's a substitute for you comes down to three things.

**On Next.js it isn't on the table.** Next owns routing and TanStack doesn't ship an integration for it. `@tanstack/router-plugin` exports entry points for Vite, Rspack, esbuild and webpack, and none for Next or Turbopack. `@tanstack/react-start` requires `vite >=8` or `@rsbuild/core ^2` as peers. TanStack's only Next.js documentation is a guide for [migrating away from it](https://tanstack.com/start/latest/docs/framework/react/migrate-from-next-js), and step one is uninstalling Next.js. (Checked 2026-10-24 against `@tanstack/router-plugin` 1.168.48 and `@tanstack/react-start` 1.169.4.)

**On React Router the question is blast radius, not ambition.** Adopting TanStack Router means replacing your router and taking on its runtime and its concepts along with it. Adopting typed-router means React Router stays where it is and you add types and a declared information architecture on top. Nothing about rendering changes, which also makes it easy to pull back out.

**Metadata is typed differently.** TanStack's `staticData` is one interface shared app-wide. typed-router infers each route's metadata from that route's own declaration. If you're attaching an icon here, a permission there, a breadcrumb label somewhere else, that's the difference you'll notice.

## How this was checked

Everything above about typed-router was re-run against the code in this repository at 2.4.1, rather than carried over from an earlier draft:

- object and array search params round-tripping through `buildHref` → `parseSearchParams`
- `parseParams` coercing `/products/[id]` to a number and throwing `PathParamsParseError` on `abc`
- `routes.collected[n].metadata` and `children(node)` both staying typed under `tsc`
- `searchParamKeys` rejecting an undeclared key and an object value at compile time, and reading values back as strings
- `attachMetadata` keeping attached metadata typed and rejecting an unknown pathname at compile time and at runtime
- `findRouteDrift` and `findPagesDirDrift` each catching a declared route with no page and a served page the tree never declared, against real `app/` and `pages/` directories

Facts about the other libraries come from what they publish, not from their marketing pages. `peerDependencies` and release dates from the npm registry, commit dates from the GitHub API, `exports` maps read off the published packages, and for `nextjs-routes` and Next's typegen, the shipped source. Which router each one supports was read the same way — from its entry points and whether it imports `next/router`, `next/navigation` or both. Two commands get you most of it:

```bash
npm view <pkg> peerDependencies
gh api repos/<owner>/<repo>/commits?per_page=1
```

The claims that go stale fastest are "this library has stopped" and "this version isn't supported". Download counts move too — every figure here fell by roughly a third between 2026-09-03 and 2026-10-24, which says more about the registry's counting than about any of these libraries. If you're reading this well after 2026-10-24, check before relying on it.
