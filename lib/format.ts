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

// PageSpeed colors: <60 red, 60-79 yellow, 80+ green
export function scoreVariant(score?: number) {
  if (score == null) return "neutral";
  if (score < 60) return "danger";
  if (score < 80) return "warning";
  return "success";
}

export function fmtMs(v?: number | null) {
  if (v == null) return "—";
  return `${Math.round(v)} ms`;
}

export function fmtSec(v?: number | null) {
  if (v == null) return "—";
  const s = v / 1000;
  return `${s.toFixed(s < 1 ? 2 : 1)} s`;
}

export function statusVariantFromCode(code?: number) {
  if (!code) return "neutral";
  if (code >= 200 && code < 300) return "success";
  if (code >= 300 && code < 400) return "blue"; // info-ish
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
  return m.displayValue ?? (typeof m.numericValue === "number" ? m.numericValue : "—");
}
