import {
  createRouteTree,
  mergeRouteMetadata,
  type AttachedTree,
  type MetadataPatch,
  type MetadataPatchWithMeta,
  type OnlyRoutePaths,
  type RouteMetadata,
  type RoutePaths,
  type RouteTree,
  type RouteTreeInput,
  type RouteTreeInputWithMeta,
  type UseCurrentRouteNode,
} from '@hyeonqyu/typed-router-core';
// Types only, and erased: the App Router entry's runtime never reaches this module.
import type { TypedRoutes as AppTypedRoutes, CurrentRoute } from '../defineRoutes';
import { toResolverHook, type BindRoutesOptions } from '../resolveHref';
import { createTypedLink } from '../TypedLink';
import { useCurrentRouteImpl, useCurrentRouteNodeImpl, useTypedParamsImpl, useTypedRouterImpl, useTypedSearchParamsImpl } from './hooks';
import type { PagesNavigateArgsTuple } from './navigation.types';

export type TypedRouter<TTree> = {
  /** Resolves to whether the navigation completed, as `next/router`'s `push` does. */
  push: <TPath extends RoutePaths<TTree>>(pathname: TPath, ...args: PagesNavigateArgsTuple<TTree, TPath>) => Promise<boolean>;
  replace: <TPath extends RoutePaths<TTree>>(pathname: TPath, ...args: PagesNavigateArgsTuple<TTree, TPath>) => Promise<boolean>;
  /** Production only, as in Next: prefetching is a no-op under `next dev`. */
  prefetch: <TPath extends RoutePaths<TTree>>(pathname: TPath, ...args: PagesNavigateArgsTuple<TTree, TPath>) => Promise<void>;
  back: () => void;
  forward: () => void;
  /**
   * Re-navigates to the current URL, so the page's data fetching runs again while client
   * state survives — the Pages Router's nearest equivalent of the App Router's `refresh()`.
   */
  refresh: () => Promise<boolean>;
};

/** The same surface as the App Router entry's `TypedRoutes`, with `next/router` behind it. */
export type TypedRoutes<TTree> = Omit<AppTypedRoutes<TTree>, 'useTypedRouter'> & {
  useTypedRouter: () => TypedRouter<TTree>;
};

const bind = <TTree,>(source: RouteTree<TTree>, options?: BindRoutesOptions<TTree>): TypedRoutes<TTree> => {
  const untyped = source as RouteTree<unknown>;
  const useResolveHref = toResolverHook(options);

  return {
    ...source,

    TypedLink: createTypedLink<TTree>(untyped, useResolveHref),

    useCurrentRoute: () => useCurrentRouteImpl(untyped) as CurrentRoute<TTree>,

    /** The declared route pattern of the current URL (`/products/[id]`, not `/products/123`). */
    useTypedPathname: () => useCurrentRouteImpl(untyped).pathname as RoutePaths<TTree> | null,

    /** The tree node behind the current URL, checked against the pathname when one is given. */
    useCurrentRouteNode: ((pathname?: string) => useCurrentRouteNodeImpl(untyped, pathname)) as UseCurrentRouteNode<TTree>,

    /**
     * The dynamic segments of the current URL, typed from the pathname you pass and
     * validated by whatever `paramSchema` each of its segments declared.
     *
     * The pathname is checked against the page Next rendered, so calling this from a
     * component rendered elsewhere throws instead of returning another route's params
     * under this route's types. On a statically optimized dynamic page it also throws
     * `RouteNotReadyError` until hydration has filled the segments in.
     */
    useTypedParams: (pathname, options) => useTypedParamsImpl(untyped, pathname, options) as never,

    /**
     * The current search params, validated and coerced by the route's schema. Throws
     * `RouteNotReadyError` until `router.isReady`, which a statically rendered page only
     * reaches after hydration.
     */
    useTypedSearchParams: (pathname, options) => useTypedSearchParamsImpl(untyped, pathname, options) as never,

    useTypedRouter: () => useTypedRouterImpl(untyped, useResolveHref) as TypedRouter<TTree>,

    $types: {} as TypedRoutes<TTree>['$types'],
  };
};

/**
 * Gives a route tree built elsewhere — core's `defineRoutes`, core's `attachMetadata`, a
 * shared package — the Pages Router hooks and `TypedLink`, without declaring it again.
 *
 * ```ts
 * import { bindRoutes } from '@hyeonqyu/typed-router-next/pages';
 * import { routes as shared } from '@acme/shop-routes'; // declared with core
 *
 * export const { useTypedRouter, TypedLink, useTypedParams, useTypedSearchParams, useCurrentRoute } = bindRoutes(shared);
 * ```
 *
 * The source's tree, paths and parsers are reused as they are, not rebuilt.
 *
 * Pass `useResolveHref` when some routes navigate elsewhere — see {@link BindRoutesOptions}.
 */
// The tree is read off the source (`TSource['routes']`) rather than inferred back out of
// `RouteTree<TTree>`: solving `TTree` from members like `paths: RoutePaths<TTree>[]` is what
// costs instantiations in proportion to the tree, and gives up on a large one (TS2589 / TS2590).
// `NoInfer`: the tree comes from `source` alone, so a loosely typed resolver cannot widen it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any tree is accepted; its type comes from `routes`
export const bindRoutes = <TSource extends RouteTree<any>>(
  source: TSource,
  options?: BindRoutesOptions<NoInfer<TSource['routes']>>,
): TypedRoutes<TSource['routes']> => bind<TSource['routes']>(source, options);

const create = <TTree,>(tree: TTree): TypedRoutes<TTree> => bind(createRouteTree(tree));

/**
 * Declares a route tree and returns everything the Next.js Pages Router needs to
 * navigate it type-safely. Keys mirror `pages/`: `products/[id].tsx` is
 * `products: { '[id]': { _metadata: {} } }`, and `pages/index.tsx` is the `''` key.
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
 * declares only the structure — by pathname, and returns the Pages Router adapter on
 * the result.
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
