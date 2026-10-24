import {
  assertRouteMatches,
  buildHref,
  createRouteTree,
  mergeRouteMetadata,
  type AttachedTree,
  type MetadataPatch,
  type MetadataPatchWithMeta,
  type OnlyRoutePaths,
  type ParsePathParamsOptions,
  type ParseSearchParamsOptions,
  type PathParamsOutput,
  type RouteMatch,
  type RouteMetadata,
  type RoutePaths,
  type RouteTree,
  type RouteTreeInput,
  type RouteTreeInputWithMeta,
  type SearchParamsOutput,
  type UseCurrentRouteNode,
} from '@hyeonqyu/typed-router-core';
import { useMemo, type ReactElement, type Ref } from 'react';
import { useLocation, useNavigate, useRoutes, type RouteObject } from 'react-router-dom';
import type { NavigateArgsTuple, RawNavigateArgs } from './navigation.types';
import { toRouteObjects } from './toRouteObjects';
import { createTypedLink, type TypedLinkProps } from './TypedLink';

export type CurrentRoute<TTree> = {
  /** The declared route pattern, e.g. `/products/[id]` — `null` when nothing matches. */
  pathname: RoutePaths<TTree> | null;
  /** The live URL pathname, e.g. `/products/123`. */
  url: string;
  node: RouteMatch['node'] | null;
  metadata: RouteMetadata | null;
  params: Record<string, string | string[]>;
};

export type TypedRouter<TTree> = {
  push: <TPath extends RoutePaths<TTree>>(pathname: TPath, ...args: NavigateArgsTuple<TTree, TPath>) => void;
  replace: <TPath extends RoutePaths<TTree>>(pathname: TPath, ...args: NavigateArgsTuple<TTree, TPath>) => void;
  /**
   * No-op in React Router's library mode, which has no client-side prefetching.
   * Kept so navigation code ports between the React and Next.js adapters unchanged.
   */
  prefetch: <TPath extends RoutePaths<TTree>>(pathname: TPath, ...args: NavigateArgsTuple<TTree, TPath>) => void;
  back: () => void;
  forward: () => void;
  /** Re-navigates to the current entry, re-running loaders in a data router. */
  refresh: () => void;
};

export type TypedRoutes<TTree> = RouteTree<TTree> & {
  TypedLink: <TPath extends RoutePaths<TTree>>(props: TypedLinkProps<TTree, TPath> & { ref?: Ref<HTMLAnchorElement> }) => ReactElement;
  /** Plain React Router `RouteObject[]` built from the tree — yours to modify. */
  toRouteObjects: () => RouteObject[];
  /** Renders the generated routes. Convenience wrapper over `useRoutes(toRouteObjects())`. */
  TypedRoutes: () => ReactElement | null;
  useCurrentRoute: () => CurrentRoute<TTree>;
  useCurrentRouteNode: UseCurrentRouteNode<TTree>;
  useTypedParams: <TPath extends RoutePaths<TTree>>(pathname: TPath, options?: ParsePathParamsOptions) => PathParamsOutput<TPath, TTree>;
  useTypedPathname: () => RoutePaths<TTree> | null;
  useTypedRouter: () => TypedRouter<TTree>;
  useTypedSearchParams: <TPath extends RoutePaths<TTree>>(
    pathname: TPath,
    options?: ParseSearchParamsOptions,
  ) => SearchParamsOutput<TTree, TPath>;
  $types: { tree: TTree; pathname: RoutePaths<TTree> };
};

type RawTypedRouter = {
  push: (pathname: string, args?: RawNavigateArgs) => void;
  replace: (pathname: string, args?: RawNavigateArgs) => void;
  prefetch: (pathname: string, args?: RawNavigateArgs) => void;
  back: () => void;
  forward: () => void;
  refresh: () => void;
};

const useRawTypedRouter = (): RawTypedRouter => {
  const navigate = useNavigate();

  return useMemo(() => {
    const toHref = (pathname: string, args?: RawNavigateArgs) => buildHref(pathname, args);

    return {
      push: (pathname, args) => navigate(toHref(pathname, args), args),
      replace: (pathname, args) => navigate(toHref(pathname, args), { ...args, replace: true }),
      prefetch: () => undefined,
      back: () => navigate(-1),
      forward: () => navigate(1),
      refresh: () => navigate(0),
    };
  }, [navigate]);
};

const create = <TTree,>(tree: TTree): TypedRoutes<TTree> => {
  const routes = createRouteTree(tree);

  type Pathname = RoutePaths<TTree>;

  const buildRouteObjects = () => toRouteObjects(routes.routes);

  /** Resolves the live URL back to the declared route it came from. */
  const useCurrentRoute = (): CurrentRoute<TTree> => {
    const { pathname: url } = useLocation();

    return useMemo(() => {
      const matched = routes.match(url);

      return {
        pathname: (matched?.path ?? null) as Pathname | null,
        url,
        node: matched?.node ?? null,
        metadata: (matched?.metadata as RouteMetadata | undefined) ?? null,
        params: matched?.params ?? {},
      };
    }, [url]);
  };

  /** The current path params, validated and coerced by each segment's declared schema. */
  const useTypedParams = <TPath extends Pathname>(pathname: TPath, options?: ParsePathParamsOptions): PathParamsOutput<TPath, TTree> => {
    const { pathname: matched, params } = useCurrentRoute();
    const onError = options?.onError;

    // Outside the memo, so every render is checked rather than only the ones that recompute.
    assertRouteMatches('useTypedParams', pathname, matched);

    return useMemo(() => routes.parseParams(pathname, params, { onError }), [pathname, params, onError]);
  };

  /** The tree node behind the current URL, checked against the pathname when one is given. */
  const useCurrentRouteNode = ((pathname?: Pathname) => {
    const { pathname: matched, node } = useCurrentRoute();
    if (pathname !== undefined) assertRouteMatches('useCurrentRouteNode', pathname, matched);
    return node;
  }) as UseCurrentRouteNode<TTree>;

  /** The current search params, validated and coerced by the route's schema. */
  const useTypedSearchParams = <TPath extends Pathname>(
    pathname: TPath,
    options?: ParseSearchParamsOptions,
  ): SearchParamsOutput<TTree, TPath> => {
    const { search } = useLocation();
    const onError = options?.onError;

    return useMemo(
      () => routes.parseSearchParams(pathname, Array.from(new URLSearchParams(search).entries()), { onError }),
      [pathname, search, onError],
    );
  };

  return {
    ...routes,

    TypedLink: createTypedLink<TTree>(),

    toRouteObjects: buildRouteObjects,

    TypedRoutes: () => useRoutes(buildRouteObjects()),

    useCurrentRoute,

    /** The declared route pattern of the current URL (`/products/[id]`, not `/products/123`). */
    useTypedPathname: () => useCurrentRoute().pathname,

    useCurrentRouteNode,

    /**
     * The dynamic segments of the current URL, typed from the pathname you pass and
     * validated by whatever `paramSchema` each of its segments declared.
     * Read from the URL rather than `useParams()`, so catch-alls keep their declared
     * name instead of React Router's anonymous `*`.
     *
     * The pathname is checked against the route the URL actually matched, so calling
     * this from a component rendered elsewhere throws instead of returning another
     * route's params under this route's types.
     */
    useTypedParams,

    useTypedSearchParams,

    useTypedRouter: () => useRawTypedRouter() as TypedRouter<TTree>,

    $types: {} as TypedRoutes<TTree>['$types'],
  };
};

/**
 * Declares a route tree and returns everything React Router needs to navigate it
 * type-safely — including the router configuration itself.
 *
 * ```tsx
 * export const routes = defineRoutes({
 *   products: {
 *     _metadata: { title: 'Products', element: <ProductList /> },
 *     '[id]': { _metadata: { title: 'Detail', element: <ProductDetail /> } },
 *   },
 * });
 *
 * createBrowserRouter(routes.toRouteObjects());
 * ```
 *
 * Use `defineRoutes.withMeta<TMetadata, TContext>()` when every node should share a
 * metadata contract.
 */
export const defineRoutes = Object.assign(<const TTree extends RouteTreeInput>(tree: TTree): TypedRoutes<TTree> => create(tree), {
  withMeta:
    <TMetadata extends RouteMetadata, TContext = unknown>() =>
    <const TTree extends RouteTreeInputWithMeta<TMetadata, TContext>>(tree: TTree): TypedRoutes<TTree> =>
      create(tree),
});

/**
 * Attaches metadata to a tree declared elsewhere — typically a shared package that
 * declares only the structure — by pathname, and returns the full adapter on the result,
 * so the hooks, `TypedLink` and `toRouteObjects` see it like any other.
 *
 * ```ts
 * export const routes = attachMetadata(accountRoutes).withMeta<{ title: TranslationKey }>()({
 *   '/info': { title: 'GNB_USER_INFO' },
 * });
 * ```
 *
 * Keys are the source's pathnames. Each entry is merged over the source's `_metadata`;
 * routes left out keep theirs, and `paramSchema` / `searchParamsSchema` stay the
 * source's. The source is not mutated.
 */
export const attachMetadata = <TTree,>(source: { routes: TTree }) =>
  Object.assign(
    <const TPatch extends MetadataPatch<TTree>>(patch: TPatch & OnlyRoutePaths<TTree, TPatch>): TypedRoutes<AttachedTree<TTree, TPatch>> =>
      create<AttachedTree<TTree, TPatch>>(mergeRouteMetadata<TTree, TPatch>(source.routes, patch)),
    {
      withMeta:
        <TMetadata extends RouteMetadata, TContext = unknown>() =>
        <const TPatch extends MetadataPatchWithMeta<TTree, TMetadata, TContext>>(
          patch: TPatch & OnlyRoutePaths<TTree, TPatch>,
        ): TypedRoutes<AttachedTree<TTree, TPatch>> =>
          create<AttachedTree<TTree, TPatch>>(mergeRouteMetadata<TTree, TPatch>(source.routes, patch)),
    },
  );
