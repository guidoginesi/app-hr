import type { ReactNode } from 'react';
import type { LeaveRequestWithDetails, LeaveRequestStatus } from '@/types/time-off';
import { LEAVE_STATUS_LABELS, LEAVE_STATUS_COLORS } from '@/types/time-off';
import { formatDateLocal } from '@/lib/dateUtils';

// El blob de "Trabajo Remoto" trae Destino/Domicilio/Contacto/Notas en una sola
// cadena. En la lista solo mostramos el Destino como chip; el resto va al abrir.
function parseLeaveNotes(notes: string | null): { destino: string | null; note: string | null } {
  if (!notes) return { destino: null, note: null };
  const trimmed = notes.trim();
  if (/INFORMACI[ÓO]N DE TRABAJO REMOTO/i.test(trimmed)) {
    const m = trimmed.match(/Destino:\s*(.*?)(?:\s+Domicilio:|\s+Contacto|\n|$)/i);
    return { destino: m?.[1]?.trim() || null, note: null };
  }
  return { destino: null, note: trimmed };
}

function formatRange(start: string, end: string): string {
  const a = formatDateLocal(start, 'es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
  if (start === end) {
    return formatDateLocal(start, 'es-AR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
  const b = formatDateLocal(end, 'es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${a} – ${b}`;
}

function Initials({ name }: { name: string | null }) {
  const initials = (name ?? '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
      {initials}
    </div>
  );
}

function Tick({ state }: { state: 'ok' | 'no' | 'wait' }) {
  if (state === 'ok') {
    return (
      <svg className="h-3.5 w-3.5 text-[var(--green-700)]" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    );
  }
  if (state === 'no') {
    return (
      <svg className="h-3.5 w-3.5 text-[var(--red-600)]" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
    );
  }
  return <span className="inline-block h-2 w-2 rounded-full bg-[var(--muted-foreground)]/40" aria-hidden="true" />;
}

function ApprovalTrail({ request, leaderLabel }: { request: LeaveRequestWithDetails; leaderLabel: string }) {
  const status = request.status as LeaveRequestStatus;
  const leaderState: 'ok' | 'no' | 'wait' =
    request.leader_approved_at ? 'ok' : status === 'rejected_leader' ? 'no' : 'wait';
  const hrState: 'ok' | 'no' | 'wait' =
    status === 'approved' ? 'ok' : status === 'rejected_hr' ? 'no' : 'wait';

  return (
    <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        <Tick state={leaderState} />
        {leaderLabel}
      </span>
      <span className="flex items-center gap-1">
        <Tick state={hrState} />
        HR
      </span>
    </div>
  );
}

export function LeaveRequestRow({
  request,
  showEmployee = false,
  leaderLabel = 'Líder',
  showTrail = true,
  actions,
}: {
  request: LeaveRequestWithDetails;
  /** Muestra avatar + nombre del empleado (vista de equipo). Si no, encabeza con el tipo. */
  showEmployee?: boolean;
  /** Etiqueta del primer aprobador en el trail: "Tú" en equipo, "Líder" en mis solicitudes. */
  leaderLabel?: string;
  /** Oculta el trail de aprobación (p.ej. en filas accionables que ya muestran botones). */
  showTrail?: boolean;
  actions?: ReactNode;
}) {
  const status = request.status as LeaveRequestStatus;
  const isSick = request.leave_type_code === 'sick';
  const colors = LEAVE_STATUS_COLORS[status] || LEAVE_STATUS_COLORS.pending;
  // La licencia por enfermedad no se aprueba: cuando está 'approved' quiere decir
  // "vigente". Mostrar "Aprobada" sugeriría que alguien la aprobó, cosa que no pasa.
  const label = isSick && status === 'approved' ? 'Registrada' : LEAVE_STATUS_LABELS[status] || status;
  const unit =
    request.count_type === 'weeks'
      ? `semana${request.days_requested > 1 ? 's' : ''}`
      : `día${request.days_requested > 1 ? 's' : ''}`;
  const { destino, note } = parseLeaveNotes(request.notes);
  const rejection =
    request.hr_rejection_reason || request.leader_rejection_reason || request.rejection_reason;

  return (
    <li className="flex items-center gap-3 px-4 py-3 sm:px-6">
      {showEmployee &&
        (request.employee_photo_url ? (
          <img
            src={request.employee_photo_url}
            alt={request.employee_name}
            className="h-9 w-9 shrink-0 rounded-full object-cover"
          />
        ) : (
          <Initials name={request.employee_name} />
        ))}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-medium text-foreground">
            {showEmployee ? request.employee_name : request.leave_type_name}
          </span>
          <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}>
            {label}
          </span>
          {destino && (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {destino}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[13px] text-muted-foreground" title={rejection || undefined}>
          {showEmployee && <>{request.leave_type_name} · </>}
          {request.days_requested} {unit} · {formatRange(request.start_date, request.end_date)}
          {note && <> · “{note}”</>}
          {rejection && <span className="text-[var(--red-600)]"> · Motivo: {rejection}</span>}
        </p>
      </div>

      {showTrail && !actions && !isSick && <ApprovalTrail request={request} leaderLabel={leaderLabel} />}
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </li>
  );
}
