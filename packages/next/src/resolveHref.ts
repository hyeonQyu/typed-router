import { buildHref, type BuildHrefArgs, type RouteMetadata, type RoutePaths, type RouteTree } from '@hyeonqyu/typed-router-core';

/** The route a navigation is headed for, as `useResolveHref`'s resolver sees it. */
export type ResolveHrefRoute<TTree> = BuildHrefArgs & {
  /** The declared pathname, e.g. `/products/[id]`. */
  pathname: RoutePaths<TTree>;
  /** The route's declared metadata. The library reads no key of it; the resolver decides which one matters. */
  metadata: RouteMetadata;
};

/** Returns a URL to navigate to instead of the route's own pathname, or `undefined` to keep it. */
export type ResolveHref<TTree> = (route: ResolveHrefRoute<TTree>) => string | undefined;

export type BindRoutesOptions<TTree> = {
  /**
   * A hook returning a resolver that `push`, `replace`, `prefetch` and `TypedLink` consult
   * before building the route's own href — for entries that live elsewhere, like a blog on
   * another domain. Being a hook, it can read the locale or any other React context.
   *
   * ```ts
   * bindRoutes(routes, {
   *   useResolveHref: () => {
   *     const { language } = useLocale();
   *     return useCallback(({ metadata }) => (typeof metadata.href === 'function' ? metadata.href({ language }) : undefined), [language]);
   *   },
   * });
   * ```
   *
   * Return the same function across renders (`useCallback`): `useTypedRouter` hands out a
   * new router object whenever it changes. With this option set, `TypedLink` runs the hook
   * too, so render it from client components.
   */
  useResolveHref?: () => ResolveHref<TTree>;
};

/** What the adapter calls once the typed wrapper has erased the pathname generic. */
export type UseRawResolveHref = () => ResolveHref<unknown> | undefined;

/**
 * Stands in for `useResolveHref` when none was given. It calls no React hook, so a
 * `TypedLink` without the option still renders in a server component.
 */
const useNoResolver: UseRawResolveHref = () => undefined;

export const toResolverHook = <TTree>(options?: BindRoutesOptions<TTree>): UseRawResolveHref =>
  (options?.useResolveHref as UseRawResolveHref | undefined) ?? useNoResolver;

/** The resolver's URL when it returns one, the route's own href otherwise. */
export const toHref = (
  routes: RouteTree<unknown>,
  resolve: ResolveHref<unknown> | undefined,
  pathname: string,
  args?: BuildHrefArgs,
): string => {
  const resolved = resolve?.({
    pathname: pathname as never,
    metadata: (routes.getMetadata(pathname as never) as RouteMetadata | undefined) ?? {},
    params: args?.params,
    searchParams: args?.searchParams,
    hash: args?.hash,
  });

  return resolved ?? buildHref(pathname, args);
};

/** `https://…`, `mailto:…`, `//cdn…` — a URL that leaves the app, so there is nothing to prefetch. */
export const isAbsoluteUrl = (href: string): boolean => /^(?:[a-z][a-z\d+\-.]*:|\/\/)/i.test(href);
