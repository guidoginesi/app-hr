-- "Ya liquidada" pasa a ser por mes.
--
-- Era un booleano de la solicitud, y alcanzaba mientras una licencia viviera
-- entera dentro de un mes. Desde que las novedades se recortan al mes que se
-- liquida, una licencia del 24/8 al 6/9 son dos renglones que se liquidan en
-- meses distintos, y un solo booleano no puede decir "agosto sí, septiembre no".
--
-- Un renglón por (solicitud, mes) marcado. Sin renglón = sin liquidar.

create table if not exists public.leave_request_plus_paid_months (
  leave_request_id uuid not null references public.leave_requests(id) on delete cascade,
  year             int  not null,
  month            int  not null check (month between 1 and 12),
  marked_by        uuid references auth.users(id) on delete set null,
  marked_at        timestamptz not null default now(),
  primary key (leave_request_id, year, month)
);

alter table public.leave_request_plus_paid_months enable row level security;

drop policy if exists "plus meses read" on public.leave_request_plus_paid_months;
create policy "plus meses read" on public.leave_request_plus_paid_months
  for select using (exists (select 1 from public.user_roles ur
                             where ur.user_id = auth.uid() and ur.role in ('admin','administracion')));

drop policy if exists "plus meses admin manage" on public.leave_request_plus_paid_months;
create policy "plus meses admin manage" on public.leave_request_plus_paid_months
  for all using (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'))
  with check (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'));

-- Backfill: lo que estaba marcado se atribuye al mes donde arranca la licencia,
-- que es como se venía usando cuando el flag era uno solo.
insert into public.leave_request_plus_paid_months (leave_request_id, year, month)
select id, extract(year from start_date)::int, extract(month from start_date)::int
from public.leave_requests
where plus_paid
on conflict do nothing;

comment on table public.leave_request_plus_paid_months is
  'Meses en los que el plus de una licencia ya se liquidó. Reemplaza a leave_requests.plus_paid.';
comment on column public.leave_requests.plus_paid is
  'OBSOLETA: migrada a leave_request_plus_paid_months. No se lee ni se escribe.';
