"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "../../lib/utils";

// Editor inline de fechas reprogramadas. Reusable para:
//  - Facturas pendientes (override de `expected_collection_date` vs `due_date`).
//  - Ocurrencias de gastos proyectados (override de `expected_payment_date`).
//
// `onSave(newDate | null)` recibe `null` cuando el usuario quiere limpiar el
// override. `fallbackDateISO` se usa solo para el label del botón "Limpiar"
// (cuando aplica). Si no se pasa, el botón "Limpiar" igual funciona pero no
// muestra la fecha de fallback.
//
// `mode` controla cómo se despliega el editor:
//   - "popover" (default): popover absolute sobre el label, sin afectar el
//     ancho de la columna. Útil cuando la columna es estrecha (cashflow).
//   - "inline": el editor reemplaza al label en flujo normal, manteniendo
//     todo en la misma fila. Útil cuando hay espacio (detalle del gasto).
export function ReprogramDateEditor({
  currentDateISO,
  fallbackDateISO,
  fallbackLabel,
  isOverridden,
  overriddenTitleSuffix,
  onSave,
  mode = "popover",
}: {
  currentDateISO: string;
  fallbackDateISO?: string;
  fallbackLabel: string;
  isOverridden: boolean;
  overriddenTitleSuffix: string;
  onSave: (newDate: string | null) => Promise<{ success: boolean; error?: string }>;
  mode?: "popover" | "inline";
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentDateISO);
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setValue(currentDateISO);
          setError(null);
          setEditing(true);
        }}
        className={`inline-flex items-center gap-1 hover:bg-secondary rounded px-1 py-0.5 transition-colors ${
          isOverridden ? "text-[var(--amber-600)] font-medium" : "text-muted-foreground"
        }`}
        title={
          isOverridden
            ? `${overriddenTitleSuffix.charAt(0).toUpperCase() + overriddenTitleSuffix.slice(1)}${
                fallbackDateISO ? ` · ${fallbackLabel} ${formatDate(fallbackDateISO)}` : ""
              } (clic para editar)`
            : "Clic para reprogramar la fecha proyectada (afecta sólo a este movimiento)"
        }
      >
        {formatDate(currentDateISO)}
        {isOverridden && <span className="text-[9px] uppercase">·rep</span>}
      </button>
    );
  }

  const save = (newDate: string | null) => {
    setError(null);
    startSaving(async () => {
      const result = await onSave(newDate);
      if (!result.success) {
        setError(result.error ?? "Error al guardar");
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  // Controles compartidos por ambos modos.
  const dateInput = (
    <input
      type="date"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      disabled={saving}
      autoFocus
      className="h-7 px-1.5 rounded border border-input text-[11px] focus:outline-none focus:ring-1 focus:ring-ring"
    />
  );
  const okButton = (
    <button
      type="button"
      onClick={() => save(value)}
      disabled={saving || !value}
      className="h-7 px-2 rounded bg-primary text-primary-foreground text-[10px] font-medium hover:bg-[var(--primary-hover)] disabled:opacity-50"
    >
      {saving ? "…" : "OK"}
    </button>
  );
  const cancelButton = (
    <button
      type="button"
      onClick={() => {
        setEditing(false);
        setError(null);
      }}
      disabled={saving}
      className="h-7 px-1.5 rounded text-muted-foreground text-[10px] hover:bg-secondary disabled:opacity-50"
    >
      ✕
    </button>
  );
  const clearButton = isOverridden ? (
    <button
      type="button"
      onClick={() => save(null)}
      disabled={saving}
      className="text-[10px] text-muted-foreground hover:text-foreground underline w-fit disabled:opacity-50"
      title={
        fallbackDateISO
          ? `Quitar override: vuelve a ${formatDate(fallbackDateISO)}`
          : `Quitar override: vuelve al ${fallbackLabel}`
      }
    >
      {fallbackDateISO
        ? `Limpiar (usar ${fallbackLabel} ${formatDate(fallbackDateISO)})`
        : `Limpiar (usar ${fallbackLabel})`}
    </button>
  ) : null;
  const errorLabel = error ? (
    <span className="text-[10px] text-[var(--red-600)]">{error}</span>
  ) : null;

  if (mode === "inline") {
    // Inline: el editor se monta en la misma fila pero anclado de forma
    // absoluta sobre un placeholder invisible que conserva el ancho del
    // label original. Así el editor no empuja las columnas vecinas (no
    // hace reflow horizontal ni vertical) y se ve integrado al row, sin
    // sombras/bordes que parezcan popover.
    return (
      <span className="relative inline-block" onClick={(e) => e.stopPropagation()}>
        <span className="invisible inline-flex items-center gap-1 px-1 py-0.5">
          {formatDate(currentDateISO)}
          {isOverridden && <span className="text-[9px] uppercase">·rep</span>}
        </span>
        <span className="absolute top-1/2 left-0 -translate-y-1/2 inline-flex items-center gap-1 bg-card border rounded-md px-1 py-0.5">
          {dateInput}
          {okButton}
          {cancelButton}
          {clearButton}
          {errorLabel}
        </span>
      </span>
    );
  }

  // Popover absolute: la columna es estrecha y no queremos que el row haga
  // reflow al abrir. Reservamos el ancho del label original.
  return (
    <span className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <span className="invisible inline-flex items-center gap-1 px-1 py-0.5">
        {formatDate(currentDateISO)}
        {isOverridden && <span className="text-[9px] uppercase">·rep</span>}
      </span>
      <div className="absolute top-0 left-0 z-30 flex flex-col gap-1 bg-card border rounded-md shadow-lg p-2 whitespace-nowrap">
        <div className="flex items-center gap-1">
          {dateInput}
          {okButton}
          {cancelButton}
        </div>
        {clearButton}
        {errorLabel}
      </div>
    </span>
  );
}
