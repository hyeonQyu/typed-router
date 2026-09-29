import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

type Manifest = {
  name: string;
  types?: string;
  exports?: Record<string, string | { types?: string }>;
  typesVersions?: Record<string, Record<string, string[]>>;
};

const packagesDir = join(__dirname, '..', 'packages');
const manifests: Manifest[] = readdirSync(packagesDir).map((dir) =>
  JSON.parse(readFileSync(join(packagesDir, dir, 'package.json'), 'utf8')),
);

// `"moduleResolution": "node"` ignores `exports`, so a subpath's declarations are only
// visible there through `typesVersions`. Every typed subpath needs a matching entry, or
// `import … from '<pkg>/pages'` fails with TS2307 under node10 while bundlers resolve it fine.
test.each(manifests.map((m) => [m.name, m] as const))('%s mirrors every typed subpath in typesVersions', (_, m) => {
  const expected: Record<string, string[]> = {};
  for (const [key, target] of Object.entries(m.exports ?? {})) {
    if (key === '.' || typeof target === 'string' || !target.types) continue;
    expected[key.replace(/^\.\//, '')] = [target.types];
  }

  // The root entry keeps resolving through `types`; mapping `*` would shadow it.
  expect(m.typesVersions?.['*'] ?? {}).toEqual(expected);
});
