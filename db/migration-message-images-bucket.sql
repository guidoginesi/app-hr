-- Bucket público para las carátulas de los mails de Comunicaciones.
-- Público porque las imágenes se muestran dentro de un mail y un cliente de
-- mail no puede pedir URLs firmadas. Sólo se sube desde
-- /api/admin/messages/cover (admin, con la service role); no hay policies de
-- escritura para usuarios autenticados.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('message-images', 'message-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;
