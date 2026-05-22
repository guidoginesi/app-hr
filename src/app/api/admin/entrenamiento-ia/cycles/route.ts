import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

export async function GET() {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('ai_training_cycles')
      .select('*')
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ cycles: data ?? [] });
  } catch (err) {
    console.error('GET ai_training_cycles:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { isAdmin, user } = await requireAdmin();
    if (!isAdmin || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { name, description, start_date, end_date, is_active } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    if (is_active) {
      await supabase.from('ai_training_cycles').update({ is_active: false }).eq('is_active', true);
    }

    const { data, error } = await supabase
      .from('ai_training_cycles')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        start_date: start_date || null,
        end_date: end_date || null,
        is_active: is_active ?? true,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ cycle: data });
  } catch (err) {
    console.error('POST ai_training_cycles:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
