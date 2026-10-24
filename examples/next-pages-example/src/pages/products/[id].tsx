import { RouteInspector } from '../../components/RouteInspector';
import { Section, subtleLink, Value } from '../../components/ui';
import { RouterReady, TypedLink, useTypedParams } from '../../routes';

/**
 * A statically optimized dynamic page. Next prerenders one HTML file for every `[id]`,
 * so until hydration it does not know which `id` it is showing — `useTypedParams` would
 * throw `RouteNotReadyError` there, and renders inside `<RouterReady>` instead.
 */
export default function ProductDetailPage() {
  return (
    <>
      <RouteInspector />
      <RouterReady fallback={<p data-testid="waiting">Waiting for the router…</p>}>
        <ProductDetail />
      </RouterReady>
    </>
  );
}

function ProductDetail() {
  // `[id]` declares `paramSchema: z.number()` in the shared tree, so this is 42, not '42'.
  const params = useTypedParams('/products/[id]');

  return (
    <>
      <Section title="useTypedParams('/products/[id]')">
        <Value label="id" value={params.id} />
      </Section>

      <Section title="Links that require this param">
        <TypedLink href="/products/[id]" params={{ id: params.id + 1 }} style={subtleLink}>
          Next product
        </TypedLink>
      </Section>
    </>
  );
}
