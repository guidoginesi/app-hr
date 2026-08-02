import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { CATEGORY_LABELS, type InquiryCategory } from '@/lib/inquiries';

/** Mediana y p90: nunca promedio — una consulta olvidada 30 días lo destruye. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

// GET /api/admin/inquiries/stats?from=&to=
export async function GET(req: NextRequest) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseServer();
  const sp = new URL(req.url).searchParams;
  const from = sp.get('from');
  const to = sp.get('to');

  let query = supabase
    .from('inquiries_with_details')
    .select(
      'id, employee_id, employee_name, category, status, created_at, first_hr_response_at, first_response_due_at, resolved_at, reopen_count, parent_inquiry_id, topic_tag, sla_overdue',
    );
  if (from) query = query.gte('created_at', new Date(`${from}T00:00:00-03:00`).toISOString());
  if (to) query = query.lte('created_at', new Date(`${to}T23:59:59.999-03:00`).toISOString());

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const items = data ?? [];

  // ── Volumen por categoría ──
  const byCategory = new Map<string, { total: number; abiertas: number; resueltas: number }>();
  for (const i of items) {
    const c = byCategory.get(i.category) ?? { total: 0, abiertas: 0, resueltas: 0 };
    c.total++;
    if (['nueva', 'en_curso', 'esperando_colaborador'].includes(i.status)) c.abiertas++;
    if (['resuelta', 'cerrada'].includes(i.status)) c.resueltas++;
    byCategory.set(i.category, c);
  }

  // ── Tiempo de PRIMERA respuesta (en horas) ──
  const responseHours = items
    .filter((i: any) => i.first_hr_response_at)
    .map((i: any) => (new Date(i.first_hr_response_at).getTime() - new Date(i.created_at).getTime()) / 3_600_000)
    .sort((a: number, b: number) => a - b);

  const answered = items.filter((i: any) => i.first_hr_response_at);
  const onTime = answered.filter(
    (i: any) => i.first_response_due_at && new Date(i.first_hr_response_at) <= new Date(i.first_response_due_at),
  );

  // ── Recurrentes ──
  const reabiertas = items.filter((i: any) => (i.reopen_count ?? 0) > 0);
  const continuaciones = items.filter((i: any) => i.parent_inquiry_id);
  const porPersonaCategoria = new Map<string, { employee_name: string; category: string; total: number }>();
  for (const i of items) {
    const k = `${i.employee_id}|${i.category}`;
    const e = porPersonaCategoria.get(k) ?? { employee_name: i.employee_name, category: i.category, total: 0 };
    e.total++;
    porPersonaCategoria.set(k, e);
  }
  const repetidas = [...porPersonaCategoria.values()]
    .filter((r) => r.total >= 3)
    .sort((a, b) => b.total - a.total)
    .map((r) => ({ ...r, category_label: CATEGORY_LABELS[r.category as InquiryCategory] ?? r.category }));

  return NextResponse.json({
    total: items.length,
    abiertas: items.filter((i: any) => ['nueva', 'en_curso', 'esperando_colaborador'].includes(i.status)).length,
    vencidas: items.filter((i: any) => i.sla_overdue).length,
    por_categoria: [...byCategory.entries()]
      .map(([category, v]) => ({
        category,
        label: CATEGORY_LABELS[category as InquiryCategory] ?? category,
        ...v,
      }))
      .sort((a, b) => b.total - a.total),
    tiempo_respuesta: {
      respondidas: answered.length,
      mediana_horas: Math.round(percentile(responseHours, 50) * 10) / 10,
      p90_horas: Math.round(percentile(responseHours, 90) * 10) / 10,
      cumplimiento_sla_pct: answered.length ? Math.round((onTime.length / answered.length) * 100) : null,
      sin_responder: items.filter((i: any) => !i.first_hr_response_at).length,
    },
    recurrentes: {
      reabiertas: reabiertas.length,
      continuaciones: continuaciones.length,
      repetidas_por_persona: repetidas.slice(0, 10),
    },
  });
}
