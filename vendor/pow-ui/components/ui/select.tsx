import { cn } from "../../lib/utils";
import { forwardRef } from "react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  /** Texto largo que se muestra como tooltip nativo al hacer hover sobre el
   *  ícono ⓘ a la derecha del label. Para contexto/ejemplos más extensos
   *  que el `helperText`. */
  tooltip?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, tooltip, options, placeholder, className, id, required, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
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
        <select
          ref={ref}
          id={selectId}
          required={required}
          aria-required={required || undefined}
          className={cn(
            "w-full h-9 px-3 rounded-[var(--radius)] border bg-card text-foreground text-sm",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
            "transition-colors",
            error ? "border-[var(--red-600)] bg-danger-subtle" : "border-input hover:border-[var(--gray-300)]",
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-danger">{error}</p>}
        {helperText && !error && (
          <p className="text-xs text-muted-foreground">{helperText}</p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";
