// Builder de filtros compartido entre el listado admin de mensajes y el export CSV.
// Mantiene una sola fuente de verdad para parsear params y aplicarlos al query.

export type MessageOrigin = 'todos' | 'manuales' | 'automaticos';
export type MessageReadState = 'todos' | 'con_no_leidos' | 'todos_leidos';

export type MessageFilters = {
  q?: string;
  origin: MessageOrigin;
  priority?: 'info' | 'warning' | 'critical';
  status?: 'draft' | 'published' | 'archived';
  dateField: 'created_at' | 'published_at';
  from?: string; // ISO
  to?: string; // ISO (fin del día)
  readState: MessageReadState;
  recipient?: string; // user_id (auth)
  limit: number;
  offset: number;
};

const LIST_SELECT =
  'id, type, title, priority, require_confirmation, status, created_at, published_at, expires_at, scheduled_for, audience, created_by, metadata';

const NO_MATCH = '00000000-0000-0000-0000-000000000000';

function oneOf<T extends string>(v: string | null, allowed: readonly T[]): T | undefined {
  return allowed.includes(v as T) ? (v as T) : undefined;
}

export function parseMessageFilters(sp: URLSearchParams): MessageFilters {
  const get = (k: string) => sp.get(k) || undefined;
  const fromRaw = get('from');
  const toRaw = get('to');
  return {
    q: get('q'),
    origin: oneOf(sp.get('origin'), ['manuales', 'automaticos'] as const) ?? 'todos',
    priority: oneOf(sp.get('priority'), ['info', 'warning', 'critical'] as const),
    status: oneOf(sp.get('status'), ['draft', 'published', 'archived'] as const),
    dateField: oneOf(sp.get('dateField'), ['published_at'] as const) ?? 'created_at',
    from: fromRaw ? new Date(`${fromRaw}T00:00:00-03:00`).toISOString() : undefined,
    to: toRaw ? new Date(`${toRaw}T23:59:59.999-03:00`).toISOString() : undefined,
    readState: oneOf(sp.get('readState'), ['con_no_leidos', 'todos_leidos'] as const) ?? 'todos',
    recipient: get('recipient'),
    limit: Math.min(Math.max(parseInt(sp.get('limit') ?? '50', 10) || 50, 1), 200),
    offset: Math.max(parseInt(sp.get('offset') ?? '0', 10) || 0, 0),
  };
}

// Escapa comas y paréntesis que romperían la sintaxis de .or() de PostgREST.
function sanitize(term: string): string {
  // Quita separadores de .or() y comodines LIKE (% _) para tratarlos como literales.
  return term.replace(/[,()%_]/g, ' ').trim();
}

// Aplica los filtros a nivel columna sobre un query de supabase.from('messages').
// Los filtros por destinatario y por estado de lectura NO van acá (necesitan
// resolver sets de ids antes), se aplican en queryMessages.
export function applyColumnFilters(query: any, f: MessageFilters) {
  if (f.q) {
    const t = sanitize(f.q);
    if (t) query = query.or(`title.ilike.%${t}%,body.ilike.%${t}%`);
  }
  if (f.origin === 'manuales') {
    query = query.eq('type', 'broadcast').or('metadata->>automated.is.null,metadata->>automated.neq.true');
  } else if (f.origin === 'automaticos') {
    query = query.or('type.eq.system,metadata->>automated.eq.true');
  }
  if (f.priority) query = query.eq('priority', f.priority);
  if (f.status) query = query.eq('status', f.status);
  if (f.from) query = query.gte(f.dateField, f.from);
  if (f.to) query = query.lte(f.dateField, f.to);
  return query;
}

// Resuelve los ids de mensajes que matchean destinatario / estado de lectura.
async function idFilters(supabase: any, f: MessageFilters): Promise<string[] | null> {
  const sets: Set<string>[] = [];
  if (f.recipient) {
    const { data, error } = await supabase.from('message_recipients').select('message_id').eq('user_id', f.recipient);
    if (error) throw new Error(error.message);
    sets.push(new Set((data ?? []).map((r: any) => r.message_id as string)));
  }
  if (f.readState !== 'todos') {
    const col = f.readState === 'con_no_leidos' ? 'has_unread' : 'fully_read';
    const { data, error } = await supabase.from('message_metrics').select('message_id').eq(col, true);
    if (error) throw new Error(error.message);
    sets.push(new Set((data ?? []).map((r: any) => r.message_id as string)));
  }
  if (sets.length === 0) return null;
  // intersección de todos los sets
  return [...sets.reduce((acc, s) => new Set([...acc].filter((x) => s.has(x))))];
}

export async function queryMessages(
  supabase: any,
  f: MessageFilters,
): Promise<{ items: any[]; total: number }> {
  let query = applyColumnFilters(supabase.from('messages').select(LIST_SELECT, { count: 'exact' }), f);

  const ids = await idFilters(supabase, f);
  if (ids !== null) query = query.in('id', ids.length ? ids : [NO_MATCH]);

  query = query.order('created_at', { ascending: false }).range(f.offset, f.offset + f.limit - 1);
  const { data: messages, count, error } = await query;
  if (error) throw new Error(error.message);

  const msgIds = (messages ?? []).map((m: any) => m.id);
  const metricsByMsg = new Map<string, any>();
  if (msgIds.length) {
    const { data: metrics, error: mErr } = await supabase.from('message_metrics').select('*').in('message_id', msgIds);
    if (mErr) throw new Error(mErr.message);
    for (const m of metrics ?? []) metricsByMsg.set(m.message_id, m);
  }
  const items = (messages ?? []).map((m: any) => {
    const mt = metricsByMsg.get(m.id);
    return {
      ...m,
      recipients_total: mt?.recipients_total ?? 0,
      read_count: mt?.read_count ?? 0,
      confirmed_count: mt?.confirmed_count ?? 0,
    };
  });
  return { items, total: count ?? 0 };
}

// Devuelve los ids de mensajes que matchean los filtros, sin paginación (para export).
export async function filteredMessageIds(supabase: any, f: MessageFilters, cap = 5000): Promise<string[]> {
  let query = applyColumnFilters(supabase.from('messages').select('id'), f);
  const ids = await idFilters(supabase, f);
  if (ids !== null) query = query.in('id', ids.length ? ids : [NO_MATCH]);
  query = query.order('created_at', { ascending: false }).limit(cap);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((m: any) => m.id as string);
}
