"use client";

import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "../../lib/utils";

export function Label({
  className,
  required,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root> & { required?: boolean }) {
  return (
    <LabelPrimitive.Root
      className={cn(
        "text-sm font-medium text-secondary-foreground select-none peer-disabled:opacity-50",
        className
      )}
      {...props}
    >
      {props.children}
      {required && <span className="text-danger ml-0.5" aria-hidden="true">*</span>}
    </LabelPrimitive.Root>
  );
}
