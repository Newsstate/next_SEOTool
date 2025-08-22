// lib/format.ts
import * as React from "react";

/* ---------- tiny utils ---------- */

export function cn(...a: Array<string | false | undefined | null>) {
  return a.filter(Boolean).join(" ");
}

/** Safe clipboard copy for client-only; SSR returns false. */
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
  } catch {}
  return false;
}

export function labelize(k: string) {
  return k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

/* ---------- color/variant helpers ---------- */

function variant(color: "slate"|"sky"|"red"|"yellow"|"green"|"emerald"|"violet") {
  const map: Record<string, string> = {
    slate:   "bg-slate-50 text-slate-700 ring-1 ring-slate-200",
    sky:     "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
    red:     "bg-red-50 text-red-700 ring-1 ring-red-200",
    yellow:  "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200",
    green:   "bg-green-50 text-green-700 ring-1 ring-green-200",
    emerald: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    violet:  "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  };
  return map[color];
}

/** Overall PageSpeed score bands */
export function scoreBand(score?: number | null) {
  if (score == null) return "neutral" as const;
  if (score < 60) return "bad" as const;    // red
  if (score < 80) return "warn" as const;   // yellow
  if (score < 90) return "good" as const;   // green
  return "great" as const;                  // emerald
}

/** Old callers may use scoreClass; keep for compatibility. */
export function scoreClass(score?: number | null) {
  const band = scoreBand(score);
  switch (band) {
    case "bad":   return variant("red");
    case "warn":  return variant("yellow");
    case "good":  return variant("green");
    case "great": return variant("emerald");
    default:      return variant("slate");
  }
}

/** What Results.tsx expects: return Tailwind classes by score. */
export function scoreVariant(score?: number | null) {
  return scoreClass(score);
}

/** Bool → classes (used for pass/fail chips). */
export function boolVariant(v?: boolean | null) {
  if (v === true)  return variant("green");
  if (v === false) return variant("red");
  return variant("slate");
}

/** HTTP status → classes */
export function statusVariantFromCode(code?: number | null) {
  if (!code) return variant("slate");
  if (code >= 200 && code < 300) return variant("green");
  if (code >= 300 && code < 400) return variant("sky");
  if (code >= 400 && code < 500) return variant("yellow");
  if (code >= 500)               return variant("red");
  return variant("slate");
}

/* ---------- Lighthouse metric helpers ---------- */
/** Thresholds based on Lighthouse recommendations */
const METRIC_THRESHOLDS: Record<string, {good:number; ni:number; unit:"ms"|"s"|"unitless"}> = {
  // Core Web Vitals / common audits
  "first-contentful-paint":     { good: 1800, ni: 3000, unit: "ms" },
  "largest-contentful-paint":   { good: 2500, ni: 4000, unit: "ms" },
  "speed-index":                { good: 3400, ni: 5800, unit: "ms" },
  "total-blocking-time":        { good: 200,  ni: 600,  unit: "ms" },
  "cumulative-layout-shift":    { good: 0.1,  ni: 0.25, unit: "unitless" },
  "server-response-time":       { good: 600,  ni: 1200, unit: "ms" },
};

function toNumber(x: any): number | null {
  if (x == null) return null;
  if (typeof x === "number") return x;
  if (typeof x === "string") {
    const n = Number(x);
    return isNaN(n) ? null : n;
  }
  if (typeof x === "object") {
    if (typeof (x as any).numericValue === "number") return (x as any).numericValue;
    if (typeof (x as any).displayValue === "string") {
      const m = (x as any).displayValue.match(/([\d.]+)/);
      return m ? Number(m[1]) : null;
    }
  }
  return null;
}

/** Color classes for a specific Lighthouse metric by id */
export function metricVariant(metricId: string, value: any): string {
  const id = metricId.toLowerCase();
  const t = METRIC_THRESHOLDS[id];
  if (!t) return variant("slate");

  const num = toNumber(value);
  if (num == null) return variant("slate");

  const v = num;

  if (id === "cumulative-layout-shift") {
    if (v <= t.good) return variant("green");
    if (v <= t.ni)   return variant("yellow");
    return variant("red");
  } else {
    if (v <= t.good) return variant("green");
    if (v <= t.ni)   return variant("yellow");
    return variant("red");
  }
}

/** Human-readable value for a Lighthouse metric */
export function metricValue(metricId: string, value: any): string {
  const id = metricId.toLowerCase();
  const t = METRIC_THRESHOLDS[id];
  if (!t) {
    if (value && typeof value.displayValue === "string") return value.displayValue;
    const n = toNumber(value);
    return n == null ? "—" : String(n);
  }

  const n = toNumber(value);
  if (n == null) {
    if (value && typeof value.displayValue === "string") return value.displayValue;
    return "—";
  }

  if (id === "cumulative-layout-shift") {
    const s = (Math.round(n * 100) / 100).toFixed(2);
    return s.replace(/\.?0+$/, "");
  }

  if (t.unit === "ms") {
    if (n >= 1000) {
      const s = Math.round((n / 1000) * 100) / 100;
      return `${s.toFixed(2).replace(/\.?0+$/, "")} s`;
    }
    return `${Math.round(n)} ms`;
  }

  return String(n);
}

/* ---------- Non-JSX DataTable component ---------- */

export type TableProps = {
  headers: Array<React.ReactNode>;
  rows: Array<Array<React.ReactNode>>;
  dense?: boolean;
  className?: string;
};

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
            className: "text-left font-semibold text-slate-600 dark:text-slate-300 px-3 py-2",
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
                  { key: ci, className: cn("align-top px-3", dense ? "py-1" : "py-2") },
                  cell as React.ReactNode
                )
              )
            )
          )
        );

  return React.createElement(
    "table",
    { role: "table", className: `w-full text-sm border-separate border-spacing-y-2 ${className}` },
    thead,
    tbody
  );
}

// Back-compat alias if other files import { Table }
export const Table = DataTable;

// Default export (optional)
export default DataTable;

/* ---------- safe property helpers (NEW) ---------- */
export function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object";
}

export function safeCheckValue(v: unknown): string {
  try {
    if (!isRecord(v)) return v == null ? "—" : String(v);
    if (Object.prototype.hasOwnProperty.call(v, "value")) {
      const val = (v as any).value;
      return val == null || isRecord(val) ? JSON.stringify(val ?? null) : String(val);
    }
    const s = JSON.stringify(v);
    return s.length > 200 ? s.slice(0, 200) + "…" : s;
  } catch {
    return "—";
  }
}
