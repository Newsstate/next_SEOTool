"use client";

export function Loader() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-200/70 dark:border-slate-800 p-4 bg-white/70 dark:bg-white/5 shadow-sm animate-pulse min-h-[120px]"
        >
          <div className="h-5 w-32 rounded bg-slate-200/80 dark:bg-slate-700 mb-3" />
          <div className="space-y-2">
            <div className="h-3 w-3/4 rounded bg-slate-200/80 dark:bg-slate-700" />
            <div className="h-3 w-2/3 rounded bg-slate-200/80 dark:bg-slate-700" />
            <div className="h-3 w-1/2 rounded bg-slate-200/80 dark:bg-slate-700" />
          </div>
        </div>
      ))}
    </div>
  );
}
