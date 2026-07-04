"use client";

import { useState } from "react";
import { Dialog } from "./dialog";
import { Button } from "./button";
import { Input } from "./input";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void> | void;
  /** Título del modal. Default: "Eliminar definitivamente" */
  title?: string;
  /** Nombre del recurso (ej. "Liquidación", "Factura"). Singular. */
  entityLabel: string;
  /** Identificador legible del registro (número de factura, período, etc.). */
  entityIdentifier: string;
  /** Texto adicional que se muestra arriba del input. */
  description?: React.ReactNode;
  /** Si `true`, requiere tipear ELIMINAR para habilitar el botón. Default true. */
  requireTyping?: boolean;
  /** Si `true`, muestra un input opcional de motivo que se guarda en deletion_log. */
  askReason?: boolean;
  /** Texto del botón de confirmación. Default: "Eliminar". */
  confirmLabel?: string;
  /** Estado externo de loading (mientras corre el server action). */
  loading?: boolean;
  /** Mensaje de error para mostrar abajo del modal. */
  error?: string | null;
}

const CONFIRM_TOKEN = "ELIMINAR";

export function DeleteConfirmDialog(props: Props) {
  // Render null when closed so the inner state (`typed`, `reason`) resets
  // naturally on the next open via component remount.
  if (!props.open) return null;
  return <DeleteConfirmDialogInner {...props} />;
}

function DeleteConfirmDialogInner({
  open,
  onClose,
  onConfirm,
  title = "Eliminar definitivamente",
  entityLabel,
  entityIdentifier,
  description,
  requireTyping = true,
  askReason = true,
  confirmLabel = "Eliminar",
  loading = false,
  error = null,
}: Props) {
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  // Loading propio: el onConfirm puede ser async (server action + refresh) y la
  // mayoría de los callers no pasan `loading`. Sin esto el botón no daba feedback
  // y los errores quedaban tragados (parecía "colgado" hasta refrescar a mano).
  const [busy, setBusy] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const isBusy = loading || busy;
  const shownError = error ?? internalError;

  async function handleConfirm() {
    if (isBusy) return;
    setInternalError(null);
    setBusy(true);
    try {
      await onConfirm(reason.trim() || undefined);
    } catch (e) {
      setInternalError(e instanceof Error ? e.message : "No se pudo completar la acción");
    } finally {
      setBusy(false);
    }
  }

  const canConfirm = !requireTyping || typed.trim().toUpperCase() === CONFIRM_TOKEN;

  return (
    <Dialog open={open} onClose={isBusy ? () => {} : onClose} title={title} size="md">
      <div className="space-y-4">
        <div className="rounded-md border border-danger/20 bg-danger-subtle p-3 text-sm text-[var(--red-600)]">
          <p className="font-semibold">Esta acción no se puede deshacer.</p>
          <p className="mt-1">
            Vas a eliminar <strong>{entityLabel.toLowerCase()}</strong>{" "}
            <span className="font-mono">{entityIdentifier}</span>.
          </p>
        </div>

        {description && <div className="text-sm text-muted-foreground">{description}</div>}

        {askReason && (
          <Input
            label="Motivo (opcional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej. registro duplicado, error de carga, etc."
            disabled={isBusy}
          />
        )}

        {requireTyping && (
          <Input
            label={`Tipeá ${CONFIRM_TOKEN} para confirmar`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={CONFIRM_TOKEN}
            disabled={isBusy}
            autoComplete="off"
          />
        )}

        {shownError && (
          <p className="text-sm text-[var(--red-600)] bg-danger-subtle border border-danger/20 rounded-md px-3 py-2">
            {shownError}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isBusy}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            loading={isBusy}
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
