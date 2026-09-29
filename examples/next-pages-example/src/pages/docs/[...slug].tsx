import type { GetServerSideProps } from 'next';
import { RouteInspector } from '../../components/RouteInspector';
import { Section, Value } from '../../components/ui';
import { useTypedParams } from '../../routes';

/**
 * A server-rendered page. With `getServerSideProps` the router is ready from the very
 * first render, on the server too, so no `<RouterReady>` boundary is needed here.
 */
export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function DocsPage() {
  // A catch-all is reported under its declared name, `slug`.
  const { slug } = useTypedParams('/docs/[...slug]');

  return (
    <>
      <RouteInspector />
      <Section title="useTypedParams('/docs/[...slug]')">
        <Value label="slug" value={slug} />
      </Section>
    </>
  );
}
