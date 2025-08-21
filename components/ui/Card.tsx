import { cn } from "@/lib/format";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white/70 dark:bg-white/5 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}
