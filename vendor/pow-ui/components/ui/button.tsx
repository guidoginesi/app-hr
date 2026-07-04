import { cn } from "../../lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
  {
    variants: {
      variant: {
        // acción principal — tinta POW
        primary:
          "bg-primary text-primary-foreground hover:bg-[var(--primary-hover)] shadow-sm",
        // acento de marca — naranja POW (texto negro = accesible)
        brand:
          "bg-brand text-brand-foreground hover:bg-[var(--orange-700)] shadow-sm",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[var(--gray-200)]",
        destructive:
          "bg-danger text-danger-foreground hover:bg-[var(--red-600)] shadow-sm",
        ghost:
          "bg-transparent text-muted-foreground hover:text-foreground hover:bg-secondary",
        outline:
          "border bg-card text-secondary-foreground hover:bg-muted",
      },
      size: {
        sm: "h-7 px-2.5 text-xs rounded-[var(--radius)]",
        md: "h-8 px-3.5 text-sm rounded-[var(--radius)]",
        lg: "h-10 px-5 text-sm rounded-[var(--radius)]",
        icon: "h-8 w-8 rounded-[var(--radius)]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, loading, className, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(buttonVariants({ variant, size }), "relative", className)}
        {...props}
      >
        {/* Spinner superpuesto y centrado: el botón NO cambia de ancho al cargar. */}
        {loading && (
          <span className="absolute inset-0 grid place-items-center" aria-hidden>
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </span>
        )}
        {/* El contenido reserva el ancho aun oculto (visibility:hidden, no display:none). */}
        <span className={cn("inline-flex items-center justify-center", loading && "invisible")}>
          {children}
        </span>
      </button>
    );
  }
);

Button.displayName = "Button";

export { buttonVariants };
