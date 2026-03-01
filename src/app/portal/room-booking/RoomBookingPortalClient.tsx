'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Room = {
  id: string;
  name: string;
  floor: string | null;
  capacity: number;
  amenities: string[];
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
  room_name: string;
  room_floor: string | null;
  room_capacity: number;
  employee_first_name: string;
  employee_last_name: string;
};

type RoomBookingPortalClientProps = {
  employeeId: string;
  rooms: Room[];
  initialBookings: Booking[];
  initialDate: string;
};

export function RoomBookingPortalClient({
  employeeId,
  rooms,
  initialBookings,
  initialDate,
}: RoomBookingPortalClientProps) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    start_time: '09:00',
    end_time: '10:00',
    notes: '',
  });

  useEffect(() => {
    if (selectedDate !== initialDate) {
      fetchBookings(selectedDate);
    }
  }, [selectedDate]);

  async function fetchBookings(date: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/room-booking/bookings?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setBookings(data);
      }
    } catch (err) {
      console.error('Error fetching bookings:', err);
    } finally {
      setLoading(false);
    }
  }

  function openBookingModal(room: Room) {
    setSelectedRoom(room);
    setFormData({ title: '', start_time: '09:00', end_time: '10:00', notes: '' });
    setError(null);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setSelectedRoom(null);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRoom) return;

    if (formData.end_time <= formData.start_time) {
      setError('La hora de fin debe ser posterior a la hora de inicio');
      return;
    }

    if (!formData.title.trim()) {
      setError('El título es requerido');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const start_at = `${selectedDate}T${formData.start_time}:00`;
      const end_at = `${selectedDate}T${formData.end_time}:00`;

      const res = await fetch('/api/portal/room-booking/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: selectedRoom.id,
          title: formData.title,
          start_at,
          end_at,
          notes: formData.notes || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al crear la reserva');
        return;
      }

      closeModal();
      fetchBookings(selectedDate);
    } catch (err: any) {
      setError(err.message || 'Error al crear la reserva');
    } finally {
      setSaving(false);
    }
  }

  function getRoomBookings(roomId: string) {
    return bookings.filter((b) => b.room_id === roomId);
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Reserva de Salas
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Reservá una sala de reunión para tu próxima reunión
          </p>
        </div>
        <Link
          href="/portal/room-booking/my-bookings"
          className="rounded-lg border border-cyan-600 px-4 py-2 text-sm font-medium text-cyan-600 hover:bg-cyan-50"
        >
          Mis reservas
        </Link>
      </div>

      {/* Date picker */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-zinc-700">Fecha:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-cyan-600 focus:outline-none focus:ring-1 focus:ring-cyan-600"
        />
        {selectedDate !== initialDate && (
          <button
            onClick={() => setSelectedDate(initialDate)}
            className="text-sm text-cyan-600 hover:text-cyan-700"
          >
            Hoy
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
        </div>
      )}

      {/* Room cards grid */}
      {!loading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => {
            const roomBookings = getRoomBookings(room.id);

            return (
              <div
                key={room.id}
                className="rounded-xl border border-zinc-200 bg-white shadow-sm"
              >
                {/* Room header */}
                <div className="border-b border-zinc-200 px-5 py-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-zinc-900">{room.name}</h3>
                    <button
                      onClick={() => openBookingModal(room)}
                      className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-700"
                    >
                      Reservar
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-sm text-zinc-500">
                    {room.floor && (
                      <span className="flex items-center gap-1">
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                          />
                        </svg>
                        Piso {room.floor}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      {room.capacity} {room.capacity === 1 ? 'persona' : 'personas'}
                    </span>
                  </div>
                  {/* Amenities */}
                  {room.amenities && room.amenities.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {room.amenities.map((amenity) => (
                        <span
                          key={amenity}
                          className="inline-flex items-center rounded-full bg-cyan-50 px-2 py-0.5 text-xs font-medium text-cyan-700"
                        >
                          {amenity}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Room bookings for selected date */}
                <div className="px-5 py-3">
                  {roomBookings.length === 0 ? (
                    <p className="py-2 text-center text-sm text-zinc-400">
                      Sin reservas para este día
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                        Reservas del día
                      </p>
                      {roomBookings.map((booking) => (
                        <div
                          key={booking.id}
                          className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium text-zinc-800">
                              {booking.title}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {booking.employee_first_name} {booking.employee_last_name}
                            </p>
                          </div>
                          <span className="whitespace-nowrap text-xs font-medium text-cyan-700">
                            {formatTime(booking.start_at)} - {formatTime(booking.end_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && rooms.length === 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center shadow-sm">
          <svg
            className="mx-auto h-12 w-12 text-zinc-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-zinc-900">
            No hay salas disponibles
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            Contactá al administrador para agregar salas.
          </p>
        </div>
      )}

      {/* Booking Modal */}
      {showModal && selectedRoom && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
            <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl">
              <div className="border-b border-zinc-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-zinc-900">
                  Reservar {selectedRoom.name}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {selectedDate &&
                    new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-AR', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                </p>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="space-y-4 p-6">
                  {error && (
                    <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                      {error}
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">
                      Título *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, title: e.target.value }))
                      }
                      required
                      placeholder="Ej: Reunión de equipo"
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-cyan-600 focus:outline-none focus:ring-1 focus:ring-cyan-600"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-700">
                        Hora inicio *
                      </label>
                      <input
                        type="time"
                        value={formData.start_time}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            start_time: e.target.value,
                          }))
                        }
                        required
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-cyan-600 focus:outline-none focus:ring-1 focus:ring-cyan-600"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-700">
                        Hora fin *
                      </label>
                      <input
                        type="time"
                        value={formData.end_time}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            end_time: e.target.value,
                          }))
                        }
                        required
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-cyan-600 focus:outline-none focus:ring-1 focus:ring-cyan-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">
                      Notas
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, notes: e.target.value }))
                      }
                      rows={3}
                      placeholder="Información adicional (opcional)"
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-cyan-600 focus:outline-none focus:ring-1 focus:ring-cyan-600"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50"
                  >
                    {saving ? 'Reservando...' : 'Confirmar reserva'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
