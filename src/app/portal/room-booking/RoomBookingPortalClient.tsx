'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Spinner } from '@/components/Spinner';
import { PageHeader } from '@pow/ui/components/ui/page-header';
import { Button, buttonVariants } from '@pow/ui/components/ui/button';
import { Dialog } from '@pow/ui/components/ui/dialog';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem } from '@pow/ui/components/ui/dropdown';
import { SelectMenu } from '@pow/ui/components/ui/select-menu';

type Room = {
  id: string;
  name: string;
  capacity: number;
  location: string | null;
  description: string | null;
  equipment: string | null;
  status: string;
  is_active: boolean;
};

type Booking = {
  id: string;
  room_id: string;
  employee_id: string;
  title: string;
  start_at: string;
  end_at: string;
  status: string;
  notes: string | null;
  employee_first_name?: string;
  employee_last_name?: string;
};

type Invitee = {
  id: string;
  name: string;
  email: string;
};

type Props = {
  rooms: Room[];
  employeeId: string;
  employeeName: string;
};

const TIME_SLOTS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

// Always work in Argentina timezone so the grid is consistent regardless of the browser's locale
const AR_TZ = 'America/Argentina/Buenos_Aires';

// Returns "YYYY-MM-DD" in Buenos Aires timezone
function toArgDateStr(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: AR_TZ }).format(date);
}

// Returns the hour (0-23) in Buenos Aires timezone
function toArgHour(date: Date): number {
  return parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: AR_TZ, hour: 'numeric', hour12: false }).format(date),
    10,
  );
}

// Returns a Date representing the start/end of a slot in Buenos Aires time
function argSlotBoundary(dateStr: string, hour: number): Date {
  return new Date(`${dateStr}T${String(hour).padStart(2, '0')}:00:00-03:00`);
}

const RECURRENCE_OPTIONS = [
  { value: '', label: 'Sin recurrencia' },
  { value: 'daily', label: 'Diaria' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quincenal' },
  { value: 'monthly', label: 'Mensual' },
];

// Color estable por persona para las reuniones de otros (categóricas del DS).
const EVENT_STYLES = [
  'border-l-cat-violet bg-cat-violet-subtle',
  'border-l-cat-cyan bg-cat-cyan-subtle',
  'border-l-cat-pink bg-cat-pink-subtle',
];
function eventStyle(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return EVENT_STYLES[h % EVENT_STYLES.length];
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getInitialWeek(): Date {
  const now = new Date();
  const weekStart = getWeekStart(now);

  // Check if the current week still has at least one future slot
  for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
    const day = addDays(weekStart, dayOffset);
    for (const time of TIME_SLOTS) {
      const hour = parseInt(time.split(':')[0]);
      const slotDate = new Date(day);
      slotDate.setHours(hour, 0, 0, 0);
      if (slotDate > now) {
        return weekStart;
      }
    }
  }

  // Current week is fully past — show next week
  return addDays(weekStart, 7);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

function formatWeekRange(weekStart: Date): string {
  const end = addDays(weekStart, 4);
  const startStr = weekStart.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  const endStr = end.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

function toInputDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function RoomBookingPortalClient({ rooms, employeeId, employeeName }: Props) {
  const [currentWeek, setCurrentWeek] = useState(() => getInitialWeek());
  const [selectedRoomId, setSelectedRoomId] = useState(rooms[0]?.id || '');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; hour: number } | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formStartTime, setFormStartTime] = useState('');
  const [formEndTime, setFormEndTime] = useState('');
  const [formRecurrence, setFormRecurrence] = useState('');
  const [formRecurrenceEndDate, setFormRecurrenceEndDate] = useState('');
  const [formInvitees, setFormInvitees] = useState<Invitee[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Invitee search state
  const [inviteeSearch, setInviteeSearch] = useState('');
  const [inviteeResults, setInviteeResults] = useState<Invitee[]>([]);
  const [showInviteeDropdown, setShowInviteeDropdown] = useState(false);
  const [searchingInvitees, setSearchingInvitees] = useState(false);
  const inviteeInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const weekDays = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => addDays(currentWeek, i));
  }, [currentWeek]);

  useEffect(() => {
    if (!selectedRoomId) return;
    const fetchBookings = async () => {
      setLoading(true);
      try {
        const from = currentWeek.toISOString().split('T')[0];
        const to = addDays(currentWeek, 5).toISOString().split('T')[0];
        const res = await fetch(`/api/portal/room-booking/bookings?date=${from}&to=${to}&room_id=${selectedRoomId}`);
        if (res.ok) {
          const data = await res.json();
          setBookings(data.bookings || []);
        }
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, [selectedRoomId, currentWeek]);

  // Debounced invitee search
  useEffect(() => {
    if (inviteeSearch.length < 2) {
      setInviteeResults([]);
      setShowInviteeDropdown(false);
      return;
    }
    setSearchingInvitees(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/portal/room-booking/employees?q=${encodeURIComponent(inviteeSearch)}`);
        if (res.ok) {
          const data = await res.json();
          const filtered = (data.employees || []).filter(
            (e: Invitee) => !formInvitees.find((i) => i.id === e.id)
          );
          setInviteeResults(filtered);
          setShowInviteeDropdown(filtered.length > 0);
        }
      } catch { /* ignore */ } finally {
        setSearchingInvitees(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [inviteeSearch, formInvitees]);

  // Close invitee dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inviteeInputRef.current &&
        !inviteeInputRef.current.contains(e.target as Node)
      ) {
        setShowInviteeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const getBookingForSlot = (date: Date, hour: number): Booking | undefined => {
    const slotDateStr = toArgDateStr(date);
    const slotStart = argSlotBoundary(slotDateStr, hour);
    const slotEnd = argSlotBoundary(slotDateStr, hour + 1);
    return bookings.find((b) => {
      if (b.status === 'cancelled') return false;
      const start = new Date(b.start_at);
      const end = new Date(b.end_at);
      return start < slotEnd && end > slotStart;
    });
  };

  const handleSlotClick = (date: Date, hour: number) => {
    const argDateStr = toArgDateStr(date);
    const slotEnd = argSlotBoundary(argDateStr, hour + 1);
    if (slotEnd <= new Date()) return;
    const existing = getBookingForSlot(date, hour);
    if (existing) return;

    const dateStr = argDateStr;
    setSelectedSlot({ date: dateStr, hour });
    setFormTitle('');
    setFormNotes('');
    setFormStartTime(`${hour.toString().padStart(2, '0')}:00`);
    setFormEndTime(`${(hour + 1).toString().padStart(2, '0')}:00`);
    setFormRecurrence('');
    setFormRecurrenceEndDate('');
    setFormInvitees([]);
    setInviteeSearch('');
    setInviteeResults([]);
    setError(null);
    setShowModal(true);
  };

  const handleAddInvitee = useCallback((invitee: Invitee) => {
    setFormInvitees((prev) => [...prev, invitee]);
    setInviteeSearch('');
    setInviteeResults([]);
    setShowInviteeDropdown(false);
    inviteeInputRef.current?.focus();
  }, []);

  const handleRemoveInvitee = useCallback((id: string) => {
    setFormInvitees((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const handleSubmit = async () => {
    if (!selectedSlot) return;

    // Inline validation with clear error messages
    if (!formTitle.trim()) {
      setError('Por favor completá el propósito de la reunión.');
      return;
    }
    if (formRecurrence && !formRecurrenceEndDate) {
      setError('Por favor indicá la fecha de finalización de la recurrencia.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const start_at = `${selectedSlot.date}T${formStartTime}:00-03:00`;
      const end_at = `${selectedSlot.date}T${formEndTime}:00-03:00`;

      const body: Record<string, any> = {
        room_id: selectedRoomId,
        title: formTitle.trim(),
        start_at,
        end_at,
        notes: formNotes || undefined,
      };

      if (formRecurrence) {
        body.recurrence_type = formRecurrence;
        body.recurrence_end_date = `${formRecurrenceEndDate}T23:59:59`;
      }

      if (formInvitees.length > 0) {
        body.invitees = formInvitees.map((i) => i.id);
      }

      const res = await fetch('/api/portal/room-booking/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Error al reservar');
        return;
      }

      setShowModal(false);
      const from = currentWeek.toISOString().split('T')[0];
      const to = addDays(currentWeek, 5).toISOString().split('T')[0];
      const refresh = await fetch(`/api/portal/room-booking/bookings?date=${from}&to=${to}&room_id=${selectedRoomId}`);
      if (refresh.ok) {
        const data = await refresh.json();
        setBookings(data.bookings || []);
      }
    } catch {
      setError('Error de red');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    try {
      const res = await fetch(`/api/portal/room-booking/bookings/${bookingId}`, { method: 'DELETE' });
      if (res.ok) {
        setBookings((prev) => prev.map((b) => b.id === bookingId ? { ...b, status: 'cancelled' } : b));
      }
    } catch { /* ignore */ }
  };

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reserva de Salas"
        description="Consultá la disponibilidad y reservá una sala"
        actions={
          <Link href="/portal/room-booking/my-bookings" className={buttonVariants({ variant: 'outline' })}>
            Mis reservas
            <svg className="ml-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        }
      />

      {/* Room selector + week nav */}
      <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-secondary-foreground">Sala</label>
            <Dropdown>
              <DropdownTrigger className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring">
                {selectedRoom
                  ? `${selectedRoom.name}${selectedRoom.location ? ` – ${selectedRoom.location}` : ''} (${selectedRoom.capacity} pers.)`
                  : 'Elegí una sala'}
                <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </DropdownTrigger>
              <DropdownContent align="start" className="min-w-64">
                {rooms.map((r) => (
                  <DropdownItem key={r.id} onSelect={() => setSelectedRoomId(r.id)}>
                    <span className="flex-1">
                      {r.name}{r.location ? ` – ${r.location}` : ''} ({r.capacity} pers.)
                    </span>
                    {selectedRoomId === r.id && (
                      <svg className="h-4 w-4 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </DropdownItem>
                ))}
              </DropdownContent>
            </Dropdown>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setCurrentWeek(addDays(currentWeek, -7))} className="rounded-lg border border-[var(--border)] p-2 hover:bg-muted">
              <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-sm font-medium text-secondary-foreground">Semana del {formatWeekRange(currentWeek)}</span>
            <button type="button" onClick={() => setCurrentWeek(addDays(currentWeek, 7))} className="rounded-lg border border-[var(--border)] p-2 hover:bg-muted">
              <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>

        {/* Room info */}
        {selectedRoom && (
          <div className="flex items-center gap-6 border-b border-[var(--border)] px-6 py-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              {selectedRoom.capacity} personas
            </span>
            {selectedRoom.equipment && (
              <span className="flex items-center gap-1.5">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                {selectedRoom.equipment}
              </span>
            )}
          </div>
        )}

        {/* Availability grid */}
        <div className="overflow-x-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="h-8 w-8 text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-6 gap-px overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--border)]" style={{ minWidth: 700 }}>
              {/* Header row */}
              <div className="bg-secondary p-3" />
              {weekDays.map((day, i) => {
                const isToday = toArgDateStr(day) === toArgDateStr(new Date());
                return (
                  <div key={i} className="bg-secondary p-3 text-center">
                    <div className={`text-xs font-semibold uppercase tracking-wide ${isToday ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {DAY_LABELS[i]}{isToday ? ' · hoy' : ''}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{formatDateShort(day)}</div>
                  </div>
                );
              })}

              {/* Time slots */}
              {TIME_SLOTS.map((time) => {
                const hour = parseInt(time.split(':')[0]);
                return [
                  <div key={`t-${time}`} className="bg-secondary p-3 text-center text-xs font-medium text-muted-foreground">{time}</div>,
                  ...weekDays.map((day, di) => {
                    const booking = getBookingForSlot(day, hour);
                    const argDateStr = toArgDateStr(day);
                    const slotEnd = argSlotBoundary(argDateStr, hour + 1);
                    const isPast = slotEnd <= new Date();
                    const isMine = booking?.employee_id === employeeId;
                    const isClickable = !booking && !isPast;

                    return (
                      <div
                        key={`s-${time}-${di}`}
                        onClick={() => isClickable && handleSlotClick(day, hour)}
                        className={`group relative min-h-[56px] p-1 transition-colors ${
                          isPast && !booking ? 'cursor-not-allowed bg-muted/50' : 'bg-white'
                        } ${isClickable ? 'cursor-pointer hover:bg-muted' : ''}`}
                      >
                        {booking ? (
                          <div className={`relative flex h-full flex-col justify-center rounded-md border-l-2 px-2 py-1 text-left ${isMine ? 'border-l-brand bg-accent' : `${eventStyle(booking.employee_id)}`}`}>
                            <div className={`truncate text-[11px] font-medium leading-tight ${isMine ? 'text-accent-foreground' : 'text-foreground'}`}>
                              {isMine ? 'Vos' : `${booking.employee_first_name ?? ''} ${booking.employee_last_name?.charAt(0) ?? ''}.`}
                            </div>
                            {booking.title && (
                              <div className={`truncate text-[10px] leading-tight ${isMine ? 'text-accent-foreground/80' : 'text-muted-foreground'}`}>
                                {booking.title}
                              </div>
                            )}
                            {isMine && !isPast && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleCancelBooking(booking.id); }}
                                className="absolute right-1 top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-accent-foreground/10 text-[9px] text-accent-foreground hover:bg-accent-foreground/20 group-hover:flex"
                                title="Cancelar"
                                aria-label="Cancelar reserva"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ) : isClickable ? (
                          <span className="hidden h-full items-center justify-center rounded-md border border-dashed border-[var(--border)] text-[11px] font-medium text-muted-foreground group-hover:flex">
                            + Reservar
                          </span>
                        ) : null}
                      </div>
                    );
                  }),
                ];
              })}
            </div>
          )}

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm border border-[var(--border)] bg-white" /> Disponible</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm border border-brand bg-accent" /> Tu reserva</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm border border-cat-violet bg-cat-violet-subtle" /> Ocupada (color por persona)</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm border border-[var(--border)] bg-muted" /> Pasado</span>
          </div>
        </div>
      </div>

      {/* Reservation modal */}
      <Dialog
        open={showModal && !!selectedSlot}
        onClose={() => setShowModal(false)}
        title={`Reservar ${selectedRoom?.name ?? ''}`}
        description={
          selectedSlot
            ? new Date(selectedSlot.date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
            : undefined
        }
        size="lg"
      >
        {selectedSlot && (
          <>
            {error && (
              <div className="mb-4 rounded-lg bg-danger-subtle px-4 py-3 text-xs font-medium text-[var(--red-600)]">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {/* Times */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hora inicio *</label>
                  <input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hora fin *</label>
                  <input
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                  />
                </div>
              </div>

              {/* Title / Propósito */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Propósito de la reunión *</label>
                <textarea
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  rows={2}
                  placeholder="Describe brevemente el propósito de la reserva..."
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                />
              </div>

              {/* Recurrence */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recurrencia</label>
                <SelectMenu
                  value={formRecurrence}
                  onChange={(v) => {
                    setFormRecurrence(v);
                    if (!v) setFormRecurrenceEndDate('');
                  }}
                  ariaLabel="Recurrencia"
                  className="w-full"
                  options={RECURRENCE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
                />
              </div>

              {/* Recurrence end date */}
              {formRecurrence && (
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Finalizar recurrencia *</label>
                  <input
                    type="date"
                    value={formRecurrenceEndDate}
                    onChange={(e) => setFormRecurrenceEndDate(e.target.value)}
                    min={selectedSlot?.date}
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                  />
                  {formRecurrenceEndDate && selectedSlot?.date && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Se crearán reservas hasta el {new Date(formRecurrenceEndDate + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  )}
                </div>
              )}

              {/* Invitees */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Invitar usuarios</label>

                {/* Selected invitees chips */}
                {formInvitees.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {formInvitees.map((inv) => (
                      <span
                        key={inv.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground"
                      >
                        {inv.name}
                        <button
                          type="button"
                          onClick={() => handleRemoveInvitee(inv.id)}
                          className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-secondary text-foreground hover:bg-[var(--primary-hover)]"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Search input */}
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    ref={inviteeInputRef}
                    type="text"
                    value={inviteeSearch}
                    onChange={(e) => setInviteeSearch(e.target.value)}
                    onFocus={() => inviteeResults.length > 0 && setShowInviteeDropdown(true)}
                    placeholder="Buscar usuarios por nombre o email..."
                    className="w-full rounded-lg border border-[var(--border)] py-2 pl-9 pr-3 text-sm focus:border-[var(--border)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                  />
                  {searchingInvitees && (
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                      <Spinner className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}

                  {/* Results dropdown */}
                  {showInviteeDropdown && inviteeResults.length > 0 && (
                    <div
                      ref={dropdownRef}
                      className="absolute z-10 mt-1 w-full rounded-lg border border-[var(--border)] bg-white shadow-lg"
                    >
                      {inviteeResults.map((emp) => (
                        <button
                          key={emp.id}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); handleAddInvitee(emp); }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted first:rounded-t-lg last:rounded-b-lg"
                        >
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground">
                            {emp.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{emp.name}</p>
                            <p className="text-xs text-muted-foreground">{emp.email}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  💡 Usa ↑↓ para navegar, Enter para seleccionar, o haz clic directamente
                </p>
              </div>

            </div>

            {/* Footer */}
            <div className="mt-6 flex items-center justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSubmit} loading={submitting}>
                Confirmar Reserva
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
