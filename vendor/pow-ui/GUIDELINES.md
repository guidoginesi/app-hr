# POW Design System — Definiciones y patrones

Reglas de uso del DS. Acompaña al showcase vivo (`/design-system`) y al
`README.md` de adopción. Si dudás entre dos opciones, esta es la fuente de verdad.

---

## Identidad

- **primary = tinta `#1A1D23`** (texto blanco). La acción principal. **Un primary por vista** — el resto secundario / outline / ghost.
- **brand = naranja `#FE722B`** (texto negro). **Acento**, no acción principal: nav activo, links, focus ring, subrayado de tab/orden activo, highlights.
- **El color significa, no decora.** Verde/ámbar/rojo = estado (success/warning/danger). Si no comunica un estado, es neutro (tinta/gris).
- Categóricos (`cat-violet/cyan/pink`) = tipo/categoría (Grupo, NC, tipo de movimiento), nunca estado.

## Tipografía

- Escala fija `type-*`: `display 20 · title 14 · subtitle 13 · body 12 · secondary 11 · label 10 · micro 9` (px fijos).
- Helvetica Now en `display`/`title`; system stack en el resto. **El peso hace la jerarquía**, no el tamaño-bold-en-todo.
- Montos: siempre `nums-tabular`.

## Layout de página (AppShell)

- **Usuario/organización al pie del sidebar** (no en un topbar). Sin franja superior vacía.
- **`PageHeader` como primer elemento del contenido**: `[breadcrumb? + título + descripción]` izquierda, `[acciones]` derecha — **una sola fila**.
- Descripción capada (`max-w-2xl`): no cruza todo el ancho (legibilidad ~70 car/línea).
- El contenido arranca arriba; aire vía tokens de spacing, sin bandas muertas.
- **Dónde poner el `PageHeader`:** si la pantalla tiene una acción a nivel página (botón "+ Nuevo X"), va en el client (donde vive el handler). Si no hay acción (solo lectura o acciones por sección), va directo en `page.tsx`.

## Tabs, toggles y orden — cuál usar

| Patrón | Cuándo | Componente |
|---|---|---|
| **Tabs** (subrayado, CON paneles) | Navegar entre secciones con contenido propio | `Tabs` (Radix) |
| **TabNav** (subrayado, SIN paneles) | Nav/toggle de vista sin panel (controlado) | `TabNav` |
| **SegmentedControl** (cápsula) | Toggle compacto de vista/escala | `SegmentedControl` |

- Tab/segment **activo**: subrayado/relleno + **naranja** + texto en foreground.
- La 1ª tab arranca **flush-left** (alineada con título y contenido).
- Evitar mezclar 3 lenguajes de "alternar" en una misma pantalla; preferir uno.

## Orden de tablas (sorting)

- **Ícono de ancho fijo SIEMPRE presente** → reservá el espacio, el título **no se mueve** al ordenar. (Nunca flechas unicode de ancho variable.)
- Estados: **sin ordenar** = `⇅` gris tenue (se ilumina en hover) · **activa** = `↑`/`↓` en naranja + título de esa columna en foreground.
- `aria-sort` en el `<th>`.
- Implementado en `DataTable` (listas de la app) y en `TableHead` (`sortable`/`sorted`/`onSort`).

## Tablas — texto largo en celdas

- **Alto de fila uniforme**: el contenido de una celda no debe estirar el alto. Texto largo (nombres, descripciones) → **una sola línea con `…`** (`truncate` + `max-w-[...]`) y el valor completo en **hover vía `title`** (tooltip nativo: accesible y costo cero; no usar tooltip "rico" por celda en tablas grandes).
- Si hace falta un poco más de texto, `line-clamp-2` (máx 2 líneas y ahí `…`) — pero preferir una línea en columnas de identificación (cliente, código).
- **Indicadores de fila** (adjuntos, aclaraciones, flags) junto a un nombre: agruparlos y **alinearlos a la derecha de su columna** (`justify-between` + nombre `flex-1 truncate`), no pegados al texto — así forman una columnita pareja y escaneable en vez de quedar escalonados según el largo del nombre.
- Si esos indicadores son **clicables**, tienen que parecerlo: `cursor-pointer` + hover perceptible (el `hover:` debe cambiar de verdad, no repetir el fondo base) + `title`/tooltip. Un hover que no cambia nada = no invita al clic.
- **Filas expandibles** (detalle en un `<td colSpan>`): usar **`table-fixed`** (y anchos en los `<th>` clave). Con `table-layout:auto`, el contenido ancho del detalle redistribuye las columnas al expandir → la fila se "corre". `table-fixed` fija los anchos por header.

## KPI / métricas (Stat)

- **Siempre el componente `Stat`** del DS — nunca tarjetas KPI locales. (`tone` por estado, `onClick` para drill-down, `sub`/`trend` opcionales.)
- Métrica neutra (un total, un saldo) → `tone="default"` → **tarjeta blanca + número en tinta**.
- **Estado** (`success`/`warning`/`danger`) → **superficie tintada (subtle) + número del color del estado** (Vencido rojo, Por vencer ámbar, etc.). El color guía la atención al estado.
- No pintar de colores las métricas neutras.

## Bordes, radius, sombras

- Radius canónico **8px** (`rounded-[var(--radius)]`), no valores fijos.
- Bordes de color (`border-brand`, `border-danger`) viven en `@layer utilities` — el reset global `*{border-color}` va en `@layer base` para no pisarlos.
- Sombras sutiles para profundidad en datos densos (`shadow-sm` default en cards).

## Animaciones

> **Demo vivo:** `/design-system` → sección **Animaciones** (botón loading, modal entrada/salida, sheet slide).

El movimiento **orienta, no decora**. Sobrio: nada de rebotes, springs ni duraciones largas. Si una animación no comunica un cambio de estado (algo aparece, se va, está cargando), no va.

### Principios

1. **Cada transición de estado tiene su animación; nada aparece/desaparece de golpe.** Abrir, cerrar, cargar.
2. **Entrada ágil, salida un toque más lenta.** Entrar rápido se siente responsivo; salir con un pelín más de tiempo se siente prolijo (no abrupto).
3. **Sin layout shift.** Una animación nunca debe empujar el contenido vecino ni cambiar el tamaño de un control (ver botones loading).
4. **La salida va DESPUÉS de la acción**, nunca durante: en un modal de confirmación, primero el botón muestra `loading`, la acción termina, y recién ahí el modal cierra animado.
5. **Siempre respetar `prefers-reduced-motion`**: todas las animaciones del DS se desactivan solas.
6. **No se hacen overlays a mano.** Todo modal usa `Dialog`; todo panel lateral usa `Sheet`. Así heredan animación, foco, cierre y z-index correctos. Un `fixed inset-0` propio es un bug de DS.

### Tokens

| Token | Valor | Uso |
|---|---|---|
| `--duration-fast` | 120ms | micro (fade de overlay, hover) |
| `--duration` | 180ms | estándar (entradas) |
| `--duration-slow` | 280ms | excepcional |
| salida overlays | 240ms | cierre de Dialog/Sheet (entre `--duration` y `--duration-slow`) |
| `--ease-out` | `cubic-bezier(0,0,0.2,1)` | **entradas** (desacelera al final) |
| `--ease-standard` | `cubic-bezier(0.2,0,0,1)` | **salidas** y transiciones |

### Catálogo

- **Modales (`Dialog`)** — entrada: overlay fade-in 120ms (`anim-overlay-in`) + cuadro fade + scale 0.97→1 + subida 8px 180ms `ease-out` (`anim-dialog-in`). Salida: simétrica e invertida, 240ms `ease-standard` (`anim-*-out`, con `forwards`). El Dialog se mantiene montado durante el fade-out (estado `closing`, desmonta a los 240ms).
- **Paneles laterales (`Sheet`)** — overlay igual al Dialog; el panel **slide** desde el borde (`pow-slide-in/out-right|left`), entrada 180ms `ease-out`, salida 240ms `ease-standard`. Animado vía `data-[state]` de Radix (se mantiene montado en el cierre solo).
- **Botones con acción async** — spinner del estado `loading` (ver abajo). Es la única "animación" de acción; el resto del feedback es el cierre del modal.
- **Hover / orden de tabla** — transiciones de color con `transition-colors` (~150ms). El ícono de orden no anima posición (ancho fijo, sin shift).

### Botones — estado loading

- **Regla única para TODO botón con acción async** (guardar, eliminar, generar, enviar…): usar el prop **`loading`** del `Button`. Nunca un `<button>` crudo con spinner propio.
- **Ancho estable:** el spinner se **superpone centrado** (absolute), el texto se oculta con `invisible` (no `display:none`) para reservar su ancho. El botón **nunca cambia de tamaño** al pasar a loading. (Insertar el spinner al lado del texto lo ensancha de golpe → prohibido.)
- **No cambiar el label** a `"Guardando…"`/`"Eliminando…"`: aunque quede invisible, su ancho (mayor) igual reserva espacio y el botón crece. El label se mantiene fijo; el spinner comunica el estado.
- `disabled` + `aria-busy` los maneja el `Button` solo cuando `loading` (no hace falta sumar `disabled={loading}`).
- **Íconos / acciones clicables → usar `Button` del DS** (`variant="ghost" size="icon"` para íconos), no un `<button>` a mano. El `Button` ya trae hover, focus y `cursor-pointer`; el markup a mano es donde nacen los hovers muertos y la falta de cursor.
- **Cursor:** el DS aplica `cursor: pointer` a `button`/`[role=button]`/`label[for]` en su base (los `<button>` nativos son flecha por defecto). No hace falta sumarlo a mano.

### Carga de contenido (async)

- **Bloques de contenido** (tablas, detalles expandibles, paneles que traen datos) → **`Skeleton`** que imita la estructura. Nunca texto plano `"Cargando…"`.
- **Inline / dentro de una acción** → spinner: el prop `loading` del `Button`, o `Loader2` (`animate-spin`) para un inline chico.
- Un solo evento (cargar contenido) = un solo lenguaje. Texto "Cargando…" suelto está prohibido.

## Overlays — cierre y foco

- **Botón de cierre (X)** con afordancia clara: ícono `text-muted-foreground` que en hover pasa a `text-foreground` **+ fondo `bg-secondary` redondeado** + hit-target ≥32px (`h-8 w-8`) + `focus-visible:ring-ring`. Mismo patrón en `Dialog` y `Sheet`. El cambio de color solo (sin fondo) no se percibe.

## Controles de formulario

- **Nunca `<input type="checkbox">`/`radio` crudos** — el navegador los pinta con el azul del SO (rompe la marca). Usar `Checkbox` / `RadioGroup` del DS (marcado en **tinta**, no azul).
- **Select: preferí `SelectMenu` al `<select>` nativo.** El `<select>` nativo en macOS despliega el menú **encima del ítem seleccionado** (no se puede posicionar por CSS) y no se puede estilar. `SelectMenu` (basado en `Dropdown`/Radix) abre **hacia abajo**, en portal, con el ancho del trigger y check en el elegido. Misma API que un select: `value` / `onChange(value)` / `options`.
  - Para `value=""` como opción **real** (ej. "Todos"), incluíla en `options`. Para **placeholder**, omitíla y pasá `placeholder`.
  - `Select` (nativo estilado) queda para formularios densos o casos donde el nativo alcanza; para todo lo visible/on-brand, `SelectMenu`.

## Governance

- **Nunca colores crudos.** `bg-blue-600` ❌ → `bg-primary`/token ✅. Corré `npm run lint:ds`.
- Componentes nuevos: tokens semánticos, nunca primitives directos en el markup de pantalla.
- Light mode only (sin dark mode por decisión de producto).
