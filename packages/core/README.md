# @hyeonqyu/typed-router-core

The framework-free core of [typed-router](https://github.com/hyeonQyu/typed-router): the route tree, its types, and the URL helpers derived from it.

Most applications should install an adapter instead:

- [`@hyeonqyu/typed-router-next`](https://www.npmjs.com/package/@hyeonqyu/typed-router-next) — Next.js App Router
- [`@hyeonqyu/typed-router-react`](https://www.npmjs.com/package/@hyeonqyu/typed-router-react) — React Router 6/7

Use this package directly when you want the tree without any router — on a server, in a CLI, or in tests:

```ts
import { defineRoutes } from '@hyeonqyu/typed-router-core';
import { z } from 'zod';

const routes = defineRoutes({
  products: {
    _metadata: { searchParamsSchema: z.object({ page: z.number().default(1) }) },
    '[id]': { _metadata: { title: 'Detail', paramSchema: z.number() } },
  },
});

routes.paths;                                                   // '/products' | '/products/[id]'
routes.buildHref('/products/[id]', { params: { id: 42 } });     // '/products/42'
routes.match('/products/42');                                   // { path: '/products/[id]', params: { id: '42' }, … }
routes.parseSearchParams('/products', { page: '2' });           // { page: 2 }
routes.parseParams('/products/[id]', { id: '42' });              // { id: 42 } — per the segment's schema
```

`children(node)` hands back one node's child routes with `_metadata` gone from the value and the type — the shape a menu level, a breadcrumb's siblings or a section index actually needs, where `Object.values(node)` would otherwise include the metadata block:

```ts
import { children } from '@hyeonqyu/typed-router-core';

Object.keys(routes.routes.products);            // ['_metadata', '[id]']
Object.keys(children(routes.routes.products));  // ['[id]']
```

`attachMetadata(source)` attaches metadata to a tree declared elsewhere, by pathname, without declaring it again. A shared package declares the structure and each app attaches its own view. Keys are the source's pathnames, entries merge over the source's `_metadata`, `paramSchema` and `searchParamsSchema` stay the source's, and the source is not mutated:

```ts
import { attachMetadata } from '@hyeonqyu/typed-router-core';

const ia = attachMetadata(routes).withMeta<{ title: string }>()({
  '/products/[id]': { title: 'Product' },
});

ia.getMetadata('/products/[id]').title;  // 'Product'
```

Search params round-trip: objects and nested arrays are written as JSON and read back as themselves, and a value with no faithful text form (`NaN`, a symbol, a `Map`, a cycle) throws instead of becoming `[object Object]`. `Date` is written as ISO, so declare those fields `z.coerce.date()`.

Path params get the same treatment, one segment at a time: a `paramSchema` on a `'[id]'` node types and validates that segment (its name comes from the tree key), and nested routes inherit it. A segment without one still reads back as `string`.

`zod` is an optional peer dependency — schemas are matched structurally, so Zod v3, Zod v4 and any [Standard Schema](https://standardschema.dev) validator work. A route that only names its query keys needs no validator at all: `searchParamsSchema: searchParamKeys<'redirectUrl'>()` types the keys (each optional, `string | string[]`) and passes the raw values through untouched.

MIT
