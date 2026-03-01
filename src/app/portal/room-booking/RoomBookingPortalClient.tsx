'use client';

import { useState, useEffect, useMemo } from 'react';
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

type Props = {
  rooms: Room[];
  employeeId: string;
  employeeName: string;
};

const TIME_SLOTS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
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

export function RoomBookingPortalClient({ rooms, employeeId, employeeName }: Props) {
  const [currentWeek, setCurrentWeek] = useState(() => getWeekStart(new Date()));
  const [selectedRoomId, setSelectedRoomId] = useState(rooms[0]?.id || '');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; hour: number } | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formStartTime, setFormStartTime] = useState('');
  const [formEndTime, setFormEndTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    const dateStr = date.toISOString().split('T')[0];
    setSelectedSlot({ date: dateStr, hour });
    setFormTitle('');
    setFormNotes('');
    setFormStartTime(`${hour.toString().padStart(2, '0')}:00`);
    setFormEndTime(`${(hour + 1).toString().padStart(2, '0')}:00`);
    setError(null);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!formTitle.trim() || !selectedSlot) return;
    setSubmitting(true);
    setError(null);
    try {
      const start_at = `${selectedSlot.date}T${formStartTime}:00`;
      const end_at = `${selectedSlot.date}T${formEndTime}:00`;
      const res = await fetch('/api/portal/room-booking/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: selectedRoomId, title: formTitle.trim(), start_at, end_at, notes: formNotes || undefined }),
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
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">Reservar {selectedRoom?.name}</h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {new Date(selectedSlot.date).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-zinc-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-600">Motivo de la reunión *</label>
                <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Ej: Standup diario, Planning sprint..." className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-600">Inicio</label>
                  <input type="time" value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-600">Fin</label>
                  <input type="time" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-600">Notas (opcional)</label>
                <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2} placeholder="Notas adicionales..." className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500" />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-zinc-100 px-6 py-4">
              <button type="button" onClick={() => setShowModal(false)} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">Cancelar</button>
              <button type="button" onClick={handleSubmit} disabled={submitting || !formTitle.trim()} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-60">
                {submitting ? 'Reservando...' : 'Confirmar reserva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
