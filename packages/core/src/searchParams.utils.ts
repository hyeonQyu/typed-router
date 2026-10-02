import type { ParsableSchema } from './schema.types';
import { getShape, isDefined, toBoolean, toNumber, validate as validateWith } from './schema.utils';

const validate = (schema: ParsableSchema, data: unknown) => validateWith(schema, data, 'search params');

/**
 * What to do when the URL does not satisfy the route's schema.
 *
 * - `throw`   — raise the validation error (default; surfaces bad links early)
 * - `default` — drop the offending fields and keep whatever still validates
 * - `raw`     — return the coerced values instead of throwing
 */
export type SearchParamsErrorMode = 'throw' | 'default' | 'raw';

export type ParseSearchParamsOptions = {
  onError?: SearchParamsErrorMode;
};

export type RawSearchParams = Record<string, string | string[]>;

/** The shape a raw query has, narrowed to declared keys: each one optional, a repeated key a list. */
export type SearchParamKeysValue<TKey extends string> = Partial<Record<TKey, string | string[]>>;

/** The Standard Schema {@link searchParamKeys} returns — declares key names, validates nothing. */
export type SearchParamKeysSchema<TKey extends string> = {
  readonly ['~standard']: {
    readonly version: 1;
    readonly vendor: 'typed-router';
    readonly validate: (value: unknown) => { value: SearchParamKeysValue<TKey> };
    readonly types?: { readonly input: SearchParamKeysValue<TKey>; readonly output: SearchParamKeysValue<TKey> };
  };
};

const passThrough = Object.freeze({
  '~standard': Object.freeze({ version: 1, vendor: 'typed-router', validate: (value: unknown) => ({ value }) }),
});

/**
 * A `searchParamsSchema` for a route that only needs to name the keys it accepts.
 *
 * Navigation then takes those keys — each optional, each `string | string[]` — and
 * rejects any other. Validation is a pass-through: nothing is coerced, defaulted or
 * rejected, so reading the query back returns the raw values. It is a plain Standard
 * Schema, so swapping in a real schema later is a one-line change.
 *
 * The keys must be given as a type argument; calling it without one is a compile
 * error rather than a schema that silently accepts any key.
 */
export const searchParamKeys = <TKey extends string = never>(
  ..._missingKeys: [TKey] extends [never]
    ? [error: "pass the accepted keys as a type argument, e.g. searchParamKeys<'page' | 'sort'>()"]
    : []
): SearchParamKeysSchema<TKey> => passThrough as unknown as SearchParamKeysSchema<TKey>;

/** Collects a `URLSearchParams`-like object, folding repeated keys into arrays. */
export const collectRawSearchParams = (source: Iterable<[string, string]>): RawSearchParams => {
  const raw: RawSearchParams = {};

  for (const [key, value] of source) {
    const existing = raw[key];
    if (existing === undefined) {
      raw[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      raw[key] = [existing, value];
    }
  }

  return raw;
};

/**
 * `buildHref` writes objects and nested arrays as JSON, so a value shaped like one
 * gets a decoded reading too. Only `{` and `[` prefixes qualify: that covers exactly
 * what the write path encodes, and leaves every scalar reading — including a
 * `z.string()` field's raw string — ahead of it, untouched.
 */
const toJson = (value: string): unknown | undefined => {
  const trimmed = value.trim();
  if (trimmed[0] !== '{' && trimmed[0] !== '[') return undefined;

  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
};

const scalarReadings = (value: string): unknown[] => [value, toNumber(value), toBoolean(value), toJson(value)].filter(isDefined);

const listReadings = (values: string[]): unknown[] => {
  const readings: unknown[][] = [values, values.map(toNumber), values.map(toBoolean), values.map(toJson)];
  return readings.filter((reading) => reading.every(isDefined));
};

/**
 * Every plausible reading of a raw URL value, ordered from most literal to most
 * converted. The field schema decides which one is right, so a `z.string()` field
 * keeps `"123"` as a string while a `z.number()` field gets `123`.
 */
const candidatesFor = (value: string | string[]): unknown[] => {
  if (Array.isArray(value)) return listReadings(value);

  const readings = scalarReadings(value);
  const asSingleItemList = readings.map((reading) => [reading]);

  return [...readings, ...asSingleItemList];
};

/**
 * Turns raw URL strings into the types the schema expects, by asking each field's
 * own schema which reading it accepts. Needs no knowledge of the validation
 * library beyond `.shape` and a validate method.
 */
const coerce = (schema: ParsableSchema, raw: RawSearchParams): Record<string, unknown> => {
  const shape = getShape(schema);
  if (!shape) return { ...raw };

  const coerced: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw)) {
    const field = shape[key];

    if (!field) {
      coerced[key] = value;
      continue;
    }

    const match = candidatesFor(value).find((candidate) => validate(field, candidate).ok);
    coerced[key] = match === undefined ? value : match;
  }

  return coerced;
};

/** Keeps only the entries that individually satisfy their field schema. */
const keepValidFields = (schema: ParsableSchema, coerced: Record<string, unknown>): Record<string, unknown> => {
  const shape = getShape(schema);
  if (!shape) return {};

  const kept: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(coerced)) {
    const field = shape[key];
    if (field && validate(field, value).ok) kept[key] = value;
  }

  return kept;
};

export class SearchParamsParseError extends Error {
  readonly cause: unknown;

  constructor(path: string, cause: unknown) {
    super(`typed-router: search params for "${path}" failed validation.`);
    this.name = 'SearchParamsParseError';
    this.cause = cause;
  }
}

/**
 * Validates raw URL search params against a route's schema, coercing strings to
 * the declared types first so the runtime value matches the inferred type.
 *
 * Without a schema the raw values are returned untouched.
 */
export const parseSearchParams = (
  schema: ParsableSchema | undefined,
  raw: RawSearchParams,
  { onError = 'throw' }: ParseSearchParamsOptions = {},
  path = '',
): Record<string, unknown> => {
  if (!schema) return { ...raw };

  const coerced = coerce(schema, raw);
  const result = validate(schema, coerced);

  if (result.ok) return result.value as Record<string, unknown>;

  if (onError === 'throw') throw new SearchParamsParseError(path, result.error);
  if (onError === 'raw') return coerced;

  const salvaged = validate(schema, keepValidFields(schema, coerced));
  if (salvaged.ok) return salvaged.value as Record<string, unknown>;

  const defaults = validate(schema, {});
  return defaults.ok ? (defaults.value as Record<string, unknown>) : coerced;
};
