# Comparison

**English** | [한국어](./COMPARISON.ko.md)

This page compares typed-router with libraries that solve similar problems, feature by feature. The realistic alternatives differ by framework, so [Next.js](#nextjs) and [React Router](#react-router) are covered separately. [TanStack Router](#tanstack-router), which is a router itself, has its own section.

typed-router adds types and route information to the router you already use. It does not provide data loading, caching, code splitting, or loading and error UI.

> We aim to keep this comparison accurate and fair, but it may miss details or fall behind recent releases. Check each library's own documentation as well. If something here is wrong, please [open an issue](https://github.com/hyeonQyu/typed-router/issues).
>
> Written on 2026-10-24 against the latest published version of each package. The versions compared are listed under [Versions compared](#versions-compared).

**Legend:** ✅ built in · 🟡 partial · 🛑 not supported · — not applicable

## Next.js

|  | typed-router | Next's built-in `typedRoutes` | nextjs-routes | pathpida | next-typesafe-url | next-safe-navigation |
| --- | --- | --- | --- | --- | --- | --- |
| App Router | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pages Router | ✅ | 🟡<sup>1</sup> | ✅ | ✅ | ✅ | 🛑 |
| Route definitions | declared (nested tree) | generated from the filesystem | generated from the filesystem | generated from the filesystem | paths generated, schemas written by hand | declared |
| Pathname type checking | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Path param types | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Path param runtime validation | ✅ | 🛑 | 🛑 | 🛑 | ✅ | ✅ |
| Search param types | ✅ | 🛑<sup>2</sup> | 🛑 | 🟡<sup>3</sup> | ✅ | ✅ |
| Search param runtime validation | ✅<sup>4</sup> | 🛑 | 🛑 | 🛑 | ✅ | ✅ |
| Schema library | Standard Schema | — | — | — | Zod | Standard Schema |
| Per-route metadata | ✅ | 🛑 | 🛑 | 🛑 | 🛑 | 🛑 |
| Declarations checked against the filesystem<sup>5</sup> | ✅<sup>6</sup> | — | — | — | 🟡<sup>7</sup> | 🛑 |
| Next 16 in `peerDependencies` | ✅<sup>8</sup> | — | ✅<sup>9</sup> | —<sup>10</sup> | 🛑 | ✅ |

1. `href` on `next/link` is checked on both routers. `next/router` methods (`push`, `replace`, and so on) on the Pages Router are not. Off by default; enable it with `typedRoutes: true` in `next.config`.
2. The query portion of `href` is typed as `` `?${string}` ``, so any query string is accepted. A page's `searchParams` is typed as `Record<string, string | string[] | undefined>`.
3. Types are checked when building a URL only. Reading the query is untyped.
4. A route can also declare key names only, with `searchParamKeys()`. Values are then read as strings without validation.
5. Libraries that generate routes from the filesystem cannot drift from it, so they are marked not applicable.
6. `assertRoutesMatchAppDir()` and `assertRoutesMatchPagesDir()` from `@hyeonqyu/typed-router-next/check` compare both directions. The check runs in tests or CI, not during type checking.
7. Paths are generated from the filesystem; search and path param schemas are written by hand in separate files.
8. The repository's examples and CI run on Next 15.
9. Declares `next: *`. The `nextRoutes()` config wrapper registers its generator through the webpack config callback, which Next does not call in Turbopack builds. A CLI is available for generating manually.
10. Declares no `peerDependencies`.

## React Router

|  | typed-router | react-router-typesafe-routes | typesafe-routes | @zoontek/chicane | type-route |
| --- | --- | --- | --- | --- | --- |
| Target router | React Router 6, 7 | React Router 7 | router-agnostic | its own router | its own router |
| Nested route declarations | ✅ | ✅ | ✅ | 🛑 | 🛑 |
| Pathname type checking | ✅ | ✅ | ✅ | ✅ | ✅ |
| Router config generation | ✅<sup>1</sup> | 🛑<sup>2</sup> | 🛑 | — | — |
| Search params | Standard Schema | Standard Schema, Zod, Yup<sup>3</sup> | own parsers | strings | own type definitions |
| Per-route metadata | ✅ | 🛑 | 🛑<sup>4</sup> | 🛑 | 🛑 |

1. `toRouteObjects()` builds the route array passed to `createBrowserRouter`. It does not apply in framework mode (`@react-router/dev`); building a `routes.ts` config from the route tree is covered in the [README](./README.md#react-router-7-framework-mode).
2. Provides typed path strings; `<Route>` elements are written by hand.
3. Schemas can also cover the hash and `location.state`. typed-router does not support this.
4. The type definitions include a `meta?: any` field, with no per-route type inference.

## TanStack Router

TanStack Router is a router; typed-router works on top of an existing one. Because they are different kinds of tools, the comparison is kept separate from the tables above.

|  | typed-router | TanStack Router |
| --- | --- | --- |
| Role | adds types to an existing router | router |
| Usable with Next.js | ✅ | 🛑<sup>1</sup> |
| Keeps React Router | ✅ | 🛑 (replaces the router) |
| Pathname and param type checking | ✅ | ✅ |
| Search param runtime validation | ✅ | ✅ |
| Data loading and caching | 🛑 | ✅ |
| Preloading | 🛑<sup>2</sup> | ✅ |
| Code splitting | 🛑 | ✅ |
| Loading and error UI | 🛑 | ✅ |
| Per-route metadata types | ✅ | 🟡<sup>3</sup> |

1. TanStack does not provide a Next.js integration. `@tanstack/router-plugin` exports entry points for Vite, Rspack, esbuild and webpack, and `@tanstack/react-start` requires `vite` or `@rsbuild/core` as a peer. TanStack's Next.js documentation is a [guide for migrating from Next.js to TanStack Start](https://tanstack.com/start/latest/docs/framework/react/migrate-from-next-js).
2. `prefetch` calls the Next router's prefetch on Next.js and does nothing in React Router library mode.
3. `staticData` is typed by a single `StaticDataRouteOption` interface shared by every route. Fields that differ between routes have to be declared optional on that interface.

## Versions compared

Latest npm releases as of 2026-10-24. Each entry was checked against the published package's entry points, `peerDependencies` and source, and against official documentation.

| Package | Version |
| --- | --- |
| `@hyeonqyu/typed-router-*` | 2.4.1 |
| `next` | 16.4.3 |
| `nextjs-routes` | 2.2.5 |
| `pathpida` | 0.28.0 |
| `next-typesafe-url` | 6.1.0 |
| `next-safe-navigation` | 0.4.0 |
| `react-router-typesafe-routes` | 2.2.1 |
| `typesafe-routes` | 12.3.0 |
| `@zoontek/chicane` | 3.0.0 |
| `type-route` | 1.1.0 |
| `@tanstack/react-router` | 1.170.46 |
