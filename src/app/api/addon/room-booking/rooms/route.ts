import { NextRequest, NextResponse } from 'next/server';
import { authenticateAddon } from '../_auth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// GET /api/addon/room-booking/rooms
// Used by the Google Calendar Add-on to list active rooms
export async function GET(req: NextRequest) {
  const { employee, error } = await authenticateAddon(req);
  if (error || !employee) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseServer();
  const { data, error: dbError } = await supabase
    .from('rooms')
    .select('id, name, capacity, location, description, equipment')
    .eq('is_active', true)
    .order('name');

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ rooms: data });
}
