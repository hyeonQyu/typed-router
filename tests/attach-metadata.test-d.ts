import {
  attachMetadata,
  children,
  defineRoutes,
  type CollectedRouteOf,
  type Params,
  type Pathname,
  type RouteMetadataOf,
} from '@hyeonqyu/typed-router-core';
import { attachMetadata as attachReact } from '@hyeonqyu/typed-router-react';
import { z } from 'zod';

/**
 * `attachMetadata` lets an app attach its own metadata to a tree declared elsewhere, by
 * pathname. The shared tree is the contract, so this file pins down both directions of
 * it: the result is a route tree like any other, and the patch cannot reach past the
 * source — no pathname it does not declare, no structural field it already owns.
 */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

type TranslationKey = 'GNB_USER_INFO' | 'GNB_MY_ACTIVITY' | 'GNB_MY_QUESTS' | 'GNB_LOGIN';

/** What a shared package exports: structure, schemas, and nothing app-specific. */
const accountRoutes = defineRoutes({
  info: { _metadata: {} },
  activity: {
    _metadata: { label: 'Activity' },
    quest: { _metadata: {} },
  },
  '(auth)': { login: { _metadata: {} } },
  orders: {
    '[id]': { _metadata: { paramSchema: z.number(), searchParamsSchema: z.object({ tab: z.string().optional() }) } },
  },
});

const ia = attachMetadata(accountRoutes).withMeta<{ title: TranslationKey }>()({
  '/info': { title: 'GNB_USER_INFO' },
  '/activity': { title: 'GNB_MY_ACTIVITY' },
  '/activity/quest': { title: 'GNB_MY_QUESTS' },
  '/login': { title: 'GNB_LOGIN' },
});

/** Literal, as it would be from `defineRoutes.withMeta`. */
const infoTitle = ia.getMetadata('/info').title;
type _titleStaysALiteral = Expect<Equal<typeof infoTitle, 'GNB_USER_INFO'>>;

/** The structure is the source's: same pathnames, nothing added, nothing lost. */
type _pathsAreTheSource = Expect<Equal<Pathname<typeof ia>, Pathname<typeof accountRoutes>>>;

/** A pathname under a route group is keyed the way it is navigated — without the group. */
type _groupIsTransparent = Expect<Equal<RouteMetadataOf<typeof ia, '/login'>['title'], 'GNB_LOGIN'>>;

/** Source fields the patch does not mention survive the merge. */
type _sourceFieldsSurvive = Expect<Equal<RouteMetadataOf<typeof ia, '/activity'>['label'], 'Activity'>>;

/** A route the patch leaves out keeps the source's metadata as it was. */
type _unlistedRouteUnchanged = Expect<
  Equal<RouteMetadataOf<typeof ia, '/orders/[id]'>, RouteMetadataOf<typeof accountRoutes, '/orders/[id]'>>
>;

/** Structural fields still drive params and search params on the result. */
type _paramSchemaKept = Expect<Equal<Params<typeof ia, '/orders/[id]'>, { id: number }>>;
const orderHref = ia.buildHref('/orders/[id]', { params: { id: 1 }, searchParams: { tab: 'items' } });

/** Enumeration and tree walking see the attached metadata, not the source's. */
type _collectedSeesIt = Expect<Equal<CollectedRouteOf<typeof ia, '/info'>['metadata']['title'], 'GNB_USER_INFO'>>;
const questTitle = children(ia.routes.activity).quest._metadata.title;
type _walkingSeesIt = Expect<Equal<typeof questTitle, 'GNB_MY_QUESTS'>>;

/** Without a contract, each entry is inferred per route, exactly like `defineRoutes`. */
const loose = attachMetadata(accountRoutes)({ '/info': { icon: 'user' } });
type _looseLiteral = Expect<Equal<RouteMetadataOf<typeof loose, '/info'>['icon'], 'user'>>;

/** The source is untouched at the type level too: another consumer sees none of it. */
// @ts-expect-error — `title` was attached to `ia`, never to the shared tree
type _sourceUntouched = RouteMetadataOf<typeof accountRoutes, '/info'>['title'];

/** Adapters return their own route object, with hooks, from the same patch. */
const reactIa = attachReact(accountRoutes)({ '/info': { title: 'Info' } });
const ReactLink = reactIa.TypedLink;
type _adapterLiteral = Expect<Equal<RouteMetadataOf<typeof reactIa, '/info'>['title'], 'Info'>>;

/* Negative cases: each of these must fail to compile. */

const unknownPath = attachMetadata(accountRoutes)({
  // @ts-expect-error — the shared tree declares no `/settings`
  '/settings': { title: 'Settings' },
});

/** A patch declared first and passed by name gets no excess-property check — the guard catches it anyway. */
const declaredPatch = { '/info': { title: 'Info' }, '/removed': { title: 'Gone' } } as const;
// @ts-expect-error — `/removed` is not a route of the shared tree
const unknownPathByName = attachMetadata(accountRoutes)(declaredPatch);

const groupKeyIsNotAPath = attachMetadata(accountRoutes)({
  // @ts-expect-error — route groups add no URL segment, so `/(auth)/login` is not a pathname
  '/(auth)/login': { title: 'Login' },
});

const overridesParamSchema = attachMetadata(accountRoutes)({
  // @ts-expect-error — `paramSchema` belongs to the shared tree
  '/orders/[id]': { paramSchema: z.string() },
});

const overridesSearchSchema = attachMetadata(accountRoutes).withMeta<{ title: string }>()({
  // @ts-expect-error — `searchParamsSchema` belongs to the shared tree, under a contract too
  '/orders/[id]': { title: 'Order', searchParamsSchema: z.object({}) },
});

const missingContractField = attachMetadata(accountRoutes).withMeta<{ title: TranslationKey }>()({
  // @ts-expect-error — the contract requires `title`
  '/info': {},
});

const wrongContractType = attachMetadata(accountRoutes).withMeta<{ title: TranslationKey }>()({
  // @ts-expect-error — not a `TranslationKey`
  '/info': { title: 'GNB_TYPO' },
});

/** Built-in fields keep their context-aware type alongside the contract's. */
const contextual = attachMetadata(accountRoutes).withMeta<{ title: string }, { admin: boolean }>()({
  '/info': { title: 'Info', accessible: (context) => context.admin },
});

export {
  contextual,
  groupKeyIsNotAPath,
  missingContractField,
  orderHref,
  overridesParamSchema,
  overridesSearchSchema,
  ReactLink,
  unknownPath,
  unknownPathByName,
  wrongContractType,
};
export type {
  _adapterLiteral,
  _collectedSeesIt,
  _groupIsTransparent,
  _looseLiteral,
  _paramSchemaKept,
  _pathsAreTheSource,
  _sourceFieldsSurvive,
  _sourceUntouched,
  _titleStaysALiteral,
  _unlistedRouteUnchanged,
  _walkingSeesIt,
};
