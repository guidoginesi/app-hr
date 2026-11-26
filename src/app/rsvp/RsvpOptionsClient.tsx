'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Respuesta a un mensaje con preguntas y opciones. Guarda la opción del botón
 * que trajo a la persona y le muestra todas las preguntas, así contesta las
 * otras (o cambia) desde acá sin volver al mail.
 */
type Props = { m: string; u: string; t: string; q: number; o: number };
type Question = { question: string; options: string[] };
type Loaded = { title: string; questions: Question[]; answers: Record<string, number>; test?: boolean };
type State = { kind: 'saving' } | { kind: 'error'; error: string } | ({ kind: 'done' } & Loaded);

const C = {
  bg: '#F3F1ED',
  card: '#FFFFFF',
  ink: '#171614',
  body: '#2E2C28',
  muted: '#8F8B83',
  line: '#D9D4CB',
  accent: '#FE722B',
  accentSoft: '#FFF1E8',
  font: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

export function RsvpOptionsClient({ m, u, t, q, o }: Props) {
  const [state, setState] = useState<State>({ kind: 'saving' });
  const [pending, setPending] = useState<string | null>(null);
  const first = useRef(false);

  const save = useCallback(
    async (qi: number, oi: number) => {
      const res = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ m, u, t, q: qi, o: oi }),
      }).catch(() => null);
      if (!res) return { error: 'No hay conexión. Probá de nuevo.' };
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { error: (data.error as string) ?? 'No pude guardar tu respuesta.' };
      return { data: data as Loaded };
    },
    [m, u, t],
  );

  useEffect(() => {
    if (first.current) return;
    first.current = true;
    save(q, o).then((r) =>
      setState('error' in r ? { kind: 'error', error: r.error! } : { kind: 'done', ...r.data! }),
    );
  }, [save, q, o]);

  const choose = async (qi: number, oi: number) => {
    if (state.kind !== 'done' || pending) return;
    setPending(`${qi}:${oi}`);
    const r = await save(qi, oi);
    setPending(null);
    if ('error' in r) return setState({ kind: 'error', error: r.error! });
    // En el mail de prueba no se guarda nada: la página recuerda la elección igual.
    const answers = r.data!.test ? { ...state.answers, [String(qi)]: oi } : r.data!.answers;
    setState({ kind: 'done', ...r.data!, answers });
  };

  const answered = state.kind === 'done' ? state.questions.filter((_, i) => state.answers[String(i)] !== undefined).length : 0;

  return (
    <main style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: C.font }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&display=swap" />
      <div style={{ width: '100%', maxWidth: 480, background: C.card, borderRadius: 16, padding: '28px 26px', boxShadow: '0 1px 2px rgba(23,22,20,.06), 0 8px 24px rgba(23,22,20,.06)' }}>
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
            <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800, color: C.ink, letterSpacing: '-0.025em', lineHeight: 1.15 }}>
              {answered === state.questions.length ? 'Listo, quedó anotado' : 'Anotado. Te falta responder:'}
            </h1>
            <p style={{ margin: '0 0 20px', color: C.body, fontSize: 14, lineHeight: 1.6 }}>
              {state.test
                ? 'Este era el mail de prueba, así que no se guarda en ningún lado.'
                : 'Podés cambiar cualquier respuesta tocando otra opción.'}
            </p>
            {state.questions.map((question, qi) => (
              <div key={qi} style={{ marginBottom: 18 }}>
                <p style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 800, color: C.ink }}>{question.question}</p>
                <div role="radiogroup" aria-label={question.question} style={{ display: 'grid', gap: 8 }}>
                  {question.options.map((label, oi) => {
                    const selected = state.answers[String(qi)] === oi;
                    return (
                      <button
                        key={oi}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={Boolean(pending)}
                        onClick={() => choose(qi, oi)}
                        style={{
                          font: 'inherit',
                          fontSize: 14,
                          fontWeight: 700,
                          textAlign: 'left',
                          padding: '11px 14px',
                          borderRadius: 10,
                          border: `1px solid ${selected ? C.accent : C.line}`,
                          background: selected ? C.accentSoft : C.card,
                          color: C.ink,
                          cursor: pending ? 'wait' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <span
                          aria-hidden
                          style={{
                            flex: 'none',
                            width: 16,
                            height: 16,
                            borderRadius: 999,
                            border: `2px solid ${selected ? C.accent : C.line}`,
                            background: selected ? `radial-gradient(${C.accent} 45%, transparent 50%)` : 'transparent',
                          }}
                        />
                        {pending === `${qi}:${oi}` ? 'Guardando…' : label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </main>
  );
}
