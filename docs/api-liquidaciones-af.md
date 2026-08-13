# API de liquidaciones RRHH → A&F

Documento para el equipo de la **App A&F**. La ruta ya está implementada y
desplegada en producción; acá está cómo consumirla, qué devuelve hoy y las
cosas donde tuve que decidir algo que el contrato no dejaba escrito en una línea.

Implementa dos contratos de `app-adm`: `docs/contrato-rrhh-liquidaciones.md`
(monotributo) y `docs/contrato-rrhh-recibos-rrdd.md` (relación de dependencia).
**Si algo de este documento contradice a esos contratos, mandan ellos** — este
describe la implementación, aquellos definen qué tiene que devolver.

---

## Estado

| | |
|---|---|
| Ruta | `GET https://hr.pow-apps.com/api/payroll/settlements` |
| `contract_version` | **2** |
| Estado | **Operativa** |
| Verificada de punta a punta | 11/08/2026 (monotributo) · 12/08/2026 (relación de dependencia) |

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
| `since` | No | Devuelve sólo las liquidaciones **enviadas** con `sent_at > since`. ISO 8601. |

Sin `since` devuelve todas las enviadas, que es lo que necesita la carga
histórica. Las **no enviadas viajan siempre**, con o sin `since` — ver la
decisión 3.

```
GET /api/payroll/settlements
GET /api/payroll/settlements?since=2026-08-01T00:00:00Z
```

## Respuesta

### Monotributo

```json
{
  "contract_version": 2,
  "generated_at": "2026-08-12T18:00:00.000Z",
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
      "total_a_facturar": 5149699,

      "rrdd": null
    }
  ]
}
```

### Relación de dependencia

Los 7 conceptos de monotributo siguen viajando en `null`; el desglose va en
`rrdd`, que es un campo **nuevo**, no un reemplazo.

```json
{
  "settlement_id": "uuid",
  "period_key":    "2026-06",
  "employee_id":   "uuid",
  "sent_at":       "2026-07-01T14:23:00.000Z",
  "contract_type": "RELACION_DEPENDENCIA",

  "sueldo": null,
  "monotributo": null,

  "rrdd": {
    "fecha_ingreso": "2026-04-27",
    "recibos": [
      {
        "tipo": "SAC",
        "periodo": "2026-06",
        "remunerativo_total":     487500,
        "no_remunerativo_total":       0,
        "descuentos_total":        82875,
        "contribuciones_total":     3607.5,
        "sueldo_bruto":           487500,
        "sueldo_neto":            404625,
        "costo_total_empleador":  491107.5,
        "conceptos": [
          { "codigo": "2510", "nombre": "SAC PRIMER SEMESTRE",          "tipo": "REMUNERATIVO", "monto": 487500 },
          { "codigo": "4010", "nombre": "JUBILACION",                   "tipo": "DESCUENTO",    "monto":  53625 },
          { "codigo": "5250", "nombre": "CONTRIBUCION PORCENTUAL ART",  "tipo": "CONTRIBUCION", "monto":   3607.5 }
        ]
      },
      {
        "tipo": "MENSUAL",
        "periodo": "2026-06",
        "…": "mismos campos"
      }
    ]
  }
}
```

`periodo` es **siempre el `period_key` de la liquidación** (el mes devengado),
nunca la etiqueta del PDF.

### Liquidaciones no enviadas

Viajan con la identidad completa y **todos los importes en `null`**, incluido
`rrdd`:

```json
{
  "settlement_id": "uuid",
  "period_key":    "2025-12",
  "employee_id":   "uuid",
  "sent_at":       null,
  "contract_type": "MONOTRIBUTO",
  "first_name":    "Nombre",
  "last_name":     "Apellido",
  "email":         "persona@pow.la",
  "sueldo": null, "monotributo": null, "reintegro_internet": null,
  "reintegro_extraordinario": null, "plus_vacacional": null,
  "bonificacion_anual": null, "aguinaldo": null,
  "adelanto_sueldo": null, "total_a_facturar": null,
  "rrdd": null
}
```

La respuesta va con `Cache-Control: no-store`: el dato cambia cada vez que se
envía una liquidación y no queremos que quede cacheado en el camino.

### Qué devuelve hoy

Al 12/08/2026, sin `since`:

| | |
|---|---|
| Liquidaciones | **263** |
| Enviadas | 254 |
| — monotributo (con conceptos) | 182 |
| — relación de dependencia (con `rrdd`) | 72 |
| No enviadas (identidad, todo en `null`) | 9 |
| Períodos cubiertos | `2025-12` a `2026-07` |
| Recibos dentro de los `rrdd` | 84 |

## Errores

| Código | Cuándo | Cuerpo |
|---|---|---|
| `401` | Falta `x-af-key` o no coincide | `{"error":"Unauthorized"}` |
| `400` | `since` no es una fecha válida | `{"error":"El parámetro since tiene que ser una fecha ISO 8601."}` |
| `503` | Falta `AF_INTEGRATION_KEY` del lado de RRHH | `{"error":"Integración no configurada"}` |
| `500` | Error leyendo la base | `{"error":"No se pudieron leer las liquidaciones"}` |

---

## Tres decisiones que los contratos no dejaban escritas

### 1. Los importes van sólo en las enviadas

La ruta filtra por `sent_at IS NOT NULL` para todo lo que sea plata. Una
liquidación en borrador tiene desgloses a medio cargar que podrían hacer fallar
la validación de **toda** la respuesta.

### 2. Los conceptos de monotributo van en `null` por tipo de contrato

Para `RELACION_DEPENDENCIA` los 7 conceptos, `adelanto_sueldo` y
`total_a_facturar` viajan en `null` **porque el contrato dice que así viajan**,
no sólo porque hoy no tengan desglose cargado. Su plata está en `rrdd`.

### 3. Las no enviadas viajan igual, y `since` no las filtra

Van sin un solo importe: sólo la identidad. Es lo que permite distinguir "esta
persona no existe en RRHH" de "existe pero su liquidación todavía no se envió".

**`since` no se les aplica a propósito.** No tienen `sent_at` contra qué
comparar, así que filtrarlas por ahí las volvería invisibles justo en el caso
que importa: la liquidación que quedó sin enviar y nadie miró. Hoy son 9 filas;
el costo de mandarlas siempre es despreciable.

---

## Sobre los números

Los importes viajan como **números**, no strings, y **sin redondear**. El dato de
RRHH trae ruido de punto flotante (`5.869.795,369999999`); redondear de este lado
rompería las validaciones que corre A&F con tolerancia de $0,01.

Verificado sobre los datos reales:

- Monotributo: `Σ conceptos − adelanto = total_a_facturar` cierra en las **182**,
  con diferencia máxima **0,000000**.
- Relación de dependencia: las **tres identidades cierran en los 84 recibos**,
  contrastadas contra los totales que imprime cada PDF. Cero diferencias.
- Ninguna fila trae campos de más ni de menos.

---

## Cómo se arma el `rrdd`

Los importes de relación de dependencia no están en ninguna tabla: viven adentro
del PDF. `src/lib/payslipParser.ts` los lee cuando People sube el recibo y el
desglose queda guardado en `payroll_payslips.parsed`. La ruta no abre un solo
archivo.

### Tres formatos de recibo, no uno

El estudio cambió el formato dos veces en 2026 y los tres conviven en la base:

| Plantilla | Períodos | Contribuciones patronales |
|---|---|---|
| B | `2025-12` a `2026-04` | **no las trae** |
| C | `2026-05` | sí |
| A | `2026-06` en adelante | sí |

⚠️ **La plantilla B no tiene las contribuciones patronales en ninguna parte del
documento.** No es que el parser no las encuentre: el recibo trae los haberes,
los descuentos del empleado y el neto, y nada más. Para esos recibos
`contribuciones_total` y `costo_total_empleador` viajan en **`null`**.

Son **37 de las 72** liquidaciones de relación de dependencia. La tercera
identidad (`bruto + contribuciones = costo total`) no se puede evaluar ahí
porque le falta el término, no porque no cierre.

Esto choca con el criterio de aceptación del contrato ("las tres identidades
cierran en el 100% de los recibos, sin excepciones toleradas"): **el 100% es
alcanzable sobre las identidades que el documento permite calcular, no sobre las
tres siempre.** Si A&F necesita el costo total de esos períodos, hay que pedirle
al estudio los recibos con las contribuciones o cargarlas a mano.

### El catálogo real son 28 códigos, no 14

⚠️ Esto bloquea la importación si no se carga antes. El contrato lista 14 códigos
"observados"; en los 72 recibos reales aparecen **28**. Como un código sin mapear
bloquea la importación, con el catálogo de 14 **fallarían casi todos los
recibos**: `9999 REDONDEO` solo aparece 58 veces.

| Código | Nombre | Tipo | Veces | ¿Estaba en el contrato? |
|---|---|---|---:|---|
| 2010 | SUELDO | REMUNERATIVO | 66 | sí |
| 2015 | SUELDO PROPORCIONAL | REMUNERATIVO | 1 | **no** |
| 2111 | PLUS VACACIONAL | REMUNERATIVO | 5 | **no** |
| 2161 | LICENCIA SIN GOCE DE SUELDO | REMUNERATIVO | 1 | **no** |
| 2200 | ADICIONAL VARIABLE | REMUNERATIVO | 12 | **no** |
| 2260 | BONO REMUNERATIVO | REMUNERATIVO | 5 | **no** |
| 2265 | SAC S/ BONO REMUNERATIVO | REMUNERATIVO | 5 | **no** |
| 2300 | REINTEGRO GASTOS DE CONECTIVIDAD | NO_REMUNERATIVO | 20 | **no** |
| 2306 | REINTEGRO DE GASTOS | NO_REMUNERATIVO | 48 | sí |
| 2307 | BONO NO REMUNERATIVO | NO_REMUNERATIVO | 1 | **no** |
| 2410 | PLUS VACACIONAL | REMUNERATIVO | 1 | **no** |
| 2510 | SAC PRIMER SEMESTRE | REMUNERATIVO | 12 | sí |
| 4010 | JUBILACION | DESCUENTO | 70 | sí |
| 4021 | INSSJP LEY 19032 | DESCUENTO | 70 | sí |
| 4051 | OBRA SOCIAL | DESCUENTO | 70 | sí |
| 4090 | ADELANTO DE SUELDO | DESCUENTO | 1 | **no** |
| 5010 | CONTRIBUCION JUBILACION | CONTRIBUCION | 29 | sí |
| 5020 | CONTRIBUCION LEY 19032 | CONTRIBUCION | 29 | sí |
| 5030 | CONTRIB ASIGN FAMILIARES | CONTRIBUCION | 29 | sí |
| 5040 | CONTRIBUCION FONDO DE EMPLEO | CONTRIBUCION | 29 | sí |
| 5050 | CONTRIBUCION OBRA SOCIAL | CONTRIBUCION | 9 | **no** |
| 5150 | CONTRIBUCION ANSSAL | CONTRIBUCION | 20 | sí |
| 5250 | CONTRIBUCION PORCENTUAL ART | CONTRIBUCION | 47 | sí |
| 5350 | CONTRIBUCION SUMA FIJA ART | CONTRIBUCION | 35 | sí |
| 5400 | CONTRI ART FIN ESPECIFICOS | CONTRIBUCION | 35 | sí |
| 6980 | RETENCION GANANCIAS | DESCUENTO | 17 | **no** |
| 6985 | DEVOLUCION GANANCIAS | DESCUENTO | 1 | **no** |
| 9999 | REDONDEO | NO_REMUNERATIVO | 58 | **no** |

Dos que conviene mirar con cuidado:

- **`2300` y `2306`** son los dos el reintegro de conectividad, con nombres
  distintos según la plantilla. Mapean a la misma línea de A&F.
- **`4090 ADELANTO DE SUELDO`** es el equivalente del `adelanto_sueldo` de
  monotributo, pero acá viaja como un descuento más adentro de
  `descuentos_total`. No hay que restarlo otra vez.

### Qué se descarta y qué no

`pdf2` es un segundo espacio de archivo sin ninguna semántica, así que hay que
decidir por contenido:

- **Repetido** — dos recibos del mismo tipo en la misma liquidación: va uno solo.
  Hoy son **11**, todos `pdf2` de `2026-06` que repiten una página que el `pdf`
  ya trae.
- **Ajeno** — un segundo archivo cuyo período no corresponde: se descarta.
- **Ilegible** — un archivo que no es un recibo: no produce ningún importe.
  Hoy hay **1** (ver abajo).

Lo descartado **no viaja** en la respuesta, para que del otro lado no se pueda
sumar por accidente. La evidencia de qué se descartó y por qué queda en
`payroll_payslips.parsed`.

**El corrimiento de un mes NO alcanza para descartar por sí solo.** Las
liquidaciones extraordinarias devengan en un período y se pagan meses después: el
bono anual de `2025-12` se pagó el 20/03/2026 y su recibo dice `02/2026`, a dos
meses del devengado. Descartarlo por la distancia tiraría plata bien imputada.
Por eso el corrimiento sólo descarta en el **segundo** archivo; el recibo
principal se entrega siempre y, si el período no es el esperado, queda marcado
para revisar. Hoy son 5, todos del bono anual.

## Cómo probarlo

```bash
# Que responda y traiga las 263
curl -s -H "x-af-key: $AF_INTEGRATION_KEY" \
  https://hr.pow-apps.com/api/payroll/settlements \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['contract_version'], len(d['settlements']))"

# Los recibos de relación de dependencia
curl -s -H "x-af-key: $AF_INTEGRATION_KEY" \
  https://hr.pow-apps.com/api/payroll/settlements \
  | python3 -c "import sys,json; d=json.load(sys.stdin); r=[s for s in d['settlements'] if s.get('rrdd')]; print(len(r), 'con rrdd,', sum(len(s['rrdd']['recibos']) for s in r), 'recibos')"
```

## Si cambia la forma de la respuesta

Se sube `CONTRACT_VERSION` en `src/app/api/payroll/settlements/route.ts` y se
avisa. A&F falla con un mensaje claro en vez de leer campos que ya no están.

## Pendientes del lado de RRHH

Ninguna bloquea la integración.

1. **`2025-12` no es un mes de sueldos: es el bono anual.** 26 de 28
   liquidaciones de monotributo tienen `bonificacion_anual` y **ninguna** tiene
   sueldo. Sus 31 de 39 enviadas no son un mes incompleto.
2. **Cuando diciembre se liquide en dos** (aguinaldo cerca del 18/12 y el resto
   en enero), tienen que ser **dos filas de `payroll_periods` con el mismo
   `period_key`**. Hoy no existe ningún `period_key` duplicado.
3. **Hay un archivo que no es un recibo** en el `pdf2` de una liquidación de
   `2026-06`: una factura de gas a nombre de un tercero. El parser la rechaza,
   pero está en el bucket de recibos y conviene sacarla.
4. **Falta un tipo de recibo.** El enum del contrato es `MENSUAL | SAC | FINAL`
   y los recibos del bono anual no son ninguno de los tres; hoy viajan como
   `MENSUAL`. Si A&F necesita distinguirlos, hace falta agregar un valor.
