import { attachMetadata as attachCoreMetadata, defineRoutes as defineCoreRoutes } from '@hyeonqyu/typed-router-core';
import { bindRoutes as bindNextRoutes, defineRoutes as defineNextRoutes, type ResolveHrefRoute } from '@hyeonqyu/typed-router-next';
import { bindRoutes as bindPagesRoutes, defineRoutes as definePagesRoutes } from '@hyeonqyu/typed-router-next/pages';
import { defineRoutes as defineReactRoutes } from '@hyeonqyu/typed-router-react';
import { useCallback } from 'react';
import { z } from 'zod';

/**
 * Proves the two adapters expose the same surface: the *same* tree declaration and
 * the *same* component body compile against both. If either adapter drifts — a hook
 * renamed, `TypedLink` going back to `to`, params merged into search params — this
 * file stops compiling.
 */

const tree = {
  home: { _metadata: { title: 'Home' } },
  '(shop)': {
    products: {
      _metadata: {
        title: 'Products',
        searchParamsSchema: z.object({
          sort: z.enum(['price-asc', 'price-desc']).optional(),
          page: z.number().default(1),
        }),
      },
      // A declared segment: both adapters must read it back as a number, not text.
      '[id]': { _metadata: { title: 'Detail', paramSchema: z.number() } },
    },
  },
  search: { _metadata: { title: 'Search', searchParamsSchema: z.object({ q: z.string() }) } },
} as const;

const nextRoutes = defineNextRoutes(tree);
const pagesRoutes = definePagesRoutes(tree);
const reactRoutes = defineReactRoutes(tree);

/** One component body, written once, type-checked against each adapter in turn. */
const useSharedBody = (routes: typeof nextRoutes | typeof pagesRoutes | typeof reactRoutes) => {
  const router = routes.useTypedRouter();
  const pathname = routes.useTypedPathname();
  const node = routes.useCurrentRouteNode();
  const current = routes.useCurrentRoute();
  const params = routes.useTypedParams('/products/[id]');
  const looseParams = routes.useTypedParams('/products/[id]', { onError: 'default' });
  const query = routes.useTypedSearchParams('/products');

  router.push('/home');
  router.push('/products/[id]', { params: { id: 7 } });
  router.replace('/search', { searchParams: { q: 'hi' } });
  router.prefetch('/products', { searchParams: { page: 2 } });
  router.back();
  router.forward();
  router.refresh();

  // Enumeration keeps metadata typed identically on both adapters.
  const titles: string[] = routes.collected.map((route) => route.metadata.title);

  // `paramSchema` is honoured identically on both adapters — this line stops compiling if either drifts.
  const id: number = params.id;

  return { pathname, node, current, titles, id, looseId: looseParams.id, page: query.page, sort: query.sort, url: current.url };
};

const NextNav = () => {
  const { TypedLink } = nextRoutes;
  return (
    <nav>
      <TypedLink href="/home">Home</TypedLink>
      <TypedLink href="/products/[id]" params={{ id: 1 }}>
        Detail
      </TypedLink>
      <TypedLink href="/search" searchParams={{ q: 'shoes' }} hash="top">
        Search
      </TypedLink>
    </nav>
  );
};

const PagesNav = () => {
  const { TypedLink } = pagesRoutes;
  return (
    <nav>
      <TypedLink href="/home">Home</TypedLink>
      <TypedLink href="/products/[id]" params={{ id: 1 }}>
        Detail
      </TypedLink>
      <TypedLink href="/search" searchParams={{ q: 'shoes' }} hash="top">
        Search
      </TypedLink>
    </nav>
  );
};

const ReactNav = () => {
  const { TypedLink } = reactRoutes;
  return (
    <nav>
      <TypedLink href="/home">Home</TypedLink>
      <TypedLink href="/products/[id]" params={{ id: 1 }}>
        Detail
      </TypedLink>
      <TypedLink href="/search" searchParams={{ q: 'shoes' }} hash="top">
        Search
      </TypedLink>
    </nav>
  );
};

/* Negative cases must fail identically on both adapters. */

const NextInvalid = () => {
  const router = nextRoutes.useTypedRouter();
  // @ts-expect-error — `[id]` declares `z.number()`, so a string is not a valid link
  router.push('/products/[id]', { params: { id: 'abc' } });
  // @ts-expect-error — dynamic route needs params
  router.push('/products/[id]');
  // @ts-expect-error — `/home` declares no schema
  router.push('/home', { searchParams: { q: 'x' } });
  // @ts-expect-error — `q` is required
  router.push('/search', { searchParams: {} });
  // @ts-expect-error — React Router's `to` is not the prop name here
  return <nextRoutes.TypedLink to="/home">x</nextRoutes.TypedLink>;
};

const PagesInvalid = () => {
  const router = pagesRoutes.useTypedRouter();
  // @ts-expect-error — `[id]` declares `z.number()`, so a string is not a valid link
  router.push('/products/[id]', { params: { id: 'abc' } });
  // @ts-expect-error — dynamic route needs params
  router.push('/products/[id]');
  // @ts-expect-error — `/home` declares no schema
  router.push('/home', { searchParams: { q: 'x' } });
  // @ts-expect-error — `q` is required
  router.push('/search', { searchParams: {} });
  // @ts-expect-error — `to` is not the prop name here either
  return <pagesRoutes.TypedLink to="/home">x</pagesRoutes.TypedLink>;
};

/** `shallow` belongs to the Pages Router alone; the App Router's router has no such option. */
const shallowOnPagesOnly = () => {
  void pagesRoutes.useTypedRouter().push('/products/[id]', { params: { id: 1 }, shallow: true, scroll: false });
  // @ts-expect-error — the App Router has no shallow routing
  nextRoutes.useTypedRouter().push('/home', { shallow: true });
};

/*
 * `bindRoutes` on a tree declared with core must be indistinguishable, at every call
 * site, from declaring the same tree with the adapter — on both Next entries.
 */
const coreRoutes = defineCoreRoutes(tree);
const boundNext = bindNextRoutes(coreRoutes);
const boundPages = bindPagesRoutes(coreRoutes);

const useBoundBody = () => {
  const nextId: number = boundNext.useTypedParams('/products/[id]').id;
  const pagesId: number = boundPages.useTypedParams('/products/[id]').id;
  const page: number = boundPages.useTypedSearchParams('/products').page;
  const same: typeof pagesRoutes.$types.pathname = boundPages.useTypedPathname() ?? '/home';

  boundPages.useTypedRouter().push('/search', { searchParams: { q: 'x' } });
  // @ts-expect-error — the bound tree is still checked: `q` is required
  boundNext.useTypedRouter().push('/search');

  return { nextId, pagesId, page, same };
};

/** A tree that went through core's `attachMetadata` binds the same way, attached metadata included. */
const attached = attachCoreMetadata(coreRoutes).withMeta<{ title: string; icon: 'home' | 'cart' }>()({
  '/home': { title: 'Home', icon: 'home' },
});
const boundAttached = bindPagesRoutes(attached);
const icon: 'home' | 'cart' = boundAttached.getMetadata('/home').icon;

/**
 * One `useResolveHref` fits both entries, and its resolver sees the tree's own pathnames.
 * The option is purely additive: the bound adapter's surface is unchanged.
 */
const useResolveHref = () => (route: ResolveHrefRoute<typeof coreRoutes.routes>) =>
  route.pathname === '/search' ? 'https://search.example.com' : undefined;
const resolvedNext = bindNextRoutes(coreRoutes, { useResolveHref });
const resolvedPages = bindPagesRoutes(coreRoutes, { useResolveHref });
const sameNext: typeof boundNext = resolvedNext;
const samePages: typeof boundPages = resolvedPages;

/** The README's pattern: `useCallback` infers the resolver's parameter from the option's type alone. */
const useLanguage = () => 'en';
const withLocale = attachCoreMetadata(coreRoutes).withMeta<{ href?: (context: { language: string }) => string }>()({
  '/home': { href: ({ language }) => `https://example.com/${language}` },
});
const localized = bindNextRoutes(withLocale, {
  useResolveHref: () => {
    const language = useLanguage();
    return useCallback(({ metadata }) => (typeof metadata.href === 'function' ? metadata.href({ language }) : undefined), [language]);
  },
});

bindPagesRoutes(coreRoutes, {
  // @ts-expect-error — the resolver's pathname is the tree's, so an undeclared one is a compile error
  useResolveHref: () => (route) => (route.pathname === '/nope' ? 'https://example.com' : undefined),
});

const ReactInvalid = () => {
  const router = reactRoutes.useTypedRouter();
  // @ts-expect-error — `[id]` declares `z.number()`, so a string is not a valid link
  router.push('/products/[id]', { params: { id: 'abc' } });
  // @ts-expect-error — dynamic route needs params
  router.push('/products/[id]');
  // @ts-expect-error — `/home` declares no schema
  router.push('/home', { searchParams: { q: 'x' } });
  // @ts-expect-error — `q` is required
  router.push('/search', { searchParams: {} });
  // @ts-expect-error — `to` is not the prop name here either
  return <reactRoutes.TypedLink to="/home">x</reactRoutes.TypedLink>;
};

/** Only the React adapter generates router config; the output is plain data. */
const routeObjects = reactRoutes.toRouteObjects();
const composed = [{ path: '/', children: routeObjects }, ...routeObjects];

export {
  composed,
  icon,
  localized,
  NextInvalid,
  NextNav,
  PagesInvalid,
  PagesNav,
  ReactInvalid,
  ReactNav,
  routeObjects,
  sameNext,
  samePages,
  shallowOnPagesOnly,
  useBoundBody,
  useSharedBody,
};
