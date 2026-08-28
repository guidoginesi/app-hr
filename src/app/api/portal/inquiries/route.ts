import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { getAdminUserIds, createSystemNotification } from '@/lib/notificationService';
import { firstResponseDueAt, CATEGORY_LABELS, type InquiryCategory } from '@/lib/inquiries';
import { generarPropuestaDeConsulta } from '@/lib/manual/generarPropuestaDeConsulta';

const CreateSchema = z.object({
  category: z.enum(['sueldo', 'licencias', 'beneficios', 'adelantos', 'capacitaciones', 'certificados', 'otros']),
  subject: z.string().min(1, 'El asunto es requerido').max(200),
  description: z.string().min(1, 'Contanos tu consulta'),
});

// GET /api/portal/inquiries — mis consultas
export async function GET() {
  const auth = await getAuthResult();
  if (!auth.user || !auth.employee) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('inquiries_with_details')
    .select(
      'id, category, subject, status, created_at, last_activity_at, first_response_due_at, first_hr_response_at, closed_at, message_count',
    )
    .eq('employee_id', auth.employee.id)
    .order('last_activity_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

// POST /api/portal/inquiries — nueva consulta
export async function POST(req: NextRequest) {
  const auth = await getAuthResult();
  if (!auth.user || !auth.employee) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const parsed = CreateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((e) => e.message).join(', ') }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const employeeName = `${auth.employee.first_name ?? ''} ${auth.employee.last_name ?? ''}`.trim();

  const { data: inquiry, error } = await supabase
    .from('employee_inquiries')
    .insert({
      employee_id: auth.employee.id,
      user_id: auth.user.id,
      category: parsed.data.category,
      subject: parsed.data.subject.trim(),
      status: 'nueva',
      first_response_due_at: firstResponseDueAt().toISOString(),
    })
    .select('id, first_response_due_at')
    .single();

  if (error || !inquiry) {
    console.error('[inquiries] error creando consulta:', error);
    return NextResponse.json({ error: 'No se pudo crear la consulta' }, { status: 500 });
  }

  // El primer mensaje del hilo es la descripción.
  await supabase.from('inquiry_messages').insert({
    inquiry_id: inquiry.id,
    author_user_id: auth.user.id,
    author_role: 'employee',
    body: parsed.data.description.trim(),
  });

  await supabase.from('inquiry_events').insert({
    inquiry_id: inquiry.id,
    actor_user_id: auth.user.id,
    event_type: 'created',
    to_status: 'nueva',
  });

  // La propuesta de respuesta se arma sola, para que el borrador ya esté cuando
  // People abre la consulta en vez de tener que pedirlo y esperar.
  //
  // Sin await y con el error atajado: el colaborador no tiene por qué esperar a
  // que el agente lea el manual, y si el agente falla la consulta igual entra.
  generarPropuestaDeConsulta(inquiry.id as string).catch((e) =>
    console.error('[inquiries] no se pudo generar la propuesta:', e),
  );

  // Aviso a People. dedupeKey por consulta (evento irrepetible: el alta).
  const adminIds = await getAdminUserIds();
  await createSystemNotification({
    userIds: adminIds,
    title: 'Nueva consulta de un colaborador',
    body: `${employeeName} abrió una consulta de ${CATEGORY_LABELS[parsed.data.category as InquiryCategory]}: "${parsed.data.subject.trim()}"`,
    deepLink: '/admin/consultas',
    dedupeKey: `inquiry-new-${inquiry.id}`,
  }).catch((e) => console.error('[inquiries] notif alta falló:', e));

  return NextResponse.json({ id: inquiry.id, first_response_due_at: inquiry.first_response_due_at }, { status: 201 });
}
