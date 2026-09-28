import { isRouteGroup } from '@hyeonqyu/typed-router-core';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * The only thing this module needs from a route tree. Structural on purpose, so
 * `findRouteDrift(routes, …)` accepts a `defineRoutes()` result without dragging
 * the adapter's React types into a Node-only entry point.
 */
export type RoutesLike = {
  paths: readonly string[];
};

/** Extensions Next treats as a page when `pageExtensions` is not configured. */
const DEFAULT_PAGE_EXTENSIONS = ['tsx', 'ts', 'jsx', 'js'] as const;

export type FindRouteDriftOptions = {
  /**
   * Pathnames to leave out of the report, as declared pathnames rather than folder
   * names: `'/admin/secret'` for one route, `'/admin/*'` for a route and everything
   * under it. The Next conventions that address no pathname of their own —
   * intercepting routes (`(.)`, `(..)`, `(...)`), private folders (`_folder`),
   * `route.ts`, `default.tsx` — are skipped already and never need listing here.
   */
  ignore?: readonly string[];
  /** Mirrors `next.config.js` `pageExtensions`. Defaults to `['tsx', 'ts', 'jsx', 'js']`. */
  pageExtensions?: readonly string[];
};

export type RouteDriftReport = {
  /** Declared in the tree with no page under `app/` — type-checks, then 404s. */
  missingFromAppDir: string[];
  /** A page under `app/` the tree never declares — live, but absent from `routes.paths`. */
  missingFromTree: string[];
  /** True when both lists are empty. */
  inSync: boolean;
};

/**
 * A parallel route renders into a layout slot, and like a route group it adds no URL
 * segment — but what sits *under* it still does. `dashboard/@team/settings/page.tsx`
 * really is served at `/dashboard/settings`, with no `dashboard/settings/page.tsx`
 * anywhere, so the slot is transparent rather than skipped.
 */
const isParallelSlot = (name: string): boolean => name.startsWith('@');

/** `_folder` opts a subtree out of routing entirely. */
const isPrivateFolder = (name: string): boolean => name.startsWith('_');

/** `(.)photo`, `(..)photo`, `(..)(..)photo`, `(...)photo` — rendered over another route, not at their own path. */
const isIntercepting = (name: string): boolean => /^\(\.{1,3}\)/.test(name);

const isPageFile = (name: string, pageExtensions: readonly string[]): boolean =>
  pageExtensions.some((extension) => name === `page.${extension}`);

/**
 * Every pathname `app/` actually serves, in the same notation the tree uses —
 * Next folder names and tree keys share their syntax (`[id]`, `[...slug]`,
 * `[[...slug]]`, `(group)`), so the two sides compare as plain strings.
 */
const collectAppDirPaths = (appDir: string, pageExtensions: readonly string[]): string[] => {
  const found = new Set<string>();

  const walk = (directory: string, url: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const { name } = entry;
      if (name.startsWith('.') || name === 'node_modules') continue;

      if (entry.isDirectory()) {
        if (isPrivateFolder(name) || isIntercepting(name)) continue;

        const transparent = isRouteGroup(name) || isParallelSlot(name);
        walk(join(directory, name), transparent ? url : `${url}/${name}`);
        continue;
      }

      // `route.ts`, `default.tsx`, `layout.tsx`, `loading.tsx`, … are not pathnames.
      if (isPageFile(name, pageExtensions)) found.add(url === '' ? '/' : url);
    }
  };

  walk(appDir, '');
  return [...found];
};

const isIgnored = (pathname: string, patterns: readonly string[]): boolean =>
  patterns.some((pattern) => {
    if (!pattern.endsWith('/*')) return pathname === pattern;

    const prefix = pattern.slice(0, -2);
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });

const resolveDir = (dir: string, kind: 'app' | 'pages'): string => {
  const root = resolve(dir);

  if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`typed-router: ${kind} directory "${dir}" does not exist (resolved to "${root}").`);
  }

  return root;
};

/** Both directions of drift between the tree and what a directory serves, sorted. */
const compare = (routes: RoutesLike, onDisk: readonly string[], ignore: readonly string[]) => {
  const declared = new Set(routes.paths);
  const served = new Set(onDisk);

  return {
    missingFromDir: [...declared].filter((path) => !served.has(path) && !isIgnored(path, ignore)).sort(),
    missingFromTree: [...served].filter((path) => !declared.has(path) && !isIgnored(path, ignore)).sort(),
  };
};

/**
 * Compares the routes declared in the tree against the pages that exist under `app/`,
 * and reports the pathnames only one side knows about.
 *
 * ```ts
 * const report = findRouteDrift(routes, 'src/app');
 * if (!report.inSync) console.error(report.missingFromAppDir, report.missingFromTree);
 * ```
 *
 * `appDir` is resolved from the current working directory. Node-only: this module
 * reads the filesystem and is published on its own entry point so `fs` never reaches
 * a browser bundle.
 */
export const findRouteDrift = (routes: RoutesLike, appDir: string, options: FindRouteDriftOptions = {}): RouteDriftReport => {
  const { ignore = [], pageExtensions = DEFAULT_PAGE_EXTENSIONS } = options;
  const root = resolveDir(appDir, 'app');

  const { missingFromDir, missingFromTree } = compare(routes, collectAppDirPaths(root, pageExtensions), ignore);

  return {
    missingFromAppDir: missingFromDir,
    missingFromTree,
    inSync: missingFromDir.length === 0 && missingFromTree.length === 0,
  };
};

/** The message both drift errors share; only the directory and its first list differ. */
const describe = (dir: string, missingFromDir: readonly string[], missingFromTree: readonly string[]): string => {
  const lines = [`typed-router: the route tree and "${dir}" disagree.`];

  if (missingFromDir.length > 0) {
    lines.push('  declared in the tree, but no page exists — these type-check and 404 at runtime:');
    lines.push(...missingFromDir.map((path) => `    ${path}`));
  }

  if (missingFromTree.length > 0) {
    lines.push('  a page exists, but the tree never declares it — live, yet missing from routes.paths:');
    lines.push(...missingFromTree.map((path) => `    ${path}`));
  }

  return lines.join('\n');
};

export class RouteDriftError extends Error {
  /** The drift that caused the throw, so a caller can inspect it instead of parsing the message. */
  readonly report: RouteDriftReport;

  constructor(report: RouteDriftReport, appDir: string) {
    super(describe(appDir, report.missingFromAppDir, report.missingFromTree));
    this.name = 'RouteDriftError';
    this.report = report;
  }
}

/**
 * Throws {@link RouteDriftError} unless the tree and `app/` declare exactly the same
 * pathnames. Written for a test, where a failure lands in the suite of whoever owns
 * the app rather than blocking everyone's build:
 *
 * ```ts
 * import { assertRoutesMatchAppDir } from '@hyeonqyu/typed-router-next/check';
 * import { routes } from '@/routes';
 *
 * test('the route tree matches src/app', () => {
 *   assertRoutesMatchAppDir(routes, 'src/app');
 * });
 * ```
 */
export const assertRoutesMatchAppDir = (routes: RoutesLike, appDir: string, options?: FindRouteDriftOptions): void => {
  const report = findRouteDrift(routes, appDir, options);
  if (!report.inSync) throw new RouteDriftError(report, appDir);
};

// --- the Pages Router ------------------------------------------------------------

/**
 * Files at the root of `pages/` that Next reads as the app shell or an error page rather
 * than as a route: `_app`, `_document`, `_error`, and the static `404` / `500` pages.
 */
const PAGES_SPECIAL_FILES: ReadonlySet<string> = new Set(['_app', '_document', '_error', '404', '500']);

/**
 * The route name of a file under `pages/`, or `undefined` when it is not a page.
 *
 * The longest matching extension wins, so a project using `pageExtensions:
 * ['page.tsx']` reads `about.page.tsx` as `about` and leaves `about.tsx` alone.
 */
const pageNameOf = (file: string, pageExtensions: readonly string[]): string | undefined => {
  if (file.endsWith('.d.ts')) return undefined;

  const extension = [...pageExtensions]
    .sort((a, b) => b.length - a.length)
    .find((candidate) => file.endsWith(`.${candidate}`) && file.length > candidate.length + 1);

  return extension === undefined ? undefined : file.slice(0, -(extension.length + 1));
};

/**
 * Every pathname `pages/` actually serves, in the tree's notation. Each page file is a
 * route of its own — `products/[id].tsx` is `/products/[id]` — and an `index` file
 * serves its folder: `products/index.tsx` is `/products`, `pages/index.tsx` is `/`.
 *
 * Unlike `app/`, a `pages/` folder name is always a URL segment: the Pages Router has no
 * route groups, parallel slots or private folders, so `(shop)`, `@team` and `_folder`
 * are read as the literal segments Next serves them at.
 */
const collectPagesDirPaths = (pagesDir: string, pageExtensions: readonly string[]): string[] => {
  const found = new Set<string>();

  const walk = (directory: string, url: string) => {
    const atRoot = url === '';

    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const { name } = entry;
      if (name.startsWith('.') || name === 'node_modules') continue;

      if (entry.isDirectory()) {
        // `pages/api/**` are API routes: handlers, not pages.
        if (atRoot && name === 'api') continue;

        walk(join(directory, name), `${url}/${name}`);
        continue;
      }

      const page = pageNameOf(name, pageExtensions);
      // Next reads `/api` itself as an API route too, so `pages/api.ts` is no page either.
      if (page === undefined || (atRoot && (PAGES_SPECIAL_FILES.has(page) || page === 'api'))) continue;

      if (page === 'index') found.add(atRoot ? '/' : url);
      else found.add(`${url}/${page}`);
    }
  };

  walk(pagesDir, '');
  return [...found];
};

export type FindPagesDirDriftOptions = {
  /**
   * Pathnames to leave out of the report: `'/admin/secret'` for one route, `'/admin/*'`
   * for a route and everything under it. `_app`, `_document`, `_error`, `404`, `500` and
   * `api/` are skipped already and never need listing here.
   */
  ignore?: readonly string[];
  /** Mirrors `next.config.js` `pageExtensions`. Defaults to `['tsx', 'ts', 'jsx', 'js']`. */
  pageExtensions?: readonly string[];
};

export type PagesDirDriftReport = {
  /** Declared in the tree with no page under `pages/` — type-checks, then 404s. */
  missingFromPagesDir: string[];
  /** A page under `pages/` the tree never declares — live, but absent from `routes.paths`. */
  missingFromTree: string[];
  /** True when both lists are empty. */
  inSync: boolean;
};

/**
 * The Pages Router counterpart of {@link findRouteDrift}: compares the routes declared in
 * the tree against the pages under `pages/`, and reports the pathnames only one side
 * knows about.
 *
 * ```ts
 * const report = findPagesDirDrift(routes, 'src/pages');
 * if (!report.inSync) console.error(report.missingFromPagesDir, report.missingFromTree);
 * ```
 *
 * `pagesDir` is resolved from the current working directory.
 */
export const findPagesDirDrift = (routes: RoutesLike, pagesDir: string, options: FindPagesDirDriftOptions = {}): PagesDirDriftReport => {
  const { ignore = [], pageExtensions = DEFAULT_PAGE_EXTENSIONS } = options;
  const root = resolveDir(pagesDir, 'pages');

  const { missingFromDir, missingFromTree } = compare(routes, collectPagesDirPaths(root, pageExtensions), ignore);

  return {
    missingFromPagesDir: missingFromDir,
    missingFromTree,
    inSync: missingFromDir.length === 0 && missingFromTree.length === 0,
  };
};

export class PagesDirDriftError extends Error {
  /** The drift that caused the throw, so a caller can inspect it instead of parsing the message. */
  readonly report: PagesDirDriftReport;

  constructor(report: PagesDirDriftReport, pagesDir: string) {
    super(describe(pagesDir, report.missingFromPagesDir, report.missingFromTree));
    this.name = 'PagesDirDriftError';
    this.report = report;
  }
}

/**
 * Throws {@link PagesDirDriftError} unless the tree and `pages/` declare exactly the same
 * pathnames. The Pages Router counterpart of {@link assertRoutesMatchAppDir}:
 *
 * ```ts
 * import { assertRoutesMatchPagesDir } from '@hyeonqyu/typed-router-next/check';
 * import { routes } from '@/routes';
 *
 * test('the route tree matches src/pages', () => {
 *   assertRoutesMatchPagesDir(routes, 'src/pages');
 * });
 * ```
 */
export const assertRoutesMatchPagesDir = (routes: RoutesLike, pagesDir: string, options?: FindPagesDirDriftOptions): void => {
  const report = findPagesDirDrift(routes, pagesDir, options);
  if (!report.inSync) throw new PagesDirDriftError(report, pagesDir);
};
