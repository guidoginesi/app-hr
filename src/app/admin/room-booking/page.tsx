import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import Link from 'next/link';
import { RoomBookingLayout } from './RoomBookingLayout';
import { Stat } from '@pow/ui/components/ui/stat';
import { Card } from '@pow/ui/components/ui/card';
import { buttonVariants } from '@pow/ui/components/ui/button';
import { DoorOpen, CalendarCheck, CalendarDays } from 'lucide-react';

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
    <RoomBookingLayout active="dashboard">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Stat icon={<DoorOpen className="h-6 w-6" />} label="Salas activas" value={String(activeRooms)} sub="Disponibles para reservar" />
          <Stat icon={<CalendarCheck className="h-6 w-6" />} label="Reservas hoy" value={String(todayBookings)} sub={buenosAires} />
          <Stat icon={<CalendarDays className="h-6 w-6" />} label="Reservas esta semana" value={String(weekBookings)} sub="Confirmadas" />
        </div>

        {/* Today's bookings */}
        <Card>
          <div className="border-b border-[var(--border)] px-6 py-4">
            <h3 className="text-base font-semibold text-foreground">Reservas de hoy</h3>
          </div>
          {todayDetails.length > 0 ? (
            <ul className="divide-y divide-[var(--border)]">
              {todayDetails.map((booking: Record<string, string>) => (
                <li key={booking.id} className="px-6 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{booking.room_name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{booking.title}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium tabular-nums text-foreground">
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
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {booking.employee_first_name} {booking.employee_last_name}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
              No hay reservas para hoy
            </div>
          )}
        </Card>

        {/* Quick Actions */}
        <Card className="p-6">
          <h3 className="text-base font-semibold text-foreground">Acciones rápidas</h3>
          <p className="mt-1 text-sm text-muted-foreground">Administra salas y reservas</p>
          <div className="mt-4 flex gap-3">
            <Link href="/admin/room-booking/rooms" className={buttonVariants({ variant: 'secondary' })}>
              Gestionar salas
            </Link>
            <Link href="/admin/room-booking/bookings" className={buttonVariants({ variant: 'secondary' })}>
              Ver reservas
            </Link>
          </div>
        </Card>
      </div>
    </RoomBookingLayout>
  );
}
