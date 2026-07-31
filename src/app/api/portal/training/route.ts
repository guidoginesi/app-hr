import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { createSystemNotification, getAdminUserIds } from '@/lib/notificationService';
import { sendSimpleEmail } from '@/lib/emailService';
import { renderEmail, getAppUrl } from '@/lib/email/layout';
import { computeBudget, evaluateTrainingRequest, USD } from '@/lib/training';
import type { TrainingCurrency } from '@/types/training';

const currentYear = () => new Date().getFullYear();

async function getEffectiveBudget(
  supabase: ReturnType<typeof getSupabaseServer>,
  employeeId: string,
  year: number,
): Promise<number> {
  const { data: override } = await supabase
    .from('training_budget_overrides')
    .select('amount_usd')
    .eq('employee_id', employeeId)
    .eq('year', year)
    .maybeSingle();
  if (override) return Number(override.amount_usd);
  const { data: config } = await supabase
    .from('training_budget_config')
    .select('default_amount_usd')
    .eq('year', year)
    .maybeSingle();
  return config ? Number(config.default_amount_usd) : 500;
}

const CreateSchema = z.object({
  course_name: z.string().trim().min(1, 'El nombre del curso es obligatorio'),
  provider: z.string().trim().optional().nullable(),
  modality: z.enum(['online', 'presencial']).optional().nullable(),
  hours: z.number().positive().optional().nullable(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  link: z.string().url().optional().nullable().or(z.literal('')),
  objective: z.string().trim().optional().nullable(),
  role_relation: z.string().trim().optional().nullable(),
  cost: z.number().positive('El costo debe ser positivo'),
  currency: z.enum(['USD', 'ARS']),
});

// GET /api/portal/training — mi budget + mis solicitudes + preview
export async function GET() {
  try {
    const auth = await requirePortalAccess();
    if (!auth?.employee) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = getSupabaseServer();
    const year = currentYear();

    const { data: requests, error } = await supabase
      .from('training_requests_with_details')
      .select('*')
      .eq('employee_id', auth.employee.id)
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const totalUsd = await getEffectiveBudget(supabase, auth.employee.id, year);
    const yearRows = (requests ?? []).filter((r) => r.budget_year === year);
    const budget = { ...computeBudget(totalUsd, yearRows), year };

    // Preview: sólo antigüedad + budget (el costo se valida en vivo en el cliente)
    const seniorityEval = evaluateTrainingRequest({
      hireDate: auth.employee.hire_date ?? null,
      now: new Date(),
      budget,
      cost: 0.01,
      currency: 'USD',
    });

    return NextResponse.json({
      requests: requests ?? [],
      budget,
      preview: { seniorityOk: seniorityEval.seniorityOk },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/portal/training — crear solicitud
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePortalAccess();
    if (!auth?.employee || !auth.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = CreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
    }
    const d = parsed.data;
    const currency = d.currency as TrainingCurrency;

    const supabase = getSupabaseServer();
    const year = currentYear();

    // Re-validar server-side
    const { data: existing } = await supabase
      .from('training_requests')
      .select('status, cost_usd, budget_year')
      .eq('employee_id', auth.employee.id);
    const totalUsd = await getEffectiveBudget(supabase, auth.employee.id, year);
    const budget = { ...computeBudget(totalUsd, (existing ?? []).filter((r) => r.budget_year === year)), year };

    const evalResult = evaluateTrainingRequest({
      hireDate: auth.employee.hire_date ?? null,
      now: new Date(),
      budget,
      cost: d.cost,
      currency,
    });
    if (!evalResult.canRequest) {
      return NextResponse.json({ error: evalResult.reason ?? 'No cumple los requisitos.' }, { status: 400 });
    }

    const { data: created, error: insertError } = await supabase
      .from('training_requests')
      .insert({
        employee_id: auth.employee.id,
        budget_year: year,
        course_name: d.course_name,
        provider: d.provider || null,
        modality: d.modality || null,
        hours: d.hours ?? null,
        start_date: d.start_date || null,
        end_date: d.end_date || null,
        link: d.link || null,
        objective: d.objective || null,
        role_relation: d.role_relation || null,
        cost: d.cost,
        currency,
        cost_usd: currency === 'USD' ? d.cost : null, // ARS se fija al aprobar HR
        status: 'requested',
        leader_id: auth.employee.manager_id ?? null,
        created_by: auth.user.id,
      })
      .select('id')
      .single();

    if (insertError || !created) {
      return NextResponse.json({ error: insertError?.message ?? 'Error al crear' }, { status: 500 });
    }

    await supabase.from('training_request_events').insert({
      request_id: created.id,
      event_type: 'created',
      to_status: 'requested',
      actor_user_id: auth.user.id,
    });

    const employeeName = `${auth.employee.first_name ?? ''} ${auth.employee.last_name ?? ''}`.trim();

    // Notificar al líder (o admins si no hay líder). Aprobación 1 del flujo.
    const managerId = auth.employee.manager_id ?? null;
    (async () => {
      let approverIds: string[] = [];
      if (managerId) {
        const { data: mgr } = await supabase
          .from('employees')
          .select('user_id')
          .eq('id', managerId)
          .maybeSingle();
        if (mgr?.user_id) approverIds = [mgr.user_id];
      }
      if (approverIds.length === 0) approverIds = await getAdminUserIds();
      await createSystemNotification({
        userIds: approverIds,
        title: 'Nueva solicitud de capacitación',
        body: `${employeeName} solicitó "${d.course_name}" (${d.currency} ${d.cost}).`,
        deepLink: '/admin/training',
        dedupeKey: `training-new-${created.id}`,
      });
    })().catch((e) => console.error('[Training] approver notif failed:', e));

    const to = auth.employee.work_email || auth.employee.personal_email;
    if (to) {
      sendSimpleEmail({
        to,
        subject: 'Recibimos tu solicitud de capacitación',
        html: renderEmail({
          title: 'Recibimos tu solicitud de capacitación',
          contextLabel: 'People · Capacitaciones',
          badge: { tone: 'neutral', label: 'En revisión' },
          intro: `Hola ${auth.employee.first_name ?? ''}, registramos tu solicitud para "${d.course_name}". La revisa tu líder y luego People.`,
          details: [
            { label: 'Curso', value: d.course_name },
            { label: 'Costo', value: `${d.currency} ${d.cost}` },
          ],
          cta: { label: 'Ver mis capacitaciones', url: `${getAppUrl()}/portal/capacitaciones` },
        }),
      }).catch((e) => console.error('[Training] confirmation email failed:', e));
    }

    return NextResponse.json({ success: true, id: created.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
