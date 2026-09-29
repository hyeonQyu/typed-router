import type { HasRequiredKeys, RouteArgs } from '@hyeonqyu/typed-router-core';

/** Next-specific navigation options layered on top of the shared route args. */
export type NavigateOptions = {
  scroll?: boolean;
};

/**
 * `TOptions` is the router's own options, so the Pages Router entry can add `shallow`
 * without the App Router entry growing an option its router does not have.
 */
export type NavigateArgs<TTree, TPath extends string, TOptions = NavigateOptions> = RouteArgs<TTree, TPath> & TOptions;

/**
 * Makes the argument object optional when the route requires nothing, so
 * `push('/cart')` is legal while `push('/products/[id]')` is a compile error.
 */
export type NavigateArgsTuple<TTree, TPath extends string, TOptions = NavigateOptions> =
  HasRequiredKeys<RouteArgs<TTree, TPath>> extends true
    ? [args: NavigateArgs<TTree, TPath, TOptions>]
    : [args?: NavigateArgs<TTree, TPath, TOptions>];
