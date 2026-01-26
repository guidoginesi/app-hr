-- Migration: Bulk Load Employees - Pow S.A.
-- Generated from employees_bulk_template.csv
-- Run this in the Supabase SQL Editor

-- ==========================================
-- 1. Create Legal Entity: Pow S.A.
-- ==========================================
INSERT INTO public.legal_entities (id, name, country, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'Pow S.A.', 'Argentina', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, country = EXCLUDED.country;

-- ==========================================
-- 2. Create Departments
-- ==========================================
INSERT INTO public.departments (id, name, legal_entity_id, is_active) VALUES
  ('10000000-0000-0000-0000-000000000001', 'CX', '00000000-0000-0000-0000-000000000001', true),
  ('10000000-0000-0000-0000-000000000002', 'HR', '00000000-0000-0000-0000-000000000001', true),
  ('10000000-0000-0000-0000-000000000003', 'Digital Marketing', '00000000-0000-0000-0000-000000000001', true),
  ('10000000-0000-0000-0000-000000000004', 'IT', '00000000-0000-0000-0000-000000000001', true),
  ('10000000-0000-0000-0000-000000000005', 'Sales & Mkt', '00000000-0000-0000-0000-000000000001', true),
  ('10000000-0000-0000-0000-000000000006', 'Growth Strategy', '00000000-0000-0000-0000-000000000001', true),
  ('10000000-0000-0000-0000-000000000007', 'Product', '00000000-0000-0000-0000-000000000001', true),
  ('10000000-0000-0000-0000-000000000008', 'Directorio', '00000000-0000-0000-0000-000000000001', true),
  ('10000000-0000-0000-0000-000000000009', 'Product Design', '00000000-0000-0000-0000-000000000001', true),
  ('10000000-0000-0000-0000-000000000010', 'Adm. & Finance', '00000000-0000-0000-0000-000000000001', true),
  ('10000000-0000-0000-0000-000000000011', 'Business Intelligence', '00000000-0000-0000-0000-000000000001', true),
  ('10000000-0000-0000-0000-000000000012', 'Undo', '00000000-0000-0000-0000-000000000001', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- ==========================================
-- 3. Insert Employees
-- ==========================================
-- Note: manager_id will be updated in step 4 after all employees exist

INSERT INTO public.employees (
  id, first_name, last_name, personal_email, work_email, hire_date, status,
  dni, cuil, birth_date, phone, nationality, marital_status,
  address, city, postal_code, country,
  education_level, education_title, languages,
  job_title, seniority_level, legal_entity_id, department_id,
  emergency_contact_relationship, emergency_contact_first_name, 
  emergency_contact_last_name, emergency_contact_phone, emergency_contact_address,
  is_studying
) VALUES

-- 1. Agustina Falvino
('20000000-0000-0000-0000-000000000001', 'Agustina', 'Falvino', 
 'agusfalvino5@gmail.com', 'agustina.falvino@pow.la', '2024-09-01', 'active',
 '42649778', '27426497781', '2000-06-05', '1130191501', 'Argentina', 'single',
 'Avenida Mosconi 2438', 'CABA', '1419', 'Argentina',
 'Secundario', NULL, 'Español (nativo) Inglés (avanzado)',
 'Asistente Customer Success', '1.3', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
 'Madre', 'María', 'Pérez', '+54 11 9876-5432', 'Av. Rivadavia 5678 Buenos Aires',
 false),

-- 2. Agustina Martinez Marques
('20000000-0000-0000-0000-000000000002', 'Agustina', 'Martínez Marqués', 
 'agustinamarques97@gmail.com', 'agustina.marques@pow.la', '2025-06-02', 'active',
 '40128549', '27401285496', '1997-04-21', '1158026480', 'Argentina', 'single',
 'Manuela Pedraza 1878, 2B', 'CABA', '1429', 'Argentina',
 'Posgrado', 'Especialista en Comunicación Corporativa', NULL,
 'HR Manager', '3.1', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 3. Alicia Prats
('20000000-0000-0000-0000-000000000003', 'Alicia', 'Prats', 
 'aliciapratsv@gmail.com', 'alicia@pow.la', '2021-10-18', 'active',
 '33761464', '27337614642', '1988-09-20', '261156640792', 'Argentina', 'single',
 'Manzanares 1609, piso 12 depto 5', 'CABA', '1429', 'Argentina',
 'Master', 'Especialista en Dirección Estratégica de Marketing', NULL,
 'Digital Marketing Manager', '3.3', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 4. Andrea Soteldo
('20000000-0000-0000-0000-000000000004', 'Andrea', 'Soteldo', 
 'andrea.soteldo@gmail.com', 'andrea@pow.la', '2023-06-26', 'active',
 '96013437', '27960134376', '2001-04-06', '1124792648', 'Venezolana', 'single',
 'Av. La Plata 236, piso 4 depto B. Caballito', 'CABA', '1184', 'Argentina',
 'Universitario', NULL, NULL,
 'Dev. Front-End', '1.4', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 5. Andrés Jaromezuk
('20000000-0000-0000-0000-000000000005', 'Andrés', 'Jaromezuk', 
 'andres.jaromezuk@gmail.com', 'andres.jaromezuk@pow.la', '2023-02-01', 'active',
 '29946689', '20299466893', '1983-03-04', '1149471320', 'Argentina', 'single',
 'Valentín Gómez 3550, 3°B, Almagro', 'CABA', '1191', 'Argentina',
 'Universitario', 'Licenciatura en Historia', NULL,
 'Dev. Back-End', '2.4', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 6. Andrés Acerenza
('20000000-0000-0000-0000-000000000006', 'Andres Pedro', 'Acerenza', 
 'andresacerenza@hotmail.com', 'andres@pow.la', '2021-01-03', 'active',
 '32594159', '20325941597', '1986-09-21', '1168028417', 'Argentina', 'married',
 'Roseti 1526, Villa Ortuzar', 'CABA', '1427', 'Argentina',
 'Universitario', 'Licenciatura en Administracion de Empresas', NULL,
 'Sales Manager', '5.1', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 7. Antonella Medone
('20000000-0000-0000-0000-000000000007', 'Antonella', 'Medone', 
 'antomedone@gmail.com', 'antonella@pow.la', '2021-11-23', 'active',
 '36538386', '27365383869', '1992-02-14', '1167132812', 'Argentina', 'single',
 'Riglos 150 Piso 11 C', 'CABA', '1424', 'Argentina',
 'Secundario', NULL, NULL,
 'Growth Strategy Manager', '3.4', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000006',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 8. Benjamín Kunkel
('20000000-0000-0000-0000-000000000008', 'Benjamin Ariel', 'Bernardo Kunkel', 
 'kunkelbenjamin08@gmail.com', 'benjamin@pow.la', '2020-07-09', 'active',
 '39485986', '23394859869', '1996-07-08', '2342505952', 'Argentina', 'single',
 'Calle 61 numero 522 piso 1 departamento 6, ciudad La Plata', 'Buenos Aires', '1900', 'Argentina',
 'Secundario', NULL, NULL,
 'Dev. Front-End', '3.1', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 9. Brenda Melink
('20000000-0000-0000-0000-000000000009', 'Brenda', 'Melink', 
 'brendamelink@gmail.com', 'brenda@pow.la', '2021-12-07', 'active',
 '38070440', '23380704404', '1994-02-11', '1163073813', 'Argentina', 'single',
 'Gral. Cesar Diaz 5126, Planta Alta', 'CABA', '1407', 'Argentina',
 'Universitario', 'Licenciatura en Gestión de Medios y Entretenimiento', NULL,
 'Paid Media Specialist', '2.3', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 10. Candela Paratcha
('20000000-0000-0000-0000-000000000010', 'Candela', 'Paratcha', 
 'candelaparatcha01@gmail.com', 'candela@pow.la', '2025-02-18', 'active',
 '43584810', '27435848104', '2001-07-06', '1169607531', 'Argentina', 'single',
 'Gral. Juan Lavalle 421. Ituzaingó', 'Buenos Aires', '1714', 'Argentina',
 'Universitario', 'Licenciada en Comercialización', NULL,
 'Analista de Marketing Digital', '2.1', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 11. Carlos Caserotto
('20000000-0000-0000-0000-000000000011', 'Carlos Federico', 'Caserotto', 
 'carlos.caserotto@yahoo.com', 'carlos@pow.la', '2024-03-04', 'active',
 '27080635', '20270806350', '1979-01-30', '1552601637', 'Argentina', 'married',
 'Gavilan 804', 'CABA', '1406', 'Argentina',
 'Master', 'MBA', NULL,
 'Tech Lead Hermés', '3.1', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 12. Dafne Zas
('20000000-0000-0000-0000-000000000012', 'Dafne Antonella', 'Zas Amy', 
 'dafnezas@gmail.com', 'dafne@pow.la', '2019-05-20', 'active',
 '38027103', '27380271031', '1994-02-28', '1164924032', 'Argentina', 'single',
 'Aranguren 2948, Piso 4, Dpto 17', 'CABA', '1406', 'Argentina',
 'Secundario', NULL, NULL,
 'Team Leader Producto Vtex & Shopify', '2.4', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 13. Delfina Felice
('20000000-0000-0000-0000-000000000013', 'Delfina', 'Felice', 
 'delfinafelice.del@gmail.com', 'delfina@pow.la', '2023-08-28', 'active',
 '39162785', '27391627857', '1995-11-10', '2284631868', 'Argentina', 'single',
 'Alberdi, 1227, Casa, Tandil', 'Buenos Aires', '7000', 'Argentina',
 'Universitario', 'Ingeniera Industrial', NULL,
 'Product Analyst', '1.2', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 14. Emiliano Gioia
('20000000-0000-0000-0000-000000000014', 'Emiliano', 'Gioia', 
 'emiliano@gioia.com.ar', 'emiliano@pow.la', '2023-02-01', 'active',
 '38707126', '20387071262', '1994-11-24', '1136665506', 'Argentina', 'single',
 'Valle 553 3oF, Caballito', 'CABA', '1424', 'Argentina',
 'Universitario', 'Licenciado en Diseño Gráfico', NULL,
 'Developer Front End Ssr. VTEX', '2.4', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 15. Florencia Virdó
('20000000-0000-0000-0000-000000000015', 'Florencia Reneé', 'Virdó Lauricella', 
 'florencia.virdo@gmail.com', 'florencia@pow.la', '2023-07-24', 'active',
 '33761696', '27337616963', '1988-11-03', '2616965589', 'Argentina', 'single',
 'Mariano Moreno, 415', 'Mendoza', '5500', 'Argentina',
 'Universitario', 'Licenciada en Administración', NULL,
 'Paid Media Specialist', '2.1', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 16. Franco Panaro
('20000000-0000-0000-0000-000000000016', 'Franco', 'Panaro', 
 'francogpanaro@gmail.com', 'franco@pow.la', '2025-01-12', 'active',
 '39353213', '20393532131', '1995-10-12', '1140605050', 'Argentina', 'single',
 'Charlone 917, 4B Villa Ortuzar', 'CABA', '1427', 'Argentina',
 'Universitario', 'Licenciatura en Publicidad', NULL,
 'Marketing Analyst', '3.2', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 17. Giovanna Maratta
('20000000-0000-0000-0000-000000000017', 'Giovanna Sol', 'Maratta', 
 'giovi.maratta@gmail.com', 'giovanna@pow.la', '2022-02-03', 'active',
 '39008256', '27390082563', '1995-10-05', '2646292572', 'Argentina', 'single',
 'Amenabar, 1809, 4C, Belgrano', 'CABA', '1426', 'Argentina',
 'Universitario', 'Ingeniero Industrial', NULL,
 'Product Manager', '3.2', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 18. Guido Ginesi (CEO) - OMITIDO: ya existe en el sistema con guido@pow.la

-- 19. Karen Aranda (work_email: ivan@pow.la - parece error en CSV)
('20000000-0000-0000-0000-000000000019', 'Karen Ayelen', 'Aranda', 
 'karen.aranda@outlook.com.ar', 'karen.aranda@pow.la', '2021-09-11', 'active',
 '38147197', '27381471972', '1994-03-03', '1162782839', 'Argentina', 'single',
 'Joaquin V Gonzalez 2151 7A', 'CABA', '1417', 'Argentina',
 'Universitario', NULL, NULL,
 'Growht Specialist', '2.4', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000006',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 20. Lucia Desgens (work_email: karen@pow.la - parece error en CSV)
('20000000-0000-0000-0000-000000000020', 'Lucía', 'Desgens Berenguer', 
 'luchidesgens@gmail.com', 'lucia.desgens@pow.la', '2023-02-05', 'active',
 '37494146', '20374941467', '1994-05-24', '2645857779', 'Argentina', 'single',
 '25 de Mayo 855 (O), Edificio Reina Sofía, Depto 4', 'San Juan', '5400', 'Argentina',
 'Master', 'Master en Gestión de la Innovación y Diseño Industrial', NULL,
 'Product Analyst', '1.4', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 21. Luciana Medina (work_email: lucia.desgens@pow.la - parece error en CSV)
('20000000-0000-0000-0000-000000000021', 'Luciana', 'Medina', 
 'luucianamedina1997@gmail.com', 'luciana.medina@pow.la', '2025-12-08', 'active',
 '43895966', '27438959667', '1997-09-18', '1157212032', 'Argentina', 'single',
 'Carlos tejedor 1421 6G, Haedo', 'Buenos Aires', '1706', 'Argentina',
 'Universitario', NULL, NULL,
 'Analista de Marketing Digital', '2.1', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 22. Manuel Alvarez (work_email: luciana@pow.la - parece error en CSV)
('20000000-0000-0000-0000-000000000022', 'Manuel', 'Alvarez', 
 'manuelalvarezsuarez12@gmail.com', 'manuel.alvarez@pow.la', '2022-02-14', 'active',
 '40130639', '20401306391', '1997-01-14', '2266416155', 'Argentina', 'single',
 'Virrey Loreto 1546 2/B', 'CABA', '1426', 'Argentina',
 'Universitario', NULL, NULL,
 'Analista CX', '1.4', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 23. Manuela Heine (work_email: manuel@pow.la - parece error en CSV)
('20000000-0000-0000-0000-000000000023', 'Manuela', 'Heine Galli', 
 'mheinegalli@gmail.com', 'manuela.heine@pow.la', '2020-02-11', 'active',
 '39459755', '23394597554', '1996-01-21', '1167359535', 'Argentina', 'single',
 'Bolivia 1044, Depto 2', 'CABA', '1406', 'Argentina',
 'Universitario', NULL, NULL,
 'Asistente Administración', '1.2', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000010',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 24. Paula Perez (work_email: manuela@pow.la - parece error en CSV)
('20000000-0000-0000-0000-000000000024', 'Maria Paula', 'Perez Ortiz', 
 'mpaulaperez96@gmail.com', 'paula.perez@pow.la', '2022-12-09', 'active',
 '39653113', '27396531130', '1996-06-23', '2645240088', 'Argentina', 'single',
 'V.Nucce 1575 oeste', 'San Juan', '5400', 'Argentina',
 'Universitario', 'Ingeniero Industrial', NULL,
 'Lider Implementaciones', '2.4', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 25. Martín Becerra
('20000000-0000-0000-0000-000000000025', 'Martin Eduardo', 'Becerra', 
 'martinbecerra1992@gmail.com', 'martin.becerra@pow.la', '2022-12-09', 'active',
 '38752001', '20387520016', '1992-11-20', '2645054323', 'Argentina', 'single',
 'Avenida Libertador 521 oeste, 2C', 'San Juan', '5400', 'Argentina',
 'Universitario', 'Ingeniero Industrial', NULL,
 'Data Strategist', '2.4', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000011',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 26. Micaela Morghen
('20000000-0000-0000-0000-000000000026', 'Micaela', 'Morghen', 
 'micaelamorghen@gmail.com', 'micaela@pow.la', '2023-02-01', 'active',
 '37327627', '27373276273', '1992-11-24', '1553187992', 'Argentina', 'single',
 'Avenida San Martín, 4970, 8c', 'CABA', '1417', 'Argentina',
 'Universitario', 'Diseñadora Gráfica', NULL,
 'UX/UI Designer', '2.1', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000009',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 27. Nahiara Alvez
('20000000-0000-0000-0000-000000000027', 'Nahiara', 'Alvez', 
 'nahi.alvez@gmail.com', 'nahiara@pow.la', '2023-07-08', 'active',
 '44107960', '27441079600', '2002-04-15', '1166454642', 'Argentina', 'single',
 'General Hornos 2667, Caseros', 'Buenos Aires', '1678', 'Argentina',
 'Universitario', NULL, NULL,
 'Asistente Administración', '1.2', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000010',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 28. Natalia Cabezas
('20000000-0000-0000-0000-000000000028', 'Natalia', 'Cabezas', 
 'nataliadanielacabezas@gmail.com', 'natalia@pow.la', '2024-05-02', 'active',
 '41106741', '27411067411', '1998-04-07', '1163077080', 'Argentina', 'single',
 'Av jujuy 1717 5 508 Parque Patricios', 'CABA', '1258', 'Argentina',
 'Universitario', NULL, NULL,
 'CX', '2.1', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 29. Ornella Lacelli
('20000000-0000-0000-0000-000000000029', 'Ornella', 'Lacelli', 
 'ornellalacelli@gmail.com', 'ornella@pow.la', '2022-02-03', 'active',
 '39509973', '27395099731', '1996-03-30', '2345685962', 'Argentina', 'single',
 'Pte. Perón 735, Gral. Alvear', 'Buenos Aires', '7263', 'Argentina',
 'Universitario', 'Ingeniera Industrial', NULL,
 'Product Analyst', '2.1', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 30. Rodrigo Plutino
('20000000-0000-0000-0000-000000000030', 'Rodrigo', 'Plutino', 
 'rodrigoivanplutino@gmail.com', 'rodrigo@pow.la', '2021-01-02', 'active',
 '42367598', '20423675986', '2000-02-09', '1173675464', 'Argentina', 'single',
 'General Bernardo O''higgins 2128 4A, Lanús Este', 'Buenos Aires', '1824', 'Argentina',
 'Universitario', NULL, NULL,
 'Dev. Back-End', '2.1', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 31. Rosario Otero
('20000000-0000-0000-0000-000000000031', 'Rosario', 'Otero', 
 'rosariotero18@gmail.com', 'rosario@pow.la', '2022-06-28', 'active',
 '40422028', '23404220284', '1997-06-18', '3772525977', 'Argentina', 'single',
 'Avenida Rivadavia 5126, Piso 19, Depto 8.', 'CABA', '1424', 'Argentina',
 'Universitario', 'Diseño gráfico', NULL,
 'UX/UI Designer', '1.4', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000009',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 32. Ruben Mavarez
('20000000-0000-0000-0000-000000000032', 'Ruben', 'Mavarez', 
 'rubene250@gmail.com', 'ruben@pow.la', '2024-02-01', 'active',
 '95964258', '20959642584', '1996-10-05', '1138259632', 'Venezolana', 'single',
 'Hidalgo 1637, 3B. Villa Crespo', 'CABA', '1414', 'Argentina',
 'Secundario', NULL, NULL,
 'Dev. Front-End', '3.1', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 33. Valeria Crespo (birth_date formato diferente en CSV: 12/21/1991)
('20000000-0000-0000-0000-000000000033', 'Valeria', 'Crespo', 
 'valeriaccrespo@gmail.com', 'valeria@pow.la', '2017-10-17', 'active',
 '35803896', '23358038964', '1991-12-21', NULL, 'Argentina', 'single',
 'Barrio Castaños, lote 360, Nordelta', 'Buenos Aires', '1670', 'Argentina',
 NULL, NULL, NULL,
 'Product Analyst', '2.1', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 34. Patricio Messia
('20000000-0000-0000-0000-000000000034', 'Patricio', 'Messia', 
 'patricio.messia@pow.la', 'patricio@pow.la', NULL, 'active',
 NULL, NULL, NULL, NULL, 'Argentina', 'single',
 'Echeverria 3105, piso 9A', 'CABA', '1428', 'Argentina',
 NULL, NULL, NULL,
 'CEO', '3.1', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000012',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 35. Martin Krieger (CTO)
('20000000-0000-0000-0000-000000000035', 'Martin', 'Krieger', 
 'martin.krieger@pow.la', 'martin@pow.la', NULL, 'active',
 NULL, NULL, NULL, NULL, 'Argentina', 'single',
 'Barrio Castaños, lote 360, Nordelta', 'Buenos Aires', '1670', 'Argentina',
 NULL, NULL, NULL,
 'CTO', '5.3', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000008',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 36. Corvalán Sergio (Finances Manager)
('20000000-0000-0000-0000-000000000036', 'Sergio', 'Estanciero Corvalan', 
 'sergio.ubafce@gmail.com', 'sergio@pow.la', '2019-05-20', 'active',
 NULL, NULL, NULL, NULL, 'Argentina', 'single',
 'Pichincha 649, 7 D. Balvanera', 'CABA', '1219', 'Argentina',
 NULL, NULL, NULL,
 'Finances Manager', '3.3', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000010',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 37. Eric Hoare
('20000000-0000-0000-0000-000000000037', 'Eric', 'Hoare', 
 'eric.hoare@pow.la', 'eric@pow.la', '2021-03-05', 'active',
 NULL, NULL, NULL, NULL, 'Argentina', 'single',
 'Maquinista Carregal, 1985, Vicente Lopez', 'Buenos Aires', '1602', 'Argentina',
 NULL, NULL, NULL,
 'Dev. Front-End', '2.1', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 38. Fernanda Pezzuti (Líder Front-End)
('20000000-0000-0000-0000-000000000038', 'Maria Fernanda', 'Pezzuti', 
 'fernanda.pezzuti@pow.la', 'fernanda@pow.la', '2021-03-05', 'active',
 NULL, NULL, NULL, NULL, 'Argentina', 'single',
 'General Ocampo, 887, 2, Villa Luzuriaga', 'Buenos Aires', '1754', 'Argentina',
 NULL, NULL, NULL,
 'Líder Front-End', '3.4', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004',
 NULL, NULL, NULL, NULL, NULL,
 false),

-- 39. Ivan Sosa
('20000000-0000-0000-0000-000000000039', 'Ivan', 'Sosa', 
 'ivan.sosa@pow.la', 'ivan@pow.la', '2021-08-23', 'active',
 NULL, NULL, NULL, NULL, 'Argentina', 'single',
 'Combatientes de malvinas 3970 6B.', 'CABA', '1431', 'Argentina',
 NULL, NULL, NULL,
 'Dev. Front-End', '1.4', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004',
 NULL, NULL, NULL, NULL, NULL,
 false)

ON CONFLICT (id) DO UPDATE SET 
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  personal_email = EXCLUDED.personal_email,
  work_email = EXCLUDED.work_email,
  hire_date = EXCLUDED.hire_date,
  status = EXCLUDED.status,
  dni = EXCLUDED.dni,
  cuil = EXCLUDED.cuil,
  birth_date = EXCLUDED.birth_date,
  phone = EXCLUDED.phone,
  nationality = EXCLUDED.nationality,
  marital_status = EXCLUDED.marital_status,
  address = EXCLUDED.address,
  city = EXCLUDED.city,
  postal_code = EXCLUDED.postal_code,
  country = EXCLUDED.country,
  education_level = EXCLUDED.education_level,
  education_title = EXCLUDED.education_title,
  languages = EXCLUDED.languages,
  job_title = EXCLUDED.job_title,
  seniority_level = EXCLUDED.seniority_level,
  legal_entity_id = EXCLUDED.legal_entity_id,
  department_id = EXCLUDED.department_id,
  emergency_contact_relationship = EXCLUDED.emergency_contact_relationship,
  emergency_contact_first_name = EXCLUDED.emergency_contact_first_name,
  emergency_contact_last_name = EXCLUDED.emergency_contact_last_name,
  emergency_contact_phone = EXCLUDED.emergency_contact_phone,
  emergency_contact_address = EXCLUDED.emergency_contact_address,
  is_studying = EXCLUDED.is_studying;

-- ==========================================
-- 4. Update Manager Relationships
-- ==========================================
-- Nota: Guido Ginesi (guido@pow.la) ya existe en el sistema, lo buscamos por work_email

-- Martin Krieger (CTO) reports to Guido
UPDATE public.employees SET manager_id = (SELECT id FROM public.employees WHERE work_email = 'guido@pow.la' LIMIT 1) WHERE id = '20000000-0000-0000-0000-000000000035';

-- Directorio/C-Level reports to Guido
UPDATE public.employees SET manager_id = (SELECT id FROM public.employees WHERE work_email = 'guido@pow.la' LIMIT 1) WHERE work_email IN (
  'andres@pow.la',       -- Sales Manager -> guido@pow.com
  'alicia@pow.la',       -- Digital Marketing Manager -> guido@pow.com
  'giovanna@pow.la',     -- Product Manager -> guido@pow.com
  'sergio@pow.la'        -- Finances Manager -> guido@pow.com
);

-- Patricio Messia (Undo CEO) reports to Guido
UPDATE public.employees SET manager_id = (SELECT id FROM public.employees WHERE work_email = 'guido@pow.la' LIMIT 1) WHERE id = '20000000-0000-0000-0000-000000000034';

-- Antonella Medone (Growth Strategy Manager) - reports to Guido
UPDATE public.employees SET manager_id = (SELECT id FROM public.employees WHERE work_email = 'guido@pow.la' LIMIT 1) WHERE id = '20000000-0000-0000-0000-000000000007';

-- CX team reports to Antonella
UPDATE public.employees SET manager_id = '20000000-0000-0000-0000-000000000007' WHERE work_email IN (
  'agustina.falvino@pow.la',  -- Asistente Customer Success
  'natalia@pow.la'            -- CX
);

-- HR reports to Guido
UPDATE public.employees SET manager_id = (SELECT id FROM public.employees WHERE work_email = 'guido@pow.la' LIMIT 1) WHERE work_email = 'agustina.marques@pow.la';

-- Digital Marketing team reports to Alicia
UPDATE public.employees SET manager_id = '20000000-0000-0000-0000-000000000003' WHERE work_email IN (
  'brenda@pow.la',       -- Paid Media Specialist
  'candela@pow.la',      -- Analista de Marketing Digital
  'florencia@pow.la',    -- Paid Media Specialist
  'luciana.medina@pow.la' -- Analista de Marketing Digital
);

-- IT team - Tech Lead Carlos reports to Martin Krieger
UPDATE public.employees SET manager_id = '20000000-0000-0000-0000-000000000035' WHERE work_email IN (
  'carlos@pow.la',       -- Tech Lead Hermés
  'fernanda@pow.la'      -- Líder Front-End
);

-- IT team reports to Carlos (Backend)
UPDATE public.employees SET manager_id = '20000000-0000-0000-0000-000000000011' WHERE work_email IN (
  'andres.jaromezuk@pow.la',  -- Dev. Back-End -> carlos@pow.la
  'rodrigo@pow.la'            -- Dev. Back-End -> carlos@pow.la
);

-- IT Frontend team reports to Fernanda or Ruben
UPDATE public.employees SET manager_id = '20000000-0000-0000-0000-000000000038' WHERE work_email IN (
  'benjamin@pow.la',     -- Dev. Front-End -> fernanda@pow.la
  'eric@pow.la'          -- Dev. Front-End -> fernanda@pow.la
);

UPDATE public.employees SET manager_id = '20000000-0000-0000-0000-000000000032' WHERE work_email IN (
  'andrea@pow.la',       -- Dev. Front-End -> ruben@pow.la
  'emiliano@pow.la',     -- Developer Front End Ssr. VTEX -> ruben@pow.la
  'ivan@pow.la'          -- Dev. Front-End -> ruben@pow.la
);

-- Ruben reports to Martin Krieger
UPDATE public.employees SET manager_id = '20000000-0000-0000-0000-000000000035' WHERE work_email = 'ruben@pow.la';

-- Sales & Mkt reports to Andrés Acerenza
UPDATE public.employees SET manager_id = '20000000-0000-0000-0000-000000000006' WHERE work_email = 'franco@pow.la';

-- Growth Strategy reports to Antonella
UPDATE public.employees SET manager_id = '20000000-0000-0000-0000-000000000007' WHERE work_email IN (
  'karen.aranda@pow.la', -- Growth Specialist -> antonella@pow.la
  'martin.becerra@pow.la' -- Data Strategist -> antonella@pow.la
);

-- Product team reports to Giovanna
UPDATE public.employees SET manager_id = '20000000-0000-0000-0000-000000000017' WHERE work_email IN (
  'dafne@pow.la',        -- Team Leader Producto Vtex & Shopify
  'delfina@pow.la',      -- Product Analyst
  'lucia.desgens@pow.la',-- Product Analyst
  'ornella@pow.la',      -- Product Analyst
  'paula.perez@pow.la',  -- Lider Implementaciones
  'valeria@pow.la'       -- Product Analyst
);

-- Product Design reports to Antonella
UPDATE public.employees SET manager_id = '20000000-0000-0000-0000-000000000007' WHERE work_email IN (
  'micaela@pow.la',      -- UX/UI Designer -> antonella@pow.la
  'rosario@pow.la'       -- UX/UI Designer -> antonella@pow.la
);

-- Adm. & Finance reports to Sergio
UPDATE public.employees SET manager_id = '20000000-0000-0000-0000-000000000036' WHERE work_email IN (
  'manuela.heine@pow.la', -- Asistente Administración -> sergio@pow.la
  'nahiara@pow.la'        -- Asistente Administración -> sergio@pow.la
);

-- Manuel (CX Analyst) reports to Antonella
UPDATE public.employees SET manager_id = '20000000-0000-0000-0000-000000000007' WHERE work_email = 'manuel.alvarez@pow.la';

-- ==========================================
-- 5. Summary Query
-- ==========================================
SELECT 
  'Empleados insertados: ' || COUNT(*) as summary
FROM public.employees
WHERE id::text LIKE '20000000-0000-0000-0000-%';

-- Check manager relationships
SELECT 
  e.first_name || ' ' || e.last_name as employee,
  e.job_title,
  d.name as department,
  COALESCE(m.first_name || ' ' || m.last_name, 'Sin manager') as manager
FROM public.employees e
LEFT JOIN public.employees m ON e.manager_id = m.id
LEFT JOIN public.departments d ON e.department_id = d.id
WHERE e.id::text LIKE '20000000-0000-0000-0000-%'
ORDER BY d.name, e.last_name;
