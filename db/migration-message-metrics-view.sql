-- Métricas de mensajes: vista agregada por mensaje (para filtros de lectura y
-- para evitar escanear todos los recipients en cada carga del listado admin).
create index if not exists idx_message_recipients_user on public.message_recipients(user_id);

create or replace view public.message_metrics as
  select mr.message_id,
    count(*)::int             as recipients_total,
    count(mr.read_at)::int    as read_count,
    count(mr.confirmed_at)::int as confirmed_count,
    bool_or(mr.read_at is null)      as has_unread,
    bool_and(mr.read_at is not null) as fully_read
  from public.message_recipients mr
  group by mr.message_id;
