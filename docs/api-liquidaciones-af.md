# API de liquidaciones RRHH → A&F

Documento para el equipo de la **App A&F**. La ruta ya está implementada y
desplegada en producción; acá está cómo consumirla, qué devuelve hoy y las dos
cosas donde tuve que decidir algo que el contrato no dejaba escrito en una línea.

Implementa `docs/contrato-rrhh-liquidaciones.md` de `app-adm`. **Si algo de este
documento contradice al contrato, manda el contrato** — este describe la
implementación, aquel define qué tiene que devolver.

---

## Estado

| | |
|---|---|
| Ruta | `GET https://hr.pow-apps.com/api/payroll/settlements` |
| Estado | **Operativa** |
| Verificada de punta a punta | 11/08/2026, con `scripts/check-rrhh-import.ts` |

El secreto ya está cargado en los dos proyectos de Vercel (`AF_INTEGRATION_KEY`
en app-hr, `RRHH_API_KEY` en app-adm) y en los `.env.local` de los dos repos para
desarrollo local. Está marcado como sensible en Vercel: **no se puede volver a
leer desde el panel**. Si hace falta rotarlo, hay que generarlo de nuevo y
cargarlo en los cuatro lugares a la vez.

Si la variable faltara, la ruta responde `503` en vez de quedar abierta: devuelve
las liquidaciones de toda la empresa.

## Autenticación

Header `x-af-key` con el secreto compartido.

```bash
curl -H "x-af-key: $AF_INTEGRATION_KEY" \
  https://hr.pow-apps.com/api/payroll/settlements
```

A&F no necesita ninguna credencial de la base de RRHH. El service key se usa
dentro de la ruta; del lado de A&F sólo existe este secreto.

## Parámetros

| Parámetro | Obligatorio | Qué hace |
|---|---|---|
| `since` | No | Devuelve sólo las liquidaciones con `sent_at > since`. ISO 8601. |

Sin `since` devuelve todas las enviadas, que es lo que necesita la carga
histórica.

```
GET /api/payroll/settlements
GET /api/payroll/settlements?since=2026-08-01T00:00:00Z
```

## Respuesta

```json
{
  "contract_version": 1,
  "generated_at": "2026-08-11T18:00:00.000Z",
  "settlements": [
    {
      "settlement_id": "uuid",
      "period_id":     "uuid",
      "period_key":    "2026-06",
      "employee_id":   "uuid",
      "sent_at":       "2026-07-01T14:23:00.000Z",
      "contract_type": "MONOTRIBUTO",

      "first_name": "Nombre",
      "last_name":  "Apellido",
      "email":      "persona@pow.la",

      "sueldo":                   5000000,
      "monotributo":              120000,
      "reintegro_internet":       29999,
      "reintegro_extraordinario": 0,
      "plus_vacacional":          0,
      "bonificacion_anual":       0,
      "aguinaldo":                0,

      "adelanto_sueldo":  300,
      "total_a_facturar": 5149699
    }
  ]
}
```

La respuesta va con `Cache-Control: no-store`: el dato cambia cada vez que se
envía una liquidación y no queremos que quede cacheado en el camino.

### Qué devuelve hoy

Al 11/08/2026, sin `since` — medido corriendo `check-rrhh-import.ts` contra la
ruta en producción:

| | |
|---|---|
| Liquidaciones | **254** |
| Monotributo (con conceptos) | 182 |
| Relación de dependencia (conceptos en `null`) | 72 |
| Períodos cubiertos | `2025-12` a `2026-07` |

## Errores

| Código | Cuándo | Cuerpo |
|---|---|---|
| `401` | Falta `x-af-key` o no coincide | `{"error":"Unauthorized"}` |
| `400` | `since` no es una fecha válida | `{"error":"El parámetro since tiene que ser una fecha ISO 8601."}` |
| `503` | Falta `AF_INTEGRATION_KEY` del lado de RRHH | `{"error":"Integración no configurada"}` |
| `500` | Error leyendo la base | `{"error":"No se pudieron leer las liquidaciones"}` |

---

## Dos decisiones que el contrato no dejaba escritas

### 1. Devuelve sólo las enviadas

La ruta filtra por `sent_at IS NOT NULL`.

El contrato dice que A&F únicamente importa las que tienen `sent_at`, y que
`since` compara contra ese campo. Mandar las no enviadas agregaría filas con
`sent_at: null` que del otro lado se descartan igual — pero con desgloses
todavía en borrador, que podrían hacer fallar la validación de **toda** la
respuesta.

Hoy quedan afuera 9: 2 de monotributo y 7 de relación de dependencia, todas sin
enviar.

**Si prefieren recibirlas igual, es un cambio de una línea.** Avisen.

### 2. Los conceptos van en `null` por tipo de contrato

Para `RELACION_DEPENDENCIA` los 7 conceptos, `adelanto_sueldo` y
`total_a_facturar` viajan en `null` **porque el contrato dice que así viajan**,
no sólo porque hoy no tengan desglose cargado.

Hoy el resultado es el mismo —ninguna de las 79 tiene desglose— pero si mañana
alguien le carga uno a una de relación de dependencia, la fila va a seguir
viajando en `null`, como pide el contrato.

---

## Sobre los números

Los importes viajan como **números**, no strings, y **sin redondear**. El dato de
RRHH trae ruido de punto flotante (`5.869.795,369999999`); redondear de este lado
rompería la validación `Σ conceptos − adelanto = total_a_facturar` que corre A&F
con tolerancia de $0,01.

Verificado sobre las 254 filas que devuelve la ruta con los datos reales:

- La cuenta cierra en las **182 de monotributo**, con diferencia máxima
  **0,000000**.
- Las 72 de relación de dependencia vienen con los conceptos en `null`.
- Ninguna fila trae campos de más ni de menos.

## Cómo probarlo

Una vez cargada la variable:

```bash
# Que responda y traiga las 254
curl -s -H "x-af-key: $AF_INTEGRATION_KEY" \
  https://hr.pow-apps.com/api/payroll/settlements \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['contract_version'], len(d['settlements']))"

# Incremental
curl -s -H "x-af-key: $AF_INTEGRATION_KEY" \
  "https://hr.pow-apps.com/api/payroll/settlements?since=2026-08-01T00:00:00Z" \
  | python3 -c "import sys,json; print(len(json.load(sys.stdin)['settlements']))"
```

Después, apuntar `scripts/check-rrhh-import.ts` a la URL: tiene que dar lo mismo
que da hoy armando la respuesta con los datos directos.

## Si cambia la forma de la respuesta

Se sube `CONTRACT_VERSION` en `src/app/api/payroll/settlements/route.ts` y se
avisa. A&F falla con un mensaje claro en vez de leer campos que ya no están.

## Dos cosas pendientes del lado de RRHH

Ninguna bloquea la integración; las dos las levantó el contrato y siguen abiertas.

1. **`2025-12` tiene 31 de 39 liquidaciones enviadas.** A&F las reporta como
   anomalía y no bloquea, pero falta confirmar con People si esas 8 quedaron sin
   enviar a propósito.
2. **Cuando diciembre se liquide en dos** (aguinaldo cerca del 18/12 y el resto
   en enero), tienen que ser **dos filas de `payroll_periods` con el mismo
   `period_key`**. Hoy no existe ningún `period_key` duplicado, así que ese
   camino no está ejercitado por datos reales.
