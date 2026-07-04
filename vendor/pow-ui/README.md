# @pow/ui — POW Design System

Sistema de diseño compartido entre apps POW. **Light mode**, marca fija: tinta
`#1A1D23` (primary) + naranja `#FE722B` (brand/accent). Construido sobre
**Tailwind v4 + Radix + CVA**.

> **Definiciones y patrones:** ver [`GUIDELINES.md`](./GUIDELINES.md) — cuándo usar
> Tabs vs SegmentedControl vs TabNav, orden de tablas, PageHeader, KPIs, color, etc.

> Estado: **paquete del workspace** (`@pow/ui`). Los 39 componentes viven en
> `packages/pow-ui/components/ui/` con un `cn` interno (`lib/utils.ts`) — sin
> dependencias de app-adm, portable. app-adm lo consume vía el alias
> `@/components/ui/*` → el paquete (cero cambios en sus imports); otras apps lo
> importan como `@pow/ui/components/ui/*`. Falta solo publicarlo a un registry.

---

## Adoptar el DS en otra app (3 pasos)

### 1. Tokens / theme
En tu CSS global, después de Tailwind:

```css
@import "tailwindcss";
@import "@pow/ui/theme.css";   /* o ruta relativa al archivo */
```

Esto te da **todos los tokens** (`bg-primary`, `text-muted-foreground`,
`bg-success-subtle`, `bg-brand`, …), la **escala tipográfica** (`type-display`
… `type-micro`), `.card`, `.nums-tabular`, y los tokens de `--z-*`, `--duration-*`.

> El `html { font-size: 90% }` y el `body { … }` **NO** vienen en el theme —
> son shell de cada app. Definilos vos si los querés.

### 2. Fuente de marca (Helvetica Now Var)
Los títulos usan `var(--font-display)`, que cae a `--font-helvetica-now`. En Next:

```ts
import localFont from "next/font/local";
const helveticaNow = localFont({
  src: [{ path: "./fonts/HelveticaNowVar.ttf", weight: "100 900" }],
  variable: "--font-helvetica-now",
});
// <html className={helveticaNow.variable}>
```

Sin esto, los títulos caen al stack del sistema (funciona, sin la marca).

### 3. Dependencias
Instalá las peer deps (ver `package.json`): `class-variance-authority`, `clsx`,
`tailwind-merge`, `lucide-react`, `date-fns`, `cmdk`, `sonner` y los `@radix-ui/*`.

---

## Componentes (37)

**Base:** Button, Badge, Input, Select, Textarea, Label, Checkbox, RadioGroup,
Switch, CurrencyInput.
**Layout/data:** Card, Table, Tabs, Stat, PageHeader, FilterBar, NavSidebar,
Separator, Avatar, Pagination, Breadcrumb, Skeleton, EmptyState.
**Overlays:** Dialog, DeleteConfirmDialog, Sheet, Popover, Dropdown, Tooltip,
Command, Combobox, DatePicker (+ Calendar), Accordion, Toaster.

Galería viva con todos los ejemplos: ruta `/design-system` en app-adm.

---

## Reglas de uso (governance)

1. **Nunca colores crudos.** `bg-blue-600` ❌ → `bg-primary` ✅. `text-gray-500` ❌
   → `text-muted-foreground` ✅. Corré `npm run lint:ds` para detectarlos.
2. **Un `primary` (tinta) por vista**; el resto outline/ghost. `brand` (naranja)
   es acento, no acción principal.
3. **Estados con tokens semánticos:** success/warning/danger + su `-subtle`.
4. **Montos** siempre con `nums-tabular`.
5. **Radius** vía `rounded-[var(--radius)]`, no valores fijos.

---

## Extracción a paquete (Fase 3)

Hecho (workspace local):
1. ✅ Componentes en `packages/pow-ui/components/ui/` con `cn` interno (`lib/utils.ts`).
2. ✅ Workspace npm (`"workspaces": ["packages/*"]`) → `node_modules/@pow/ui` symlinkeado.
3. ✅ app-adm consume vía alias `@/components/ui/*` → el paquete (sin tocar sus imports);
   Tailwind escanea el paquete (`@source` en globals.css).

Pendiente (para reusar desde otras apps):
- Publicar `@pow/ui` a un registry privado (GitHub Packages / npm privado) y, en cada
  app consumidora, importar `@pow/ui/components/ui/*` + `transpilePackages: ["@pow/ui"]`.

La capa de tokens (`theme.css`) ya es 100% portable y no requiere nada de esto.
