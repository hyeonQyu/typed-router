import { RouteInspector } from '../components/RouteInspector';
import { code, Section } from '../components/ui';
import { routes, useTypedRouter } from '../routes';

export default function HomePage() {
  const router = useTypedRouter();

  return (
    <>
      <RouteInspector />

      <Section title="routes.paths — derived from the shared tree">
        <div style={code}>{routes.paths.join('\n')}</div>
      </Section>

      <Section title="routes.buildHref — no hook, runs anywhere">
        <div style={code}>{routes.buildHref('/products/[id]', { params: { id: 7 } })}</div>
      </Section>

      <Section title="useResolveHref — a route that lives on another site">
        <button type="button" onClick={() => void router.push('/blog')}>
          router.push(&apos;/blog&apos;)
        </button>
      </Section>
    </>
  );
}
