import type { AppProps } from 'next/app';
import Head from 'next/head';
import { Nav } from '../components/Nav';
import { page } from '../components/ui';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      <Head>
        <title>typed-router · Next.js Pages Router example</title>
      </Head>
      <main style={page}>
        <h1 style={{ fontSize: 22, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>typed-router · Next.js Pages Router</h1>
        <p style={{ color: '#6b7280', marginTop: 0, fontSize: 14 }}>
          A tree declared with core, in a shared module, bound to <code>next/router</code> with <code>bindRoutes</code>.
        </p>
        <Nav />
        <Component {...pageProps} />
      </main>
    </div>
  );
}
