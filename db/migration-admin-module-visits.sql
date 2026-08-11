-- Bullet de novedades en el sidebar del admin.
--
-- El punto se prende cuando entró algo NUEVO a un módulo desde la última vez
-- que esa persona lo abrió, y se apaga al entrar.
--
-- Por qué "desde la última visita" y no "todo lo pendiente": Reclutamiento
-- tiene hoy 496 postulaciones sin procesar (276 de ellas en búsquedas ya
-- cerradas). Con el criterio de "lo que está abierto", ese módulo quedaría con
-- el punto prendido para siempre, y un punto que nunca se apaga enseña a
-- ignorar todos los puntos.
--
-- Es por usuario: que Tini haya revisado las consultas no significa que
-- alguien más ya las vio.

CREATE TABLE IF NOT EXISTS public.admin_module_visits (
  user_id uuid NOT NULL,
  module_key text NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, module_key)
);
