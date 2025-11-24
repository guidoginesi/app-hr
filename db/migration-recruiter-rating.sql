-- Agregar campo de calificación del reclutador a la tabla applications
-- Rating de 1 a 5 estrellas

alter table public.applications 
add column if not exists recruiter_rating integer check (recruiter_rating >= 1 and recruiter_rating <= 5);

comment on column public.applications.recruiter_rating is 'Calificación del reclutador de 1 a 5 estrellas';

