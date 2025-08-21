// lib/format.ts
import * as React from "react";

export function cn(...a: Array<string | false | undefined | null>) {
  return a.filter(Boolean).join(" ");
}

/** Safe clipboard copy:
 * - Works in modern browsers via navigator.clipboard
 * - Falls back to a hidden textarea
 * - On server (no window/navigator) returns false without throwing
 */
export async function copy(text: string) {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    if (typeof document !== "undefined") {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand ? document.execCommand("copy") : false;
      document.body.removeChild(ta);
      return !!ok;
    }
  } catch {
    // ignore
  }
  return false;
}

export function labelize(k: string) {
  return k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

// Overall PageSpeed score colors: <60 red, 60-79 yellow, 80-89 green, 90+ emerald
export function scoreBand(score?: number | null) {
  if (score == null) return "neutral" as const;
  if (score < 60) return "bad" as const;
  if (score < 80) return "warn" as const;
  if (score < 90) return "good" as const;
  return "great" as const;
}
export function scoreClass(score?: number | null) {
  const band = scoreBand(score);
  switch (band) {
    case "bad":
      return "bg-red-50 text-red-700 ring-1 ring-red-200";
    case "warn":
      return "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200";
    case "good":
      return "bg-green-50 text-green-700 ring-1 ring-green-200";
    case "great":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    default:
      return "bg-slate-50 text-slate-600 ring-1 ring-slate-200";
  }
}

export type TableProps = {
  headers: Array<React.ReactNode>;
  rows: Array<Array<React.ReactNode>>;
  dense?: boolean;
  className?: string;
};

/** Generic data table without JSX (safe in .ts files) */
export function DataTable(
  { headers, rows, dense = false, className = "" }: TableProps
): React.ReactElement {
  const thead = React.createElement(
    "thead",
    null,
    React.createElement(
      "tr",
      null,
      ...headers.map((h, i) =>
        React.createElement(
          "th",
          {
            key: i,
            scope: "col",
            className:
              "text-left font-semibold text-slate-600 dark:text-slate-300 px-3 py-2",
          },
          h
        )
      )
    )
  );

  const tbody =
    rows.length === 0
      ? React.createElement(
          "tbody",
          null,
          React.createElement(
            "tr",
            null,
            React.createElement(
              "td",
              { colSpan: headers.length, className: "px-3 py-4 text-slate-500" },
              "No data."
            )
          )
        )
      : React.createElement(
          "tbody",
          null,
          ...rows.map((r, ri) =>
            React.createElement(
              "tr",
              {
                key: ri,
                className:
                  "bg-white dark:bg-slate-900 rounded-xl shadow-sm ring-1 ring-slate-200/60 dark:ring-white/10",
              },
              ...r.map((cell, ci) =>
                React.createElement(
                  "td",
                  {
                    key: ci,
                    className: cn("align-top px-3", dense ? "py-1" : "py-2"),
                  },
                  cell as React.ReactNode
                )
              )
            )
          )
        );

  return React.createElement(
    "table",
    {
      role: "table",
      className: `w-full text-sm border-separate border-spacing-y-2 ${className}`,
    },
    thead,
    tbody
  );
}

// Back-compat alias if other files import { Table }
export const Table = DataTable;

// Default export (optional convenience)
export default DataTable;
