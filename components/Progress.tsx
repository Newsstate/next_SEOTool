"use client";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/format";

type StageKey = "fetch" | "parse" | "links" | "robots" | "pagespeed" | "rendered";
const labels: Record<StageKey, string> = {
  fetch: "Fetch HTML",
  parse: "Parse & Structured Data",
  links: "Links Audit",
  robots: "Robots & Sitemaps",
  pagespeed: "PageSpeed",
  rendered: "Rendered DOM",
};

export function ProgressBar({
  stages,
  showRendered,
  showPageSpeed,
}: {
  stages: Partial<Record<StageKey, "idle" | "start" | "done" | "error" | "skipped">>;
  showRendered: boolean;
  showPageSpeed: boolean;
}) {
  const baseOrder: StageKey[] = ["fetch", "parse", "links", "robots", "pagespeed", "rendered"];
  const active = baseOrder.filter((k) => (k === "rendered" ? showRendered : k === "pagespeed" ? showPageSpeed : true));

  const completed = active.filter((k) => stages[k] === "done").length;
  const total = active.length;
  const pct = Math.round((completed / total) * 100);

  return (
    <div className="space-y-3">
      <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
        <div
          className={cn(
            "h-full transition-all",
            pct < 60 ? "bg-rose-500" : pct < 80 ? "bg-amber-500" : "bg-green-500"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {active.map((k) => {
          const s = stages[k] || "idle";
          const variant =
            s === "done" ? "success" : s === "error" ? "danger" : s === "skipped" ? "neutral" : "warning";
          return (
            <div key={k} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/60 dark:border-slate-800 px-3 py-2">
              <span className="text-xs">{labels[k]}</span>
              <Badge variant={variant as any}>
                {s === "done" ? "Done" : s === "error" ? "Error" : s === "skipped" ? "Skipped" : "…"}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}
