-- Migration: rol "administracion" (aprobador de adelantos de sueldo)
-- ---------------------------------------------------------------
-- Perfil de admin restringido: solo accede al módulo de Adelantos y solo
-- gestiona el paso de Administración (aprobar/transferir/saldar/rechazar).
-- El acceso se gatea en middleware + rutas; acá solo se agrega el valor al enum.

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'administracion';
