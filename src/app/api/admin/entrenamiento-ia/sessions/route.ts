import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

export async function GET(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const cycleId = searchParams.get('cycle_id');

    const supabase = getSupabaseServer();
    let query = supabase
      .from('ai_training_sessions')
      .select('*')
      .order('session_date', { ascending: false });

    if (cycleId) query = query.eq('cycle_id', cycleId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ sessions: data ?? [] });
  } catch (err) {
    console.error('GET ai_training_sessions:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { cycle_id, title, session_date, description } = body;

    if (!cycle_id || !title?.trim() || !session_date) {
      return NextResponse.json({ error: 'Ciclo, título y fecha son obligatorios' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('ai_training_sessions')
      .insert({
        cycle_id,
        title: title.trim(),
        session_date,
        description: description?.trim() || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ session: data });
  } catch (err) {
    console.error('POST ai_training_sessions:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
