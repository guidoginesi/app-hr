-- Reintegros: motivos que no pasan por el líder.
--
-- Guardería es un beneficio con reglas fijas (tope mensual), no un gasto que el
-- líder tenga que evaluar. Pasar por su aprobación sólo lo demoraba: en
-- septiembre un pedido quedó trabado porque la líder estaba de vacaciones.
--
-- Con `requiere_lider = false`, el pedido nace listo para que Administración lo
-- valide. El resto de los motivos sigue igual.
--
-- Correr en el SQL Editor de Supabase. Es idempotente.

ALTER TABLE public.expense_reasons
  ADD COLUMN IF NOT EXISTS requiere_lider boolean NOT NULL DEFAULT true;

UPDATE public.expense_reasons
   SET requiere_lider = false
 WHERE name = 'Guardería';

-- Verificación: Guardería en false, el resto en true.
SELECT name, requiere_lider FROM public.expense_reasons ORDER BY sort_order;
