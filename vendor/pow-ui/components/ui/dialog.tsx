"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
  "2xl": "max-w-4xl",
};

export function Dialog({ open, onClose, title, description, children, size = "md" }: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const mouseDownOnOverlay = useRef(false);
  // Se mantiene montado durante el fade-out: render sigue true mientras anima la salida.
  const [render, setRender] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setRender(true);
      setClosing(false);
    } else if (render) {
      setClosing(true);
      const t = setTimeout(() => setRender(false), 240); // = duración de anim-dialog-out
      return () => clearTimeout(t);
    }
  }, [open, render]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!render) return null;

  return (
    <div
      ref={overlayRef}
      className={cn(
        "fixed inset-0 z-[var(--z-overlay)] flex items-center justify-center p-4",
        closing && "pointer-events-none"
      )}
      onMouseDown={(e) => {
        mouseDownOnOverlay.current = e.target === overlayRef.current;
      }}
      onMouseUp={(e) => {
        if (mouseDownOnOverlay.current && e.target === overlayRef.current) onClose();
        mouseDownOnOverlay.current = false;
      }}
    >
      <div className={cn("absolute inset-0 bg-black/30 backdrop-blur-sm", closing ? "anim-overlay-out" : "anim-overlay-in")} />
      <div
        className={cn(
          "relative w-full bg-popover text-popover-foreground rounded-2xl shadow-xl border flex flex-col max-h-[90vh]",
          closing ? "anim-dialog-out" : "anim-dialog-in",
          sizeClasses[size]
        )}
      >
        {title && (
          <div className="flex items-start justify-between px-6 pt-5 pb-4 shrink-0">
            <div>
              <h2 className="text-base font-semibold text-foreground">{title}</h2>
              {description && (
                <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="ml-4 -mr-1.5 -mt-1 grid h-8 w-8 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className={cn("px-6 pb-6 overflow-y-auto", title && "pt-0")}>{children}</div>
      </div>
    </div>
  );
}
