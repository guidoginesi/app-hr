'use client';

import { useEffect, useState } from 'react';
import { Sheet, SheetTrigger, SheetContent } from '@pow/ui/components/ui/sheet';
import { Button, buttonVariants } from '@pow/ui/components/ui/button';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';
import type { LeaveType } from '@/types/time-off';
import { conUnidad } from '@/lib/leaveUnits';
import { duracionDeLicencia } from '@/lib/registroDeLicencia';

type Persona = { id: string; first_name: string; last_name: string };

const campo =
  'w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring';
const etiqueta = 'mb-1 block text-sm font-medium text-secondary-foreground';

/**
 * "Registrar licencia": RRHH carga una licencia en nombre de alguien, por
 * ejemplo un día que ya se tomó y no se pudo pedir desde el portal (el portal
 * no acepta fechas pasadas). Queda aprobada, descuenta del saldo y no manda
 * mails. Las reglas viven en /api/admin/time-off/requests/registrar.
 */
export function RegistrarLicencia({ onRegistrada }: { onRegistrada: () => void }) {
  const [open, setOpen] = useState(false);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [tipos, setTipos] = useState<LeaveType[]>([]);
  const [personaId, setPersonaId] = useState('');
  const [tipoId, setTipoId] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  // Se cargan al abrir el panel, una sola vez: la pantalla de solicitudes no
  // las necesita.
  useEffect(() => {
    if (!open || personas.length > 0) return;
    Promise.all([
      fetch('/api/admin/employees?status=active').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/admin/time-off/leave-types').then((r) => (r.ok ? r.json() : [])),
    ]).then(([emps, lts]) => {
      setPersonas(Array.isArray(emps) ? emps : []);
      setTipos((Array.isArray(lts) ? lts : []).filter((t: LeaveType) => t.is_active));
    });
  }, [open, personas.length]);

  const tipo = tipos.find((t) => t.id === tipoId);
  const unSoloDia = tipo?.code === 'birthday';
  const fin = unSoloDia ? desde : hasta;
  const duracion = tipo && desde && fin ? duracionDeLicencia(tipo.count_type, desde, fin) : 0;

  function reiniciar() {
    setPersonaId('');
    setTipoId('');
    setDesde('');
    setHasta('');
    setMotivo('');
    setError('');
  }

  async function registrar() {
    setError('');
    setEnviando(true);
    try {
      const res = await fetch('/api/admin/time-off/requests/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: personaId, leave_type_id: tipoId, start_date: desde, end_date: fin, motivo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'No se pudo registrar la licencia');
        return;
      }
      setOpen(false);
      reiniciar();
      onRegistrada();
    } catch {
      setError('No se pudo registrar la licencia');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reiniciar();
      }}
    >
      <SheetTrigger className={buttonVariants({ variant: 'outline' })}>Registrar licencia</SheetTrigger>
      <SheetContent
        title="Registrar licencia"
        description="Para una licencia que ya se tomó o que no se pudo pedir desde el portal."
        className="sm:max-w-xl"
      >
        {/* px-1: aire para que el ring de foco de los inputs no se corte contra el overflow del Sheet */}
        <div className="space-y-4 px-1">
          <div>
            <label className={etiqueta}>Persona</label>
            <SelectMenu
              value={personaId}
              onChange={setPersonaId}
              options={personas.map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}`.trim() }))}
              placeholder={personas.length ? 'Elegí a la persona' : 'Cargando…'}
              ariaLabel="Persona"
              className="w-full"
            />
          </div>

          <div>
            <label className={etiqueta}>Tipo de licencia</label>
            <SelectMenu
              value={tipoId}
              onChange={setTipoId}
              options={tipos.map((t) => ({ value: t.id, label: t.name }))}
              placeholder={tipos.length ? 'Elegí el tipo' : 'Cargando…'}
              ariaLabel="Tipo de licencia"
              className="w-full"
            />
            {tipo?.code === 'remote_work' && (
              <p className="mt-1.5 text-xs text-muted-foreground">Semanas completas: de un lunes a un domingo.</p>
            )}
          </div>

          <div className={unSoloDia ? '' : 'grid grid-cols-2 gap-4'}>
            <div>
              <label className={etiqueta} htmlFor="registrar-desde">
                {unSoloDia ? 'Día' : 'Desde'}
              </label>
              <input id="registrar-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={campo} />
            </div>
            {!unSoloDia && (
              <div>
                <label className={etiqueta} htmlFor="registrar-hasta">
                  Hasta
                </label>
                <input
                  id="registrar-hasta"
                  type="date"
                  value={hasta}
                  min={desde || undefined}
                  onChange={(e) => setHasta(e.target.value)}
                  className={campo}
                />
              </div>
            )}
          </div>
          {duracion > 0 && tipo && (
            <p className="text-sm text-secondary-foreground">
              Descuenta <span className="font-medium text-foreground">{conUnidad(tipo.count_type, duracion)}</span>
              {tipo.count_type === 'business_days' ? (duracion === 1 ? ' hábil' : ' hábiles') : ''} del saldo.
            </p>
          )}

          <div>
            <label className={etiqueta} htmlFor="registrar-motivo">
              Motivo
            </label>
            <textarea
              id="registrar-motivo"
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej.: se tomó el día y el portal no la dejó cargarlo por la superposición con trabajo remoto."
              className={campo}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Queda en la solicitud como &quot;Registrado por RRHH&quot;. La licencia nace aprobada y no le llega ningún mail a
              la persona.
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-danger/20 bg-danger-subtle px-4 py-3">
              <p className="text-sm text-[var(--red-600)]">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button
              onClick={registrar}
              loading={enviando}
              disabled={!personaId || !tipoId || !desde || !fin || duracion <= 0 || motivo.trim().length < 3}
            >
              Registrar licencia
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
