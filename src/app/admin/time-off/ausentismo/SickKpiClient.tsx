'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Stat } from '@pow/ui/components/ui/stat';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';
import { Spinner } from '@/components/Spinner';
import { Activity, CalendarDays, Repeat, Clock, Users } from 'lucide-react';
import type { SickKpiResult } from '@/lib/sickKpi';

type KpiResponse = SickKpiResult & {
  year: number;
  filters: { area: string; modalidad: string };
  areas: string[];
  periodEnd: string;
};

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MODALIDAD_LABEL: Record<string, string> = { dependency: 'Relación de dependencia', monotributista: 'Monotributo' };

function antiguedad(meses: number | null): string {
  if (meses == null) return '—';
  if (meses < 12) return `${meses} m`;
  const años = Math.floor(meses / 12);
  const resto = meses % 12;
  return resto ? `${años} a ${resto} m` : `${años} a`;
}

export function SickKpiClient() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const [year, setYear] = useState(currentYear);
  const [area, setArea] = useState('');
  const [modalidad, setModalidad] = useState('');
  const [data, setData] = useState<KpiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ year: String(year) });
      if (area) params.set('area', area);
      if (modalidad) params.set('modalidad', modalidad);
      const res = await fetch(`/api/admin/time-off/sick-kpi?${params}`);
      const json = await res.json();
      if (res.ok) setData(json);
      else setError(json.error ?? 'No se pudo cargar el reporte.');
    } catch {
      setError('No se pudo cargar el reporte.');
    } finally {
      setLoading(false);
    }
  }, [year, area, modalidad]);

  useEffect(() => {
    load();
  }, [load]);

  const maxMes = useMemo(() => Math.max(1, ...(data?.porMes ?? []).map((m) => m.dias)), [data]);
  const years = Array.from({ length: 4 }, (_, i) => currentYear - i);
  const vacio = data && data.totalEventos === 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Ausentismo por enfermedad</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Indicadores de licencias por enfermedad. El dato individual es sólo para People; al directorio se reporta
          agregado.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Año</label>
          <SelectMenu
            ariaLabel="Año"
            className="w-32"
            value={String(year)}
            onChange={(v) => setYear(Number(v))}
            options={years.map((y) => ({ value: String(y), label: String(y) }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Área</label>
          <SelectMenu
            ariaLabel="Área"
            className="w-56"
            value={area}
            onChange={setArea}
            options={[{ value: '', label: 'Todas las áreas' }, ...(data?.areas ?? []).map((a) => ({ value: a, label: a }))]}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Modalidad</label>
          <SelectMenu
            ariaLabel="Modalidad"
            className="w-56"
            value={modalidad}
            onChange={setModalidad}
            options={[
              { value: '', label: 'Todas' },
              { value: 'dependency', label: 'Relación de dependencia' },
              { value: 'monotributista', label: 'Monotributo' },
            ]}
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-[var(--border)] bg-danger-subtle px-5 py-3 text-sm text-[var(--red-600)]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner className="h-8 w-8 text-muted-foreground" />
        </div>
      ) : !data ? null : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Stat icon={<Activity className="h-6 w-6" />} label="Tasa de ausentismo" value={`${data.tasaAusentismo}%`} sub="Sobre días laborables" />
            <Stat icon={<CalendarDays className="h-6 w-6" />} label="Días de enfermedad" value={String(data.totalDias)} sub="Días hábiles" />
            <Stat icon={<Repeat className="h-6 w-6" />} label="Eventos" value={String(data.totalEventos)} sub="Licencias registradas" />
            <Stat icon={<Clock className="h-6 w-6" />} label="Duración media" value={String(data.duracionMedia)} sub="Días por evento" />
            <Stat icon={<Users className="h-6 w-6" />} label="Personas con evento" value={`${data.pctPersonasConEvento}%`} sub={`${data.personasConEvento} de ${data.headcount}`} />
          </div>

          <p className="text-xs text-muted-foreground">
            Tasa = días de enfermedad / (días hábiles del período × dotación). Período hasta {data.periodEnd}. Un feriado
            cuenta como hábil (todavía no hay calendario de feriados). La serie arranca desde que se habilitó el módulo:
            no hay histórico previo.
          </p>

          {vacio ? (
            <div className="rounded-xl border border-[var(--border)] bg-muted px-6 py-12 text-center">
              <p className="text-sm font-medium text-foreground">No hay licencias por enfermedad en este período</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Cuando el equipo registre licencias por enfermedad, acá vas a ver los indicadores.
              </p>
            </div>
          ) : (
            <>
              {/* Estacionalidad */}
              <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-foreground">Estacionalidad</p>
                <p className="mb-4 text-xs text-muted-foreground">Días de enfermedad por mes</p>
                <div className="flex items-end gap-2" style={{ height: 140 }}>
                  {data.porMes.map((m) => (
                    <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-[10px] nums-tabular text-muted-foreground">{m.dias || ''}</span>
                      <div
                        className="w-full rounded-t bg-[var(--brand)]/70"
                        style={{ height: `${(m.dias / maxMes) * 100}%`, minHeight: m.dias ? 4 : 0 }}
                        title={`${MESES[m.month - 1]}: ${m.dias} día(s), ${m.eventos} evento(s)`}
                      />
                      <span className="text-[10px] text-muted-foreground">{MESES[m.month - 1]}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Por área */}
                <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
                  <div className="border-b border-[var(--border)] bg-muted px-5 py-3">
                    <p className="text-sm font-semibold text-foreground">Por área</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-5 py-2 font-medium">Área</th>
                        <th className="px-5 py-2 text-right font-medium">Personas</th>
                        <th className="px-5 py-2 text-right font-medium">Eventos</th>
                        <th className="px-5 py-2 text-right font-medium">Días</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {data.porArea.map((a) => (
                        <tr key={a.area}>
                          <td className="px-5 py-2 text-foreground">{a.area}</td>
                          <td className="px-5 py-2 text-right nums-tabular text-muted-foreground">{a.personas}</td>
                          <td className="px-5 py-2 text-right nums-tabular text-muted-foreground">{a.eventos}</td>
                          <td className="px-5 py-2 text-right nums-tabular font-medium text-foreground">{a.dias}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Ranking individual */}
                <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
                  <div className="border-b border-[var(--border)] bg-muted px-5 py-3">
                    <p className="text-sm font-semibold text-foreground">Quiénes acumulan más</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-5 py-2 font-medium">Persona</th>
                        <th className="px-5 py-2 font-medium">Área</th>
                        <th className="px-5 py-2 text-right font-medium">Ev.</th>
                        <th className="px-5 py-2 text-right font-medium">Días</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {data.ranking.map((r) => (
                        <tr key={r.employee_id}>
                          <td className="px-5 py-2">
                            <span className="text-foreground">{r.name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {r.modalidad ? MODALIDAD_LABEL[r.modalidad] : '—'} · {antiguedad(r.antiguedadMeses)}
                            </span>
                          </td>
                          <td className="px-5 py-2 text-muted-foreground">{r.area}</td>
                          <td className="px-5 py-2 text-right nums-tabular text-muted-foreground">{r.eventos}</td>
                          <td className="px-5 py-2 text-right nums-tabular font-medium text-foreground">{r.dias}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
