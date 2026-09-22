export { createRouteTree, resolveMetadata, resolveMetadataValue, type RouteTree } from './createRouteTree';
export {
  defineRoutes,
  type CollectedRouteOf,
  type Params,
  type Pathname,
  type RouteMetadataOf,
  type RouteNodeOf,
  type SearchParams,
  type TypedRoutes,
} from './defineRoutes';

export type {
  GetRouteMetadata,
  GetRouteNode,
  MetadataKey,
  PathParamValue,
  PathParams,
  PathParamsOutput,
  RouteGroupKey,
  RoutePaths,
  SegmentKeys,
  Simplify,
  UseCurrentRouteNode,
} from './path.types';

export {
  METADATA_KEY,
  RouteMismatchError,
  assertRouteMatches,
  buildHref,
  collectRoutes,
  isRouteGroup,
  isSameOrAncestorRoute,
  matchRoute,
  parseSegment,
  splitPath,
  toSearchParamsString,
  type BuildHrefArgs,
  type CollectedRoute,
  type GetCollectedRoute,
  type RouteMatch,
  type RouteParams,
  type SegmentPattern,
} from './path.utils';

export {
  PathParamsParseError,
  parsePathParams,
  type ParsePathParamsOptions,
  type PathParamSchemas,
  type PathParamsErrorMode,
  type RawPathParams,
} from './pathParams.utils';

export type { AnySchema, InferSchemaInput, InferSchemaOutput, ParsableSchema } from './schema.types';

export {
  SearchParamsParseError,
  collectRawSearchParams,
  parseSearchParams,
  type ParseSearchParamsOptions,
  type RawSearchParams,
  type SearchParamsErrorMode,
} from './searchParams.utils';

export type {
  BuiltinMetadata,
  HasRequiredKeys,
  MetadataValue,
  ParsedPathParams,
  PathParamsInput,
  ResolvableMetadataKey,
  ResolvedMetadata,
  RouteArgs,
  RouteArgsTuple,
  RouteMetadata,
  RouteNodeInput,
  RouteNodeInputWithMeta,
  RouteTreeInput,
  RouteTreeInputWithMeta,
  SearchParamsInput,
  SearchParamsOutput,
} from './tree.types';

export { children, type RouteChildren } from './tree.utils';
