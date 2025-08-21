import { cn } from "@/lib/format";

export function Badge({
  children,
  variant = "slate",
}: {
  children: React.ReactNode;
  variant?: "slate" | "blue" | "purple";
}) {
  const map = {
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-200",
    blue: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
    purple: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  } as const;

  return (
    <span className={cn("px-2 py-0.5 rounded-lg text-xs", map[variant])}>
      {children}
    </span>
  );
}
