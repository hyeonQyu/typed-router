// @vitest-environment jsdom

/**
 * The Next.js adapter, actually rendered.
 *
 * Next's navigation hooks need an App Router runtime, which a unit test has no way to
 * stand up — so `next/navigation` and `next/link` are aliased to the stubs next door.
 * What is under test is everything the adapter does *with* those values, which is where
 * all of its own logic lives.
 */
import { attachMetadata as attachCoreMetadata, defineRoutes as defineCoreRoutes } from '@hyeonqyu/typed-router-core';
import { attachMetadata, bindRoutes, defineRoutes, type RouteMetadata } from '@hyeonqyu/typed-router-next';
import { cleanup, render, screen } from '@testing-library/react';
import { createContext, useCallback, useContext, type ReactNode } from 'react';
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

describe('useResolveHref', () => {
  const Language = createContext('en');

  // A tree whose `/blog` lives on another domain, as a shared package plus an app's metadata would declare it.
  const linked = bindRoutes(
    attachCoreMetadata(
      defineCoreRoutes({ home: { _metadata: {} }, blog: { _metadata: {} }, products: { '[id]': { _metadata: {} } } }),
    ).withMeta<{ href?: (context: { language: string }) => string }>()({
      '/blog': { href: ({ language }) => `https://blog.example.com/${language}` },
    }),
    {
      useResolveHref: () => {
        const language = useContext(Language);
        return useCallback(
          ({ metadata }: { metadata: RouteMetadata }) =>
            (metadata.href as ((c: { language: string }) => string) | undefined)?.({ language }),
          [language],
        );
      },
    },
  );

  test('push, replace and TypedLink go where the resolver says, reading React context to decide', () => {
    const { TypedLink } = linked;
    const Probe = () => {
      const typed = linked.useTypedRouter();
      typed.push('/blog');
      typed.replace('/blog', { scroll: false });
      return <TypedLink href="/blog">blog</TypedLink>;
    };

    setLocation('/home');
    render(
      <Language.Provider value="ko">
        <Probe />
      </Language.Provider>,
    );

    expect(router.push).toHaveBeenCalledWith('https://blog.example.com/ko', { scroll: undefined });
    expect(router.replace).toHaveBeenCalledWith('https://blog.example.com/ko', { scroll: false });
    expect(screen.getByRole('link', { name: 'blog' }).getAttribute('href')).toBe('https://blog.example.com/ko');
  });

  test('a route the resolver returns nothing for keeps its own href', () => {
    const { TypedLink } = linked;
    const Probe = () => {
      linked.useTypedRouter().push('/products/[id]', { params: { id: '7' } });
      return <TypedLink href="/home">home</TypedLink>;
    };

    at('/home', <Probe />);

    expect(router.push).toHaveBeenCalledWith('/products/7', { scroll: undefined });
    expect(screen.getByRole('link', { name: 'home' }).getAttribute('href')).toBe('/home');
  });

  test('prefetch skips a resolved absolute URL but still prefetches a resolved local one', () => {
    const aliased = bindRoutes(defineCoreRoutes({ old: { _metadata: {} }, docs: { _metadata: {} } }), {
      useResolveHref: () => (route) =>
        route.pathname === '/old' ? '/new' : route.pathname === '/docs' ? 'https://docs.example.com' : undefined,
    });
    const Probe = () => {
      const typed = aliased.useTypedRouter();
      typed.prefetch('/docs');
      typed.prefetch('/old');
      return null;
    };

    at('/', <Probe />);

    expect(router.prefetch).toHaveBeenCalledTimes(1);
    expect(router.prefetch).toHaveBeenCalledWith('/new');
  });

  test('the resolver sees the route s pathname, metadata, params, search params and hash', () => {
    const seen = vi.fn(() => undefined);
    const searchParamsSchema = z.object({ tab: z.string().optional() });
    const watched = bindRoutes(defineCoreRoutes({ products: { '[id]': { _metadata: { title: 'Detail', searchParamsSchema } } } }), {
      useResolveHref: () => seen,
    });
    const Probe = () => {
      watched.useTypedRouter().push('/products/[id]', { params: { id: '7' }, searchParams: { tab: 'info' }, hash: 'top' });
      return null;
    };

    at('/', <Probe />);

    expect(seen).toHaveBeenCalledWith({
      pathname: '/products/[id]',
      metadata: { title: 'Detail', searchParamsSchema },
      params: { id: '7' },
      searchParams: { tab: 'info' },
      hash: 'top',
    });
    expect(router.push).toHaveBeenCalledWith('/products/7?tab=info#top', { scroll: undefined });
  });
});
