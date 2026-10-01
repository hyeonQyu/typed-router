import {
  assertRouteMatches,
  type BuildHrefArgs,
  type CollectedRoute,
  type ParsePathParamsOptions,
  type ParseSearchParamsOptions,
  type RouteMetadata,
  type RouteTree,
} from '@hyeonqyu/typed-router-core';
import { useRouter } from 'next/router';
import { useMemo } from 'react';
import type { RawCurrentRoute } from '../client';
import { isAbsoluteUrl, toHref, type UseRawResolveHref } from '../resolveHref';
import type { PagesNavigateOptions } from './navigation.types';

/**
 * The Pages Router half of the adapter, backed by `next/router`.
 *
 * Nothing here imports `next/navigation` or the App Router entry — `RawCurrentRoute`
 * above is a type and is erased — so a Pages Router bundle never pulls either in.
 *
 * The route comes from `router.pathname`, which is the page Next actually rendered in
 * the same notation the tree uses (`/products/[id]`), rather than from matching
 * `asPath`: the two differ under rewrites, and Next's answer is the one that is true.
 */

/**
 * Thrown when a hook needs part of the URL that the Pages Router has not read yet.
 *
 * A statically rendered page — one without `getServerSideProps` or `getInitialProps` —
 * is rendered once with an empty `router.query` and only learns its query string, and
 * on a statically optimized dynamic route its path params too, after hydration.
 * Returning schema defaults in the meantime would be typed and wrong, so the hook
 * throws instead.
 */
export class RouteNotReadyError extends Error {
  /** The pathname the hook was called with, e.g. `/products/[id]`. */
  readonly pathname: string;

  constructor(hook: string, pathname: string, missing: string) {
    super(
      `typed-router: ${hook}("${pathname}") was called before the Pages Router was ready, ` +
        `so the ${missing} of this statically rendered page is not known yet. ` +
        'Render this component inside <RouterReady>, or once useRouterReady() is true, or give the page `getServerSideProps`. ' +
        'Do not gate on `router.isReady` directly: it differs between the prerendered HTML and the first client render.',
    );
    this.name = 'RouteNotReadyError';
    this.pathname = pathname;
  }
}

/** `/products/42?sort=desc#top` → `/products/42`. */
const pathOf = (asPath: string): string => asPath.split(/[?#]/)[0];

/** `/products/42?sort=desc#top` → `sort=desc`. */
const searchOf = (asPath: string): string => {
  const [beforeHash] = asPath.split('#');
  const start = beforeHash.indexOf('?');
  return start === -1 ? '' : beforeHash.slice(start + 1);
};

const findRoute = (routes: RouteTree<unknown>, path: string): CollectedRoute | undefined =>
  (routes.collected as readonly CollectedRoute[]).find((route) => route.path === path);

/**
 * `router.query` merges path params and search params. Only the route's own dynamic
 * segments are path params — and Next fills those over any search param of the same
 * name — so picking them by name recovers exactly what `match()` would have produced.
 */
const pickParams = (route: CollectedRoute, query: Record<string, string | string[] | undefined>): Record<string, string | string[]> => {
  const params: Record<string, string | string[]> = {};

  for (const segment of route.segments) {
    if (segment.kind === 'static') continue;

    const value = query[segment.name];
    if (value !== undefined) params[segment.name] = value;
  }

  return params;
};

export const useCurrentRouteImpl = (routes: RouteTree<unknown>): RawCurrentRoute => {
  const { pathname: page, asPath, query } = useRouter();
  const url = pathOf(asPath);

  return useMemo(() => {
    const route = findRoute(routes, page);

    return {
      pathname: route?.path ?? null,
      url,
      node: route?.node ?? null,
      metadata: (route?.metadata as RouteMetadata | undefined) ?? null,
      params: route ? pickParams(route, query) : {},
    };
  }, [routes, page, url, query]);
};

type ParseUntyped = (path: string, raw: Iterable<[string, string]>, options?: ParseSearchParamsOptions) => unknown;

export const useTypedSearchParamsImpl = (routes: RouteTree<unknown>, pathname: string, options?: ParseSearchParamsOptions): unknown => {
  const { asPath, isReady } = useRouter();
  const search = searchOf(asPath);
  const onError = options?.onError;
  const parse = routes.parseSearchParams as ParseUntyped;

  // Until hydration `asPath` carries no query string on the server and the real one on
  // the client, so parsing it now would hand out defaults — or a hydration mismatch.
  if (!isReady) throw new RouteNotReadyError('useTypedSearchParams', pathname, 'query string');

  return useMemo(() => parse(pathname, new URLSearchParams(search).entries(), { onError }), [parse, pathname, search, onError]);
};

type ParseParamsUntyped = (
  path: string,
  raw: Record<string, string | string[]>,
  options?: ParsePathParamsOptions,
) => Record<string, unknown>;

/**
 * Whether a required segment of `pathname` is absent — which, once the route matched,
 * only happens on a statically optimized dynamic page before hydration.
 *
 * Keyed to the segments rather than to `isReady` alone: a `getStaticProps` page is
 * not "ready" during its build-time render either, yet its path params are all there.
 * An optional catch-all is never required, so leaving it out stays within its type.
 */
const lacksRequiredParam = (routes: RouteTree<unknown>, pathname: string, params: Record<string, string | string[]>): boolean =>
  findRoute(routes, pathname)?.segments.some(
    (segment) => (segment.kind === 'dynamic' || segment.kind === 'catchAll') && params[segment.name] === undefined,
  ) ?? false;

export const useTypedParamsImpl = (routes: RouteTree<unknown>, pathname: string, options?: ParsePathParamsOptions): unknown => {
  const { isReady } = useRouter();
  const { pathname: matched, params } = useCurrentRouteImpl(routes);
  const onError = options?.onError;
  const parse = routes.parseParams as ParseParamsUntyped;

  // Outside the memo, so every render is checked rather than only the ones that recompute.
  assertRouteMatches('useTypedParams', pathname, matched);
  if (!isReady && lacksRequiredParam(routes, pathname, params)) {
    throw new RouteNotReadyError('useTypedParams', pathname, 'dynamic segments');
  }

  return useMemo(() => parse(pathname, params, { onError }), [parse, pathname, params, onError]);
};

/** The node behind the current URL, checked against the pathname when one is given. */
export const useCurrentRouteNodeImpl = (routes: RouteTree<unknown>, pathname?: string): unknown => {
  const { pathname: matched, node } = useCurrentRouteImpl(routes);
  if (pathname !== undefined) assertRouteMatches('useCurrentRouteNode', pathname, matched);
  return node;
};

/** What a navigation call carries once the typed wrapper has erased its pathname generic. */
export type RawNavigateArgs = BuildHrefArgs & PagesNavigateOptions;

export type RawTypedRouter = {
  push: (pathname: string, args?: RawNavigateArgs) => Promise<boolean>;
  replace: (pathname: string, args?: RawNavigateArgs) => Promise<boolean>;
  prefetch: (pathname: string, args?: RawNavigateArgs) => Promise<void>;
  back: () => void;
  forward: () => void;
  refresh: () => Promise<boolean>;
};

export const useTypedRouterImpl = (routes: RouteTree<unknown>, useResolveHref: UseRawResolveHref): RawTypedRouter => {
  const router = useRouter();
  const resolve = useResolveHref();

  return useMemo(() => {
    const hrefOf = (pathname: string, args?: RawNavigateArgs) => toHref(routes, resolve, pathname, args);
    const optionsOf = (args?: RawNavigateArgs) => ({ scroll: args?.scroll, shallow: args?.shallow });

    // An absolute URL needs nothing special on `push`: the Pages Router hard-navigates to a non-local one.
    return {
      push: (pathname, args) => router.push(hrefOf(pathname, args), undefined, optionsOf(args)),
      replace: (pathname, args) => router.replace(hrefOf(pathname, args), undefined, optionsOf(args)),
      prefetch: async (pathname, args) => {
        const href = hrefOf(pathname, args);
        if (!isAbsoluteUrl(href)) await router.prefetch(href);
      },
      back: () => router.back(),
      // What `router.forward()` does, without depending on the Next version that added it.
      forward: () => window.history.forward(),
      // The Pages Router has no `refresh()`. Re-navigating to the current URL is the
      // closest match: data fetching runs again and client state survives.
      refresh: () => router.replace(router.asPath, undefined, { scroll: false }),
    };
  }, [router, routes, resolve]);
};
