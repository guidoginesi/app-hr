-- Un gasto puede tener más de un comprobante: la factura y el ticket, el pasaje
-- de ida y el de vuelta, el detalle y el resumen. Hasta ahora entraba uno solo y
-- el resto había que mandarlo por otro lado, que es donde se pierde.
--
-- Las columnas receipt_* de la solicitud se quedan apuntando al PRIMER archivo:
-- son las que usan la validación y los listados, y romperlas no aporta nada. La
-- tabla es la lista completa.

create table if not exists public.expense_reimbursement_files (
  id               uuid primary key default gen_random_uuid(),
  reimbursement_id uuid not null references public.expense_reimbursements(id) on delete cascade,
  storage_path     text not null,
  filename         text not null,
  size             integer,
  mime             text,
  created_at       timestamptz not null default now()
);

create index if not exists idx_erf_reimbursement
  on public.expense_reimbursement_files(reimbursement_id, created_at);

alter table public.expense_reimbursement_files enable row level security;

-- Lo mismo que ve el reintegro lo ve su lista de archivos: el solicitante, su
-- líder, admin y Administración.
drop policy if exists "archivos: lee quien ve el reintegro" on public.expense_reimbursement_files;
create policy "archivos: lee quien ve el reintegro" on public.expense_reimbursement_files
  for select using (
    exists (
      select 1
      from public.expense_reimbursements r
      left join public.employees e  on e.id = r.employee_id
      left join public.employees l  on l.id = r.leader_id
      where r.id = expense_reimbursement_files.reimbursement_id
        and (
          e.user_id = auth.uid()
          or l.user_id = auth.uid()
          or exists (select 1 from public.user_roles ur
                      where ur.user_id = auth.uid() and ur.role in ('admin','administracion'))
        )
    )
  );

drop policy if exists "archivos: gestiona admin" on public.expense_reimbursement_files;
create policy "archivos: gestiona admin" on public.expense_reimbursement_files
  for all using (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'))
  with check (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'));

-- Backfill: lo que ya existía pasa a ser el primer archivo de su reintegro.
insert into public.expense_reimbursement_files (reimbursement_id, storage_path, filename, size, mime, created_at)
select id, receipt_path, coalesce(receipt_filename, 'comprobante'), receipt_size, receipt_mime, created_at
from public.expense_reimbursements
where receipt_path is not null and receipt_path <> 'pendiente'
on conflict do nothing;

comment on table public.expense_reimbursement_files is
  'Comprobantes de un reintegro. El primero se espeja en las columnas receipt_* de la solicitud.';

-- La lista viaja con el reintegro: cuatro rutas leen esta vista con select('*')
-- —portal, líder, admin y detalle— y así la reciben las cuatro sin tocar
-- ninguna. La columna va al final porque CREATE OR REPLACE VIEW no deja
-- insertar en el medio.
-- (definición completa en la migración aplicada; acá sólo se documenta el agregado)
--   COALESCE((SELECT jsonb_agg(jsonb_build_object('id', f.id, 'filename', f.filename,
--                                                 'size', f.size, 'mime', f.mime)
--                              ORDER BY f.created_at)
--             FROM public.expense_reimbursement_files f
--             WHERE f.reimbursement_id = r.id), '[]'::jsonb) AS receipt_files
