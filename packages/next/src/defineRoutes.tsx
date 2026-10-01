import {
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
import type { ReactElement, Ref } from 'react';
import { useCurrentRouteImpl, useCurrentRouteNodeImpl, useTypedParamsImpl, useTypedRouterImpl, useTypedSearchParamsImpl } from './client';
import type { NavigateArgsTuple } from './navigation.types';
import { toResolverHook, type BindRoutesOptions } from './resolveHref';
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
  prefetch: <TPath extends RoutePaths<TTree>>(pathname: TPath, ...args: NavigateArgsTuple<TTree, TPath>) => void;
  back: () => void;
  forward: () => void;
  refresh: () => void;
};

export type TypedRoutes<TTree> = RouteTree<TTree> & {
  TypedLink: <TPath extends RoutePaths<TTree>>(props: TypedLinkProps<TTree, TPath> & { ref?: Ref<HTMLAnchorElement> }) => ReactElement;
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

/**
 * Gives a route tree built elsewhere — core's `defineRoutes`, core's `attachMetadata`, a
 * shared package — the hooks and `TypedLink`, without declaring it again.
 *
 * ```ts
 * import { bindRoutes } from '@hyeonqyu/typed-router-next';
 * import { routes as shared } from '@acme/shop-routes'; // declared with core
 *
 * export const routes = bindRoutes(shared);
 * ```
 *
 * The source's tree, paths and parsers are reused as they are, not rebuilt.
 *
 * Pass `useResolveHref` when some routes navigate elsewhere — see {@link BindRoutesOptions}.
 */
// `NoInfer`: the tree comes from `source` alone, so a loosely typed resolver cannot widen it.
export const bindRoutes = <TTree,>(source: RouteTree<TTree>, options?: BindRoutesOptions<NoInfer<TTree>>): TypedRoutes<TTree> => {
  const untyped = source as RouteTree<unknown>;
  const useResolveHref = toResolverHook(options);

  // The hooks below live behind a `'use client'` boundary. They are only *referenced*
  // here, never called, so this module stays importable from server components.
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
     * Read from the URL rather than `useParams()`, so catch-alls keep their declared name.
     *
     * The pathname is checked against the route the URL actually matched, so calling
     * this from a component rendered elsewhere throws instead of returning another
     * route's params under this route's types.
     */
    useTypedParams: (pathname, options) => useTypedParamsImpl(untyped, pathname, options) as never,

    /** The current search params, validated and coerced by the route's schema. */
    useTypedSearchParams: (pathname, options) => useTypedSearchParamsImpl(untyped, pathname, options) as never,

    useTypedRouter: () => useTypedRouterImpl(untyped, useResolveHref) as TypedRouter<TTree>,

    $types: {} as TypedRoutes<TTree>['$types'],
  };
};

const create = <TTree,>(tree: TTree): TypedRoutes<TTree> => bindRoutes(createRouteTree(tree));

/**
 * Declares a route tree and returns everything Next.js needs to navigate it type-safely.
 *
 * ```ts
 * export const routes = defineRoutes({
 *   products: {
 *     _metadata: { title: 'Products' },
 *     '[id]': { _metadata: { title: 'Detail' } },
 *   },
 * });
 * ```
 *
 * The returned object is safe to import from server components — only the hooks are
 * client-side, and calling one from a server component fails exactly the way calling
 * `useRouter` there would.
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
 * so the hooks and `TypedLink` see it like any other.
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
