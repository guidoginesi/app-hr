import { cn } from "../../lib/utils";
import { Info, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

type Variant = "info" | "success" | "warning" | "danger";

const styles: Record<Variant, { box: string; icon: typeof Info; iconColor: string }> = {
  info: { box: "bg-accent border-[var(--orange-100)] text-foreground", icon: Info, iconColor: "text-brand" },
  success: { box: "bg-success-subtle border-success/20 text-foreground", icon: CheckCircle2, iconColor: "text-[var(--green-700)]" },
  warning: { box: "bg-warning-subtle border-warning/30 text-foreground", icon: AlertTriangle, iconColor: "text-[var(--amber-600)]" },
  danger: { box: "bg-danger-subtle border-danger/20 text-foreground", icon: XCircle, iconColor: "text-[var(--red-600)]" },
};

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  title?: string;
}

export function Alert({ variant = "info", title, className, children, ...props }: AlertProps) {
  const s = styles[variant];
  const Icon = s.icon;
  return (
    <div className={cn("flex gap-3 rounded-[var(--radius)] border p-3", s.box, className)} role="alert" {...props}>
      <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", s.iconColor)} />
      <div className="min-w-0 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "text-muted-foreground")}>{children}</div>}
      </div>
    </div>
  );
}
