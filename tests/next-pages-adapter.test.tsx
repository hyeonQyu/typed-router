// @vitest-environment jsdom

/**
 * The Pages Router entry, actually rendered.
 *
 * `next/router` is aliased to a stub whose fields are filled the way Next fills them
 * (see `stubs/next-router.ts`); what is under test is everything the adapter does with
 * them. The tree is declared with core, as a shared package would, and bound here.
 */
import { attachMetadata as attachCoreMetadata, defineRoutes as defineCoreRoutes } from '@hyeonqyu/typed-router-core';
import {
  attachMetadata,
  bindRoutes,
  defineRoutes,
  RouteMismatchError,
  RouteNotReadyError,
  RouterReady,
  type RouteMetadata,
} from '@hyeonqyu/typed-router-next/pages';
import { act, cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { z } from 'zod';
import { router, setPage } from './stubs/next-router';

const shared = defineCoreRoutes({
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
  files: { '[[...path]]': { _metadata: { title: 'Files' } } },
});

const routes = bindRoutes(shared);

/** Puts the app on a page — the one thing the stubbed `next/router` needs to know. */
const at = (page: [pathname: string, asPath: string, params?: Record<string, string | string[]>], children: ReactNode) => {
  setPage(...page);
  return render(<>{children}</>);
};

const Show = ({ value }: { value: unknown }) => <span data-testid="out">{JSON.stringify(value)}</span>;

const out = (): unknown => JSON.parse(screen.getByTestId('out').textContent ?? 'null');

/** Rendering a throwing component logs through React; the throw itself is what is asserted. */
const quietly = () => vi.spyOn(console, 'error').mockImplementation(() => undefined);

beforeEach(() => {
  setPage('/', '/');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('bindRoutes', () => {
  test('keeps the source tree, paths and parsers rather than rebuilding them', () => {
    expect(routes.routes).toBe(shared.routes);
    expect(routes.paths).toBe(shared.paths);
    expect(routes.buildHref).toBe(shared.buildHref);
    expect(routes.parseParams).toBe(shared.parseParams);
  });
});

describe('useTypedParams', () => {
  test('reads the page s segments from router.query and coerces them by their schema', () => {
    const Probe = () => <Show value={routes.useTypedParams('/products/[id]')} />;

    at(['/products/[id]', '/products/42', { id: '42' }], <Probe />);
    expect(out()).toEqual({ id: 42 });
  });

  test('a catch-all keeps its declared name', () => {
    const Probe = () => <Show value={routes.useTypedParams('/docs/[...slug]')} />;

    at(['/docs/[...slug]', '/docs/a/b', { slug: ['a', 'b'] }], <Probe />);
    expect(out()).toEqual({ slug: ['a', 'b'] });
  });

  test('a search param sharing a segment s name does not leak into the params', () => {
    const Probe = () => <Show value={routes.useTypedParams('/products/[id]')} />;

    at(['/products/[id]', '/products/42?id=9&sort=asc', { id: '42' }], <Probe />);
    expect(out()).toEqual({ id: 42 });
  });

  test('an ancestor route may be read from a component rendered underneath it', () => {
    const Probe = () => <Show value={routes.useTypedParams('/products/[id]')} />;

    at(['/products/[id]/reviews', '/products/42/reviews', { id: '42' }], <Probe />);
    expect(out()).toEqual({ id: 42 });
  });

  test('a pathname the page did not come from throws RouteMismatchError', () => {
    const Probe = () => <Show value={routes.useTypedParams('/products/[id]')} />;

    quietly();
    expect(() => at(['/docs/[...slug]', '/docs/a', { slug: ['a'] }], <Probe />)).toThrow(RouteMismatchError);
  });

  test('a page the tree never declares — Next s own 404 included — matches nothing', () => {
    const Probe = () => <Show value={routes.useTypedParams('/products/[id]')} />;

    quietly();
    expect(() => at(['/404', '/nope'], <Probe />)).toThrow(/matches no declared route/);
  });

  test('before hydration on a statically optimized page, it throws rather than hand out missing segments', () => {
    const Probe = () => <Show value={routes.useTypedParams('/products/[id]')} />;

    quietly();
    setPage('/products/[id]', '/products/[id]', { id: '42' }, { isReady: false });
    expect(() => render(<Probe />)).toThrow(RouteNotReadyError);
  });

  test('a getStaticProps page is not ready either, but its segments are there — so it reads them', () => {
    const Probe = () => <Show value={routes.useTypedParams('/products/[id]')} />;

    setPage('/products/[id]', '/products/42', { id: '42' }, { isReady: false, paramsKnown: true });
    render(<Probe />);
    expect(out()).toEqual({ id: 42 });
  });

  test('an absent optional catch-all is within its type, so it does not wait for hydration', () => {
    const Probe = () => <Show value={routes.useTypedParams('/files/[[...path]]')} />;

    setPage('/files/[[...path]]', '/files', {}, { isReady: false });
    render(<Probe />);
    expect(out()).toEqual({});
  });
});

describe('useCurrentRoute, useTypedPathname and useCurrentRouteNode', () => {
  test('the route is the page Next rendered, even when a rewrite shows another URL', () => {
    const Probe = () => {
      const current = routes.useCurrentRoute();
      return <Show value={{ pathname: current.pathname, url: current.url, params: current.params, title: current.metadata?.title }} />;
    };

    at(['/products/[id]', '/p/42?sort=asc#top', { id: '42' }], <Probe />);
    expect(out()).toEqual({ pathname: '/products/[id]', url: '/p/42', params: { id: '42' }, title: 'Detail' });
  });

  test('the route is known before hydration, since Next already knows the page', () => {
    const Probe = () => <Show value={routes.useTypedPathname()} />;

    setPage('/products/[id]', '/products/[id]', {}, { isReady: false });
    render(<Probe />);
    expect(out()).toBe('/products/[id]');
  });

  test('pages/index.tsx is the root route', () => {
    const Probe = () => <Show value={routes.useTypedPathname()} />;

    at(['/', '/'], <Probe />);
    expect(out()).toBe('/');
  });

  test('useCurrentRouteNode is checked the same way', () => {
    const Probe = () => <Show value={Boolean(routes.useCurrentRouteNode('/products/[id]'))} />;

    quietly();
    expect(() => at(['/home', '/home'], <Probe />)).toThrow(/was called under "\/home"/);
  });
});

describe('useTypedSearchParams', () => {
  test('parses the query string shown in the URL, schema defaults included', () => {
    const Probe = () => <Show value={routes.useTypedSearchParams('/products')} />;

    at(['/products', '/products?sort=desc#top'], <Probe />);
    expect(out()).toEqual({ sort: 'desc', page: 1 });
  });

  test('before the router is ready it throws, instead of returning defaults the URL may contradict', () => {
    const Probe = () => <Show value={routes.useTypedSearchParams('/products')} />;

    quietly();
    setPage('/products', '/products', {}, { isReady: false });
    expect(() => render(<Probe />)).toThrow(RouteNotReadyError);
  });
});

describe('RouterReady', () => {
  const View = () => <Show value={routes.useTypedSearchParams('/products')} />;
  const Waiting = () => <span data-testid="out">&quot;waiting&quot;</span>;

  test('renders the fallback until the router is ready, then the children', () => {
    // A fresh element each time: the stub router is not React state, so an identical
    // element would let React skip the re-render.
    const tree = () => (
      <RouterReady fallback={<Waiting />}>
        <View />
      </RouterReady>
    );

    setPage('/products', '/products?page=2', {}, { isReady: false });
    const { rerender } = render(tree());
    expect(out()).toBe('waiting');

    setPage('/products', '/products?page=2');
    rerender(tree());
    expect(out()).toEqual({ page: 2 });
  });

  // The case `router.isReady` alone gets wrong: a statically rendered page with no query
  // string is not ready in its prerendered HTML, yet ready on the first client render.
  test('hydrates without a mismatch when isReady flips between the server and the client', async () => {
    const tree = (
      <RouterReady fallback={<Waiting />}>
        <View />
      </RouterReady>
    );

    setPage('/products', '/products', {}, { isReady: false });
    const container = document.createElement('div');
    container.innerHTML = renderToString(tree);
    document.body.appendChild(container);
    expect(out()).toBe('waiting');

    setPage('/products', '/products');
    const onRecoverableError = vi.fn();
    const root = await act(async () => hydrateRoot(container, tree, { onRecoverableError }));

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(out()).toEqual({ page: 1 });

    act(() => root.unmount());
    container.remove();
  });
});

describe('useTypedRouter', () => {
  test('builds the href and hands it to next/router with the Pages Router s options', async () => {
    let typed: ReturnType<typeof routes.useTypedRouter> | undefined;
    const Probe = () => {
      typed = routes.useTypedRouter();
      return null;
    };

    at(['/home', '/home'], <Probe />);

    await expect(typed!.push('/products/[id]', { params: { id: 42 }, shallow: true })).resolves.toBe(true);
    await typed!.replace('/products', { searchParams: { page: 2 }, scroll: false });
    await typed!.prefetch('/home');

    expect(router.push).toHaveBeenCalledWith('/products/42', undefined, { scroll: undefined, shallow: true });
    expect(router.replace).toHaveBeenCalledWith('/products?page=2', undefined, { scroll: false, shallow: undefined });
    expect(router.prefetch).toHaveBeenCalledWith('/home');
  });

  test('refresh re-navigates to the current URL; forward walks history', async () => {
    const forward = vi.spyOn(window.history, 'forward').mockImplementation(() => undefined);
    let typed: ReturnType<typeof routes.useTypedRouter> | undefined;
    const Probe = () => {
      typed = routes.useTypedRouter();
      return null;
    };

    at(['/products', '/products?page=3'], <Probe />);

    await typed!.refresh();
    typed!.forward();
    typed!.back();

    expect(router.replace).toHaveBeenCalledWith('/products?page=3', undefined, { scroll: false });
    expect(forward).toHaveBeenCalled();
    expect(router.back).toHaveBeenCalled();
  });
});

describe('TypedLink', () => {
  test('renders an anchor whose href is built from its params, search params and hash', () => {
    const { TypedLink } = routes;

    at(
      ['/home', '/home'],
      <TypedLink href="/products/[id]" params={{ id: 42 }} hash="top">
        detail
      </TypedLink>,
    );

    expect(screen.getByRole('link', { name: 'detail' }).getAttribute('href')).toBe('/products/42#top');
  });
});

describe('useResolveHref', () => {
  const Language = createContext('en');

  const linked = bindRoutes(
    attachCoreMetadata(defineCoreRoutes({ home: { _metadata: {} }, blog: { _metadata: {} } })).withMeta<{
      href?: (context: { language: string }) => string;
    }>()({
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

  test('push, replace and TypedLink go where the resolver says; prefetch skips the absolute URL', async () => {
    const { TypedLink } = linked;
    let typed: ReturnType<typeof linked.useTypedRouter> | undefined;
    const Probe = () => {
      typed = linked.useTypedRouter();
      return (
        <>
          <TypedLink href="/blog">blog</TypedLink>
          <TypedLink href="/home">home</TypedLink>
        </>
      );
    };

    setPage('/home', '/home');
    render(
      <Language.Provider value="ko">
        <Probe />
      </Language.Provider>,
    );

    await typed!.push('/blog', { shallow: true });
    await typed!.replace('/blog');
    await typed!.prefetch('/blog');
    await typed!.prefetch('/home');

    expect(router.push).toHaveBeenCalledWith('https://blog.example.com/ko', undefined, { scroll: undefined, shallow: true });
    expect(router.replace).toHaveBeenCalledWith('https://blog.example.com/ko', undefined, { scroll: undefined, shallow: undefined });
    expect(router.prefetch).toHaveBeenCalledTimes(1);
    expect(router.prefetch).toHaveBeenCalledWith('/home');
    expect(screen.getByRole('link', { name: 'blog' }).getAttribute('href')).toBe('https://blog.example.com/ko');
    expect(screen.getByRole('link', { name: 'home' }).getAttribute('href')).toBe('/home');
  });
});

describe('defineRoutes and attachMetadata', () => {
  test('a tree declared with this entry gets the same hooks', () => {
    const local = defineRoutes({ orders: { '[id]': { _metadata: { paramSchema: z.number() } } } });
    const Probe = () => <Show value={local.useTypedParams('/orders/[id]')} />;

    at(['/orders/[id]', '/orders/7', { id: '7' }], <Probe />);
    expect(out()).toEqual({ id: 7 });
  });

  test('attached metadata and the shared schemas are read together', () => {
    const app = attachMetadata(shared)({ '/products/[id]': { title: 'Product' } });
    const Probe = () => <Show value={{ title: app.useCurrentRoute().metadata?.title, params: app.useTypedParams('/products/[id]') }} />;

    at(['/products/[id]', '/products/5', { id: '5' }], <Probe />);
    expect(out()).toEqual({ title: 'Product', params: { id: 5 } });
  });
});

/**
 * Every module the Pages Router entry loads at runtime, and the bare specifiers they
 * import. Type-only imports are skipped, because they are erased and load nothing.
 */
const runtimeGraph = (entry: string) => {
  const files = new Set<string>();
  const specifiers = new Set<string>();

  const visit = (file: string) => {
    if (files.has(file)) return;
    files.add(file);

    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest);

    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      if (!statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue;

      const typeOnly = ts.isImportDeclaration(statement)
        ? statement.importClause?.isTypeOnly ||
          (statement.importClause !== undefined &&
            !statement.importClause.name &&
            statement.importClause.namedBindings !== undefined &&
            ts.isNamedImports(statement.importClause.namedBindings) &&
            statement.importClause.namedBindings.elements.every((element) => element.isTypeOnly))
        : statement.isTypeOnly ||
          (statement.exportClause !== undefined &&
            ts.isNamedExports(statement.exportClause) &&
            statement.exportClause.elements.every((element) => element.isTypeOnly));
      if (typeOnly) continue;

      const specifier = statement.moduleSpecifier.text;
      if (!specifier.startsWith('.')) {
        specifiers.add(specifier);
        continue;
      }

      const base = resolve(dirname(file), specifier);
      const candidates = [`${base}.ts`, `${base}.tsx`, resolve(base, 'index.ts')];
      const found = candidates.find((candidate) => {
        try {
          readFileSync(candidate);
          return true;
        } catch {
          return false;
        }
      });
      if (found) visit(found);
    }
  };

  visit(entry);
  return { files: [...files], specifiers: [...specifiers] };
};

describe('isolation from the App Router entry', () => {
  test('nothing the Pages Router entry loads reaches next/navigation or the App Router hooks', () => {
    const { files, specifiers } = runtimeGraph(resolve(__dirname, '../packages/next/src/pages/index.ts'));

    expect(specifiers).toContain('next/router');
    expect(specifiers).not.toContain('next/navigation');

    // The App Router's hooks, its binder, and the package root that re-exports both.
    const loaded = files.map((file) => file.replace(/.*packages\/next\/src\//, ''));
    expect(loaded).toContain('pages/hooks.ts');
    expect(loaded).not.toContain('client.tsx');
    expect(loaded).not.toContain('defineRoutes.tsx');
    expect(loaded).not.toContain('index.ts');
  });
});
