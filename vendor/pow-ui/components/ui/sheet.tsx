"use client";

import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;

const sides = {
  right:
    "inset-y-0 right-0 h-full w-full max-w-md border-l data-[state=open]:animate-[pow-slide-in-right_180ms_var(--ease-out)] data-[state=closed]:animate-[pow-slide-out-right_240ms_var(--ease-standard)_forwards]",
  left:
    "inset-y-0 left-0 h-full w-full max-w-md border-r data-[state=open]:animate-[pow-slide-in-left_180ms_var(--ease-out)] data-[state=closed]:animate-[pow-slide-out-left_240ms_var(--ease-standard)_forwards]",
};

export function SheetContent({
  className,
  side = "right",
  title,
  description,
  /** Sin header ni scroll forzados: el caller controla todo el layout (header/body/footer). */
  flush = false,
  children,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: keyof typeof sides;
  title?: string;
  description?: string;
  flush?: boolean;
}) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-[var(--z-overlay)] bg-black/30 backdrop-blur-sm data-[state=open]:animate-[pow-fade-in_120ms_var(--ease-out)] data-[state=closed]:animate-[pow-fade-out_240ms_var(--ease-standard)_forwards]" />
      <SheetPrimitive.Content
        aria-describedby={flush ? undefined : props["aria-describedby"]}
        className={cn(
          "fixed z-[var(--z-overlay)] flex flex-col bg-popover shadow-xl outline-none overflow-hidden",
          flush ? "" : "gap-4 p-6",
          sides[side],
          className
        )}
        {...props}
      >
        {flush ? (
          <>
            {/* Título accesible (Radix lo exige); el header visible lo provee el caller. */}
            {title && <SheetPrimitive.Title className="sr-only">{title}</SheetPrimitive.Title>}
            {children}
          </>
        ) : (
          <>
        {(title || description) && (
          <div className="flex items-start justify-between">
            <div>
              {title && <SheetPrimitive.Title className="type-title">{title}</SheetPrimitive.Title>}
              {description && (
                <SheetPrimitive.Description className="text-sm text-muted-foreground mt-0.5">
                  {description}
                </SheetPrimitive.Description>
              )}
            </div>
            <SheetPrimitive.Close
              aria-label="Cerrar"
              className="-mr-1.5 -mt-1 grid h-8 w-8 place-items-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-5 w-5" />
            </SheetPrimitive.Close>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
          </>
        )}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}
