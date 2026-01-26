# Template para Carga Masiva de Empleados

## Archivo: `employees_bulk_template.csv`

### Campos Obligatorios

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| `first_name` | Nombre | Juan |
| `last_name` | Apellido | Pérez |
| `personal_email` | Email personal (único) | juan@gmail.com |
| `hire_date` | Fecha de ingreso (YYYY-MM-DD) | 2020-03-15 |
| `status` | Estado del empleado | active |

### Campos de Información Personal

| Campo | Descripción | Ejemplo | Valores Posibles |
|-------|-------------|---------|------------------|
| `work_email` | Email corporativo | juan@pow.com | |
| `dni` | Documento Nacional de Identidad | 12345678 | |
| `cuil` | CUIL | 20-12345678-9 | |
| `birth_date` | Fecha de nacimiento (YYYY-MM-DD) | 1990-05-20 | |
| `phone` | Teléfono | +54 11 1234-5678 | |
| `nationality` | Nacionalidad | Argentina | |
| `marital_status` | Estado civil | single | single, married, divorced, widowed, other |

### Campos de Dirección

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| `address` | Dirección | Av. Corrientes 1234 |
| `city` | Ciudad | Buenos Aires |
| `postal_code` | Código postal | C1043AAZ |
| `country` | País | Argentina |

### Campos de Educación

| Campo | Descripción | Ejemplo | Valores Posibles |
|-------|-------------|---------|------------------|
| `education_level` | Nivel educativo | university | primary, secondary, tertiary, university, postgraduate |
| `education_title` | Título obtenido | Licenciado en Sistemas | |
| `languages` | Idiomas | Español (nativo), Inglés (avanzado) | |
| `is_studying` | ¿Está estudiando? (para licencia por estudio) | false | true, false |

### Campos de Organización

| Campo | Descripción | Ejemplo | Notas |
|-------|-------------|---------|-------|
| `job_title` | Puesto de trabajo | Software Engineer | |
| `seniority_level` | Nivel de seniority | 2.3 | 1.x=Jr, 2.x=Ssr, 3.x=Sr, 4.x=Líder, 5.x=C-Level |
| `legal_entity_name` | Nombre de la sociedad | Pow Labs | Debe existir previamente en el sistema |
| `department_name` | Nombre del departamento | Engineering | Debe existir previamente en el sistema |
| `manager_email` | Email del manager | guido@pow.com | Debe ser work_email de un empleado existente |

### Campos de Contacto de Emergencia

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| `emergency_contact_relationship` | Relación | Madre, Padre, Esposo/a, Hermano/a |
| `emergency_contact_first_name` | Nombre del contacto | María |
| `emergency_contact_last_name` | Apellido del contacto | Pérez |
| `emergency_contact_phone` | Teléfono del contacto | +54 11 9876-5432 |
| `emergency_contact_address` | Dirección del contacto | Av. Rivadavia 5678 |

### Valores de `status`

- `active` - Empleado activo
- `inactive` - Empleado inactivo (licencia, etc)
- `terminated` - Empleado desvinculado

### Valores de `seniority_level`

| Código | Nivel |
|--------|-------|
| 1.1 - 1.4 | Junior (Trainee a Jr+) |
| 2.1 - 2.4 | Semi-Senior |
| 3.1 - 3.4 | Senior |
| 4.1 - 4.4 | Líder/Manager |
| 5.1 - 5.4 | C-Level/Director |

### Notas Importantes

1. **Fechas**: Usar formato ISO `YYYY-MM-DD` (ej: 2020-03-15)
2. **Legal Entity y Department**: Deben existir previamente en el sistema
3. **Manager**: Se busca por `work_email`, debe ser un empleado existente
4. **Email personal**: Debe ser único en el sistema
5. **Campos vacíos**: Dejar vacío si no aplica (no poner "N/A" o "-")
