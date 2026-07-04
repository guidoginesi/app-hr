import { cn } from "../../lib/utils";

type Variant =
  | "default"
  | "secondary"
  | "destructive"
  | "success"
  | "warning"
  | "promo"
  | "outline"
  // categóricos (tipo/categoría, no estado)
  | "cat-violet"
  | "cat-cyan"
  | "cat-pink";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
  dot?: boolean;
}

const variantClasses: Record<Variant, string> = {
  default: "bg-accent text-accent-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  destructive: "bg-danger-subtle text-[var(--red-600)]",
  success: "bg-success-subtle text-[var(--green-700)]",
  warning: "bg-warning-subtle text-[var(--amber-600)]",
  promo: "bg-promo text-promo-foreground",
  outline: "border text-muted-foreground bg-transparent",
  "cat-violet": "bg-cat-violet-subtle text-cat-violet",
  "cat-cyan": "bg-cat-cyan-subtle text-cat-cyan",
  "cat-pink": "bg-cat-pink-subtle text-cat-pink",
};

const dotColors: Record<Variant, string> = {
  default: "bg-brand",
  secondary: "bg-muted-foreground",
  destructive: "bg-danger",
  success: "bg-success",
  warning: "bg-warning",
  promo: "bg-[var(--yellow-dark)]",
  outline: "bg-muted-foreground",
  "cat-violet": "bg-cat-violet",
  "cat-cyan": "bg-cat-cyan",
  "cat-pink": "bg-cat-pink",
};

export function Badge({ variant = "default", dot, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", dotColors[variant])} />
      )}
      {children}
    </span>
  );
}
