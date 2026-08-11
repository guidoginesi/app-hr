'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@pow/ui/components/ui/button';
import { Checkbox } from '@pow/ui/components/ui/checkbox';
import { Input } from '@pow/ui/components/ui/input';

type Area = { id: string; name: string; active: boolean; used: number };

/**
 * Áreas del Banco de Talentos.
 *
 * Son las áreas como las nombra alguien de afuera, que no son las de la app:
 * un candidato no sabe qué es "Front-end VTEX". Por eso se editan acá y no se
 * derivan de los departamentos.
 */
export function TalentPoolAreasPanel() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nueva, setNueva] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/talent-pool/areas');
      const data = await res.json();
      if (res.ok) setAreas(data.areas ?? []);
      else setError(data.error ?? 'No se pudieron cargar las áreas.');
    } catch {
      setError('No se pudieron cargar las áreas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (body: Record<string, unknown>, ok: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/talent-pool/areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo guardar.');
        return;
      }
      setAreas(data.areas ?? []);
      setNueva('');
      setNotice(ok);
    } catch {
      setError('No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {notice && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-success-subtle px-5 py-3 text-sm text-[var(--green-700)]"
        >
          <span>{notice}</span>
          <button type="button" aria-label="Cerrar" onClick={() => setNotice(null)} className="shrink-0 font-medium">
            ✕
          </button>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-danger-subtle px-5 py-3 text-sm text-[var(--red-600)]"
        >
          <span>{error}</span>
          <button type="button" aria-label="Cerrar" onClick={() => setError(null)} className="shrink-0 font-medium">
            ✕
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">Áreas del Banco de Talentos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Son las que elige quien deja sus datos en el portal público. Un área que ya se usó no se
            borra: se desactiva, así deja de ofrecerse pero los registros viejos la siguen mostrando.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-6 py-3">
          <Input
            aria-label="Nombre del área nueva"
            placeholder="Nueva área…"
            className="max-w-xs"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && nueva.trim().length >= 2 && !saving) {
                post({ action: 'create', name: nueva.trim() }, 'Área agregada.');
              }
            }}
          />
          <Button
            size="sm"
            loading={saving}
            disabled={nueva.trim().length < 2}
            onClick={() => post({ action: 'create', name: nueva.trim() }, 'Área agregada.')}
          >
            Agregar
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-transparent" />
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {areas.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
                <div>
                  <p
                    className={`font-medium ${a.active ? 'text-foreground' : 'text-muted-foreground line-through'}`}
                  >
                    {a.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.used === 0 ? 'Sin usar' : `Elegida por ${a.used} candidato${a.used === 1 ? '' : 's'}`}
                  </p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-secondary-foreground">
                  <Checkbox
                    aria-label={`Ofrecer ${a.name} en el formulario`}
                    checked={a.active}
                    disabled={saving}
                    onCheckedChange={(c) =>
                      post(
                        { action: 'toggle', id: a.id, active: c === true },
                        c === true ? 'Área activada.' : 'Área desactivada: deja de ofrecerse.',
                      )
                    }
                  />
                  Se ofrece
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
