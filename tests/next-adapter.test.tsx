// @vitest-environment jsdom

/**
 * The Next.js adapter, actually rendered.
 *
 * Next's navigation hooks need an App Router runtime, which a unit test has no way to
 * stand up — so `next/navigation` and `next/link` are aliased to the stubs next door.
 * What is under test is everything the adapter does *with* those values, which is where
 * all of its own logic lives.
 */
import { defineRoutes as defineCoreRoutes } from '@hyeonqyu/typed-router-core';
import { attachMetadata, bindRoutes, defineRoutes } from '@hyeonqyu/typed-router-next';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { z } from 'zod';
import { router, setLocation } from './stubs/next-navigation';

const routes = defineRoutes({
  '': { _metadata: { title: 'Index' } },
  home: { _metadata: { title: 'Home' } },
  products: {
    _metadata: {
      title: 'Products',
      searchParamsSchema: z.object({ page: z.number().default(1), sort: z.enum(['asc', 'desc']).optional() }),
    },
    '[id]': {
      _metadata: { title: 'Detail', paramSchema: z.number() },
      reviews: { _metadata: { title: 'Reviews' } },
    },
  },
  docs: { '[...slug]': { _metadata: { title: 'Docs' } } },
});

/** Puts the app at `url` — the one thing the stubbed `next/navigation` needs to know. */
const at = (url: string, children: ReactNode) => {
  setLocation(url);
  return render(<>{children}</>);
};

const Show = ({ value }: { value: unknown }) => <span data-testid="out">{JSON.stringify(value)}</span>;

const out = (): unknown => JSON.parse(screen.getByTestId('out').textContent ?? 'null');

beforeEach(() => {
  setLocation('/');
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useTypedParams', () => {
  test('reads the live URL and coerces each segment by its declared schema', () => {
    const Probe = () => <Show value={routes.useTypedParams('/products/[id]')} />;

    at('/products/42', <Probe />);
    expect(out()).toEqual({ id: 42 });
  });

  test('a catch-all keeps its declared name rather than Next s anonymous slug', () => {
    const Probe = () => <Show value={routes.useTypedParams('/docs/[...slug]')} />;

    at('/docs/a/b/c', <Probe />);
    expect(out()).toEqual({ slug: ['a', 'b', 'c'] });
  });

  test('an ancestor route may be read from a component rendered underneath it', () => {
    const Probe = () => <Show value={routes.useTypedParams('/products/[id]')} />;

    at('/products/42/reviews', <Probe />);
    expect(out()).toEqual({ id: 42 });
  });

  test('a pathname the URL did not come from throws, where it used to return another route s params', () => {
    const Probe = () => <Show value={routes.useTypedParams('/products/[id]')} />;

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => at('/docs/a', <Probe />)).toThrow(/was called under "\/docs\/\[\.\.\.slug\]"/);
  });

  test('a URL matching no declared route throws too', () => {
    const Probe = () => <Show value={routes.useTypedParams('/products/[id]')} />;

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => at('/nope', <Probe />)).toThrow(/matches no declared route/);
  });
});

describe('useCurrentRouteNode', () => {
  test('with a pathname, it checks the URL came from that route', () => {
    const Probe = () => <Show value={Boolean(routes.useCurrentRouteNode('/products/[id]'))} />;

    at('/products/42', <Probe />);
    expect(out()).toBe(true);
  });

  test('with the wrong pathname it throws', () => {
    const Probe = () => <Show value={Boolean(routes.useCurrentRouteNode('/products/[id]'))} />;

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => at('/home', <Probe />)).toThrow(/was called under "\/home"/);
  });

  test('without a pathname it stays the unchecked call it always was', () => {
    const Probe = () => <Show value={routes.useCurrentRouteNode() !== null} />;

    at('/home', <Probe />);
    expect(out()).toBe(true);
  });
});

describe('useCurrentRoute and useTypedPathname', () => {
  test('resolve a live URL back to the route it was declared as', () => {
    const Probe = () => {
      const current = routes.useCurrentRoute();
      return <Show value={{ pathname: current.pathname, url: current.url, params: current.params }} />;
    };

    at('/products/42/reviews', <Probe />);
    expect(out()).toEqual({ pathname: '/products/[id]/reviews', url: '/products/42/reviews', params: { id: '42' } });
  });

  test('the root is a route like any other', () => {
    const Probe = () => <Show value={routes.useTypedPathname()} />;

    at('/', <Probe />);
    expect(out()).toBe('/');
  });
});

describe('attachMetadata', () => {
  test('the hooks read the attached metadata and the shared schemas together', () => {
    /** Declared with core, as a shared package would. */
    const shared = defineCoreRoutes({ orders: { '[id]': { _metadata: { paramSchema: z.number() } } } });
    const app = attachMetadata(shared)({ '/orders/[id]': { title: 'Order' } });

    const Probe = () => {
      const current = app.useCurrentRoute();
      return <Show value={{ title: current.metadata?.title, params: app.useTypedParams('/orders/[id]') }} />;
    };

    at('/orders/7', <Probe />);
    expect(out()).toEqual({ title: 'Order', params: { id: 7 } });
  });
});

describe('bindRoutes', () => {
  test('gives a tree declared with core the hooks, reusing its parsers as they are', () => {
    const shared = defineCoreRoutes({ orders: { '[id]': { _metadata: { title: 'Order', paramSchema: z.number() } } } });
    const app = bindRoutes(shared);

    const Probe = () => <Show value={{ pathname: app.useTypedPathname(), params: app.useTypedParams('/orders/[id]') }} />;

    at('/orders/7', <Probe />);
    expect(out()).toEqual({ pathname: '/orders/[id]', params: { id: 7 } });
    expect(app.parseParams).toBe(shared.parseParams);
    expect(app.routes).toBe(shared.routes);
  });
});

describe('useTypedSearchParams', () => {
  test('applies the schema, including its defaults', () => {
    const Probe = () => <Show value={routes.useTypedSearchParams('/products')} />;

    at('/products?sort=desc', <Probe />);
    expect(out()).toEqual({ sort: 'desc', page: 1 });
  });
});

describe('useTypedRouter', () => {
  test('builds the href before handing it to Next s router', () => {
    const Probe = () => {
      const typed = routes.useTypedRouter();
      typed.push('/products/[id]', { params: { id: 42 } });
      typed.replace('/products', { searchParams: { page: 2 } });
      typed.prefetch('/home');
      return <Show value={null} />;
    };

    at('/home', <Probe />);

    expect(router.push).toHaveBeenCalledWith('/products/42', { scroll: undefined });
    expect(router.replace).toHaveBeenCalledWith('/products?page=2', { scroll: undefined });
    expect(router.prefetch).toHaveBeenCalledWith('/home');
  });
});

describe('TypedLink', () => {
  test('renders an anchor whose href is built from the params it was given', () => {
    const { TypedLink } = routes;

    at(
      '/home',
      <TypedLink href="/products/[id]" params={{ id: 42 }}>
        detail
      </TypedLink>,
    );

    expect(screen.getByRole('link', { name: 'detail' }).getAttribute('href')).toBe('/products/42');
  });

  test('search params and hash reach the href too', () => {
    const { TypedLink } = routes;

    at(
      '/home',
      <TypedLink href="/products" searchParams={{ page: 2 }} hash="top">
        list
      </TypedLink>,
    );

    expect(screen.getByRole('link', { name: 'list' }).getAttribute('href')).toBe('/products?page=2#top');
  });
});
