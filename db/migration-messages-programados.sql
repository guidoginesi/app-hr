-- Programar la fecha de envío de un mensaje al equipo.
--
-- `date` y no `timestamptz` a propósito: la programación es por DÍA, no por hora.
-- El envío sale en el lote de la mañana (el cron daily-automations, 09:00 UTC =
-- 06:00 en Argentina), el mismo momento en que ya salen los cumpleaños, el digest
-- de aprobaciones y los recordatorios de recibos. Guardar un timestamptz sugeriría
-- una precisión de hora que el sistema no da, y además obligaría a decidir en qué
-- zona se interpreta; con `date` la comparación se hace contra la fecha de hoy en
-- Argentina y no hay ambigüedad.
--
-- El mensaje programado sigue en status 'draft': se puede editar y se puede
-- publicar a mano antes de la fecha. Al publicarse, scheduled_for se limpia, así
-- que el cron no lo vuelve a tomar.

alter table public.messages
  add column if not exists scheduled_for date;

comment on column public.messages.scheduled_for is
  'Fecha (Argentina) en la que el cron de la mañana publica este borrador. NULL = sin programar.';

-- El cron busca borradores vencidos: índice parcial, porque las filas con
-- scheduled_for son una minoría frente al total de mensajes.
create index if not exists idx_messages_scheduled
  on public.messages (scheduled_for)
  where scheduled_for is not null and status = 'draft';
