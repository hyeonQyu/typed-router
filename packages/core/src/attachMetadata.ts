import type { MetadataKey, RouteGroupKey, RoutePaths, Simplify } from './path.types';
import { collectRoutes, isRouteGroup, METADATA_KEY } from './path.utils';
import type { BuiltinMetadata, RouteMetadata } from './tree.types';

/**
 * Metadata fields that belong to the tree's structure rather than to one app's view of
 * it: they decide which URLs parse and how. A shared tree declares them once, and every
 * consumer that attaches metadata inherits them as they are.
 */
type StructuralKey = 'paramSchema' | 'searchParamsSchema';

const STRUCTURAL_KEYS: readonly StructuralKey[] = ['paramSchema', 'searchParamsSchema'];

type NoStructuralFields = { readonly [K in StructuralKey]?: never };

/** Metadata to attach to an existing tree, keyed by the pathnames it declares. */
export type MetadataPatch<TTree> = {
  readonly [P in RoutePaths<TTree>]?: RouteMetadata & NoStructuralFields;
};

/** {@link MetadataPatch} under a shared contract, as `defineRoutes.withMeta` enforces it. */
export type MetadataPatchWithMeta<TTree, TMetadata, TContext> = {
  readonly [P in RoutePaths<TTree>]?: TMetadata & Omit<BuiltinMetadata<TContext>, StructuralKey> & NoStructuralFields;
};

/**
 * Rejects every key of a patch that is not a pathname of the tree.
 *
 * An object literal written inline already gets excess-property checking from the
 * constraint, but a patch declared first and passed by name does not — it is only
 * checked for assignability, and an extra key is assignable. Mapping each such key to
 * `never` closes that gap, so a deleted route is a compile error for every consumer
 * that still attaches metadata to it, however the patch was written.
 */
export type OnlyRoutePaths<TTree, TPatch> = {
  readonly [K in Exclude<keyof TPatch, RoutePaths<TTree>>]: never;
};

/** Source fields the patch does not mention survive; the ones it does mention are replaced. */
type MergeMetadata<TSource, TAttached> = Simplify<Omit<TSource, keyof TAttached> & TAttached>;

/**
 * The tree with a patch applied: the same shape, node for node, with each patched
 * route's `_metadata` merged. Mirrors {@link mergeRouteMetadata}'s walk.
 *
 * `TSelf` is the pathname the node's own `_metadata` answers to. A route group adds no
 * URL segment and is never itself a route, so it carries `''` — which no pathname is —
 * and its metadata, if it has any, is left as it was: the same rule `collectRoutes`
 * applies.
 *
 * Every conditional here is paid once per level by anything that walks the result, and
 * the walks already sit close to TypeScript's instantiation-depth limit on deep trees
 * (see `RoutePaths`). So the walk takes one branch per key and nothing more: `''`
 * rather than `never` for "no route", and `K & string` rather than a `K extends string`
 * test. It still costs a level: the full `collected` union of an attached tree compiles
 * to 29 levels deep where a declared one reaches 31 (`tests/stress.types.test-d.ts`).
 */
export type AttachedTree<TTree, TPatch> = AttachNode<TTree, TPatch, '', ''>;

type AttachNode<TNode, TPatch, TPrefix extends string, TSelf extends string> = {
  [K in keyof TNode]: K extends MetadataKey
    ? TSelf extends keyof TPatch
      ? MergeMetadata<TNode[K], TPatch[TSelf]>
      : TNode[K]
    : K extends RouteGroupKey
      ? AttachNode<TNode[K], TPatch, TPrefix, ''>
      : AttachNode<TNode[K], TPatch, `${TPrefix}/${K & string}`, `${TPrefix}/${K & string}`>;
};

/**
 * Returns a copy of `tree` with `patch` merged into the metadata of the routes it names.
 *
 * The source tree is not touched — every node on the way is a new object — so any number
 * of consumers can attach their own metadata to the same shared tree. A route the patch
 * leaves out keeps the source's metadata object as it is. Structural fields
 * (`paramSchema`, `searchParamsSchema`) always come from the source.
 *
 * Throws on a pathname the tree does not declare and on a structural field in the patch.
 * The types already rule both out; the checks are for the calls that got past them.
 *
 * The framework-agnostic half of `attachMetadata`, which each adapter wraps.
 */
export const mergeRouteMetadata = <TTree, TPatch>(tree: TTree, patch: TPatch): AttachedTree<TTree, TPatch> => {
  const known = new Set(collectRoutes(tree).map((route) => route.path));
  const attached = new Map<string, RouteMetadata>();

  for (const [path, metadata] of Object.entries(patch as Record<string, RouteMetadata | undefined>)) {
    if (!known.has(path)) {
      throw new Error(`typed-router: attachMetadata was given "${path}", which is not a route of the source tree.`);
    }
    if (metadata === undefined) continue;

    for (const key of STRUCTURAL_KEYS) {
      if (metadata[key] !== undefined) {
        throw new Error(
          `typed-router: attachMetadata cannot set "${key}" on "${path}". ` +
            'It belongs to the structure of the source tree; declare it there instead.',
        );
      }
    }

    attached.set(path, metadata);
  }

  const merge = (source: RouteMetadata | undefined, metadata: RouteMetadata): RouteMetadata => {
    const merged: RouteMetadata = { ...source, ...metadata };

    // `paramSchema: undefined` passes the check above, and the spread would still let it
    // blank out the source's schema.
    for (const key of STRUCTURAL_KEYS) {
      if (source && key in source) merged[key] = source[key];
      else delete merged[key];
    }

    return merged;
  };

  const copy = (node: object, prefix: string, self: string | null): Record<string, unknown> => {
    const result: Record<string, unknown> = {};

    for (const [key, child] of Object.entries(node)) {
      if (key === METADATA_KEY) {
        const metadata = self === null ? undefined : attached.get(self);
        result[key] = metadata ? merge(child as RouteMetadata | undefined, metadata) : child;
        continue;
      }

      if (typeof child !== 'object' || child === null) {
        result[key] = child;
        continue;
      }

      const childPath = isRouteGroup(key) ? prefix : `${prefix}/${key}`;
      result[key] = copy(child, childPath, isRouteGroup(key) ? null : childPath);
    }

    return result;
  };

  return copy(tree as object, '', null) as AttachedTree<TTree, TPatch>;
};
