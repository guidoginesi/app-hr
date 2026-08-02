-- Budget de capacitaciones editable desde el admin — endurecimiento.
--
-- Las tablas ya existían (migration-training-fund.sql) pero sin camino de
-- escritura: el GET leía los overrides y nadie los creaba. La feature funciona
-- sin correr esto (la app escribe con service_role sobre columnas que ya
-- existen); esta migración es la red de seguridad alrededor de esa escritura.
--
-- Sobre los permisos: ambas tablas tienen RLS activo y SOLO políticas de
-- lectura, así que hoy un INSERT/UPDATE con la anon key ya cae por falta de
-- política. El revoke explícito es defensa en profundidad — mismo criterio que
-- migration-payroll-receipt-hardening.sql — para que agregar una política de
-- lectura mañana no abra la escritura por accidente.

revoke insert, update, delete on public.training_budget_config from anon, authenticated;
revoke insert, update, delete on public.training_budget_overrides from anon, authenticated;

-- Un budget nunca puede ser negativo. Sin esto, un monto negativo dejaría el
-- disponible en 0 por el Math.max de computeBudget() y el error pasaría
-- inadvertido: la persona vería "USD 0 disponible" sin explicación.
-- La API ya lo valida; esto lo cierra también a nivel base.
do $$ begin
  alter table public.training_budget_overrides
    add constraint training_budget_overrides_amount_nonneg check (amount_usd >= 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.training_budget_config
    add constraint training_budget_config_default_nonneg check (default_amount_usd >= 0);
exception when duplicate_object then null; end $$;

-- Los overrides siempre se leen filtrando por año.
create index if not exists idx_tbo_year on public.training_budget_overrides (year);
