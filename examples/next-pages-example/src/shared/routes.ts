import { defineRoutes } from '@hyeonqyu/typed-router-core';
import { z } from 'zod';

/**
 * Stands in for a shared package — `@acme/shop-routes` — that several apps depend on.
 *
 * It is declared with core, so it carries no framework: no React, no `next/router`,
 * nothing an app on another router would have to install. Each app binds its own
 * adapter to it; this one does so in `../routes.ts`.
 *
 * The keys mirror `src/pages/` one for one, which `tests/check-pages.test.ts` enforces.
 */
export const routes = defineRoutes({
  // `pages/index.tsx` is the root: the empty key, reached as `'/'`.
  '': { _metadata: { title: 'Home' } },

  products: {
    _metadata: {
      title: 'Products',
      searchParamsSchema: z.object({
        sort: z.enum(['price-asc', 'price-desc', 'name']).optional(),
        page: z.number().default(1),
        inStock: z.boolean().optional(),
      }),
    },

    // `pages/products/[id].tsx`: `/products/42` reads back as the number 42.
    '[id]': { _metadata: { title: 'Product detail', paramSchema: z.number() } },
  },

  docs: {
    '[...slug]': { _metadata: { title: 'Docs' } },
  },
});
