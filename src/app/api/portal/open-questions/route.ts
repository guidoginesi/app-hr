import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

// GET - Get active open questions for evaluations (public for portal users)
export async function GET() {
  try {
    const supabase = getSupabaseServer();
    
    const { data, error } = await supabase
      .from('evaluation_open_question_config')
      .select('question_key, label_self, label_leader, description')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('Error fetching open questions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
