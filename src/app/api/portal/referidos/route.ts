import { NextRequest, NextResponse } from 'next/server';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// GET /api/portal/referidos — open jobs + own referrals
export async function GET() {
  try {
    const auth = await requirePortalAccess();
    if (!auth?.employee) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = getSupabaseServer();

    const [jobsRes, referralsRes] = await Promise.all([
      supabase
        .from('jobs')
        .select('id, title, department, location, work_mode')
        .eq('is_published', true)
        .order('created_at', { ascending: false }),
      supabase
        .from('referrals')
        .select(`*, job:jobs!job_id(id, title, department)`)
        .eq('referrer_employee_id', auth.employee.id)
        .order('created_at', { ascending: false }),
    ]);

    return NextResponse.json({
      jobs: jobsRes.data || [],
      referrals: referralsRes.data || [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/portal/referidos — submit a referral
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePortalAccess();
    if (!auth?.employee) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { job_id, candidate_name, candidate_email, candidate_phone, candidate_linkedin, recommendation_reason } = body;

    if (!job_id) return NextResponse.json({ error: 'Debe seleccionar una búsqueda' }, { status: 400 });
    if (!candidate_name?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    if (!candidate_email?.trim()) return NextResponse.json({ error: 'El email es requerido' }, { status: 400 });
    if (!recommendation_reason?.trim()) return NextResponse.json({ error: 'El motivo de recomendación es requerido' }, { status: 400 });

    const supabase = getSupabaseServer();

    // Check job is still published
    const { data: job } = await supabase.from('jobs').select('id, title, is_published').eq('id', job_id).single();
    if (!job?.is_published) return NextResponse.json({ error: 'Esta búsqueda ya no está activa' }, { status: 400 });

    // Check no duplicate referral (same employee + same candidate email + same job)
    const { data: existing } = await supabase
      .from('referrals')
      .select('id')
      .eq('referrer_employee_id', auth.employee.id)
      .eq('job_id', job_id)
      .eq('candidate_email', candidate_email.trim().toLowerCase())
      .maybeSingle();

    if (existing) return NextResponse.json({ error: 'Ya referiste a esta persona para esta búsqueda' }, { status: 409 });

    const { data, error } = await supabase
      .from('referrals')
      .insert({
        referrer_employee_id: auth.employee.id,
        job_id,
        candidate_name: candidate_name.trim(),
        candidate_email: candidate_email.trim().toLowerCase(),
        candidate_phone: candidate_phone?.trim() || null,
        candidate_linkedin: candidate_linkedin?.trim() || null,
        recommendation_reason: recommendation_reason.trim(),
      })
      .select(`*, job:jobs!job_id(id, title, department)`)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
