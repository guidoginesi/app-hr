import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { RoomBookingShell } from './RoomBookingShell';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function RoomBookingDashboardPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  const supabase = getSupabaseServer();

  const now = new Date();
  const buenosAires = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  const todayStart = `${buenosAires}T00:00:00-03:00`;
  const todayEnd = `${buenosAires}T23:59:59-03:00`;

  const dayOfWeek = new Date(buenosAires).getDay();
  const daysUntilSunday = 7 - dayOfWeek;
  const endOfWeek = new Date(buenosAires);
  endOfWeek.setDate(endOfWeek.getDate() + daysUntilSunday);
  const weekEnd = endOfWeek.toISOString().split('T')[0] + 'T23:59:59-03:00';

  const [activeRoomsResult, todayBookingsResult, weekBookingsResult, todayDetailResult] =
    await Promise.all([
      supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true),
      supabase
        .from('room_bookings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'confirmed')
        .gte('start_at', todayStart)
        .lte('start_at', todayEnd),
      supabase
        .from('room_bookings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'confirmed')
        .gte('start_at', todayStart)
        .lte('start_at', weekEnd),
      supabase
        .from('room_bookings_with_details')
        .select('*')
        .eq('status', 'confirmed')
        .gte('start_at', todayStart)
        .lte('start_at', todayEnd)
        .order('start_at', { ascending: true })
        .limit(20),
    ]);

  const activeRooms = activeRoomsResult.count || 0;
  const todayBookings = todayBookingsResult.count || 0;
  const weekBookings = weekBookingsResult.count || 0;
  const todayDetails = todayDetailResult.data || [];

  return (
    <RoomBookingShell active="dashboard">
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Dashboard de Reserva de Salas
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Resumen general de salas y reservas
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Salas activas
            </p>
            <p className="mt-3 text-4xl font-bold text-cyan-600">{activeRooms}</p>
            <p className="mt-2 text-xs text-zinc-500">Disponibles para reservar</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Reservas hoy
            </p>
            <p className="mt-3 text-4xl font-bold text-cyan-600">{todayBookings}</p>
            <p className="mt-2 text-xs text-zinc-500">
              {buenosAires}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Reservas esta semana
            </p>
            <p className="mt-3 text-4xl font-bold text-cyan-600">{weekBookings}</p>
            <p className="mt-2 text-xs text-zinc-500">Confirmadas</p>
          </div>
        </div>

        {/* Today's bookings */}
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-6 py-4">
            <h3 className="text-base font-semibold text-zinc-900">Reservas de hoy</h3>
          </div>
          {todayDetails.length > 0 ? (
            <ul className="divide-y divide-zinc-200">
              {todayDetails.map((booking: Record<string, string>) => (
                <li key={booking.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-zinc-900">{booking.room_name}</p>
                      <p className="text-sm text-zinc-500">{booking.title}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-zinc-900">
                        {new Date(booking.start_at).toLocaleTimeString('es-AR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'America/Argentina/Buenos_Aires',
                        })}{' '}
                        -{' '}
                        {new Date(booking.end_at).toLocaleTimeString('es-AR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'America/Argentina/Buenos_Aires',
                        })}
                      </p>
                      <p className="text-sm text-zinc-500">
                        {booking.employee_first_name} {booking.employee_last_name}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-6 py-8 text-center text-sm text-zinc-500">
              No hay reservas para hoy
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-900">Acciones rápidas</h3>
          <p className="mt-1 text-sm text-zinc-500">Administra salas y reservas</p>
          <div className="mt-4 flex gap-3">
            <Link
              href="/admin/room-booking/rooms"
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Gestionar salas
            </Link>
            <Link
              href="/admin/room-booking/bookings"
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Ver reservas
            </Link>
          </div>
        </div>
      </div>
    </RoomBookingShell>
  );
}
