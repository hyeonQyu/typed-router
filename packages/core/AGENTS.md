# @hyeonqyu/typed-router-core — agent guide

**Mental model:** the route tree object is the source of truth for the application's information
architecture — its pathnames, path params, search-param types, route metadata and navigation are all
*derived* from that one declaration and checked by the compiler. You declare the whole IA once as a
nested object literal. This is not a path-constant generator — if you hand-write a URL string or keep
a parallel `PATHS` list anywhere, you have defeated the entire point of the library.

Whether the tree also decides which routes *exist* depends on the adapter, and the core package alone
cannot answer it. Under `@hyeonqyu/typed-router-react`, `toRouteObjects()` builds the router from the
tree, so nothing can exist outside it. Under `@hyeonqyu/typed-router-next`, the `app/` directory
decides route existence and the tree mirrors it by hand; the compiler does not check the two agree,
so that adapter ships `assertRoutesMatchAppDir` on its own `/check` entry point to verify it in a
test. The core package never touches the filesystem, so it derives types and metadata from what you
declared and makes no claim about what is actually routable.

## Most apps should install an adapter, not this package

- **Next.js App Router** → [`@hyeonqyu/typed-router-next`](https://www.npmjs.com/package/@hyeonqyu/typed-router-next)
- **React Router 6/7** → [`@hyeonqyu/typed-router-react`](https://www.npmjs.com/package/@hyeonqyu/typed-router-react)

The adapters re-export most of this surface, so a consumer imports from **one** package only. Import
`@hyeonqyu/typed-router-core` directly only when there is no router: server / edge handlers, CLIs,
tests, link generation for emails or sitemaps, or when writing your own adapter.

`zod` is an **optional** peer dependency (`^3.24.0 || ^4.0.0`). Schemas are matched structurally, so
Zod v3, Zod v4 and any [Standard Schema](https://standardschema.dev) validator work, and a tree with no
schemas needs no validator at all. Never import `zod` inside library-facing types.

## Segment key syntax (mirrors Next.js)

| Key | Meaning | Example path |
| --- | --- | --- |
| `products` | static segment | `/products` |
| `'[id]'` | dynamic segment | `/products/[id]` |
| `'[...slug]'` | catch-all (1+ segments, required) | `/docs/[...slug]` |
| `'[[...path]]'` | optional catch-all (0+ segments) | `/files/[[...path]]` |
| `'(shop)'` | route group — organises the tree, **contributes no URL segment** | children sit at `/…` |
| `_metadata` | reserved key; a node is a navigable destination **only if it has one** | — |

## Minimal correct setup, end to end

```ts
// src/routes.ts
import { defineRoutes, type Params, type Pathname, type SearchParams } from '@hyeonqyu/typed-router-core';
import { z } from 'zod';

export const routes = defineRoutes({
  home: { _metadata: { title: 'Home' } },
  // Route group: organises the IA, adds nothing to the URL.
  '(shop)': {
    products: {
      _metadata: {
        title: 'Products',
        searchParamsSchema: z.object({
          page: z.number().default(1),
          sort: z.enum(['price-asc', 'name']).optional(),
          tags: z.array(z.string()).optional(),
        }),
      },
      '[id]': {
        _metadata: { title: 'Product detail' },
        reviews: { _metadata: { title: 'Reviews', searchParamsSchema: z.object({ star: z.number() }) } },
      },
    },
    cart: { _metadata: { title: 'Cart' } },
  },
  docs: { '[...slug]': { _metadata: { title: 'Docs' } } },
  files: { '[[...path]]': { _metadata: { title: 'Files' } } },
  // No `_metadata` → namespaces its children, but `/internal` itself is NOT a destination.
  internal: { stats: { _metadata: { title: 'Stats' } } },
});

// Derived types — never write these unions by hand.
export type AppPath = Pathname<typeof routes>;          // or: typeof routes.$types.pathname
export type ProductsSearch = SearchParams<typeof routes, '/products'>;
export type ProductParams = Params<typeof routes, '/products/[id]'>;   // { id: string } here — see below
```

To type a dynamic segment as something other than text, put a `paramSchema` on the node whose key *is*
that segment. The name comes from the key, so only the type is written down, and nested routes inherit it:

```ts
'[id]': {
  _metadata: { title: 'Product detail', paramSchema: z.number() },
  reviews: { _metadata: { title: 'Reviews' } },   // inherits id: number
},
```

`Params<typeof routes, '/products/[id]/reviews'>` is then `{ id: number }`. A segment with no
`paramSchema` stays `string` (`string[]` for a catch-all), so this is opt-in per segment.

`defineRoutes` takes **no generics and no currying**, returns a plain module-level object, and needs no
provider. Export it and import it directly wherever you need a URL.

## Common operations

**Build a URL** — the only sanctioned way to produce one.

```ts
routes.buildHref('/cart');                                                   // '/cart' (options object omitted)
routes.buildHref('/products/[id]', { params: { id: 42 } });                  // '/products/42'
routes.buildHref('/products', { searchParams: { sort: 'name', tags: ['a'] } }); // '/products?sort=name&tags=a'
routes.buildHref('/products/[id]/reviews', { params: { id: 'abc' }, searchParams: { star: 5 }, hash: 'top' });
routes.buildHref('/docs/[...slug]', { params: { slug: ['guide', 'intro'] } }); // '/docs/guide/intro'
routes.buildHref('/files/[[...path]]');                                       // '/files' — optional catch-all
```

`params` is **required** when the path has a required dynamic or catch-all segment, **optional** when its
only dynamic segment is an optional catch-all (`[[...path]]`), and **forbidden** (`?: never`) when the path
is fully static. `searchParams` is typed from the schema's *input*, so `.default()` fields stay optional,
and follows the same three-way rule against the schema: required if the schema has a required field,
optional if every field is optional, forbidden when the route declares no schema.

**How values reach the URL.** A path segment carries text only — a `string`, `number`, `boolean`,
`bigint` or `Date` (ISO). Search params are encoded by what can be read back:

| written value | query string | read back as |
| --- | --- | --- |
| `string` / `number` / `boolean` / `bigint` | its plain text form | whatever the field's schema accepts |
| `Date` | ISO 8601 | a `string` — declare the field `z.coerce.date()` to get a `Date` |
| `['a', 'b']` — flat array | `?k=a&k=b`, one entry per item | the array, unchanged |
| `{ min: 1, max: 9 }` — object | JSON, URL-encoded | the object |
| `[[1, 2], [3]]` — nested array | JSON per item | the nested array |

Objects and nested arrays round-trip: `parseSearchParams` reads back what `buildHref` wrote. Flat
arrays of primitives are unaffected, and a raw string is still the first reading tried, so a
`z.string()` field holding `'{"a":1}'` keeps it as a string.

A value may declare its own text form: an own `toJSON` drives the JSON encoding, and an overridden
`toString` is taken as the text the author meant, so value objects and boxed primitives serialise as
they always have. The inherited `Object.prototype.toString` is not a declaration.

Anything with no faithful text form — `NaN`, `Infinity`, a symbol, a function, an invalid `Date`, a
`Map`/`Set`, a cyclic object — **throws** (`... cannot be serialised (...)`) instead of writing
`[object Object]` into the URL. Declare `Date` fields as `z.coerce.date()`; a plain `z.date()`
cannot read back the ISO string `buildHref` writes.

**Match a live URL back to a declared route.**

```ts
const match = routes.match('/products/123/reviews?star=5#top');
// { path: '/products/[id]/reviews', params: { id: '123' }, node, metadata } | null
```

`match.path` is a plain `string` and `params` is `Record<string, string | string[]>` — matching is a
runtime operation, so it is **not** narrowed to the pathname union. Narrow it yourself. `match` does no
schema validation either; feed its `params` to `parseParams` for that.

**Parse path params through each segment's own schema.**

```ts
routes.parseParams('/products/[id]', { id: '42' });                            // { id: 42 } if [id] declares z.number()
routes.parseParams('/products/[id]', { id: 'abc' });                           // throws PathParamsParseError
routes.parseParams('/products/[id]', { id: 'abc' }, { onError: 'default' });   // {} — drop the bad segment
routes.parseParams('/products/[id]', { id: 'abc' }, { onError: 'raw' });       // { id: 'abc' } — the raw segment, not thrown

const match = routes.match(url);
if (match) routes.parseParams(match.path as AppPath, match.params);
```

Same three `onError` modes as `parseSearchParams`, with the same meanings. `PathParamsParseError.param`
names the segment that failed. Segments with no `paramSchema` pass through as the strings they are, so a
route that declares nothing behaves exactly as it did before schemas existed. Catch-alls are validated as
the whole list they read back as (`z.array(z.number())`, not `z.number()`), and an optional catch-all that
matched nothing is validated against `undefined`, so `.default([])` and `.optional()` both work.

**Parse search params through the route's own schema.**

```ts
routes.parseSearchParams('/products', { page: '2', tags: ['a', 'b'] });        // { page: 2, tags: ['a','b'] }
routes.parseSearchParams('/products', new URLSearchParams('page=3&tags=a&tags=b'));
routes.parseSearchParams('/products', { sort: 'nonsense' }, { onError: 'default' }); // drop bad fields
routes.parseSearchParams('/products', { page: 'nope' }, { onError: 'raw' });         // the coerced values, not thrown
```

Accepts a `Record<string, string | string[]>`, a `URLSearchParams`, or any iterable of entries
(repeated keys fold into arrays). Returns the schema **output** type — defaults applied, transforms run.

**Read nodes, metadata and paths.**

```ts
routes.paths;                              // readonly ('/home' | '/products' | ...)[]
routes.collected;                          // one typed entry per route — the union discriminates on `path`
routes.routes;                             // the declared tree, structurally frozen
routes.getNode('/products/[id]');          // the node, literal types preserved
routes.getMetadata('/products').title;     // 'Products' — a string LITERAL, not `string`
```

**Shared metadata contract + context-dependent values.**

```ts
import { defineRoutes, resolveMetadata, resolveMetadataValue, type BuiltinMetadata } from '@hyeonqyu/typed-router-core';

type Ctx = { isAdmin: boolean; locale: 'en' | 'ko' };
type Meta = { icon: string }; // ONLY your own fields; the built-ins are added automatically

export const adminRoutes = defineRoutes.withMeta<Meta, Ctx>()({
  dashboard: {
    _metadata: { icon: 'gauge', title: 'Dashboard' },
    // Nested nodes are typed `unknown`, so the context param is NOT contextually typed here — annotate it.
    settings: { _metadata: { icon: 'cog', accessible: (ctx: Ctx) => ctx.isAdmin } },
  },
});

const ctx: Ctx = { isAdmin: true, locale: 'en' };
const meta = adminRoutes.getMetadata('/dashboard/settings');
resolveMetadataValue(meta.accessible, ctx); // boolean | undefined  ← use this to READ one field

// Build a nav from the tree — no route is named twice anywhere in the app.
// Each `collected` entry keeps its route's declared metadata type, so a field only
// some routes declare must be narrowed (or widened to the shared contract) to read:
const nav = adminRoutes.collected
  .map((route) => {
    const meta: (Meta & BuiltinMetadata<Ctx>) | undefined = resolveMetadata(route.metadata, ctx);
    return { href: route.path, icon: meta?.icon, accessible: resolveMetadataValue(meta?.accessible, ctx) };
  })
  .filter((entry) => entry.accessible !== false);
```

`resolveMetadata` resolves only `title`, `label`, `description`, `accessible`. Your own function fields
(a `loader`, an `element` factory) are copied untouched, never invoked.

**Standalone helpers (no tree).**

```ts
buildHref('/products/[id]', { params: { id: 7 }, searchParams: { page: 2 } }); // untyped builder
const collected = collectRoutes(someRawTree);           // navigable routes from a bare object
matchRoute(collected, '/products/7');                   // the matcher behind routes.match
parseSearchParams(z.object({ page: z.number() }), { page: '4' }); // { page: 4 }
collectRawSearchParams(new URLSearchParams('a=1&a=2')); // { a: ['1','2'] }
toSearchParamsString({ page: 2, tags: ['a','b'] });     // '?page=2&tags=a&tags=b'
splitPath('/products/[id]').map(parseSegment);          // segment patterns
```

**Writing a custom adapter** — wrap `createRouteTree` and attach your own framework surface.

```ts
type Redirect<TTree> = <TPath extends RoutePaths<TTree>>(
  path: TPath, ...args: RouteArgsTuple<TTree, TPath>
) => never;

export const createMyRouter = <const TTree extends RouteTreeInput>(tree: TTree) => {
  const base: RouteTree<TTree> = createRouteTree(tree);
  // Implement loosely, then cast to the typed signature — the same trick core itself uses.
  const redirect = ((path: string, args?: BuildHrefArgs) =>
    frameworkRedirect(buildHref(path, args))) as Redirect<TTree>;
  return { ...base, redirect };
};
```

`createRouteTree` is `defineRoutes` minus the type-only `$types` carrier. Reuse `RouteArgsTuple` so
your navigation functions inherit the same required/optional/forbidden argument rules.

## Rules

1. **Never hand-write a URL, and never keep a parallel route list.** No `` `/products/${id}` ``, no
   `'/products/42'`, no `PATHS` constants file — a hand-written string survives a rename of a segment key.
   ✗ `routes.buildHref('/products/42')` (not a declared pathname — compile error) ·
   ✓ `routes.buildHref('/products/[id]', { params: { id: 42 } })`
2. **Path params go in `params`, never in `searchParams`.** The 1.x → 2.0 change agents get wrong most
   often; in 1.x it silently emitted a URL containing the literal `[id]`.
   ✗ `routes.buildHref('/products/[id]/reviews', { searchParams: { id: 42, star: 5 } })` (compile error) ·
   ✓ `routes.buildHref('/products/[id]/reviews', { params: { id: 42 }, searchParams: { star: 5 } })`
   Note the standalone `buildHref` helper is untyped: it accepts the ✗ form at compile time and throws
   `typed-router: missing route param "id"` only at runtime.
3. **A node is a destination only if it declares `_metadata`.** Without it the node namespaces children
   but never appears in `routes.paths`, never matches a URL, and never reaches an adapter.
   ✗ `internal: { stats: { _metadata: {} } }` — `/internal` is not navigable ·
   ✓ `internal: { _metadata: {}, stats: { _metadata: {} } }` — both are
4. **No generics, no currying, no provider.** `defineRoutes({...})` only. There is no
   `AppRoutesProvider`, no `useAppRoutes`, no `createAppRoutes<M,C>()`. The *only* curried form is
   `defineRoutes.withMeta<TMetadata, TContext>()({...})` — note the empty `()` between the type
   arguments and the tree.
5. **Declare a `searchParamsSchema` on any route whose query string you read.** For a schema-less route
   `SearchParams<...>` and `routes.parseSearchParams(path, ...)` are both `never`, so *any* field read is a
   compile error (`TS2339: Property 'x' does not exist on type 'never'`). At runtime the call still returns a
   copy of the raw, uncoerced strings — so the fix is to declare the schema, never to cast the `never` away.
6. **Handle parse failure deliberately, on both halves of the URL.** The default is `onError: 'throw'`,
   which raises `SearchParamsParseError` or `PathParamsParseError` (`.cause` holds the Zod error or
   Standard Schema issues). Any user-editable URL will eventually fail, so pick `'default'` (drop the bad
   fields/segments, keep the rest) or `'raw'` on purpose.
7. **Do not narrow `routes.match()` by assumption.** `params` values are decoded `string` (or `string[]`
   for catch-alls) — `match` never runs a schema. `routes.parseParams(path, match.params)` is what turns
   them into the declared types; `PathParams` allows `string | number` when *writing* a segment that
   declares nothing, `PathParamsOutput` models what comes *back*.
8. **`withMeta`: put only your own fields in `TMetadata`, and annotate every context parameter.**
   `title` / `label` / `description` / `accessible` / `searchParamsSchema` / `paramSchema` already come from
   `BuiltinMetadata<TContext>`. Redeclaring one (e.g. `TMetadata = { title: string }`) intersects it down to a
   plain value type: static `title: 'Home'` still compiles, but the context form `title: (ctx) => ...` is
   silently rejected. Leave the built-ins out of `TMetadata`. And because nested nodes are unconstrained,
   `accessible: (ctx) => ctx.isAdmin` is `TS7006 implicit any` under `strict` anywhere below the top level —
   annotate every context param as `(ctx: Ctx) =>` regardless of depth.
9. **Use `resolveMetadataValue` to read one resolved field.** `resolveMetadata(meta, ctx)` returns
   `TMetadata`, i.e. the *declared* type — a field declared as `(ctx) => T` still types as a function
   there even though it was resolved at runtime. `resolveMetadataValue(meta.field, ctx)` gives `T`.
10. **Route groups never appear in URLs.** `'/(shop)/products'` is not a pathname; the route is
    `/products`. `getNode` / `getMetadata` look through groups transparently.
11. **Treat the tree as immutable, and never make `zod` a hard dependency.** `createRouteTree`
    structurally freezes the tree (metadata contents untouched), so runtime route mutation no-ops or
    throws; typing against `z.ZodType` breaks Valibot / ArkType consumers.
12. **`paramSchema` goes on the dynamic segment's own node, and is a bare schema, not an object.** It
    describes that one segment, and its name comes from the tree key.
    ✗ `'[id]': { _metadata: { paramSchema: z.object({ id: z.number() }) } }` — the segment is not an object ·
    ✗ putting it on the parent (`products: { _metadata: { paramSchema: ... }, '[id]': {} }`) — that declares
    nothing, since `products` is a static segment ·
    ✓ `'[id]': { _metadata: { paramSchema: z.number() } }`
    Do not redeclare an ancestor's segment on a nested route: `/products/[id]/reviews` already inherits
    `id`. For a catch-all, declare the list (`z.array(z.string())`), not the element.

## API reference

| Name | Signature | What it does |
| --- | --- | --- |
| `defineRoutes` | `(tree) => TypedRoutes<TTree>` | Entry point. Declares the IA and returns the typed routes object. |
| `defineRoutes.withMeta` | `<TMetadata, TContext>() => (tree) => TypedRoutes<TTree>` | Same, constraining **every** `_metadata` block in the tree to `TMetadata & BuiltinMetadata<TContext>`, at any depth. Per-node inference still holds: literal types and fields outside `TMetadata` survive. A node with no `_metadata` is organisational, so nothing is enforced on it. |
| `routes.routes` | `TTree` | The declared tree, structurally frozen. What adapters consume. |
| `routes.paths` | `readonly RoutePaths<TTree>[]` | Every navigable pathname at runtime. |
| `routes.collected` | `readonly GetCollectedRoute<TTree>[]` | `{ path, segments, node, metadata }` per route, one union member each — `path` stays a literal and `metadata` stays typed while enumerating. |
| `routes.getNode` | `(path) => GetRouteNode<TTree, TPath>` | The node behind a pathname, literal types preserved. |
| `routes.getMetadata` | `(path) => GetRouteMetadata<TTree, TPath>` | The `_metadata` block, typed down to string literals. Not context-resolved. |
| `routes.match` | `(url: string) => RouteMatch \| null` | Live URL → declared route. Static (3) beats dynamic (2) beats catch-all (1). |
| `routes.buildHref` | `(path, ...args: RouteArgsTuple) => string` | Declared pathname + `params` / `searchParams` / `hash` → URL. |
| `routes.parseSearchParams` | `(path, raw, options?) => SearchParamsOutput` | Coerce + validate a query string through the route's schema. |
| `routes.parseParams` | `(path, raw, options?) => PathParamsOutput` | Coerce + validate `match().params` through each segment's `paramSchema`. Undeclared segments pass through as strings. |
| `routes.$types` | `{ tree; pathname }` | Type-only carrier: `typeof routes.$types.pathname`. |
| `createRouteTree` | `(tree) => RouteTree<TTree>` | Framework-agnostic half of `defineRoutes`; base for custom adapters. |
| `resolveMetadata` | `(metadata, context) => TMetadata \| undefined` | Resolves `title`/`label`/`description`/`accessible`; shallow copy, other fields untouched. |
| `resolveMetadataValue` | `(value, context) => TValue \| undefined` | Resolves one `T \| ((ctx) => T)` metadata value. |
| `buildHref` | `(path, args?) => string` | Standalone untyped builder. Throws on a missing dynamic or catch-all param. |
| `matchRoute` | `(routes: CollectedRoute[], url) => RouteMatch \| null` | Standalone matcher. |
| `collectRoutes` | `(tree, basePath?) => CollectedRoute[]` | Lists navigable routes from a raw tree, skipping `(group)` keys. |
| `parseSearchParams` | `(schema, raw, options?, path?) => Record<string, unknown>` | Standalone parser. No schema → returns a copy of `raw`. |
| `parsePathParams` | `(schemas, raw, options?, path?) => Record<string, unknown>` | Standalone path-param parser. `schemas` is `Record<segmentName, schema>`. |
| `collectRawSearchParams` | `(iterable) => RawSearchParams` | Folds `URLSearchParams`-like entries, repeated keys → arrays. |
| `toSearchParamsString` | `(obj, path?) => string` | `'?a=1&b=2'`. Skips `undefined`/`null`, repeats arrays, ISO-serialises `Date`, JSON-encodes objects and nested arrays, throws on anything unserialisable. |
| `children` | `(node) => RouteChildren<TNode>` | One node's child routes, with `_metadata` gone from the value **and** the type — what a menu level, a breadcrumb's siblings or a section index needs. Returns an object, so `keys`/`values`/`entries` all work. `(group)` keys are children like any other. Distributive over a union of nodes, so an unchecked `useCurrentRouteNode()` result is stripped member by member rather than collapsing. Frozen, and cached per node of a declared (frozen) tree, so two calls on the same declared node return the same object. |
| `parseSegment` / `splitPath` / `isRouteGroup` | — | Segment classification helpers. |
| `SearchParamsParseError` | `class extends Error` | Thrown under `onError: 'throw'`; `.cause` holds the validator's error. |
| `PathParamsParseError` | `class extends Error { param, cause }` | The path-param equivalent; `.param` names the segment that failed. |
| `METADATA_KEY` | `'_metadata'` | The reserved destination marker. |

**Types.** These take the **routes object** type: `Pathname<typeof routes>`,
`SearchParams<typeof routes, '/path'>`, `RouteMetadataOf<…>`, `RouteNodeOf<…>`,
`CollectedRouteOf<typeof routes>` (the `collected` element union; pass a pathname to pick one
entry), `Params<typeof routes, '/products/[id]'>` (the read side of the path params). These take the raw
**tree** type (`typeof routes.$types.tree`): `RoutePaths`, `RouteArgs`, `RouteArgsTuple`,
`SearchParamsInput`, `SearchParamsOutput`, `PathParamsInput`, `ParsedPathParams`, `GetRouteNode`,
`GetRouteMetadata`, `GetCollectedRoute`. These take a pathname string **first** and the tree second:
`PathParams<'/products/[id]', Tree>` (write side) and `PathParamsOutput<'/products/[id]', Tree>` (read
side). The tree argument defaults to `unknown`, under which every segment is the untyped default —
`string | number` to write, `string` / `string[]` to read — so pass the tree if you want declared
`paramSchema`s reflected, or use `Params<…>` / `PathParamsInput<…>`, which take the tree already.
Also exported: `BuiltinMetadata<TContext>`, `MetadataValue<T, C>`,
`RouteMatch`, `CollectedRoute`, `SegmentPattern`, `RouteParams`, `BuildHrefArgs`, `RawSearchParams`,
`SearchParamsErrorMode`, `ParseSearchParamsOptions`, `RawPathParams`, `PathParamSchemas`,
`PathParamsErrorMode`, `ParsePathParamsOptions`, `AnySchema`, `ParsableSchema`, `InferSchemaInput`,
`InferSchemaOutput`, `RouteTreeInput`, `RouteNodeInput`, `RouteTreeInputWithMeta`,
`RouteNodeInputWithMeta`, `RouteMetadata`, `RouteGroupKey`, `MetadataKey`, `SegmentKeys`,
`HasRequiredKeys`, `Simplify`, `PathParamValue`, `RouteChildren`, `TypedRoutes`, `RouteTree`.
