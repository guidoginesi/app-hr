"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

// ─── Formatting ───────────────────────────────────────────────────────────────

/**
 * Formats a raw string into ARS display format (dots for thousands, comma for
 * decimal) while the user is typing. Accepts both "." and "," as decimal
 * separators; normalizes to the Argentine convention.
 *
 * Examples:
 *   "150000"      → "150.000"
 *   "150000,"     → "150.000,"
 *   "150000,5"    → "150.000,5"
 *   "150000,50"   → "150.000,50"
 *   "150000.50"   → "150.000,50"  (dot auto-converted to comma)
 *   "1.234,50"    → "1.234,50"    (idempotent)
 */
export function formatArsLive(raw: string): string {
  if (!raw) return "";

  // Strip currency symbol and spaces (handles paste of "$1.234,50")
  const cleaned = raw.replace(/[$\s]/g, "");
  if (!cleaned) return "";

  // Determine decimal separator position.
  // When both . and , are present: whichever comes LAST is the decimal one.
  // Exception: if comma comes last and dot comes after it → dot is decimal (US paste).
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  let intRaw: string;
  let decRaw: string | null = null;
  let hasTrailingSep = false;

  if (lastComma !== -1 && (lastDot === -1 || lastDot < lastComma)) {
    // Comma is decimal separator (standard AR)
    intRaw = cleaned.slice(0, lastComma).replace(/\D/g, "");
    const dec = cleaned.slice(lastComma + 1).replace(/\D/g, "");
    decRaw = dec.slice(0, 2);
    hasTrailingSep = dec === "";
  } else if (lastDot !== -1) {
    const afterDot = cleaned.slice(lastDot + 1).replace(/\D/g, "");
    if (afterDot.length <= 2) {
      // Dot is decimal separator
      intRaw = cleaned.slice(0, lastDot).replace(/\D/g, "");
      decRaw = afterDot;
      hasTrailingSep = afterDot === "";
    } else {
      // Multiple digits after dot → dots are thousands separators
      intRaw = cleaned.replace(/\D/g, "");
    }
  } else {
    intRaw = cleaned.replace(/\D/g, "");
  }

  if (!intRaw && decRaw === null && !hasTrailingSep) return "";

  // Format integer with thousands dots (es-AR locale)
  const intFormatted = intRaw
    ? parseInt(intRaw, 10).toLocaleString("es-AR", { maximumFractionDigits: 0 })
    : "0";

  if (decRaw !== null || hasTrailingSep) {
    return `${intFormatted},${decRaw ?? ""}`;
  }
  return intFormatted;
}

/** Convert display value to a raw string `parseArDecimal` can consume. */
export function displayToRaw(display: string): string {
  // "150.000,50" → "150000,50"  (parseArDecimal strips dots then converts comma)
  return display.replace(/\./g, "");
}

// ─── Component ────────────────────────────────────────────────────────────────

type CurrencyInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value" | "type" | "inputMode"
> & {
  label?: string;
  error?: string;
  helperText?: string;
  /** Raw string value as stored by parent (e.g. "150000,50" or "150000"). */
  value?: string;
  /** Called with the raw value (dots stripped). `parseArDecimal` handles it. */
  onChange?: (value: string) => void;
  /** Symbol prefix. Defaults to "$". Pass null to hide. */
  prefix?: string | null;
};

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      label,
      error,
      helperText,
      value = "",
      onChange,
      prefix = "$",
      className,
      id,
      required,
      disabled,
      placeholder,
      onBlur,
      onFocus,
      ...props
    },
    ref
  ) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    const [isFocused, setIsFocused] = useState(false);
    const [display, setDisplay] = useState(() => formatArsLive(value));

    // Sync when parent changes value externally (e.g. form reset)
    const prevValueRef = useRef(value);
    useEffect(() => {
      if (!isFocused && value !== prevValueRef.current) {
        prevValueRef.current = value;
        setDisplay(formatArsLive(value));
      }
    }, [value, isFocused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatArsLive(e.target.value);
      setDisplay(formatted);
      prevValueRef.current = displayToRaw(formatted);
      onChange?.(displayToRaw(formatted));
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      // Finalize: remove trailing comma, keep trailing zeros
      const finalized = formatArsLive(display.replace(/,$/, ""));
      setDisplay(finalized);
      prevValueRef.current = displayToRaw(finalized);
      onChange?.(displayToRaw(finalized));
      onBlur?.(e);
    };

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="flex items-center gap-1 text-sm font-medium text-secondary-foreground"
          >
            {label}
            {required && (
              <span className="text-danger ml-0.5" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}
        <div className="relative">
          {prefix && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            type="text"
            inputMode="decimal"
            required={required}
            disabled={disabled}
            value={display}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder ?? "0"}
            aria-label={props["aria-label"] ?? label}
            className={cn(
              "w-full h-9 rounded-[var(--radius)] border bg-card text-foreground text-sm nums-tabular",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
              "placeholder:text-muted-foreground transition-colors",
              prefix ? "pl-7 pr-3" : "px-3",
              error ? "border-[var(--red-600)] bg-danger-subtle" : "border-input hover:border-[var(--gray-300)]",
              disabled && "opacity-50 cursor-not-allowed bg-muted",
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        {helperText && !error && <p className="text-xs text-muted-foreground">{helperText}</p>}
      </div>
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";
