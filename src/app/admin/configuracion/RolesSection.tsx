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
  granted_by_email: Record<string, string | null>;
};

type Pending = { user: UserRow; role: ManageableRole };

const toneClass: Record<'danger' | 'warning' | 'neutral', string> = {
  danger: 'bg-danger-subtle text-[var(--red-600)]',
  warning: 'bg-warning-subtle text-[var(--amber-600)]',
  neutral: 'bg-secondary text-secondary-foreground',
};

export function RolesSection() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState<Pending | null>(null);

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
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, user_id: user.user_id, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo aplicar el cambio.');
        return;
      }
      setRows(data.rows ?? []);
      const quien = user.employee_name ?? user.email ?? 'la cuenta';
      setNotice(
        `${ROLE_INFO[role].label} ${action === 'grant' ? 'otorgado a' : 'quitado a'} ${quien}. ` +
          `Si tiene la sesión abierta, puede tardar hasta ${ROLE_CACHE_MINUTES} minutos en aplicarse.`,
      );
      setConfirm(null);
    } catch {
      setError('No se pudo aplicar el cambio.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = (user: UserRow, role: ManageableRole, next: boolean) => {
    if (next) return send('grant', user, role);
    // Quitar acceso a sueldos o a adelantos se confirma; sacar el envío masivo
    // es reversible sin consecuencias, así que va directo.
    if ((ELEVATED_ROLES as string[]).includes(role)) return setConfirm({ user, role });
    return send('revoke', user, role);
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
          <div className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-danger-subtle px-5 py-3 text-sm text-[var(--red-600)]">
            <span>{error}</span>
            <button type="button" aria-label="Cerrar el aviso" className="shrink-0 font-medium" onClick={() => setError(null)}>
              ✕
            </button>
          </div>
        )}
        {notice && (
          <div className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-success-subtle px-5 py-3 text-sm text-[var(--green-700)]">
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
                          {!u.is_employee && !u.is_leader && <span className="text-xs text-muted-foreground">—</span>}
                        </div>
                      </td>
                      {MANAGEABLE_ROLES.map((role) => {
                        const has = u.roles.includes(role);
                        const autor = u.granted_by_email[role];
                        return (
                          <td key={role} className="px-6 py-3 text-center">
                            <Checkbox
                              aria-label={`${ROLE_INFO[role].label} para ${u.employee_name ?? u.email ?? 'la cuenta'}`}
                              checked={has}
                              disabled={saving}
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
                        {q ? 'Ninguna cuenta coincide con la búsqueda.' : 'No hay cuentas con acceso.'}
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
        title={confirm ? `Quitar ${ROLE_INFO[confirm.role].label}` : ''}
        size="md"
      >
        {confirm && (
          <div className="space-y-4">
            <p className="text-sm text-secondary-foreground">
              <b>{confirm.user.employee_name ?? confirm.user.email}</b> va a perder: {ROLE_INFO[confirm.role].grants}
            </p>
            <p className="text-sm text-muted-foreground">
              Si tiene la sesión abierta, el cambio puede tardar hasta <b>{ROLE_CACHE_MINUTES} minutos</b> en aplicarse.
              Para cortar el acceso en el momento hay que además cerrarle la sesión desde Supabase.
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirm(null)}>Cancelar</Button>
              <Button
                variant="destructive"
                loading={saving}
                onClick={() => send('revoke', confirm.user, confirm.role)}
              >
                Quitar el rol
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </Card>
  );
}
