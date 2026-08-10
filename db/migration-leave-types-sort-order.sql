-- Orden de los tipos de licencia en los selectores.
--
-- Venían ordenados alfabéticamente por nombre, que dejaba primero "Días Pow" y
-- último "Vacaciones" — sin relación con la frecuencia de uso ni con cómo se
-- agrupan mentalmente. Se agrega sort_order (mismo patrón que expense_reasons)
-- para fijar el orden del negocio en un solo lugar, en vez de repetirlo en cada
-- pantalla.
--
-- Orden definido por Guido: primero lo que se planifica y consume cupo, después
-- lo de modalidad de trabajo, y al final lo excepcional.
--   10 Vacaciones
--   20 Días Pow
--   30 Licencia por Estudio   ← no estaba en la lista original; se ubica con los
--                               otros dos que consumen cupo anual
--   40 Trabajo Remoto
--   50 Trabajo fuera de domicilio habitual
--   60 Licencia por enfermedad
--
-- El default 100 deja cualquier tipo nuevo al final hasta que se le asigne
-- posición, en vez de meterse en medio.

alter table public.leave_types
  add column if not exists sort_order integer not null default 100;

update public.leave_types set sort_order = 10 where code = 'vacation';
update public.leave_types set sort_order = 20 where code = 'pow_days';
update public.leave_types set sort_order = 30 where code = 'study';
update public.leave_types set sort_order = 40 where code = 'remote_work';
update public.leave_types set sort_order = 50 where code = 'remote_work_trip';
update public.leave_types set sort_order = 60 where code = 'sick';

comment on column public.leave_types.sort_order is
  'Orden en los selectores. Menor primero; 100 (default) deja los tipos nuevos al final.';
