import type { CSSProperties, ReactNode } from 'react';

export const page: CSSProperties = {
  maxWidth: 880,
  margin: '0 auto',
  padding: '1.5rem 1rem 4rem',
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  lineHeight: 1.6,
  color: '#111827',
};

export const card: CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: '1rem 1.25rem',
  marginBottom: '1rem',
  background: '#fff',
};

export const link: CSSProperties = {
  display: 'inline-block',
  padding: '0.35rem 0.7rem',
  borderRadius: 6,
  background: '#111827',
  color: '#fff',
  textDecoration: 'none',
  fontSize: 14,
  marginRight: 8,
  marginBottom: 8,
};

export const subtleLink: CSSProperties = { ...link, background: '#f3f4f6', color: '#111827' };

export const code: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 13,
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  padding: '0.6rem 0.8rem',
  whiteSpace: 'pre-wrap',
  overflowX: 'auto',
};

export const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section style={card}>
    <h2 style={{ fontSize: 16, margin: '0 0 0.75rem', letterSpacing: '-0.01em' }}>{title}</h2>
    {children}
  </section>
);

/** Renders a value together with its runtime `typeof`, which is the point of most of these demos. */
export const Value = ({ label, value }: { label: string; value: unknown }) => (
  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 14, marginBottom: 2 }}>
    <span style={{ fontFamily: 'ui-monospace, monospace', color: '#6b7280', minWidth: 190 }}>{label}</span>
    <span style={{ fontFamily: 'ui-monospace, monospace' }} data-testid={label}>
      {JSON.stringify(value) ?? 'undefined'}
    </span>
    <span style={{ fontSize: 12, color: '#059669' }}>{Array.isArray(value) ? 'array' : typeof value}</span>
  </div>
);
