import {
  children,
  defineRoutes,
  type CollectedRoute,
  type CollectedRouteOf,
  type Params,
  type Pathname,
  type PathParams,
  type RouteChildren,
  type RouteMetadataOf,
  type SearchParams,
} from '@hyeonqyu/typed-router-core';
import { routes, typedParamRoutes, type Routes, type TypedParamRoutes } from './fixtures';

/**
 * Compile-time assertions. `Expect<...>` only accepts `true`, and every
 * `@ts-expect-error` below fails the build if the error it predicts stops happening —
 * so `tsc --noEmit` passing means both halves of this file hold.
 */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

/* ────────────────────────────────────────────────────────────────────────────
 * 1. Pathname union — route groups collapse, metadata-less nodes are excluded
 * ────────────────────────────────────────────────────────────────────────── */

type AllPaths = Pathname<Routes>;

type _pathnameUnion = Expect<
  Equal<
    AllPaths,
    | '/home'
    | '/products'
    | '/products/[id]'
    | '/products/[id]/reviews'
    | '/cart'
    | '/search'
    | '/docs/[...slug]'
    | '/files/[[...path]]'
    | '/internal/stats'
  >
>;

// @ts-expect-error — route groups do not contribute a URL segment
const groupPath: AllPaths = '/(shop)/products';

// @ts-expect-error — `internal` has no `_metadata`, so it is not a destination itself
const organisationalPath: AllPaths = '/internal';

/* ────────────────────────────────────────────────────────────────────────────
 * 2. Path params — typed per segment kind, optional only for optional catch-alls
 * ────────────────────────────────────────────────────────────────────────── */

type _dynamicParam = Expect<Equal<PathParams<'/products/[id]/reviews'>, { id: string | number }>>;
type _catchAllParam = Expect<Equal<PathParams<'/docs/[...slug]'>, { slug: readonly (string | number)[] }>>;
type _optionalCatchAll = Expect<Equal<PathParams<'/files/[[...path]]'>, { path?: readonly (string | number)[] }>>;
type _staticHasNoParams = Expect<Equal<keyof PathParams<'/cart'>, never>>;

// Passing the tree changes nothing for a tree that declares no `paramSchema`.
type _treeAwareIsUnchangedWithoutSchemas = Expect<Equal<PathParams<'/products/[id]', Routes['$types']['tree']>, { id: string | number }>>;
type _readsBackAsStrings = Expect<Equal<Params<Routes, '/products/[id]/reviews'>, { id: string }>>;
type _catchAllReadsAsStrings = Expect<Equal<Params<Routes, '/docs/[...slug]'>, { slug: string[] }>>;
type _optionalCatchAllReadsAsStrings = Expect<Equal<Params<Routes, '/files/[[...path]]'>, { path?: string[] }>>;

/* ────────────────────────────────────────────────────────────────────────────
 * 2b. A segment that declares a `paramSchema` reads back as that schema's output
 * ────────────────────────────────────────────────────────────────────────── */

type _declaredSegmentReadsAsNumber = Expect<Equal<Params<TypedParamRoutes, '/orgs/[orgId]'>, { orgId: number }>>;

// A nested route inherits every ancestor segment's declaration, declaring nothing itself.
type _inheritsOneAncestor = Expect<Equal<Params<TypedParamRoutes, '/orgs/[orgId]/projects'>, { orgId: number }>>;
type _inheritsTwoAncestors = Expect<
  Equal<Params<TypedParamRoutes, '/orgs/[orgId]/projects/[projectId]/settings'>, { orgId: number; projectId: string }>
>;

// A segment that declares nothing keeps reading as text, in the very same tree.
type _undeclaredStaysText = Expect<Equal<Params<TypedParamRoutes, '/posts/[slug]'>, { slug: string }>>;

// Catch-alls declare the whole list, since that is what the segment reads back as.
type _declaredCatchAll = Expect<Equal<Params<TypedParamRoutes, '/archive/[...date]'>, { date: number[] }>>;
type _declaredOptionalCatchAll = Expect<Equal<Params<TypedParamRoutes, '/gallery/[[...filters]]'>, { filters?: string[] }>>;

// The write side honours the declaration too, so a link cannot be built that the read side would reject.
typedParamRoutes.buildHref('/orgs/[orgId]/projects/[projectId]/settings', { params: { orgId: 1, projectId: 'abc' } });
typedParamRoutes.buildHref('/archive/[...date]', { params: { date: [2026, 8, 30] } });
typedParamRoutes.buildHref('/gallery/[[...filters]]', {});
typedParamRoutes.buildHref('/posts/[slug]', { params: { slug: 'hello' } });

// @ts-expect-error — `orgId` declares `z.number()`, so a string is not a valid link
typedParamRoutes.buildHref('/orgs/[orgId]', { params: { orgId: 'abc' } });

// @ts-expect-error — `date` declares a number list
typedParamRoutes.buildHref('/archive/[...date]', { params: { date: ['a'] } });

// `.default([])` makes the optional catch-all optional to write and present to read.
const galleryFilters: string[] | undefined = typedParamRoutes.parseParams('/gallery/[[...filters]]', {}).filters;

const parsedOrg = typedParamRoutes.parseParams('/orgs/[orgId]/projects/[projectId]', { orgId: '7', projectId: 'abc' });
type _parseParamsIsTyped = Expect<Equal<typeof parsedOrg, { orgId: number; projectId: string }>>;

/* ────────────────────────────────────────────────────────────────────────────
 * 3. buildHref — params required exactly when the path has dynamic segments
 * ────────────────────────────────────────────────────────────────────────── */

routes.buildHref('/cart');
routes.buildHref('/home');
routes.buildHref('/products/[id]', { params: { id: 42 } });
routes.buildHref('/products/[id]/reviews', { params: { id: 'abc' }, searchParams: { star: 5 } });
routes.buildHref('/docs/[...slug]', { params: { slug: ['a', 'b'] } });
routes.buildHref('/files/[[...path]]', {});
routes.buildHref('/search', { searchParams: { q: 'hi' } });
routes.buildHref('/search', { searchParams: { q: 'hi' }, hash: 'results' });

// @ts-expect-error — `/products/[id]` needs `params.id`
routes.buildHref('/products/[id]');

// @ts-expect-error — `params` is required, not optional, when the path is dynamic
routes.buildHref('/products/[id]', {});

// @ts-expect-error — wrong param name
routes.buildHref('/products/[id]', { params: { productId: 1 } });

// @ts-expect-error — `/cart` has no dynamic segments, so `params` is forbidden
routes.buildHref('/cart', { params: { id: 1 } });

// @ts-expect-error — `/cart` declares no schema, so arbitrary search params are rejected
routes.buildHref('/cart', { searchParams: { junk: 'yes' } });

// @ts-expect-error — `/search` requires `q`
routes.buildHref('/search', { searchParams: {} });

// @ts-expect-error — `q` must be a string
routes.buildHref('/search', { searchParams: { q: 123 } });

// @ts-expect-error — `category` is a closed enum
routes.buildHref('/search', { searchParams: { q: 'hi', category: 'toys' } });

// @ts-expect-error — unknown search param key
routes.buildHref('/search', { searchParams: { q: 'hi', typo: 1 } });

// @ts-expect-error — pathname is not part of the tree
routes.buildHref('/nope');

/* ────────────────────────────────────────────────────────────────────────────
 * 4. Schema input vs output — `.default()` is optional to write, present to read
 * ────────────────────────────────────────────────────────────────────────── */

routes.buildHref('/products', { searchParams: { sort: 'name' } });
routes.buildHref('/products', { searchParams: { page: 2, tags: ['a'], inStock: true } });

type _defaultedIsPresentOnRead = Expect<Equal<SearchParams<Routes, '/products'>['page'], number>>;
type _requiredString = Expect<Equal<SearchParams<Routes, '/search'>['q'], string>>;
type _optionalEnum = Expect<Equal<SearchParams<Routes, '/search'>['category'], 'electronics' | 'books' | undefined>>;
type _nestedSchema = Expect<Equal<SearchParams<Routes, '/products/[id]/reviews'>['star'], number>>;

/* ────────────────────────────────────────────────────────────────────────────
 * 5. Inference survives three levels of nesting behind a route group
 * ────────────────────────────────────────────────────────────────────────── */

const reviewParams = routes.parseSearchParams('/products/[id]/reviews', { star: '5' });
type _parsedShape = Expect<Equal<typeof reviewParams, { star: number }>>;

const reviewsMetadata = routes.getMetadata('/products/[id]/reviews');
type _metadataLiteral = Expect<Equal<(typeof reviewsMetadata)['title'], 'Reviews'>>;
type _metadataViaHelper = Expect<Equal<RouteMetadataOf<Routes, '/products'>['title'], 'Products'>>;

/* ────────────────────────────────────────────────────────────────────────────
 * 6. Runtime surface stays typed
 * ────────────────────────────────────────────────────────────────────────── */

const matched = routes.match('/products/123/reviews');
type _matchIsNullable = Expect<Equal<typeof matched, NonNullable<typeof matched> | null>>;
type _pathsAreTyped = Expect<Equal<(typeof routes.paths)[number], AllPaths>>;

/* ────────────────────────────────────────────────────────────────────────────
 * 7. Enumerating `collected` keeps every route's path and metadata typed
 * ────────────────────────────────────────────────────────────────────────── */

type CollectedElem = (typeof routes.collected)[number];

type _collectedPathsMatchPathnames = Expect<Equal<CollectedElem['path'], AllPaths>>;
type _collectedMetadataIsNeverUndefined = Expect<Equal<Extract<CollectedElem['metadata'], undefined>, never>>;

// A field every route declares reads without a cast — renaming it in the tree breaks this line.
type _collectedTitleUnion = Expect<
  Equal<
    CollectedElem['metadata']['title'],
    'Home' | 'Products' | 'Product detail' | 'Reviews' | 'Cart' | 'Search' | 'Docs' | 'Files' | 'Stats'
  >
>;

// The union discriminates on `path`, so ordinary control flow narrows metadata per route.
const narrowedTitles = routes.collected.map((route) => (route.path === '/cart' ? route.metadata.title : null));
type _collectedNarrowsInControlFlow = Expect<Equal<(typeof narrowedTitles)[number], 'Cart' | null>>;

type _collectedRouteOfIsTheElementUnion = Expect<Equal<CollectedRouteOf<Routes>, CollectedElem>>;
type _collectedRouteOfPicksOneRoute = Expect<Equal<CollectedRouteOf<Routes, '/search'>['metadata']['title'], 'Search'>>;

// The precise union stays assignable to the loose runtime shape adapters accept.
const looseCollected: readonly CollectedRoute[] = routes.collected;

// @ts-expect-error — `searchParamsSchema` is declared on only some routes, so it must be narrowed first
void routes.collected[0].metadata.searchParamsSchema;

// @ts-expect-error — `/products` declares no `label`
type _productsHasNoLabel = CollectedRouteOf<Routes, '/products'>['metadata']['label'];

/* ────────────────────────────────────────────────────────────────────────────
 * 8. `withMeta` — the shared contract stays readable when enumerating
 * ────────────────────────────────────────────────────────────────────────── */

const metaRoutes = defineRoutes.withMeta<{ title: string; icon?: string }>()({
  dashboard: { _metadata: { title: 'Dashboard', icon: 'gauge' } },
  settings: { _metadata: { title: 'Settings' } },
});

type MetaCollectedElem = (typeof metaRoutes.collected)[number];

// The contract field every route declares reads straight off each element, as its literal type.
type _withMetaTitleUnion = Expect<Equal<MetaCollectedElem['metadata']['title'], 'Dashboard' | 'Settings'>>;
const withMetaTitle: string = metaRoutes.collected[0].metadata.title;

// An optional contract field declared on one route narrows by path instead of degrading to `unknown`.
type _withMetaIconNarrows = Expect<Equal<Extract<MetaCollectedElem, { path: '/dashboard' }>['metadata']['icon'], 'gauge'>>;

// @ts-expect-error — `icon` is missing on `/settings`, so the union refuses blind access
void metaRoutes.collected[0].metadata.icon;

/* ────────────────────────────────────────────────────────────────────────────
 * 9. children() — metadata gone from the type, literals intact
 * ────────────────────────────────────────────────────────────────────────── */

const topLevel = children(routes.routes);
const shop = children(routes.routes['(shop)']);
const products = children(routes.routes['(shop)'].products);

// Route group keys are children like any other — `children` strips metadata, nothing else.
type _childrenKeepsGroups = Expect<Equal<keyof typeof topLevel, 'home' | '(shop)' | 'search' | 'docs' | 'files' | 'internal'>>;

// The metadata key is gone even though the node declares it.
type _childrenDropsMetadata = Expect<Equal<keyof typeof products, '[id]'>>;

// A leaf that declares only metadata has no children.
type _childrenOfLeafIsEmpty = Expect<Equal<keyof ReturnType<typeof children<(typeof routes.routes)['search']>>, never>>;

// Per-node literal inference survives the call: `title` is still the literal, not `string`.
type _childrenKeepsLiterals = Expect<Equal<(typeof shop)['cart']['_metadata']['title'], 'Cart'>>;

// @ts-expect-error — `_metadata` is not a property of the children view
void topLevel._metadata;

/**
 * A union of nodes — what an unchecked `useCurrentRouteNode()` hands back — is stripped
 * member by member. A non-distributive `Omit` would key off the union's *shared* keys,
 * which is only `_metadata`, and report the node as having no children at all.
 */
type HomeNode = (typeof routes.routes)['home'];
type ProductsNode = (typeof routes.routes)['(shop)']['products'];

type _childrenDistributesOverUnions = Expect<
  Equal<RouteChildren<HomeNode | ProductsNode>, RouteChildren<HomeNode> | RouteChildren<ProductsNode>>
>;

// The member that has children still has them, rather than collapsing to `{}`.
type _childrenOfUnionKeepsSegments = Expect<Equal<keyof Extract<RouteChildren<HomeNode | ProductsNode>, { '[id]': unknown }>, '[id]'>>;

export type {
  _catchAllParam,
  _catchAllReadsAsStrings,
  _childrenDistributesOverUnions,
  _childrenDropsMetadata,
  _childrenKeepsGroups,
  _childrenKeepsLiterals,
  _childrenOfLeafIsEmpty,
  _childrenOfUnionKeepsSegments,
  _collectedMetadataIsNeverUndefined,
  _collectedNarrowsInControlFlow,
  _collectedPathsMatchPathnames,
  _collectedRouteOfIsTheElementUnion,
  _collectedRouteOfPicksOneRoute,
  _collectedTitleUnion,
  _declaredCatchAll,
  _declaredOptionalCatchAll,
  _declaredSegmentReadsAsNumber,
  _defaultedIsPresentOnRead,
  _dynamicParam,
  _inheritsOneAncestor,
  _inheritsTwoAncestors,
  _matchIsNullable,
  _metadataLiteral,
  _metadataViaHelper,
  _nestedSchema,
  _optionalCatchAll,
  _optionalCatchAllReadsAsStrings,
  _optionalEnum,
  _parseParamsIsTyped,
  _parsedShape,
  _pathnameUnion,
  _pathsAreTyped,
  _productsHasNoLabel,
  _readsBackAsStrings,
  _requiredString,
  _staticHasNoParams,
  _treeAwareIsUnchangedWithoutSchemas,
  _undeclaredStaysText,
  _withMetaIconNarrows,
  _withMetaTitleUnion,
};
export { galleryFilters, groupPath, looseCollected, narrowedTitles, organisationalPath, parsedOrg, products, shop, topLevel, withMetaTitle };
