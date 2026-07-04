"use client";

import { Toaster as Sonner } from "sonner";

// Toaster tematizado con los tokens POW. Montar una vez en el layout y disparar
// con `toast()` / `toast.success()` / `toast.error()` desde cualquier lado.
export function Toaster() {
  return (
    <Sonner
      theme="light"
      position="bottom-right"
      toastOptions={{
        style: {
          background: "var(--card)",
          color: "var(--foreground)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          boxShadow: "var(--shadow-md)",
        },
        classNames: {
          success: "[&_[data-icon]]:text-[var(--success)]",
          error: "[&_[data-icon]]:text-[var(--danger)]",
          warning: "[&_[data-icon]]:text-[var(--warning)]",
        },
      }}
    />
  );
}

export { toast } from "sonner";
