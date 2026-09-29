import { RouteInspector } from '../../components/RouteInspector';
import { Section, subtleLink, Value } from '../../components/ui';
import { RouterReady, TypedLink, useTypedRouter, useTypedSearchParams } from '../../routes';

/**
 * A statically optimized page: no data fetching, so Next prerenders it once with an
 * empty query and fills the query in after hydration. The view that reads search
 * params therefore renders inside `<RouterReady>`.
 */
export default function ProductsPage() {
  return (
    <>
      <RouteInspector />
      <RouterReady fallback={<p data-testid="waiting">Waiting for the router…</p>}>
        <ProductsView />
      </RouterReady>
    </>
  );
}

function ProductsView() {
  // Validated and coerced by the shared tree's schema — not a cast.
  const searchParams = useTypedSearchParams('/products');
  const router = useTypedRouter();

  return (
    <>
      <Section title="useTypedSearchParams('/products')">
        <Value label="page" value={searchParams.page} />
        <Value label="sort" value={searchParams.sort} />
        <Value label="inStock" value={searchParams.inStock} />
      </Section>

      <Section title="Try it">
        <TypedLink href="/products" searchParams={{ page: 2, inStock: true }} style={subtleLink}>
          ?page=2&amp;inStock=true
        </TypedLink>
        <TypedLink href="/products" searchParams={{ sort: 'price-desc' }} style={subtleLink}>
          ?sort=price-desc
        </TypedLink>
        <button
          type="button"
          style={{ ...subtleLink, border: 0, cursor: 'pointer' }}
          onClick={() => router.push('/products', { searchParams: { page: searchParams.page + 1 }, shallow: true })}
        >
          router.push → next page (shallow)
        </button>
      </Section>
    </>
  );
}
