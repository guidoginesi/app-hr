-- Desglose de los recibos de relación de dependencia
--
-- Los importes de relación de dependencia sólo existen adentro del PDF. Esto
-- guarda lo que el parser saca de cada archivo para que la ruta de A&F no tenga
-- que abrir 72 PDFs en cada request.
--
-- Va como jsonb y no como tablas: la forma la define el contrato con A&F
-- (`rrdd.recibos[].conceptos[]`), el catálogo de conceptos lo decide la ley y
-- cambia con cada reforma de cargas sociales. Con columnas fijas, cada concepto
-- nuevo sería una migración; así es un dato más.

alter table public.payroll_payslips
  add column if not exists parsed       jsonb,
  add column if not exists parsed_at    timestamptz,
  add column if not exists parse_status text;

comment on column public.payroll_payslips.parsed is
  'Recibos leídos del PDF: totales, conceptos por código y qué se descartó. Lo produce src/lib/payslipParser.ts.';
comment on column public.payroll_payslips.parse_status is
  'OK = las identidades cerraron en todos los recibos. PARCIAL = se leyó pero algo no cierra o falta. ERROR = no se pudo leer.';

-- Para encontrar rápido lo que hay que volver a leer (recibos nuevos o de una
-- versión del parser anterior) sin recorrer toda la tabla.
create index if not exists idx_payroll_payslips_parse_status
  on public.payroll_payslips(parse_status)
  where parse_status is distinct from 'OK';
