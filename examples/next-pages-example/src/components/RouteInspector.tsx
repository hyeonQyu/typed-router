import { useCurrentRoute } from '../routes';
import { Section, Value } from './ui';

/**
 * Shows what the library resolved for the current page. `declared pathname` is Next's
 * own `router.pathname`, so it is right from the first render — even on a statically
 * optimized page, where `live url` and `params` only fill in after hydration.
 */
export const RouteInspector = () => {
  const { pathname, url, metadata, params } = useCurrentRoute();

  return (
    <Section title="Current route">
      <Value label="live url" value={url} />
      <Value label="declared pathname" value={pathname} />
      <Value label="metadata.title" value={metadata?.title} />
      <Value label="params" value={params} />
    </Section>
  );
};
