import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { parseMessageFilters, queryMessages, filteredMessageIds } from '@/lib/messagesQuery';
import { getEmailsForUserIds } from '@/lib/notificationService';

function cell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(cell).join(','));
  return '﻿' + lines.join('\r\n'); // BOM para acentos en Excel
}
function pct(n: number, total: number): string {
  return total > 0 ? `${Math.round((n / total) * 100)}%` : '';
}
const isAutomatic = (m: any) => m.type === 'system' || m?.metadata?.automated === true;

// GET /api/admin/messages/export?<mismos filtros>&granularity=messages|recipients
export async function GET(req: NextRequest) {
  const { isAdmin, user } = await requireAdmin();
  if (!isAdmin || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseServer();
  const { searchParams } = new URL(req.url);
  const filters = { ...parseMessageFilters(searchParams), limit: 5000, offset: 0 };
  const granularity = searchParams.get('granularity') === 'recipients' ? 'recipients' : 'messages';
  const stamp = new Date().toISOString().slice(0, 10);

  // Mapas de nombres para labels de audiencia
  const [{ data: depts }, { data: emps }] = await Promise.all([
    supabase.from('departments').select('id, name'),
    supabase.from('employees').select('id, user_id, first_name, last_name, work_email, personal_email'),
  ]);
  const deptName = new Map<string, string>((depts ?? []).map((d: any) => [d.id, d.name]));
  const empName = new Map<string, string>((emps ?? []).map((e: any) => [e.id, `${e.first_name} ${e.last_name}`.trim()]));

  const audienceLabel = (a: any): string => {
    if (!a) return 'Todos';
    if (a.all) return 'Todos';
    if (a.test) return 'Test';
    if (a.employment_type === 'monotributista') return 'Monotributo';
    if (a.employment_type === 'dependency') return 'Relación de dependencia';
    if (a.department_id) return `Área: ${deptName.get(a.department_id) ?? a.department_id}`;
    if (a.manager_id) return `Equipo de ${empName.get(a.manager_id) ?? a.manager_id}`;
    if (Array.isArray(a.user_ids)) return `${a.user_ids.length} persona(s)`;
    if (Array.isArray(a.roles)) return `Roles: ${a.roles.join(', ')}`;
    return 'Personalizado';
  };

  let csv: string;
  let filename: string;

  if (granularity === 'recipients') {
    const ids = await filteredMessageIds(supabase, filters);
    if (ids.length === 0) {
      csv = toCsv(['message_id', 'titulo', 'nombre', 'email', 'entregado', 'leido', 'confirmado', 'descartado'], []);
    } else {
      const { data: msgs } = await supabase.from('messages').select('id, title').in('id', ids);
      const titleById = new Map<string, string>((msgs ?? []).map((m: any) => [m.id, m.title]));
      const { data: recips } = await supabase
        .from('message_recipients')
        .select('message_id, user_id, delivered_at, read_at, confirmed_at, dismissed_at')
        .in('message_id', ids)
        .limit(20000);
      const empByUser = new Map<string, any>((emps ?? []).map((e: any) => [e.user_id, e]));
      const rows = (recips ?? []).map((r: any) => {
        const e = empByUser.get(r.user_id);
        return [
          r.message_id,
          titleById.get(r.message_id) ?? '',
          e ? `${e.first_name} ${e.last_name}`.trim() : '',
          e ? e.work_email || e.personal_email || '' : '',
          r.delivered_at ?? '',
          r.read_at ?? '',
          r.confirmed_at ?? '',
          r.dismissed_at ?? '',
        ];
      });
      csv = toCsv(['message_id', 'titulo', 'nombre', 'email', 'entregado', 'leido', 'confirmado', 'descartado'], rows);
    }
    filename = `mensajes_destinatarios_${stamp}.csv`;
  } else {
    const { items } = await queryMessages(supabase, filters);
    const creatorIds = [...new Set(items.map((m: any) => m.created_by).filter(Boolean))] as string[];
    const creators = creatorIds.length ? await getEmailsForUserIds(creatorIds) : [];
    const creatorEmail = new Map<string, string>(creators.map((c) => [c.userId, c.email]));

    const headers = [
      'id', 'titulo', 'origen', 'tipo', 'prioridad', 'estado', 'audiencia', 'requiere_confirmacion',
      'creado_por', 'creado_el', 'publicado_el', 'expira_el', 'destinatarios', 'leidos', 'leidos_pct',
      'confirmados', 'confirmados_pct',
    ];
    const rows = items.map((m: any) => [
      m.id,
      m.title,
      isAutomatic(m) ? 'Automático' : 'Manual',
      m.type === 'broadcast' ? 'Anuncio' : 'Sistema',
      m.priority,
      m.status,
      audienceLabel(m.audience),
      m.require_confirmation ? 'Sí' : 'No',
      m.created_by ? creatorEmail.get(m.created_by) ?? '' : '',
      m.created_at ?? '',
      m.published_at ?? '',
      m.expires_at ?? '',
      m.recipients_total,
      m.read_count,
      pct(m.read_count, m.recipients_total),
      m.confirmed_count,
      pct(m.confirmed_count, m.recipients_total),
    ]);
    csv = toCsv(headers, rows);
    filename = `mensajes_${stamp}.csv`;
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
