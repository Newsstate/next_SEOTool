// components/Results.tsx
"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import {
  cn,
  labelize,
  scoreVariant,
  statusVariantFromCode,
  boolVariant,
  metricVariant,
  metricValue,
  DataTable,
  safeCheckValue, // NEW
} from "@/lib/format";

type Props = {
  data: any | null;
};

function Chip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-xs ring-1", className)}>
      {children}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-200/60 dark:ring-white/10 shadow-sm">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between">
        <span>{title}</span>
        <span className="text-slate-400 group-open:rotate-180 transition-transform">⌄</span>
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

function KeyVal({ k, v }: { k: string; v: any }) {
  const txt = safeCheckValue(v); // NEW: robust display for objects/primitives
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200/60 dark:border-slate-800 px-3 py-2">
      <span className="text-xs text-slate-500">{k}</span>
      <span className="text-xs text-slate-800 dark:text-slate-200">{txt}</span>
    </div>
  );
}

export default function Results({ data }: Props) {
  if (!data) {
    return (
      <Card className="p-6">
        <p className="text-sm text-slate-500">No results yet. Run a scan to see details.</p>
      </Card>
    );
  }

  const checks = data.checks || {};
  const pagespeed = data.pagespeed || {};
  const net = data.performance || {};

  /* ----------------------- Overview ----------------------- */
  const overviewRows: Array<[string, React.ReactNode]> = [
    ["Final URL", data?.performance?.final_url || data?.url || "—"],
    ["Status", <Chip key="st" className={statusVariantFromCode(data?.status_code)}>{data?.status_code ?? "—"}</Chip>],
    ["Title", data?.title || "—"],
    ["Meta description", data?.description || "—"],
    ["Canonical", data?.canonical || "—"],
    ["AMP URL", data?.amp_url || (data?.is_amp ? "(this page is AMP)" : "—")],
  ];

  /* ---------------- Indexability & Flags (using safeCheckValue) ---------------- */
  const indexabilityRows: Array<[string, any]> = [
    ["Indexable",            checks.indexable],
    ["Robots meta index",    checks.robots_meta_index],
    ["Follow",               checks.robots_meta_follow],
    ["X-Robots-Tag",         checks.x_robots_tag],
    ["Lang attr",            checks.lang],
    ["Charset",              checks.charset],
    ["Compression",          checks.compression],
    ["Viewport Meta",        checks.viewport_meta],
  ];

  /* ----------------------- Structured Data ----------------------- */
  const sdCounts = [
    ["JSON-LD blocks", (data?.json_ld || []).length],
    ["Microdata items", data?.microdata_summary?.count ?? 0],
    ["RDFa nodes", data?.rdfa_summary?.count ?? 0],
  ];

  /* ----------------------- Performance (PageSpeed + Network) ----------------------- */
  const psMobile = pagespeed?.mobile || {};
  const psDesktop = pagespeed?.desktop || {};
  const psScoreMobile = typeof psMobile.score === "number" ? psMobile.score : null;
  const psScoreDesktop = typeof psDesktop.score === "number" ? psDesktop.score : null;

  const metricItem = (id: string, label: string, obj: any) => {
    const audit = obj?.metrics?.[id];
    return (
      <div key={id} className="rounded-lg border border-slate-200/60 dark:border-slate-800 p-2 flex items-center justify-between">
        <span className="text-slate-500 text-xs">{label}</span>
        <span className={cn("text-xs rounded px-2 py-0.5 ring-1", metricVariant(id, audit))}>
          {metricValue(id, audit)}
        </span>
      </div>
    );
  };

  /* ----------------------- Rendered Compare (table) ----------------------- */
  const rc = data?.rendered_diff || null;
  const hasRendered = !!rc?.rendered;
  const rcTable =
    hasRendered && Array.isArray(rc.matrix)
      ? (
        <DataTable
          headers={["Check", "Before", "After", "Changed?"]}
          rows={rc.matrix.map((r: any, i: number) => [
            r.label,
            String(r.before ?? "—"),
            String(r.after ?? "—"),
            r.changed ? "Yes" : "No",
          ])}
        />
      )
      : <p className="text-sm text-slate-500">Render skipped or failed.</p>;

  const rcSummary =
    hasRendered
      ? (
        <DataTable
          headers={["Field", "Before", "After"]}
          rows={[
            ["Title", rc.before?.title ?? "—", rc.after?.title ?? "—"],
            ["Meta Description", rc.before?.description ?? "—", rc.after?.description ?? "—"],
            ["Canonical", rc.before?.canonical ?? "—", rc.after?.canonical ?? "—"],
            ["H1 Count", String(rc.before?.h1_count ?? "—"), String(rc.after?.h1_count ?? "—")],
          ]}
          dense
        />
      )
      : null;

  /* ----------------------- AMP Compare (if provided) ----------------------- */
  const ampCmp = data?.amp_compare;
  const ampCmpTable = ampCmp?.rows
    ? (
      <DataTable
        headers={["Metric", "Non-AMP", "AMP", "Changed?"]}
        rows={ampCmp.rows.map((r: any) => [
          r.label,
          String(r.non_amp ?? "—"),
          String(r.amp ?? "—"),
          r.changed ? "Yes" : "No",
        ])}
      />
    ) : null;

  /* ----------------------- Links / Crawlability extras ----------------------- */
  const sitemapsFromRobots = data?.crawl_checks?.sitemaps || [];
  const sitemapMembership = data?.sitemap_membership || null;

  return (
    <div className="space-y-4">
      {/* Overview */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold mb-3">Overview</h2>
        <div className="grid md:grid-cols-2 gap-2">
          {overviewRows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between rounded-lg border border-slate-200/60 dark:border-slate-800 px-3 py-2">
              <span className="text-xs text-slate-500">{k}</span>
              <span className="text-xs text-slate-800 dark:text-slate-200">{typeof v === "string" ? v : v}</span>
            </div>
          ))}
          {data?.is_amp && data?.canonical && (
            <div className="md:col-span-2">
              <div className="rounded-lg bg-amber-50 text-amber-800 ring-1 ring-amber-200 px-3 py-2 text-xs">
                This appears to be an AMP page. You can review the full Non-AMP vs AMP comparison in the “AMP Compare” section below.
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Indexability & Flags */}
      <Section title="Links & Crawlability — Indexability & Flags">
        <div className="grid md:grid-cols-2 gap-2">
          {indexabilityRows.map(([k, v]) => (
            <KeyVal key={k} k={k} v={v} />
          ))}
        </div>

        {/* Sitemaps discovered from robots.txt */}
        <div className="mt-4">
          <h4 className="text-sm font-semibold mb-2">Sitemaps (from robots.txt)</h4>
          {sitemapsFromRobots.length === 0 ? (
            <p className="text-sm text-slate-500">No sitemaps discovered in robots.txt.</p>
          ) : (
            <ul className="list-disc pl-5 text-sm space-y-1">
              {sitemapsFromRobots.map((s: any, i: number) => (
                <li key={i}>
                  <a className="text-sky-700 hover:underline" href={s.url} target="_blank" rel="noreferrer">
                    {s.url}
                  </a>
                  {s.status ? <span className="ml-2 text-xs text-slate-500">({s.status})</span> : null}
                  {s.note ? <span className="ml-2 text-xs text-slate-500">— {s.note}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Membership of scanned URL */}
        <div className="mt-4">
          <h4 className="text-sm font-semibold mb-2">Sitemap Membership</h4>
          {sitemapMembership?.checked ? (
            <div className="space-y-2">
              <KeyVal k="Found in any sitemap?" v={sitemapMembership.found ? "Yes" : "No"} />
              {sitemapMembership.matches?.length ? (
                <div className="text-sm">
                  <div className="text-slate-600 mb-1">Matches:</div>
                  <ul className="list-disc pl-5 space-y-1">
                    {sitemapMembership.matches.map((m: string, i: number) => (
                      <li key={i}><a className="text-sky-700 hover:underline" href={m} target="_blank" rel="noreferrer">{m}</a></li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No sitemap membership info.</p>
          )}
        </div>
      </Section>

      {/* Structured Data */}
      <Section title="Structured Data">
        <div className="grid md:grid-cols-3 gap-2">
          {sdCounts.map(([k, v]) => (
            <KeyVal key={k} k={k} v={v} />
          ))}
        </div>
        {data?.json_ld_validation?.items?.length ? (
          <div className="mt-4">
            <h4 className="text-sm font-semibold mb-2">JSON-LD Validation</h4>
            <DataTable
              headers={["Type", "Missing fields", "OK?"]}
              rows={(data.json_ld_validation.items as any[]).map((r, i) => [
                String(r.type ?? "Unknown"),
                Array.isArray(r.missing) && r.missing.length ? r.missing.join(", ") : "—",
                r.ok ? "Yes" : "No",
              ])}
            />
          </div>
        ) : null}
      </Section>

      {/* Social cards */}
      <Section title="Social Cards">
        <div className="grid md:grid-cols-2 gap-2">
          <KeyVal k="Open Graph complete" v={checks?.social_cards?.og_complete} />
          <KeyVal k="Twitter Card complete" v={checks?.social_cards?.twitter_complete} />
        </div>
      </Section>

      {/* Performance */}
      <Section title="Performance">
        {/* Network snapshot */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold mb-2">Network Snapshot</h4>
          <div className="grid md:grid-cols-2 gap-2">
            <KeyVal k="Load time (ms)" v={net?.load_time_ms ?? data?.load_time_ms ?? "—"} />
            <KeyVal k="Page size (bytes)" v={net?.page_size_bytes ?? data?.content_length ?? "—"} />
            <KeyVal k="HTTP version" v={net?.http_version ?? "—"} />
            <KeyVal k="Redirects" v={net?.redirects ?? "—"} />
          </div>
        </div>

        {/* Security */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold mb-2">Security</h4>
          <div className="grid md:grid-cols-3 gap-2">
            <KeyVal k="HTTPS" v={net?.https?.is_https ? "Yes" : "No"} />
            <KeyVal k="SSL checked" v={net?.https?.ssl_checked ? "Yes" : "No"} />
            <KeyVal k="SSL OK" v={net?.https?.ssl_ok === true ? "Yes" : (net?.https?.ssl_ok === false ? "No" : "—")} />
          </div>
        </div>

        {/* PageSpeed */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold">PageSpeed — Mobile</h4>
              <Chip className={scoreVariant(psScoreMobile)}>Score: {psScoreMobile ?? "—"}</Chip>
            </div>
            {psMobile?.metrics ? (
              <div className="grid gap-2">
                {metricItem("first-contentful-paint", "FCP", psMobile)}
                {metricItem("largest-contentful-paint", "LCP", psMobile)}
                {metricItem("cumulative-layout-shift", "CLS", psMobile)}
                {metricItem("speed-index", "Speed Index", psMobile)}
                {metricItem("total-blocking-time", "TBT", psMobile)}
                {metricItem("server-response-time", "Server Response", psMobile)}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No mobile PageSpeed data.</p>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold">PageSpeed — Desktop</h4>
              <Chip className={scoreVariant(psScoreDesktop)}>Score: {psScoreDesktop ?? "—"}</Chip>
            </div>
            {psDesktop?.metrics ? (
              <div className="grid gap-2">
                {metricItem("first-contentful-paint", "FCP", psDesktop)}
                {metricItem("largest-contentful-paint", "LCP", psDesktop)}
                {metricItem("cumulative-layout-shift", "CLS", psDesktop)}
                {metricItem("speed-index", "Speed Index", psDesktop)}
                {metricItem("total-blocking-time", "TBT", psDesktop)}
                {metricItem("server-response-time", "Server Response", psDesktop)}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No desktop PageSpeed data.</p>
            )}
          </div>
        </div>
      </Section>

      {/* Rendered Compare */}
      <Section title="Rendered Compare">
        <div className="space-y-4">
          {rcSummary}
          {rcTable}
        </div>
      </Section>

      {/* AMP Compare (full table) */}
      {ampCmpTable && (
        <Card className="p-5" /* id prop is fine if your Card supports ...props */>
          <h2 className="text-lg font-semibold mb-4">AMP vs Non-AMP (full table)</h2>
          {ampCmpTable}
        </Card>
      )}
    </div>
  );
}
