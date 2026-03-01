'use client';

import { useEffect, useState } from 'react';

interface Booking {
  id: string;
  room_id: string;
  employee_id: string;
  title: string;
  start_at: string;
  end_at: string;
  status: 'confirmed' | 'cancelled';
  notes: string | null;
  created_at: string;
  room_name: string;
  room_floor: string | null;
  room_capacity: number;
  employee_first_name: string;
  employee_last_name: string;
  employee_email: string;
}

interface Room {
  id: string;
  name: string;
}

export function BookingsClient() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [roomFilter, setRoomFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRooms();
  }, []);

  useEffect(() => {
    fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomFilter, fromDate, toDate]);

  async function fetchRooms() {
    try {
      const res = await fetch('/api/admin/room-booking/rooms');
      if (res.ok) {
        setRooms(await res.json());
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  }

  async function fetchBookings() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (roomFilter) params.set('room_id', roomFilter);
      if (fromDate) params.set('from', `${fromDate}T00:00:00`);
      if (toDate) params.set('to', `${toDate}T23:59:59`);

      const res = await fetch(`/api/admin/room-booking/bookings?${params}`);
      if (res.ok) {
        const data = await res.json();
        setBookings(data.bookings || []);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(id: string) {
    setCancellingId(id);
    try {
      const res = await fetch(`/api/admin/room-booking/bookings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });

      if (res.ok) {
        setBookings((prev) =>
          prev.map((b) => (b.id === id ? { ...b, status: 'cancelled' } : b))
        );
      } else {
        const data = await res.json();
        alert(data.error || 'Error al cancelar');
      }
    } catch (error) {
      console.error('Error cancelling booking:', error);
      alert('Error de conexión');
    } finally {
      setCancellingId(null);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
    });
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Argentina/Buenos_Aires',
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Reservas</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Listado de reservas de salas de reunión
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <select
          value={roomFilter}
          onChange={(e) => setRoomFilter(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        >
          <option value="">Todas las salas</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <label className="text-sm text-zinc-500">Desde:</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-zinc-500">Hasta:</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>
        {(roomFilter || fromDate || toDate) && (
          <button
            onClick={() => {
              setRoomFilter('');
              setFromDate('');
              setToDate('');
            }}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-500">No hay reservas</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <th className="px-6 py-3">Fecha</th>
                <th className="px-6 py-3">Horario</th>
                <th className="px-6 py-3">Sala</th>
                <th className="px-6 py-3">Empleado</th>
                <th className="px-6 py-3">Título</th>
                <th className="px-6 py-3">Estado</th>
                <th className="px-6 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {bookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-zinc-50">
                  <td className="px-6 py-4 text-sm text-zinc-600">
                    {formatDate(booking.start_at)}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-600">
                    {formatTime(booking.start_at)} - {formatTime(booking.end_at)}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-zinc-900">{booking.room_name}</p>
                    {booking.room_floor && (
                      <p className="text-xs text-zinc-500">Piso {booking.room_floor}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-600">
                    {booking.employee_first_name} {booking.employee_last_name}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-zinc-900">{booking.title}</p>
                    {booking.notes && (
                      <p className="mt-0.5 text-xs text-zinc-400 truncate max-w-xs" title={booking.notes}>
                        {booking.notes}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        booking.status === 'confirmed'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-zinc-100 text-zinc-600'
                      }`}
                    >
                      {booking.status === 'confirmed' ? 'Confirmada' : 'Cancelada'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {booking.status === 'confirmed' && (
                      <button
                        onClick={() => handleCancel(booking.id)}
                        disabled={cancellingId === booking.id}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {cancellingId === booking.id ? '...' : 'Cancelar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && bookings.length > 0 && (
        <div className="text-sm text-zinc-500">
          {bookings.length} reserva{bookings.length !== 1 ? 's' : ''} ·{' '}
          {bookings.filter((b) => b.status === 'confirmed').length} confirmada
          {bookings.filter((b) => b.status === 'confirmed').length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
