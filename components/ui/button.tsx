import { cn } from "@/lib/format";

export function Button({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium",
        "bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950",
        "dark:bg-slate-100 dark:text-black dark:hover:bg-white",
        "shadow-sm transition-colors disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
