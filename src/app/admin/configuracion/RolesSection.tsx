'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@pow/ui/components/ui/card';
import { Button } from '@pow/ui/components/ui/button';
import { Checkbox } from '@pow/ui/components/ui/checkbox';
import { Dialog } from '@pow/ui/components/ui/dialog';
import { Input } from '@pow/ui/components/ui/input';
import {
  DERIVED_ROLE_INFO,
  ELEVATED_ROLES,
  MANAGEABLE_ROLES,
  ROLE_CACHE_MINUTES,
  ROLE_INFO,
  type ManageableRole,
} from '@/lib/roles';

type UserRow = {
  user_id: string;
  email: string | null;
  employee_name: string | null;
  job_title: string | null;
  department: string | null;
  is_employee: boolean;
  is_leader: boolean;
  roles: string[];
  legacy_admin: boolean;
  granted_by_email: Record<string, string | null>;
};

type Pending = { user: UserRow; role: ManageableRole; action: 'grant' | 'revoke' };

const toneClass: Record<'danger' | 'warning' | 'neutral', string> = {
  danger: 'bg-danger-subtle text-[var(--red-600)]',
  warning: 'bg-warning-subtle text-[var(--amber-600)]',
  neutral: 'bg-secondary text-secondary-foreground',
};

export function RolesSection() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState<Pending | null>(null);
  // El error del diálogo va aparte: el banner de la página queda detrás del
  // overlay, así que un revoke fallido no se veía por ningún lado.
  const [dialogError, setDialogError] = useState<string | null>(null);
  // Clave `${user_id}:${role}` de la celda en vuelo, en vez de un flag global
  // que deshabilitaba los checkboxes de todas las filas.
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/roles');
      const data = await res.json();
      if (res.ok) setRows(data.rows ?? []);
      else setError(data.error ?? 'No se pudieron cargar los accesos.');
    } catch {
      setError('No se pudieron cargar los accesos.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const send = async (action: 'grant' | 'revoke', user: UserRow, role: ManageableRole) => {
    setPending(`${user.user_id}:${role}`);
    setError(null);
    setDialogError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, user_id: user.user_id, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error ?? 'No se pudo aplicar el cambio.';
        // Si el diálogo está abierto, el error va adentro; si no, al banner.
        if (confirm) setDialogError(msg);
        else setError(msg);
        return;
      }
      // No se reemplaza la lista entera: el server la reordena y la fila que
      // acabás de tocar salta de lugar, dejando bajo el cursor el checkbox de
      // otra persona. Se aplica el cambio sólo en la fila afectada.
      if (data.rows) {
        const fresh = (data.rows as UserRow[]).find((r) => r.user_id === user.user_id);
        setRows((prev) => prev.map((r) => (fresh && r.user_id === fresh.user_id ? fresh : r)));
      }
      if (data.warning) setError(data.warning);
      const quien = user.employee_name ?? user.email ?? 'la cuenta';
      setNotice(
        `${ROLE_INFO[role].label} ${action === 'grant' ? 'otorgado a' : 'quitado a'} ${quien}. ` +
          `Si tiene la sesión abierta, puede tardar hasta ${ROLE_CACHE_MINUTES} minutos en aplicarse.`,
      );
      setConfirm(null);
    } catch {
      const msg = 'No se pudo aplicar el cambio.';
      if (confirm) setDialogError(msg);
      else setError(msg);
    } finally {
      setPending(null);
    }
  };

  const toggle = (user: UserRow, role: ManageableRole, next: boolean) => {
    const action = next ? 'grant' : 'revoke';
    // Se confirma en las DOS direcciones para los roles elevados: dar acceso a
    // todos los sueldos no puede ser más fácil que quitarlo. El envío masivo va
    // directo porque es reversible y sin consecuencias.
    if ((ELEVATED_ROLES as string[]).includes(role)) {
      setDialogError(null);
      return setConfirm({ user, role, action });
    }
    return send(action, user, role);
  };

  const q = search.trim().toLowerCase();
  const visible = q
    ? rows.filter((r) =>
        [r.employee_name, r.email, r.job_title, r.department].some((v) => v?.toLowerCase().includes(q)),
      )
    : rows;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles y accesos</CardTitle>
        <CardDescription>
          Quién entra al panel y con qué alcance. Los roles se cachean, así que un cambio puede tardar hasta{' '}
          {ROLE_CACHE_MINUTES} minutos en aplicarse si la persona tiene la sesión abierta.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Qué habilita cada rol: es lo que necesita leer quien está por otorgarlo. */}
        <div className="space-y-2 rounded-xl border border-[var(--border)] bg-muted p-4">
          {MANAGEABLE_ROLES.map((role) => (
            <div key={role} className="flex flex-wrap items-baseline gap-2 text-sm">
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClass[ROLE_INFO[role].tone]}`}>
                {ROLE_INFO[role].label}
              </span>
              <span className="text-secondary-foreground">{ROLE_INFO[role].grants}</span>
              {ROLE_INFO[role].limits && (
                <span className="text-muted-foreground">{ROLE_INFO[role].limits}</span>
              )}
            </div>
          ))}
          <p className="pt-1 text-xs text-muted-foreground">
            <b>{DERIVED_ROLE_INFO.employee.label}</b> y <b>{DERIVED_ROLE_INFO.leader.label}</b> no se otorgan acá:
            salen de los datos. {DERIVED_ROLE_INFO.employee.source} {DERIVED_ROLE_INFO.leader.source}
          </p>
        </div>

        {error && (
          <div role="alert" className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-danger-subtle px-5 py-3 text-sm text-[var(--red-600)]">
            <span>{error}</span>
            <button type="button" aria-label="Cerrar el aviso" className="shrink-0 font-medium" onClick={() => setError(null)}>
              ✕
            </button>
          </div>
        )}
        {notice && (
          <div role="status" aria-live="polite" className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-success-subtle px-5 py-3 text-sm text-[var(--green-700)]">
            <span>{notice}</span>
            <button type="button" aria-label="Cerrar el aviso" className="shrink-0 font-medium" onClick={() => setNotice(null)}>
              ✕
            </button>
          </div>
        )}

        <Input
          aria-label="Buscar una persona"
          placeholder="Buscar por nombre, email, puesto o área…"
          className="max-w-md"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--border)]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-muted text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-6 py-3">Persona</th>
                    <th scope="col" className="px-6 py-3">Tiene por sus datos</th>
                    {MANAGEABLE_ROLES.map((role) => (
                      <th key={role} scope="col" className="px-6 py-3 text-center">{ROLE_INFO[role].label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {visible.map((u) => (
                    <tr key={u.user_id} className="transition-colors hover:bg-muted">
                      <td className="px-6 py-3">
                        <p className="font-medium text-foreground">
                          {u.employee_name ?? <span className="text-muted-foreground">Cuenta sin empleado</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {u.email}
                          {u.job_title ? ` · ${u.job_title}` : ''}
                          {u.department ? ` · ${u.department}` : ''}
                        </p>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.is_employee && (
                            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                              {DERIVED_ROLE_INFO.employee.label}
                            </span>
                          )}
                          {u.is_leader && (
                            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                              {DERIVED_ROLE_INFO.leader.label}
                            </span>
                          )}
                          {u.legacy_admin && (
                            <span
                              title="Es admin por la tabla legada `admins`. Al quitarle el rol se borra de las dos fuentes."
                              className="rounded-full bg-warning-subtle px-2 py-0.5 text-xs text-[var(--amber-600)]"
                            >
                              Admin heredado
                            </span>
                          )}
                          {!u.is_employee && !u.is_leader && !u.legacy_admin && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                      {MANAGEABLE_ROLES.map((role) => {
                        const has = u.roles.includes(role) || (role === 'admin' && u.legacy_admin);
                        const autor = u.granted_by_email[role];
                        return (
                          <td key={role} className="px-6 py-3 text-center">
                            <Checkbox
                              aria-label={`${ROLE_INFO[role].label} para ${u.employee_name ?? u.email ?? 'la cuenta'}`}
                              checked={has}
                              disabled={pending !== null}
                              onCheckedChange={(c) => toggle(u, role, c === true)}
                            />
                            {has && autor && (
                              <p className="mt-1 text-[10px] text-muted-foreground" title={`Otorgado por ${autor}`}>
                                por {autor.split('@')[0]}
                              </p>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {visible.length === 0 && (
                    <tr>
                      <td colSpan={2 + MANAGEABLE_ROLES.length} className="py-12 text-center text-sm text-muted-foreground">
                        {/* Sin esto, una carga fallida afirmaba "no hay cuentas
                            con acceso", que en una pantalla de permisos es una
                            mentira peligrosa. */}
                        {error ? (
                          <span className="inline-flex items-center gap-3">
                            No se pudieron cargar los accesos.
                            <Button size="sm" variant="outline" onClick={load}>Reintentar</Button>
                          </span>
                        ) : q ? (
                          'Ninguna cuenta coincide con la búsqueda.'
                        ) : (
                          'No hay cuentas con acceso.'
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm ? `${confirm.action === 'grant' ? 'Dar' : 'Quitar'} ${ROLE_INFO[confirm.role].label}` : ''}
        size="md"
      >
        {confirm && (
          <div className="space-y-4">
            <p className="text-sm text-secondary-foreground">
              <b>{confirm.user.employee_name ?? confirm.user.email}</b>{' '}
              {confirm.action === 'grant' ? 'va a poder' : 'va a perder'}: {ROLE_INFO[confirm.role].grants}
            </p>
            {confirm.action === 'revoke' && confirm.user.legacy_admin && (
              <p className="text-sm text-secondary-foreground">
                Es <b>admin heredado</b>: se va a borrar también de la tabla <code>admins</code>, que es la que leen el
                middleware, 12 rutas del panel y las políticas de liquidaciones.
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Si tiene la sesión abierta, el cambio puede tardar hasta <b>{ROLE_CACHE_MINUTES} minutos</b> en aplicarse.
            </p>
            {dialogError && (
              <p role="alert" className="rounded-lg bg-danger-subtle px-4 py-3 text-sm text-[var(--red-600)]">
                {dialogError}
              </p>
            )}
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirm(null)}>Cancelar</Button>
              <Button
                variant={confirm.action === 'grant' ? 'primary' : 'destructive'}
                loading={pending !== null}
                onClick={() => send(confirm.action, confirm.user, confirm.role)}
              >
                {confirm.action === 'grant' ? `Dar ${ROLE_INFO[confirm.role].label}` : 'Quitar el rol'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </Card>
  );
}
