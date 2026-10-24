import {
  mergeRouteMetadata,
  type AttachedTree,
  type MetadataPatch,
  type MetadataPatchWithMeta,
  type OnlyRoutePaths,
} from './attachMetadata';
import { createRouteTree, type RouteTree } from './createRouteTree';
import type { GetRouteMetadata, GetRouteNode, RoutePaths } from './path.types';
import type { GetCollectedRoute } from './path.utils';
import type { ParsedPathParams, RouteMetadata, RouteTreeInput, RouteTreeInputWithMeta, SearchParamsOutput } from './tree.types';

export type TypedRoutes<TTree> = RouteTree<TTree> & {
  /** Type-only carrier, so `typeof routes.$types.pathname` works without extra imports. */
  $types: {
    tree: TTree;
    pathname: RoutePaths<TTree>;
  };
};

const create = <TTree>(tree: TTree): TypedRoutes<TTree> => ({
  ...createRouteTree(tree),
  $types: {} as TypedRoutes<TTree>['$types'],
});

const defineRoutesBase = <const TTree extends RouteTreeInput>(tree: TTree): TypedRoutes<TTree> => create(tree);

/**
 * Declares a route tree. No generics, no currying — metadata is inferred per node,
 * so each route may carry exactly the fields it needs.
 *
 * ```ts
 * const routes = defineRoutes({
 *   products: {
 *     _metadata: { title: 'Products', searchParamsSchema: z.object({ page: z.number().optional() }) },
 *     '[id]': { _metadata: { title: 'Product detail' } },
 *   },
 * });
 * ```
 *
 * Use `defineRoutes.withMeta<TMetadata, TContext>()` when every node should share a
 * metadata contract instead.
 */
export const defineRoutes = Object.assign(defineRoutesBase, {
  withMeta:
    <TMetadata extends RouteMetadata, TContext = unknown>() =>
    <const TTree extends RouteTreeInputWithMeta<TMetadata, TContext>>(tree: TTree): TypedRoutes<TTree> =>
      create(tree),
});

/**
 * Attaches metadata to a tree declared elsewhere, by pathname, without declaring the
 * tree again. The shared package keeps the structure; each app attaches its own view.
 *
 * ```ts
 * // shared package — structure only
 * export const accountRoutes = defineRoutes({ info: { _metadata: {} }, activity: { _metadata: {} } });
 *
 * // the owning app
 * export const ia = attachMetadata(accountRoutes).withMeta<{ title: TranslationKey }>()({
 *   '/info': { title: 'GNB_USER_INFO' },
 *   '/activity': { title: 'GNB_MY_ACTIVITY' },
 * });
 * ```
 *
 * Keys are the source's pathnames, so removing a route there breaks every consumer still
 * attaching to it. Each entry is merged over the source's `_metadata`; routes left out
 * keep theirs. `paramSchema` and `searchParamsSchema` stay the source's and cannot be set
 * here. The source is not mutated, and the result is a route tree like any other.
 */
export const attachMetadata = <TTree>(source: { routes: TTree }) =>
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

type TreeOf<TRoutes> = TRoutes extends { routes: infer TTree } ? TTree : never;

/** Every navigable pathname of a route tree: `Pathname<typeof routes>`. */
export type Pathname<TRoutes> = RoutePaths<TreeOf<TRoutes>>;

/** The parsed search params of one route: `SearchParams<typeof routes, '/search'>`. */
export type SearchParams<TRoutes, TPath extends string> = SearchParamsOutput<TreeOf<TRoutes>, TPath>;

/** The parsed path params of one route: `Params<typeof routes, '/products/[id]'>`. */
export type Params<TRoutes, TPath extends string> = ParsedPathParams<TreeOf<TRoutes>, TPath>;

/** The tree node behind one route: `RouteNodeOf<typeof routes, '/products/[id]'>`. */
export type RouteNodeOf<TRoutes, TPath extends string> = GetRouteNode<TreeOf<TRoutes>, TPath>;

/** The metadata behind one route: `RouteMetadataOf<typeof routes, '/products'>`. */
export type RouteMetadataOf<TRoutes, TPath extends string> = GetRouteMetadata<TreeOf<TRoutes>, TPath>;

/**
 * One element of `routes.collected`: `CollectedRouteOf<typeof routes>` is the whole union,
 * `CollectedRouteOf<typeof routes, '/products'>` picks one route's entry.
 */
export type CollectedRouteOf<TRoutes, TPath extends Pathname<TRoutes> = Pathname<TRoutes>> = Extract<
  GetCollectedRoute<TreeOf<TRoutes>>,
  { path: TPath }
>;
