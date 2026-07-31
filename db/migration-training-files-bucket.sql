-- Migration: bucket privado para archivos de Capacitaciones (factura + certificado)
-- Acceso restringido: subidas/lecturas van por API con service role + signed URLs.
insert into storage.buckets (id, name, public, file_size_limit)
values ('training-files', 'training-files', false, 10485760)
on conflict (id) do nothing;
