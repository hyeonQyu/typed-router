/**
 * `@hyeonqyu/typed-router-next/pages` — the Pages Router entry, backed by `next/router`.
 *
 * Everything a Pages Router app needs is exported from here, so it never has to import
 * the package root, whose hooks sit on `next/navigation`.
 */
export type { CurrentRoute } from '../defineRoutes';
export type { NavigateOptions } from '../navigation.types';
export type { BindRoutesOptions, ResolveHref, ResolveHrefRoute } from '../resolveHref';
export type { TypedLinkProps } from '../TypedLink';
export { attachMetadata, bindRoutes, defineRoutes, type TypedRoutes } from './defineRoutes';
export { RouteNotReadyError } from './hooks';
export type { PagesNavigateArgs, PagesNavigateArgsTuple, PagesNavigateOptions } from './navigation.types';
export { RouterReady, useRouterReady } from './ready';

export {
  METADATA_KEY,
  PathParamsParseError,
  RouteMismatchError,
  SearchParamsParseError,
  buildHref,
  children,
  collectRoutes,
  isRouteGroup,
  matchRoute,
  parsePathParams,
  parseSearchParams,
  resolveMetadata,
  resolveMetadataValue,
  toSearchParamsString,
  type AnySchema,
  type AttachedTree,
  type BuiltinMetadata,
  type CollectedRouteOf,
  type MetadataPatch,
  type MetadataPatchWithMeta,
  type MetadataValue,
  type Params,
  type PathParamSchemas,
  type PathParams,
  type PathParamsErrorMode,
  type PathParamsOutput,
  type Pathname,
  type RawPathParams,
  type RouteArgs,
  type RouteChildren,
  type RouteMatch,
  type RouteMetadata,
  type RouteMetadataOf,
  type RouteNodeOf,
  type RoutePaths,
  type SearchParams,
  type SearchParamsErrorMode,
} from '@hyeonqyu/typed-router-core';
