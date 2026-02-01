# Módulo de Objetivos Personales - Resumen de Cambios

## Resumen Ejecutivo

Se implementó un sistema completo de gestión de objetivos personales con periodicidad variable, sub-objetivos y pesos configurables para el cálculo del bono anual.

---

## Cambios Funcionales Implementados

### 1. Periodicidad de Objetivos

Cada empleado puede tener **exactamente 2 objetivos principales** por año, y cada uno puede configurarse con diferente periodicidad:

| Periodicidad | Sub-objetivos requeridos | Descripción |
|--------------|-------------------------|-------------|
| **Anual** | 0 | Objetivo simple, se evalúa una vez al año |
| **Semestral** | 2 | Se divide en S1 (Ene-Jun) y S2 (Jul-Dic) |
| **Trimestral** | 4 | Se divide en Q1, Q2, Q3 y Q4 |

### 2. Sistema de Pesos

- Cada objetivo principal tiene un **peso porcentual** (weight_pct)
- Los pesos de ambos objetivos **deben sumar 100%**
- Al cargar el segundo objetivo, el sistema limita automáticamente el peso máximo disponible
- Los sub-objetivos heredan el peso del objetivo padre y lo dividen equitativamente

### 3. Cálculo de Cumplimiento

**Para objetivos anuales:**
- Se evalúa directamente el cumplimiento (0-100%)

**Para objetivos semestrales/trimestrales:**
- El cumplimiento del objetivo principal = promedio de sus sub-objetivos
- Cada sub-objetivo se evalúa individualmente

### 4. Evaluación de Objetivos

- Solo el **manager directo** del empleado puede evaluar sus objetivos
- El cumplimiento está limitado a un **máximo de 100%**
- Se puede agregar notas de evaluación
- Los sub-objetivos se evalúan por separado con su propio porcentaje

### 5. Cálculo del Bono

**Pesos corporativos (fijos para todos):**
- Facturación: **70%**
- NPS: **30%**

**Pesos por seniority (componente corporativo vs personal):**
Los pesos varían según el nivel de seniority del empleado.

**Seniority histórico:**
- Para años cerrados, el bono usa el **seniority que tenía el empleado al 31/12 de ese año**
- Si el empleado fue promovido después, su bono histórico no cambia

### 6. Validaciones Implementadas

- Máximo 2 objetivos principales por empleado/año
- Pesos deben sumar exactamente 100%
- Cumplimiento máximo: 100%
- Sub-objetivos obligatorios para periodicidades semestral/trimestral
- Solo el manager directo puede evaluar

### 7. Filtros de Años

Los selectores de año (tanto en objetivos como en bonos) solo muestran años que tienen **objetivos corporativos configurados por admin**.

---

## Cambios Técnicos

### Base de Datos

Nuevos campos en tabla `objectives`:
- `periodicity` (annual/semestral/trimestral)
- `weight_pct` (peso porcentual)
- `parent_objective_id` (para sub-objetivos)
- `sub_objective_number` (1-4)
- `objective_number` (1-2)

### Componentes

- **ObjectiveCard**: Componente reutilizable para mostrar objetivos
- Ubicación: `src/components/ObjectiveCard.tsx`
- Usado en: página de objetivos y perfil de equipo

### APIs Modificadas

- `POST /api/portal/objectives` - Crear objetivos y sub-objetivos
- `PUT /api/portal/objectives/[id]/achievement` - Evaluar objetivos
- `GET /api/portal/team/[memberId]/bonus` - Cálculo de bono con seniority histórico

---

## Correcciones de Seguridad

1. **Evaluación de objetivos**: Removida la condición que permitía al creador del objetivo evaluarlo. Ahora solo el manager directo tiene permiso.

2. **Límite de cumplimiento**: Bloqueado input y validación para no permitir valores > 100%.

---

## Próximos Pasos Sugeridos

1. Dashboard de seguimiento de objetivos para HR
2. Notificaciones cuando se acerca el cierre del período
3. Exportación de datos de objetivos a Excel
4. Historial de cambios en objetivos
