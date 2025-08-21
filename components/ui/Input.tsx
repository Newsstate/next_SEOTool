import { cn } from "@/lib/format";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border bg-white/80 dark:bg-white/5",
        "border-slate-300 dark:border-slate-800",
        "px-3 py-2 text-sm outline-none",
        "focus:ring-2 ring-sky-500/30",
        className
      )}
      {...props}
    />
  );
}
