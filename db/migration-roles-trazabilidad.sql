-- Roles y accesos: trazabilidad de quién otorgó cada rol.
--
-- `user_roles` sólo tenía `created_at`, sin autor. Los roles que se asignaron
-- hasta acá no dejan rastro de quién los dio — incluidos los dos `admin` que se
-- cargaron por SQL el 2026-08-03. Como `admin` habilita ver TODOS los sueldos y
-- liquidaciones, no saber quién lo entregó es un problema de gobierno, no un
-- detalle.
--
-- Nullable a propósito: las filas viejas no tienen autor y no se puede inventar.
-- On delete set null para no perder el rol si se borra la cuenta que lo otorgó.

alter table public.user_roles
  add column if not exists granted_by uuid references auth.users(id) on delete set null;

comment on column public.user_roles.granted_by is
  'Quién otorgó el rol. NULL en las filas anteriores a 2026-08-03 y en los roles que crea el sistema.';

-- Endurecimiento: los roles definen quién ve los sueldos, así que la escritura
-- tiene que ser exclusiva del service_role. Mismo criterio que
-- migration-payroll-receipt-hardening.sql.
revoke insert, update, delete on public.user_roles from anon, authenticated;

-- El GET de la pantalla cruza user_roles por usuario; el UNIQUE (user_id, role)
-- ya existe y cubre el lookup, así que no hace falta índice nuevo.
