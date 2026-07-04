'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@pow/ui/components/ui/page-header';
import { Button, buttonVariants } from '@pow/ui/components/ui/button';

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

type MyBookingsClientProps = {
  bookings: Booking[];
};

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  confirmed: { bg: 'bg-success-subtle', text: 'text-[var(--green-700)]' },
  cancelled: { bg: 'bg-secondary', text: 'text-muted-foreground' },
};

export function MyBookingsClient({ bookings: initialBookings }: MyBookingsClientProps) {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming');

  const now = new Date().toISOString();

  const upcomingBookings = bookings.filter(
    (b) => b.start_at >= now && b.status === 'confirmed'
  );
  const pastBookings = bookings.filter(
    (b) => b.start_at < now || b.status === 'cancelled'
  );

  const displayedBookings = filter === 'upcoming' ? upcomingBookings : pastBookings;

  async function handleCancel(id: string) {
    if (!confirm('¿Estás seguro de que deseas cancelar esta reserva?')) return;

    setCancellingId(id);
    try {
      const res = await fetch(`/api/portal/room-booking/bookings/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setBookings((prev) =>
          prev.map((b) => (b.id === id ? { ...b, status: 'cancelled' } : b))
        );
        router.refresh();
      }
    } catch (err) {
      console.error('Error cancelling booking:', err);
    } finally {
      setCancellingId(null);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('es-AR', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Argentina/Buenos_Aires',
    });
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Argentina/Buenos_Aires',
    });
  }

  function isFutureConfirmed(booking: Booking) {
    return booking.start_at >= now && booking.status === 'confirmed';
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Mis Reservas"
        description="Historial de tus reservas de salas"
        actions={
          <Link href="/portal/room-booking" className={buttonVariants({ variant: 'primary' })}>
            Nueva reserva
          </Link>
        }
      />

      {/* Tabs */}
      <div className="border-b border-[var(--border)]">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => setFilter('upcoming')}
            className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
              filter === 'upcoming'
                ? 'border-brand text-foreground'
                : 'border-transparent text-muted-foreground hover:border-[var(--border)] hover:text-foreground'
            }`}
          >
            Próximas
            {upcomingBookings.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-foreground">
                {upcomingBookings.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setFilter('past')}
            className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
              filter === 'past'
                ? 'border-brand text-foreground'
                : 'border-transparent text-muted-foreground hover:border-[var(--border)] hover:text-foreground'
            }`}
          >
            Pasadas / Canceladas
          </button>
        </nav>
      </div>

      {/* Bookings list */}
      <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
        {displayedBookings.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            {filter === 'upcoming'
              ? 'No tenés reservas próximas'
              : 'No tenés reservas pasadas'}
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {displayedBookings.map((booking) => {
              const statusColors =
                STATUS_COLORS[booking.status] || STATUS_COLORS.confirmed;
              const statusLabel =
                STATUS_LABELS[booking.status] || booking.status;

              return (
                <li key={booking.id} className="px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-sm font-semibold text-foreground">
                          {booking.title}
                        </h3>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors.bg} ${statusColors.text}`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
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
                          {booking.room_name}
                        </span>
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
                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                          {formatDate(booking.start_at)}
                        </span>
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
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          {formatTime(booking.start_at)} -{' '}
                          {formatTime(booking.end_at)}
                        </span>
                      </div>
                      {booking.notes && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {booking.notes}
                        </p>
                      )}
                    </div>
                    {isFutureConfirmed(booking) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancel(booking.id)}
                        loading={cancellingId === booking.id}
                      >
                        Cancelar
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
