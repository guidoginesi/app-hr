-- Fix: Franco Panaro — cambiar de monotributista a relación en dependencia

-- PASO 1: Verificar el empleado antes de modificar
SELECT id, first_name, last_name, employment_type, status
FROM employees
WHERE LOWER(first_name) LIKE '%franco%'
  AND LOWER(last_name) LIKE '%panaro%';

-- PASO 2: Actualizar el tipo de empleo
UPDATE employees
SET
  employment_type = 'dependency',
  updated_at      = now()
WHERE LOWER(first_name) LIKE '%franco%'
  AND LOWER(last_name) LIKE '%panaro%';

-- PASO 3: Verificación final
SELECT id, first_name, last_name, employment_type
FROM employees
WHERE LOWER(first_name) LIKE '%franco%'
  AND LOWER(last_name) LIKE '%panaro%';
