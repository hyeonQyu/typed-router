import { attachMetadata, type CollectedRouteOf, type Pathname, type RouteMetadataOf } from '@hyeonqyu/typed-router-core';
import { deepRoutes, wideRoutes, type DeepRoutes, type WideRoutes } from './stress.fixtures';

/**
 * Scale regressions against `stress.fixtures.ts`: 1,260 routes wide, 30 levels
 * deep. The point is that this file keeps *compiling* — enumeration stays typed
 * at width, and depth stays inside the TS2589 ceiling (31 levels as of writing,
 * for `paths` and `collected` alike). Compare machinery costs with:
 *
 *   yarn tsc -p tests/tsconfig.json --extendedDiagnostics
 */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

type WideElem = (typeof wideRoutes.collected)[number];

// The collected union covers exactly the pathname union, 1,260 routes wide.
type _widePathsAlign = Expect<Equal<WideElem['path'], (typeof wideRoutes.paths)[number]>>;

// Metadata stays readable mid-enumeration at this width.
type _wideSpotEntry = Expect<
  Equal<CollectedRouteOf<WideRoutes, '/section1/[id]'>['metadata']['title'], 'Section 1 detail'>
>;
type _wideIconWhereDeclared = Expect<Equal<CollectedRouteOf<WideRoutes, '/section3'>['metadata']['icon'], 'star'>>;

// @ts-expect-error — `/section1` declares no `icon`
type _wideIconWhereNot = CollectedRouteOf<WideRoutes, '/section1'>['metadata']['icon'];

type DeepElem = (typeof deepRoutes.collected)[number];

// 30 levels deep: both machineries resolve without TS2589 and agree with each other.
type _deepPathsAlign = Expect<Equal<DeepElem['path'], (typeof deepRoutes.paths)[number]>>;
type _deepLeafReachable = Expect<
  Equal<Extract<DeepElem, { metadata: { title: 'Level 30' } }>['metadata']['title'], 'Level 30'>
>;

/*
 * `attachMetadata` over the same fixtures: the merge walks every node of the source, so
 * the wide tree is its width case and the deep tree its depth case. The result must keep
 * the source's pathnames exactly, and a patched route must read back its attached literal
 * while an unpatched one keeps the source's.
 *
 * Depth costs one level more here: every node of the result is a mapped type resolved on
 * demand, so a walk over it nests one extra instantiation per level. At the fixture's 30
 * levels `paths` and per-route lookups compile; the full `collected` union tops out at 29,
 * where a declared tree reaches 31. Hence the leaf is asserted by pathname below.
 */
const wideAttached = attachMetadata(wideRoutes).withMeta<{ icon: string }>()({
  '/section1': { icon: 'home' },
  '/section1/[id]/leaf4': { icon: 'leaf' },
  '/section60/child4/leaf4': { icon: 'last' },
});

type _wideAttachedPaths = Expect<Equal<Pathname<typeof wideAttached>, Pathname<WideRoutes>>>;
type _wideAttachedLiteral = Expect<Equal<RouteMetadataOf<typeof wideAttached, '/section60/child4/leaf4'>['icon'], 'last'>>;
type _wideAttachedMerged = Expect<Equal<RouteMetadataOf<typeof wideAttached, '/section1'>, { readonly title: 'Section 1'; readonly icon: 'home' }>>;
type _wideAttachedUntouched = Expect<
  Equal<RouteMetadataOf<typeof wideAttached, '/section2/child3'>, RouteMetadataOf<WideRoutes, '/section2/child3'>>
>;

const deepAttached = attachMetadata(deepRoutes)({
  '/l1/l2/l3/l4/l5/l6/l7/l8/l9/l10/l11/l12/l13/l14/l15/l16/l17/l18/l19/l20/l21/l22/l23/l24/l25/l26/l27/l28/l29/l30': { icon: 'bottom' },
});

type _deepAttachedPaths = Expect<Equal<Pathname<typeof deepAttached>, Pathname<DeepRoutes>>>;
type _deepAttachedLeaf = Expect<Equal<RouteMetadataOf<typeof deepAttached, '/l1/l2/l3/l4/l5/l6/l7/l8/l9/l10/l11/l12/l13/l14/l15/l16/l17/l18/l19/l20/l21/l22/l23/l24/l25/l26/l27/l28/l29/l30'>['icon'], 'bottom'>>;

export type {
  _deepAttachedLeaf,
  _deepAttachedPaths,
  _deepLeafReachable,
  _deepPathsAlign,
  _wideAttachedLiteral,
  _wideAttachedMerged,
  _wideAttachedPaths,
  _wideAttachedUntouched,
  _wideIconWhereDeclared,
  _wideIconWhereNot,
  _widePathsAlign,
  _wideSpotEntry,
};
