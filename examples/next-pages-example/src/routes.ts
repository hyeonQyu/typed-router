import { bindRoutes } from '@hyeonqyu/typed-router-next/pages';
import { routes as shared } from './shared/routes';

/**
 * The shared tree, given this app's router. `bindRoutes` reuses it as it is — the same
 * paths, the same schemas — and adds the Pages Router hooks and `TypedLink` on top.
 *
 * Nothing here imports `@hyeonqyu/typed-router-next` itself, whose hooks sit on the App
 * Router's `next/navigation`: the `/pages` entry has everything this app needs.
 */
export const routes = bindRoutes(shared);

export const { TypedLink, useCurrentRoute, useTypedParams, useTypedPathname, useTypedRouter, useTypedSearchParams } = routes;

export { RouterReady } from '@hyeonqyu/typed-router-next/pages';
