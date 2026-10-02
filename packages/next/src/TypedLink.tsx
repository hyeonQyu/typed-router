import type { RouteArgs, RoutePaths, RouteTree } from '@hyeonqyu/typed-router-core';
import Link from 'next/link';
import { forwardRef, type ComponentPropsWithoutRef, type ReactElement, type Ref } from 'react';
import { toHref, type UseRawResolveHref } from './resolveHref';

type AnchorProps = Omit<ComponentPropsWithoutRef<typeof Link>, 'href'>;

/**
 * `params`, `searchParams` and `hash` sit next to `href` as ordinary props, so the
 * required ones are visible in autocomplete instead of hidden inside an object.
 */
export type TypedLinkProps<TTree, TPath extends string> = AnchorProps & { href: TPath } & RouteArgs<TTree, TPath>;

export const createTypedLink = <TTree,>(routes: RouteTree<unknown>, useResolveHref: UseRawResolveHref) => {
  const TypedLink = forwardRef<HTMLAnchorElement, TypedLinkProps<TTree, string>>(function TypedLink(props, ref) {
    const { href, params, searchParams, hash, ...linkProps } = props;
    const resolve = useResolveHref();

    // A resolved absolute URL needs nothing special: `<Link>` renders it as a plain anchor.
    return <Link {...linkProps} ref={ref} href={toHref(routes, resolve, href, { params, searchParams, hash })} />;
  });

  // forwardRef erases generics; this cast restores per-`href` inference at the call site.
  return TypedLink as unknown as <TPath extends RoutePaths<TTree>>(
    props: TypedLinkProps<TTree, TPath> & { ref?: Ref<HTMLAnchorElement> },
  ) => ReactElement;
};
