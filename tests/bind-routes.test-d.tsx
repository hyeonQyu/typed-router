import { bindRoutes as bindNextRoutes, type TypedRoutes as NextTypedRoutes } from '@hyeonqyu/typed-router-next';
import { bindRoutes as bindPagesRoutes, type TypedRoutes as PagesTypedRoutes } from '@hyeonqyu/typed-router-next/pages';
import { appRoutes, wideRoutes } from './stress.fixtures';

/**
 * `bindRoutes` reads the tree off the source instead of inferring it back out of
 * `RouteTree<TTree>`, so an app-sized tree with typed metadata — `appRoutes`, 110 routes,
 * 5 levels, attached with `attachMetadata(...).withMeta<AppMeta, AuthContext>()` — binds
 * without an explicit type argument, on both Next entries.
 */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

type AppTree = typeof appRoutes.routes;

const boundNext = bindNextRoutes(appRoutes);
const boundPages = bindPagesRoutes(appRoutes);

// Exactly what the explicit type argument used to produce.
type _nextSameAsExplicit = Expect<Equal<typeof boundNext, NextTypedRoutes<AppTree>>>;
type _pagesSameAsExplicit = Expect<Equal<typeof boundPages, PagesTypedRoutes<AppTree>>>;

type _nextPaths = Expect<Equal<typeof boundNext.$types.pathname, (typeof appRoutes.paths)[number]>>;
type _pagesPaths = Expect<Equal<typeof boundPages.$types.pathname, (typeof appRoutes.paths)[number]>>;

// The attached metadata keeps its literals through the bind.
type _attachedTitle = Expect<Equal<ReturnType<typeof boundNext.getMetadata<'/section1'>>['title'], 'NAV_SECTION1'>>;

const useBoundBody = () => {
  // `[id]` declares `z.number()`; nested routes inherit it.
  const nextId: number = boundNext.useTypedParams('/section1/[id]/overview/history/entry').id;
  const pagesId: number = boundPages.useTypedParams('/section3/[id]').id;
  const tab: string = boundNext.useTypedParams('/section2/settings/[tab]/history').tab;

  const search = boundPages.useTypedSearchParams('/section1');
  type _search = Expect<Equal<typeof search, { q?: string | undefined; page: number }>>;

  boundNext.useTypedRouter().push('/section5/[id]/[tab]/history/entry', { params: { id: 5, tab: 'a' } });
  boundPages.useTypedRouter().push('/section4', { searchParams: { q: 'x' } });

  // @ts-expect-error — the bound tree is still checked: `[id]` takes a number
  boundNext.useTypedRouter().push('/section1/[id]', { params: { id: 'abc' } });
  // @ts-expect-error — a dynamic route needs its params
  boundPages.useTypedRouter().push('/section1/[id]');
  // @ts-expect-error — not a declared pathname
  boundNext.useTypedRouter().push('/section6');

  return (
    <>
      <boundNext.TypedLink href="/section2/[id]/overview" params={{ id: 2 }}>
        {nextId + pagesId + tab}
      </boundNext.TypedLink>
      <boundPages.TypedLink href="/section1" searchParams={{ page: 2 }}>
        {search.page}
      </boundPages.TypedLink>
      {/* @ts-expect-error — `[tab]` is missing */}
      <boundNext.TypedLink href="/section2/[id]/[tab]" params={{ id: 2 }}>
        x
      </boundNext.TypedLink>
    </>
  );
};

// 1,260 routes: inferring the tree structurally failed here with TS2590.
const boundWide = bindNextRoutes(wideRoutes);
type _widePaths = Expect<Equal<typeof boundWide.$types.pathname, (typeof wideRoutes.paths)[number]>>;

// `useResolveHref` is typed from the same tree: the resolver sees the app's own pathnames.
const resolvedNext = bindNextRoutes(appRoutes, {
  useResolveHref: () => (route) => (route.pathname === '/section1/[id]' ? 'https://example.com' : undefined),
});
type _resolvedSame = Expect<Equal<typeof resolvedNext, typeof boundNext>>;

bindPagesRoutes(appRoutes, {
  // @ts-expect-error — `/section6` is not a pathname of the tree
  useResolveHref: () => (route) => (route.pathname === '/section6' ? 'https://example.com' : undefined),
});

// Anything that is not a route tree is still rejected.
// @ts-expect-error — the bare tree, not a route tree
bindNextRoutes(appRoutes.routes);
// @ts-expect-error — `routes` alone does not make a route tree
bindPagesRoutes({ routes: {} });
// @ts-expect-error — not an object at all
bindNextRoutes('/section1');

export { useBoundBody };
export type { _attachedTitle, _nextPaths, _nextSameAsExplicit, _pagesPaths, _pagesSameAsExplicit, _widePaths };
