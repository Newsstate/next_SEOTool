// lib/format.ts
export function cn(...a: Array<string | false | undefined | null>) {
  return a.filter(Boolean).join(" ");
}

export async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function labelize(k: string) {
  return k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

// Overall PageSpeed score colors: <60 red, 60-79 yellow, 80+ green
export function scoreVariant(score?: number) {
  if (score == null) return "neutral";
  if (score < 60) return "danger";
  if (score < 80) return "warning";
  return "success";
}

export function statusVariantFromCode(code?: number) {
  if (!code) return "neutral";
  if (code >= 200 && code < 300) return "success";
  if (code >= 300 && code < 400) return "blue";
  if (code >= 400 && code < 500) return "warning";
  return "danger";
}

export function boolVariant(ok: boolean | undefined) {
  if (ok === true) return "success";
  if (ok === false) return "warning";
  return "neutral";
}

export function metricValue(m: any) {
  if (!m) return "—";
  if (typeof m.displayValue === "string") return m.displayValue;
  if (typeof m.numericValue === "number") return m.numericValue;
  return "—";
}

/** Lighthouse metric thresholds */
export function metricVariant(metricKey: string, audit: any) {
  const nv = typeof audit?.numericValue === "number" ? audit.numericValue : undefined;
  if (nv == null) return "neutral";

  // numericValue is in ms for most, unitless for CLS
  const ms = nv;
  switch (metricKey) {
    case "first-contentful-paint": // FCP
      // good ≤1.8s, NI 1.8–3s, poor >3s
      if (ms <= 1800) return "success";
      if (ms <= 3000) return "warning";
      return "danger";
    case "largest-contentful-paint": // LCP
      // good ≤2.5s, NI 2.5–4s, poor >4s
      if (ms <= 2500) return "success";
      if (ms <= 4000) return "warning";
      return "danger";
    case "cumulative-layout-shift": // CLS (unitless stored in numericValue)
      {
        const cls = nv; // already unitless
        if (cls <= 0.1) return "success";
        if (cls <= 0.25) return "warning";
        return "danger";
      }
    case "speed-index": // SI
      // good ≤3.4s, NI 3.4–5.8s, poor >5.8s
      if (ms <= 3400) return "success";
      if (ms <= 5800) return "warning";
      return "danger";
    case "total-blocking-time": // TBT
      // good ≤200ms, NI 200–600ms, poor >600ms
      if (ms <= 200) return "success";
      if (ms <= 600) return "warning";
      return "danger";
    case "server-response-time":
      // no strict standard; rough: ≤100ms good, ≤300ms NI, else poor
      if (ms <= 100) return "success";
      if (ms <= 300) return "warning";
      return "danger";
    default:
      return "neutral";
  }
}

/** Simple table helpers */
export function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<Array<string | number | boolean | null | undefined>>;
}) {
  return (
    <table className="w-full text-sm border-separate border-spacing-y-2">
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h} className="text-left font-semibold text-slate-600 dark:text-slate-300 pb-1">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="bg-white/70 dark:bg-white/5 rounded-xl overflow-hidden">
            {r.map((c, j) => (
              <td key={j} className="p-2 align-top border border-slate-200/60 dark:border-slate-800 rounded-lg">
                {String(c ?? "—")}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
