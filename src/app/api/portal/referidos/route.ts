import { NextRequest, NextResponse } from 'next/server';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { Stage, StageStatus } from '@/types/funnel';

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
        .select(`*, job:jobs!job_id(id, title, department), application:applications!application_id(id, current_stage, current_stage_status, final_outcome, offer_status)`)
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

// POST /api/portal/referidos — submit a referral + create candidate + application
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePortalAccess();
    if (!auth?.employee) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const job_id = formData.get('job_id') as string | null;
    const candidate_name = formData.get('candidate_name') as string | null;
    const candidate_email = formData.get('candidate_email') as string | null;
    const candidate_phone = formData.get('candidate_phone') as string | null;
    const candidate_province = formData.get('candidate_province') as string | null;
    const candidate_linkedin = formData.get('candidate_linkedin') as string | null;
    const candidate_salary_expectation = formData.get('candidate_salary_expectation') as string | null;
    const recommendation_reason = formData.get('recommendation_reason') as string | null;
    const cvFile = formData.get('cv') as File | null;

    if (!job_id) return NextResponse.json({ error: 'Debe seleccionar una búsqueda' }, { status: 400 });
    if (!candidate_name?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    if (!candidate_email?.trim()) return NextResponse.json({ error: 'El email es requerido' }, { status: 400 });
    if (!candidate_phone?.trim()) return NextResponse.json({ error: 'El teléfono es requerido' }, { status: 400 });
    if (!candidate_province?.trim()) return NextResponse.json({ error: 'La provincia es requerida' }, { status: 400 });
    if (!recommendation_reason?.trim()) return NextResponse.json({ error: 'El motivo de recomendación es requerido' }, { status: 400 });
    if (!cvFile || cvFile.size === 0) return NextResponse.json({ error: 'El CV es requerido' }, { status: 400 });

    const supabase = getSupabaseServer();

    // Check job is still published
    const { data: job } = await supabase.from('jobs').select('id, title, is_published').eq('id', job_id).single();
    if (!job?.is_published) return NextResponse.json({ error: 'Esta búsqueda ya no está activa' }, { status: 400 });

    // Prevent duplicate referral (same employee + same candidate email + same job)
    const { data: existing } = await supabase
      .from('referrals')
      .select('id')
      .eq('referrer_employee_id', auth.employee.id)
      .eq('job_id', job_id)
      .eq('candidate_email', candidate_email.trim().toLowerCase())
      .maybeSingle();

    if (existing) return NextResponse.json({ error: 'Ya referiste a esta persona para esta búsqueda' }, { status: 409 });

    // Upload CV to resumes bucket
    const MAX_SIZE = 10 * 1024 * 1024;
    if (cvFile.size > MAX_SIZE) return NextResponse.json({ error: 'El CV supera el límite de 10 MB' }, { status: 400 });

    const ext = cvFile.name.split('.').pop() || 'pdf';
    const cv_storage_path = `${job_id}/${Date.now()}-referral-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const cv_filename = cvFile.name;

    const fileBuffer = Buffer.from(await cvFile.arrayBuffer());
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(cv_storage_path, fileBuffer, {
        contentType: cvFile.type || 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('CV upload error:', uploadError);
      return NextResponse.json({ error: 'Error al subir el CV' }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from('resumes').getPublicUrl(uploadData.path);
    const resumeUrl = publicUrlData.publicUrl;

    // Upsert candidate
    const provinciaUpper = candidate_province.trim().toUpperCase().replace('OTRA', 'OTRA') as 'CABA' | 'GBA' | 'OTRA';
    const { data: candidate, error: candErr } = await supabase
      .from('candidates')
      .upsert(
        {
          email: candidate_email.trim().toLowerCase(),
          name: candidate_name.trim(),
          phone: candidate_phone.trim(),
          provincia: provinciaUpper,
          linkedin_url: candidate_linkedin?.trim() || null,
        },
        { onConflict: 'email' }
      )
      .select('id')
      .single();

    if (candErr) {
      await supabase.storage.from('resumes').remove([cv_storage_path]);
      return NextResponse.json({ error: candErr.message }, { status: 500 });
    }

    // Create application in HR_REVIEW stage (skipping auto-reject triggers — referrals are pre-screened)
    const cvReceivedDate = new Date();
    const hrReviewDate = new Date(cvReceivedDate.getTime() + 1000);

    const { data: application, error: appErr } = await supabase
      .from('applications')
      .insert({
        candidate_id: candidate.id,
        job_id,
        resume_url: resumeUrl,
        salary_expectation: candidate_salary_expectation?.trim() || null,
        current_stage: Stage.HR_REVIEW,
        current_stage_status: StageStatus.PENDING,
        status: 'Referido',
      })
      .select('id')
      .single();

    if (appErr) {
      await supabase.storage.from('resumes').remove([cv_storage_path]);
      return NextResponse.json({ error: appErr.message }, { status: 500 });
    }

    const referrerName = `${auth.employee.first_name} ${auth.employee.last_name}`;

    // Stage history: CV_RECEIVED (completed) → HR_REVIEW (pending)
    await supabase.from('stage_history').insert([
      {
        application_id: application.id,
        from_stage: null,
        to_stage: Stage.CV_RECEIVED,
        status: StageStatus.COMPLETED,
        changed_by_user_id: null,
        notes: `CV recibido por referido de ${referrerName}`,
        changed_at: cvReceivedDate.toISOString(),
      },
      {
        application_id: application.id,
        from_stage: Stage.CV_RECEIVED,
        to_stage: Stage.HR_REVIEW,
        status: StageStatus.PENDING,
        changed_by_user_id: null,
        notes: 'Avance automático a revisión HR',
        changed_at: hrReviewDate.toISOString(),
      },
    ]);

    // Insert referral linked to the application
    const { data: referral, error: refErr } = await supabase
      .from('referrals')
      .insert({
        referrer_employee_id: auth.employee.id,
        job_id,
        candidate_name: candidate_name.trim(),
        candidate_email: candidate_email.trim().toLowerCase(),
        candidate_phone: candidate_phone.trim(),
        candidate_province: candidate_province.trim(),
        candidate_linkedin: candidate_linkedin?.trim() || null,
        candidate_salary_expectation: candidate_salary_expectation?.trim() || null,
        recommendation_reason: recommendation_reason.trim(),
        cv_storage_path,
        cv_filename,
        application_id: application.id,
      })
      .select(`*, job:jobs!job_id(id, title, department)`)
      .single();

    if (refErr) {
      return NextResponse.json({ error: refErr.message }, { status: 500 });
    }

    // Link application back to referral
    await supabase.from('applications').update({ referral_id: referral.id }).eq('id', application.id);

    return NextResponse.json(referral, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/portal/referidos:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
