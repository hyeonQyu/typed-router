/**
 * Stands in for `next/router` under vitest, via an alias in `vitest.config.mts`, for the
 * same reasons `next-navigation.ts` stands in for `next/navigation`: the real hook needs a
 * mounted Pages Router, and the repo installs `next` twice.
 *
 * The router object models the fields the adapter reads the way Next fills them:
 * `pathname` is the page's pattern, `asPath` the URL as shown, and `query` the merge of
 * both — path params winning over a search param of the same name.
 */
import { vi } from 'vitest';

type Query = Record<string, string | string[]>;

export const router = {
  pathname: '/',
  asPath: '/',
  query: {} as Query,
  isReady: true,
  push: vi.fn(async () => true),
  replace: vi.fn(async () => true),
  prefetch: vi.fn(async () => undefined),
  back: vi.fn(),
};

/**
 * Puts the router on page `pathname` showing `asPath`, with `params` as the page's
 * dynamic segments.
 *
 * `isReady: false` reproduces a statically rendered page before hydration. Next then
 * leaves `query` empty on a statically optimized page, but fills in the path params of a
 * `getStaticProps` page — `paramsKnown` picks which of the two this is.
 */
export const setPage = (
  pathname: string,
  asPath: string,
  params: Query = {},
  { isReady = true, paramsKnown = isReady }: { isReady?: boolean; paramsKnown?: boolean } = {},
): void => {
  const search = new URLSearchParams(asPath.split('#')[0].split('?')[1] ?? '');
  const query: Query = {};

  for (const [key, value] of search) {
    const existing = query[key];
    query[key] = existing === undefined ? value : ([] as string[]).concat(existing, value);
  }

  router.pathname = pathname;
  router.asPath = asPath;
  router.query = isReady ? { ...query, ...params } : paramsKnown ? { ...params } : {};
  router.isReady = isReady;
};

export const useRouter = (): typeof router => router;
