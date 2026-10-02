import { attachMetadata } from '@hyeonqyu/typed-router-core';
import { bindRoutes, type ResolveHref } from '@hyeonqyu/typed-router-next/pages';
import { routes as shared } from './shared/routes';

/**
 * Says where `/blog` actually lives. The key `href` means nothing to the library — it is
 * this app's own field, read back by the resolver below.
 */
const linked = attachMetadata(shared).withMeta<{ href?: string }>()({
  '/blog': { href: 'https://github.com/hyeonQyu/typed-router' },
});

const resolveHref: ResolveHref<typeof linked.routes> = ({ metadata }) => (typeof metadata.href === 'string' ? metadata.href : undefined);

/**
 * The shared tree, given this app's router. `bindRoutes` reuses it as it is — the same
 * paths, the same schemas — and adds the Pages Router hooks and `TypedLink` on top.
 *
 * `useResolveHref` sends `push('/blog')` and `<TypedLink href="/blog">` to the URL above
 * instead of a `/blog` page that does not exist. It is a hook, so a resolver that depends
 * on the locale could read it from context here.
 *
 * Nothing here imports `@hyeonqyu/typed-router-next` itself, whose hooks sit on the App
 * Router's `next/navigation`: the `/pages` entry has everything this app needs.
 */
export const routes = bindRoutes(linked, { useResolveHref: () => resolveHref });

export const { TypedLink, useCurrentRoute, useTypedParams, useTypedPathname, useTypedRouter, useTypedSearchParams } = routes;

export { RouterReady } from '@hyeonqyu/typed-router-next/pages';
