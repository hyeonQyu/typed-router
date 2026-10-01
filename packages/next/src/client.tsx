'use client';

import type { ParsePathParamsOptions, ParseSearchParamsOptions, RouteMetadata, RouteTree } from '@hyeonqyu/typed-router-core';
import { assertRouteMatches, type BuildHrefArgs } from '@hyeonqyu/typed-router-core';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import type { NavigateOptions } from './navigation.types';
import { isAbsoluteUrl, toHref, type UseRawResolveHref } from './resolveHref';

/**
 * The client half of the adapter, behind its own `'use client'` boundary.
 *
 * These are plain functions taking the route tree as their first argument rather than
 * a factory, so `defineRoutes` can reference them from a server-safe module without
 * ever calling them during server render.
 */

export type RawCurrentRoute = {
  pathname: string | null;
  url: string;
  node: unknown;
  metadata: RouteMetadata | null;
  params: Record<string, string | string[]>;
};

export const useCurrentRouteImpl = (routes: RouteTree<unknown>): RawCurrentRoute => {
  const url = usePathname() ?? '';

  return useMemo(() => {
    const matched = routes.match(url);

    return {
      pathname: matched?.path ?? null,
      url,
      node: matched?.node ?? null,
      metadata: (matched?.metadata as RouteMetadata | undefined) ?? null,
      params: matched?.params ?? {},
    };
  }, [routes, url]);
};

export const useTypedSearchParamsImpl = (routes: RouteTree<unknown>, pathname: string, options?: ParseSearchParamsOptions): unknown => {
  const searchParams = useSearchParams();
  const onError = options?.onError;
  const parse = routes.parseSearchParams as ParseUntyped;

  return useMemo(
    () => parse(pathname, searchParams ? Array.from(searchParams.entries()) : [], { onError }),
    [parse, pathname, searchParams, onError],
  );
};

type ParseUntyped = (path: string, raw: Iterable<[string, string]>, options?: ParseSearchParamsOptions) => unknown;

export const useTypedParamsImpl = (routes: RouteTree<unknown>, pathname: string, options?: ParsePathParamsOptions): unknown => {
  const { pathname: matched, params } = useCurrentRouteImpl(routes);
  const onError = options?.onError;
  const parse = routes.parseParams as ParseParamsUntyped;

  // Outside the memo, so every render is checked rather than only the ones that recompute.
  assertRouteMatches('useTypedParams', pathname, matched);

  return useMemo(() => parse(pathname, params, { onError }), [parse, pathname, params, onError]);
};

/** The node behind the current URL, checked against the pathname when one is given. */
export const useCurrentRouteNodeImpl = (routes: RouteTree<unknown>, pathname?: string): unknown => {
  const { pathname: matched, node } = useCurrentRouteImpl(routes);
  if (pathname !== undefined) assertRouteMatches('useCurrentRouteNode', pathname, matched);
  return node;
};

type ParseParamsUntyped = (
  path: string,
  raw: Record<string, string | string[]>,
  options?: ParsePathParamsOptions,
) => Record<string, unknown>;

/** What a navigation call carries once the typed wrapper has erased its pathname generic. */
export type RawNavigateArgs = BuildHrefArgs & NavigateOptions;

export type RawTypedRouter = {
  push: (pathname: string, args?: RawNavigateArgs) => void;
  replace: (pathname: string, args?: RawNavigateArgs) => void;
  prefetch: (pathname: string, args?: RawNavigateArgs) => void;
  back: () => void;
  forward: () => void;
  refresh: () => void;
};

export const useTypedRouterImpl = (routes: RouteTree<unknown>, useResolveHref: UseRawResolveHref): RawTypedRouter => {
  const router = useRouter();
  const resolve = useResolveHref();

  return useMemo(() => {
    const hrefOf = (pathname: string, args?: RawNavigateArgs) => toHref(routes, resolve, pathname, args);

    // An absolute URL needs nothing special on `push`: the App Router hard-navigates to it.
    return {
      push: (pathname, args) => router.push(hrefOf(pathname, args), { scroll: args?.scroll }),
      replace: (pathname, args) => router.replace(hrefOf(pathname, args), { scroll: args?.scroll }),
      prefetch: (pathname, args) => {
        const href = hrefOf(pathname, args);
        if (!isAbsoluteUrl(href)) router.prefetch(href);
      },
      back: () => router.back(),
      forward: () => router.forward(),
      refresh: () => router.refresh(),
    };
  }, [router, routes, resolve]);
};
