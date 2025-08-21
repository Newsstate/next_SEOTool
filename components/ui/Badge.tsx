import { cn } from "@/lib/format";

type Variant =
  | "slate"
  | "blue"
  | "purple"
  | "success"
  | "warning"
  | "danger"
  | "neutral";

export function Badge({
  children,
  variant = "slate",
  className,
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  const map: Record<Variant, string> = {
    slate:
      "bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-200",
    blue:
      "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
    purple:
      "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
    success:
      "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
    warning:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    danger:
      "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
    neutral:
      "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  };

  return (
    <span className={cn("px-2 py-0.5 rounded-lg text-xs", map[variant], className)}>
      {children}
    </span>
  );
}
