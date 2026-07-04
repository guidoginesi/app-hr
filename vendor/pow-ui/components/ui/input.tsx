import { cn } from "../../lib/utils";
import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  /** Texto largo (multi-línea OK) que se muestra como tooltip nativo al
   *  pasar el mouse sobre el ícono ⓘ a la derecha del label. Pensado para
   *  contexto/explicación más extensa que `helperText`. */
  tooltip?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, tooltip, className, id, required, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="flex items-center gap-1 text-sm font-medium text-secondary-foreground"
          >
            <span>
              {label}
              {required && (
                <span className="text-danger ml-0.5" aria-hidden="true">*</span>
              )}
            </span>
            {tooltip && (
              <span
                role="img"
                aria-label="Información"
                title={tooltip}
                tabIndex={0}
                className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-secondary text-muted-foreground text-[10px] font-semibold cursor-help hover:bg-[var(--gray-200)] hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
              >
                ?
              </span>
            )}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-required={required || undefined}
          className={cn(
            "w-full h-9 px-3 rounded-[var(--radius)] border bg-card text-foreground text-sm",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
            "placeholder:text-muted-foreground transition-colors",
            error
              ? "border-[var(--red-600)] bg-danger-subtle"
              : "border-input hover:border-[var(--gray-300)]",
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-xs text-danger">{error}</p>
        )}
        {helperText && !error && (
          <p className="text-xs text-muted-foreground">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
