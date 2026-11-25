'use client';

import { useEffect, useRef, useState } from 'react';

type Props = { m: string; u: string; r: 'yes' | 'no'; t: string };
type State =
  | { kind: 'saving' }
  | { kind: 'done'; title: string; label: string; other: string; test?: boolean }
  | { kind: 'error'; error: string };

const C = {
  bg: '#F3F1ED',
  card: '#FFFFFF',
  ink: '#171614',
  body: '#2E2C28',
  muted: '#8F8B83',
  line: '#EFECE6',
  accent: '#FE722B',
  font: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

export function RsvpClient({ m, u, r, t }: Props) {
  const [answer, setAnswer] = useState<'yes' | 'no'>(r);
  const [state, setState] = useState<State>({ kind: 'saving' });
  const sent = useRef<string | null>(null);

  useEffect(() => {
    if (sent.current === answer) return;
    sent.current = answer;
    let cancelled = false;
    fetch('/api/rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ m, u, r: answer, t }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) setState({ kind: 'error', error: data.error ?? 'No pude guardar tu respuesta.' });
        else setState({ kind: 'done', title: data.title, label: data.label, other: data.other, test: data.test });
      })
      .catch(() => !cancelled && setState({ kind: 'error', error: 'No hay conexión. Probá de nuevo.' }));
    return () => {
      cancelled = true;
    };
  }, [answer, m, u, t]);

  const change = () => {
    setState({ kind: 'saving' });
    setAnswer((a) => (a === 'yes' ? 'no' : 'yes'));
  };

  return (
    <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: C.font }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&display=swap" />
      <div style={{ width: '100%', maxWidth: 440, background: C.card, borderRadius: 16, padding: '28px 26px', boxShadow: '0 1px 2px rgba(23,22,20,.06), 0 8px 24px rgba(23,22,20,.06)' }}>
        <div style={{ height: 3, width: 40, background: C.accent, borderRadius: 2, marginBottom: 18 }} />
        {state.kind === 'saving' && <p style={{ margin: 0, color: C.muted, fontSize: 15 }}>Guardando tu respuesta…</p>}
        {state.kind === 'error' && (
          <>
            <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: C.ink, letterSpacing: '-0.02em' }}>No se pudo guardar</h1>
            <p style={{ margin: 0, color: C.body, fontSize: 15, lineHeight: 1.6 }}>{state.error}</p>
          </>
        )}
        {state.kind === 'done' && (
          <>
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#D9480F' }}>
              {state.title}
            </p>
            <h1 style={{ margin: '0 0 10px', fontSize: 26, fontWeight: 800, color: C.ink, letterSpacing: '-0.025em', lineHeight: 1.15 }}>
              Listo, anoté: <span style={{ color: C.accent }}>{state.label}</span>
            </h1>
            <p style={{ margin: '0 0 18px', color: C.body, fontSize: 15, lineHeight: 1.6 }}>
              {state.test
                ? 'Este era el mail de prueba, así que no quedó guardado en ningún lado.'
                : 'Ya quedó registrado. Podés cerrar esta pestaña.'}
            </p>
            <button
              type="button"
              onClick={change}
              style={{ font: 'inherit', fontSize: 14, fontWeight: 700, padding: '10px 18px', borderRadius: 999, border: `1px solid #D9D4CB`, background: C.card, color: C.ink, cursor: 'pointer' }}
            >
              Cambiar a: {state.other}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
