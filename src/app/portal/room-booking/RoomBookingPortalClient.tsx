'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';

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

const RECURRENCE_OPTIONS = [
  { value: '', label: 'Sin recurrencia' },
  { value: 'daily', label: 'Diaria' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quincenal' },
  { value: 'monthly', label: 'Mensual' },
];

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
    return bookings.find((b) => {
      if (b.status === 'cancelled') return false;
      const start = new Date(b.start_at);
      const end = new Date(b.end_at);
      const slotStart = new Date(date);
      slotStart.setHours(hour, 0, 0, 0);
      const slotEnd = new Date(slotStart);
      slotEnd.setHours(hour + 1, 0, 0, 0);
      return start < slotEnd && end > slotStart;
    });
  };

  const handleSlotClick = (date: Date, hour: number) => {
    const slotDate = new Date(date);
    slotDate.setHours(hour, 0, 0, 0);
    if (slotDate < new Date()) return;
    const existing = getBookingForSlot(date, hour);
    if (existing) return;

    const dateStr = toInputDate(date);
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
      const start_at = `${selectedSlot.date}T${formStartTime}:00`;
      const end_at = `${selectedSlot.date}T${formEndTime}:00`;

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Reserva de Salas</h1>
          <p className="mt-1 text-sm text-zinc-500">Consultá la disponibilidad y reservá una sala</p>
        </div>
        <Link
          href="/portal/room-booking/my-bookings"
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
        >
          Mis reservas
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </Link>
      </div>

      {/* Room selector + week nav */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-zinc-700">Sala</label>
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}{r.location ? ` – ${r.location}` : ''} ({r.capacity} pers.)
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setCurrentWeek(addDays(currentWeek, -7))} className="rounded-lg border border-zinc-300 p-2 hover:bg-zinc-50">
              <svg className="h-4 w-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-sm font-medium text-zinc-700">Semana del {formatWeekRange(currentWeek)}</span>
            <button type="button" onClick={() => setCurrentWeek(addDays(currentWeek, 7))} className="rounded-lg border border-zinc-300 p-2 hover:bg-zinc-50">
              <svg className="h-4 w-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>

        {/* Room info */}
        {selectedRoom && (
          <div className="flex items-center gap-6 border-b border-zinc-100 px-6 py-3 text-sm text-zinc-500">
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
              <p className="text-sm text-zinc-400">Cargando disponibilidad...</p>
            </div>
          ) : (
            <div className="grid grid-cols-6 gap-px rounded-lg border border-zinc-200 bg-zinc-200 overflow-hidden" style={{ minWidth: 700 }}>
              {/* Header row */}
              <div className="bg-zinc-100 p-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500" />
              {weekDays.map((day, i) => (
                <div key={i} className="bg-zinc-100 p-3 text-center">
                  <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{DAY_LABELS[i]}</div>
                  <div className="mt-0.5 text-xs text-zinc-400">{formatDateShort(day)}</div>
                </div>
              ))}

              {/* Time slots */}
              {TIME_SLOTS.map((time) => {
                const hour = parseInt(time.split(':')[0]);
                return [
                  <div key={`t-${time}`} className="bg-zinc-50 p-3 text-center text-xs font-semibold text-zinc-500">{time}</div>,
                  ...weekDays.map((day, di) => {
                    const booking = getBookingForSlot(day, hour);
                    const slotDate = new Date(day);
                    slotDate.setHours(hour, 0, 0, 0);
                    const isPast = slotDate < new Date();
                    const isMine = booking?.employee_id === employeeId;
                    const isClickable = !booking && !isPast;

                    let bgClass = 'bg-white';
                    if (isPast && !booking) bgClass = 'bg-rose-50';
                    else if (booking && isMine) bgClass = 'bg-emerald-50';
                    else if (booking) bgClass = 'bg-violet-50';

                    return (
                      <div
                        key={`s-${time}-${di}`}
                        onClick={() => isClickable && handleSlotClick(day, hour)}
                        className={`relative min-h-[56px] p-2 text-center text-xs transition-colors ${bgClass} ${isClickable ? 'cursor-pointer hover:bg-cyan-50' : ''} ${isPast && !booking ? 'cursor-not-allowed' : ''}`}
                      >
                        {booking ? (
                          <div className="space-y-0.5">
                            <div className={`font-medium truncate ${isMine ? 'text-emerald-800' : 'text-violet-800'}`}>
                              {booking.employee_first_name} {booking.employee_last_name?.charAt(0)}.
                            </div>
                            <div className={`truncate ${isMine ? 'text-emerald-600' : 'text-violet-600'} text-[10px]`}>
                              {booking.title}
                            </div>
                            {isMine && !isPast && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleCancelBooking(booking.id); }}
                                className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] text-white hover:bg-red-600"
                                title="Cancelar"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className={isPast ? 'text-rose-400 text-[10px]' : 'text-zinc-300 text-[10px]'}>
                            {isPast ? 'No disp.' : 'Disponible'}
                          </span>
                        )}
                      </div>
                    );
                  }),
                ];
              })}
            </div>
          )}

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded border border-zinc-200 bg-white" /> Disponible</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-emerald-100" /> Tu reserva</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-violet-100" /> Ocupada</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-rose-50" /> Pasado</span>
          </div>
        </div>
      </div>

      {/* Reservation modal */}
      {showModal && selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">Reservar {selectedRoom?.name}</h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {new Date(selectedSlot.date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-zinc-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {error && (
              <div className="mx-6 mt-4 rounded-lg bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-4 px-6 py-5">
              {/* Times */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-600">Hora inicio *</label>
                  <input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-600">Hora fin *</label>
                  <input
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              {/* Title / Propósito */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-600">Propósito de la reunión *</label>
                <textarea
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  rows={2}
                  placeholder="Describe brevemente el propósito de la reserva..."
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              {/* Recurrence */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-600">Recurrencia</label>
                <select
                  value={formRecurrence}
                  onChange={(e) => {
                    setFormRecurrence(e.target.value);
                    if (!e.target.value) setFormRecurrenceEndDate('');
                  }}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Recurrence end date */}
              {formRecurrence && (
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-600">Finalizar recurrencia *</label>
                  <input
                    type="date"
                    value={formRecurrenceEndDate}
                    onChange={(e) => setFormRecurrenceEndDate(e.target.value)}
                    min={selectedSlot?.date}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                  {formRecurrenceEndDate && selectedSlot?.date && (
                    <p className="mt-1 text-xs text-zinc-400">
                      Se crearán reservas hasta el {new Date(formRecurrenceEndDate + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  )}
                </div>
              )}

              {/* Invitees */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-600">Invitar usuarios</label>

                {/* Selected invitees chips */}
                {formInvitees.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {formInvitees.map((inv) => (
                      <span
                        key={inv.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-800"
                      >
                        {inv.name}
                        <button
                          type="button"
                          onClick={() => handleRemoveInvitee(inv.id)}
                          className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-cyan-200 text-cyan-700 hover:bg-cyan-300"
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
                    <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                    className="w-full rounded-lg border border-zinc-300 py-2 pl-9 pr-3 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                  {searchingInvitees && (
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                      <svg className="h-4 w-4 animate-spin text-zinc-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    </div>
                  )}

                  {/* Results dropdown */}
                  {showInviteeDropdown && inviteeResults.length > 0 && (
                    <div
                      ref={dropdownRef}
                      className="absolute z-10 mt-1 w-full rounded-lg border border-zinc-200 bg-white shadow-lg"
                    >
                      {inviteeResults.map((emp) => (
                        <button
                          key={emp.id}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); handleAddInvitee(emp); }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-50 first:rounded-t-lg last:rounded-b-lg"
                        >
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-100 text-xs font-semibold text-cyan-700">
                            {emp.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-zinc-900">{emp.name}</p>
                            <p className="text-xs text-zinc-400">{emp.email}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-zinc-400">
                  💡 Usa ↑↓ para navegar, Enter para seleccionar, o haz clic directamente
                </p>
              </div>

            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-zinc-100 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-lg bg-cyan-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-60"
              >
                {submitting ? 'Reservando...' : 'Confirmar Reserva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
