-- Fix: Actualizar el template de confirmación de aplicación con formato HTML
UPDATE public.email_templates
SET body = E'<p>Hola {{candidateName}},</p>\n\n<p>¡Gracias por postularte a la posición de <strong>{{jobTitle}}</strong> en POW!</p>\n\n<p>Hemos recibido tu CV y estamos revisando tu perfil. Nuestro equipo de Recursos Humanos evaluará tu postulación y nos pondremos en contacto contigo en caso de que tu perfil avance en el proceso de selección.</p>\n\n<p>Te mantendremos informado sobre el estado de tu aplicación.</p>\n\n<p>Apreciamos tu interés en formar parte de nuestro equipo.</p>\n\n<p>Saludos cordiales,<br>Equipo de Recursos Humanos<br>POW</p>',
    updated_at = now()
WHERE template_key = 'application_confirmation';

