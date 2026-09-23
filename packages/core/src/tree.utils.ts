import type { SegmentKeys } from './path.types';
import { METADATA_KEY } from './path.utils';

/**
 * A node's child routes: every key of the node except `_metadata`.
 *
 * Distributive on purpose. `keyof` over a union is the *intersection* of its members'
 * keys, so a non-distributive `Omit` would collapse a union of nodes — what an unchecked
 * `useCurrentRouteNode()` or an un-narrowed `collected` element hands back — to `{}`,
 * claiming the node has no children at all. Stripping each member separately keeps the
 * union a union, and each member keeps the literal types it was declared with.
 *
 * {@link SegmentKeys} rather than `Exclude<keyof TNode, MetadataKey>` only to reuse the
 * name the rest of the tree types already use for "keys that are segments"; it also drops
 * symbol and number keys, which a declared route tree does not have.
 *
 * One limit worth knowing: a node typed loosely enough to carry a string index signature
 * — `RouteMatch['node']`, which is `RouteNodeInput` — has no `_metadata` key to remove in
 * the first place, so the type comes back just as loose. The stripping is real for a node
 * read off the declared tree (`routes.routes.support`, `routes.getNode('/support')`),
 * which is where a menu is built from.
 */
export type RouteChildren<TNode> = TNode extends unknown ? Pick<TNode, SegmentKeys<TNode>> : never;

/**
 * One derived children view per node, so repeated calls keep referential identity. Only
 * frozen nodes are cached: a mutable object could gain a child after the first call, and
 * the cache would go on serving the view from before it.
 */
const cache = new WeakMap<object, object>();

/**
 * The child routes of a tree node, with `_metadata` gone from the value *and* the type.
 *
 * Walking the declared tree by hand is how one level of a menu, a breadcrumb's siblings
 * or a section index gets built — and `Object.keys` / `values` / `entries` all hand back
 * the metadata block alongside the real children, which renders as a phantom entry. This
 * returns an object rather than an array so all three of those shapes keep working:
 *
 * ```ts
 * Object.entries(children(routes.routes.support)); // [['ask', {...}], ['notice', {...}]]
 * ```
 *
 * Route group keys `(name)` are children like any other — they organise the tree, so what
 * a group means for a given menu is the caller's call, not this function's.
 *
 * The result is frozen, and cached per node when the node is frozen — which every node of
 * a `defineRoutes` tree is — so calling it twice on the same declared node returns the same
 * object, and it can sit in a dependency array or a memoised prop without re-rendering.
 * It is a shallow view — the child values are the nodes themselves, metadata included.
 */
export const children = <TNode extends object>(node: TNode): RouteChildren<TNode> => {
  const cached = cache.get(node);
  if (cached) return cached as RouteChildren<TNode>;

  const view: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(node)) {
    if (key === METADATA_KEY) continue;
    view[key] = child;
  }

  Object.freeze(view);
  if (Object.isFrozen(node)) cache.set(node, view);

  return view as RouteChildren<TNode>;
};
