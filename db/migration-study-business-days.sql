-- La licencia por estudio pasa a contarse en días HÁBILES.
--
-- Venía en 'calendar_days' desde el seed original, siguiendo el piso de la LCT
-- (art. 158: "2 días corridos por examen, máximo 10 por año calendario"). Pow
-- decide contarlos hábiles, que es más generoso: el fin de semana ya no consume
-- cupo. Pedir de viernes a lunes pasa a computar 2 días en vez de 4.
--
-- La descripción del tipo también decía "corridos" y quedaba contradiciendo al
-- sistema, así que se actualiza junto con la regla.
--
-- Las solicitudes ya cargadas NO se recalculan: days_requested se guarda al
-- crear la solicitud, así que conservan los días que se les computaron en su
-- momento. El cambio aplica de acá en adelante.

update public.leave_types
set count_type = 'business_days',
    description = '2 días hábiles por examen, máximo 10 días hábiles por año calendario'
where code = 'study';
