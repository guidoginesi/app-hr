import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { buildScorePayload } from '@/lib/entrenamientoIa';
import type { AiTrainingScoreInput } from '@/types/entrenamiento-ia';

export async function GET(req: NextRequest) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sessionId = new URL(req.url).searchParams.get('session_id');
    if (!sessionId) {
      return NextResponse.json({ error: 'session_id es obligatorio' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const [{ data: scores, error: scoresError }, { data: employees, error: employeesError }] =
      await Promise.all([
        supabase.from('ai_training_scores').select('*').eq('session_id', sessionId),
        supabase
          .from('employees')
          .select('id, first_name, last_name, job_title, department:departments(name)')
          .eq('status', 'active')
          .order('last_name'),
      ]);

    if (scoresError) return NextResponse.json({ error: scoresError.message }, { status: 500 });
    if (employeesError) return NextResponse.json({ error: employeesError.message }, { status: 500 });

    const scoreMap = new Map((scores ?? []).map((s) => [s.employee_id, s]));

    const rows = (employees ?? []).map((emp: any) => {
      const existing = scoreMap.get(emp.id);
      return {
        employee_id: emp.id,
        first_name: emp.first_name,
        last_name: emp.last_name,
        job_title: emp.job_title,
        department_name: emp.department?.name ?? null,
        score: existing ?? null,
      };
    });

    return NextResponse.json({ rows });
  } catch (err) {
    console.error('GET ai_training_scores:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { isAdmin, user } = await requireAdmin();
    if (!isAdmin || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { session_id, scores } = body as {
      session_id: string;
      scores: Array<{ employee_id: string } & AiTrainingScoreInput>;
    };

    if (!session_id || !Array.isArray(scores)) {
      return NextResponse.json({ error: 'session_id y scores son obligatorios' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const upserts = scores.map((row) => ({
      session_id,
      employee_id: row.employee_id,
      ...buildScorePayload(row, user.id),
    }));

    const { data, error } = await supabase
      .from('ai_training_scores')
      .upsert(upserts, { onConflict: 'session_id,employee_id' })
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ scores: data ?? [] });
  } catch (err) {
    console.error('PUT ai_training_scores:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
