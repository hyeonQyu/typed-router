// @vitest-environment jsdom

/**
 * The React Router adapter, actually rendered.
 *
 * Every hook here reads from React Router's location, so the only honest way to test
 * them is to mount a component under a real router and look at what it rendered. The
 * type tests next door prove the signatures; this file proves the behaviour behind them.
 */
import { defineRoutes as defineCoreRoutes } from '@hyeonqyu/typed-router-core';
import { attachMetadata, defineRoutes } from '@hyeonqyu/typed-router-react';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { z } from 'zod';

const routes = defineRoutes({
  '': { _metadata: { title: 'Index', element: <p>index page</p> } },
  home: { _metadata: { title: 'Home', element: <p>home page</p> } },
  products: {
    _metadata: {
      title: 'Products',
      element: <p>products page</p>,
      searchParamsSchema: z.object({ page: z.number().default(1), sort: z.enum(['asc', 'desc']).optional() }),
    },
    '[id]': {
      _metadata: { title: 'Detail', paramSchema: z.number(), element: <p>detail page</p> },
      reviews: { _metadata: { title: 'Reviews', element: <p>reviews page</p> } },
    },
  },
  docs: { '[...slug]': { _metadata: { title: 'Docs', element: <p>docs page</p> } } },
  placeholder: { _metadata: { title: 'Placeholder' } },
});

/** Mounts `children` at `url`, with the tree's own routes available to render into. */
const at = (url: string, children: ReactNode) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="*" element={<>{children}</>} />
      </Routes>
    </MemoryRouter>,
  );

/** Renders one value as text, so an assertion reads the DOM rather than a hook result. */
const Show = ({ value }: { value: unknown }) => <span data-testid="out">{JSON.stringify(value)}</span>;

/** What {@link Show} put in the DOM, read back as the value it was given. */
const out = (): unknown => JSON.parse(screen.getByTestId('out').textContent ?? 'null');

// Auto-cleanup only runs when vitest is configured with `globals: true`, which this
// repo is not — so without this every test would render on top of the previous one.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useTypedParams', () => {
  test('reads the live URL and coerces each segment by its declared schema', () => {
    const Probe = () => <Show value={routes.useTypedParams('/products/[id]')} />;

    at('/products/42', <Probe />);
    expect(out()).toEqual({ id: 42 });
  });

  test('a catch-all keeps its declared name rather than React Router "*"', () => {
    const Probe = () => <Show value={routes.useTypedParams('/docs/[...slug]')} />;

    at('/docs/a/b/c', <Probe />);
    expect(out()).toEqual({ slug: ['a', 'b', 'c'] });
  });

  test('an ancestor route may be read from a component rendered underneath it', () => {
    const Probe = () => <Show value={routes.useTypedParams('/products/[id]')} />;

    at('/products/42/reviews', <Probe />);
    expect(out()).toEqual({ id: 42 });
  });

  test('a pathname the URL did not come from throws instead of typing another route s params', () => {
    const Probe = () => <Show value={routes.useTypedParams('/products/[id]')} />;

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => at('/docs/a', <Probe />)).toThrow(/was called under "\/docs\/\[\.\.\.slug\]"/);
  });

  test('a URL matching no declared route throws too', () => {
    const Probe = () => <Show value={routes.useTypedParams('/products/[id]')} />;

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => at('/nope', <Probe />)).toThrow(/matches no declared route/);
  });

  test('a descendant is not an ancestor: the child route cannot be read from the parent', () => {
    const Probe = () => <Show value={routes.useTypedParams('/products/[id]/reviews')} />;

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => at('/products/42', <Probe />)).toThrow(/was called under "\/products\/\[id\]"/);
  });

  test('onError is honoured, so a bad segment can be dropped rather than thrown', () => {
    const Probe = () => <Show value={routes.useTypedParams('/products/[id]', { onError: 'default' })} />;

    at('/products/abc', <Probe />);
    expect(out()).toEqual({});
  });
});

describe('useCurrentRouteNode', () => {
  test('with a pathname, it checks the URL came from that route', () => {
    const Probe = () => <Show value={Boolean(routes.useCurrentRouteNode('/products/[id]'))} />;

    at('/products/42', <Probe />);
    expect(out()).toBe(true);
  });

  test('with the wrong pathname it throws, where before it silently returned another node', () => {
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

  test('an unmatched URL reports null rather than guessing', () => {
    const Probe = () => <Show value={routes.useTypedPathname()} />;

    at('/nope', <Probe />);
    expect(out()).toBeNull();
  });
});

describe('useTypedSearchParams', () => {
  test('applies the schema, including its defaults', () => {
    const Probe = () => <Show value={routes.useTypedSearchParams('/products')} />;

    at('/products?sort=desc', <Probe />);
    expect(out()).toEqual({ sort: 'desc', page: 1 });
  });

  test('coerces to the declared types rather than leaving URL text', () => {
    const Probe = () => <Show value={routes.useTypedSearchParams('/products')} />;

    at('/products?page=3', <Probe />);
    expect(out()).toEqual({ page: 3 });
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

describe('TypedRoutes', () => {
  test('renders the page declared for the current URL', () => {
    render(
      <MemoryRouter initialEntries={['/products/42']}>
        <routes.TypedRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByText('detail page')).toBeTruthy();
  });

  test('a node that declares no page field matches but renders nothing', () => {
    // Documented behaviour, not an accident: the tree declares information architecture,
    // and a node may be a place in it without being a page this router draws. Add a
    // trailing `*` route if such a path should 404 instead.
    render(
      <MemoryRouter initialEntries={['/placeholder']}>
        <routes.TypedRoutes />
      </MemoryRouter>,
    );

    expect(screen.queryByText('home page')).toBeNull();
    expect(document.body.textContent).toBe('');
  });
});

describe('attachMetadata', () => {
  /** Declared with core, as a shared package would: no pages, no React. */
  const shared = defineCoreRoutes({
    orders: {
      _metadata: {},
      '[id]': { _metadata: { paramSchema: z.number() } },
    },
  });

  const app = attachMetadata(shared)({
    '/orders': { title: 'Orders', element: <p>orders page</p> },
    '/orders/[id]': { title: 'Order', element: <p>order page</p> },
  });

  test('the pages it attaches are what the router renders', () => {
    render(
      <MemoryRouter initialEntries={['/orders/7']}>
        <app.TypedRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByText('order page')).toBeTruthy();
  });

  test('the hooks read the attached metadata and the shared schemas together', () => {
    const Probe = () => {
      const current = app.useCurrentRoute();
      return <Show value={{ title: current.metadata?.title, params: app.useTypedParams('/orders/[id]') }} />;
    };

    at('/orders/7', <Probe />);
    expect(out()).toEqual({ title: 'Order', params: { id: 7 } });
  });
});
