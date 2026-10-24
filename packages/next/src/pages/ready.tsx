import { useRouter } from 'next/router';
import { useSyncExternalStore, type ReactElement, type ReactNode } from 'react';

const subscribe = () => () => undefined;

/**
 * `false` on the server and through hydration, `true` on every client render after it.
 * The server snapshot is what hydration reads, so the first client render always matches
 * the HTML; a component that mounts later, on client-side navigation, reads `true` at once.
 *
 * `useSyncExternalStore` is React 18+, which every Next version this package supports
 * already requires.
 */
const useHydrated = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

/**
 * Whether the Pages Router has read the URL — `router.isReady`, made safe to render on.
 *
 * `router.isReady` itself is not: on a statically rendered page without a query string it
 * is `false` in the prerendered HTML and already `true` on the first client render, so
 * `isReady ? <View /> : null` renders two different trees and fails hydration. This stays
 * `false` until hydration is over, then follows `router.isReady`.
 *
 * Gate every component that calls `useTypedSearchParams`, or `useTypedParams` on a
 * statically optimized dynamic page, on this — or wrap it in {@link RouterReady}.
 */
export const useRouterReady = (): boolean => {
  const { isReady } = useRouter();
  return useHydrated() && isReady;
};

/**
 * Renders `children` once {@link useRouterReady} is true, and `fallback` until then —
 * the Pages Router's counterpart of the `<Suspense>` boundary the App Router asks for
 * around `useTypedSearchParams`.
 *
 * ```tsx
 * <RouterReady fallback={<Spinner />}>
 *   <ProductsView />
 * </RouterReady>
 * ```
 *
 * A `getServerSideProps` page is ready from the first render and needs no boundary.
 */
export const RouterReady = ({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }): ReactElement => (
  <>{useRouterReady() ? children : fallback}</>
);
