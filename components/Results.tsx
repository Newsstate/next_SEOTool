// components/Results.tsx
"use client";

import * as React from "react";
import { Card } from "@/components/card"; // or "@/components/ui/card" if you prefer
import {
  cn,
  copy,
  labelize,
  scoreVariant,
  statusVariantFromCode,
  boolVariant,
  metricVariant,
  metricValue,
  DataTable,
} from "@/lib/format";

type Analysis = any;

function Section({
  id,
  title,
  defaultOpen = true,
  children,
}: {
  id?: string;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className="p-0 overflow-hidden">
      <details open={defaultOpen}>
        <summary className="cursor-pointer list-none m-0 px-4 py-3 text-sm font-semibold bg-slate-50/80 dark:bg-slate-900/40 border-b border-slate-200/60 dark:border-white/10 flex items-center justify-between">
          <span>{title}</span>
          <span className="text-slate-400 text-xs">Toggle</span>
        </summary>
        <div className="p-4">{children}</div>
      </details>
    </Card>
  );
}

function Chip({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-1 text-xs font-medium", className)}>
      {children}
    </span>
  );
}

function KeyVal({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="text-xs text-slate-500">{k}</div>
      <div className="text-sm text-slate-800 dark:text-slate-200 max-w-[70%] break-words">{v ?? <em className="text-slate-400">—</em>}</div>
    </div>
  );
}

function Copyable({ text }: { text?: string | null }) {
  if (!text) return <em className="text-slate-400">—</em>;
  return (
    <button
      onClick={() => copy(text)}
      className="text-left hover:underline decoration-dotted underline-offset-2"
      title="Copy"
    >
      {text}
    </button>
  );
}

/* ------------------------- Rendered Compare ------------------------- */

function RenderedCompare({ diff }: { diff?: any }) {
  if (!diff || !diff.rendered) {
    return <div className="text-sm text-slate-500">Render skipped or failed.</div>;
  }

  const headers = ["Label", "Before", "After", "Changed"];
  const rows = (diff.matrix || []).map((r: any, i: number) => [
    <span key={`l${i}`} className="font-medium">{r.label}</span>,
    String(r.before ?? "—"),
    String(r.after ?? "—"),
    r.changed ? <Chip className="bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200">Yes</Chip>
              : <Chip className="bg-green-50 text-green-700 ring-1 ring-green-200">No</Chip>,
  ]);

  const beforeSummary = [
    ["Title", diff.before?.title ?? "—"],
    ["Description", diff.before?.description ?? "—"],
    ["Canonical", diff.before?.canonical ?? "—"],
    ["H1 Count", String(diff.before?.h1_count ?? "—")],
  ];

  const afterSummary = [
    ["Title", diff.after?.title ?? "—"],
    ["Description", diff.after?.description ?? "—"],
    ["Canonical", diff.after?.canonical ?? "—"],
    ["H1 Count", String(diff.after?.h1_count ?? "—")],
  ];

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold mb-2">Matrix</h4>
        <DataTable headers={headers} rows={rows} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-semibold mb-2">Before</h4>
          <DataTable
            headers={["Field", "Value"]}
            rows={beforeSummary.map(([k, v]) => [k, v])}
            dense
          />
        </div>
        <div>
          <h4 className="text-sm font-semibold mb-2">After</h4>
          <DataTable
            headers={["Field", "Value"]}
            rows={afterSummary.map(([k, v]) => [k, v])}
            dense
          />
        </div>
      </div>
    </div>
  );
}

/* --------------------------- PageSpeed UI --------------------------- */

function PageSpeedBlock({ ps }: { ps?: any }) {
  if (!ps || ps.enabled === false) {
    return <div className="text-sm text-slate-500">PageSpeed not run.</div>;
  }

  const renderOne = (label: string, obj?: any) => {
    if (!obj) return null;
    const score = obj.score as number | null | undefined;
    const audits = obj.metrics || {};
    const kv = (name: string, key: string) => {
      const v = audits?.[key];
      return (
        <div key={key} className="flex items-center justify-between border rounded-md px-2 py-1">
          <span className="text-xs text-slate-500">{name}</span>
          <Chip className={metricVariant(key, v) ?? ""}>{metricValue(key, v)}</Chip>
        </div>
      );
    };
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{label}</span>
          <Chip className={scoreVariant(score)}>{score ?? "—"}</Chip>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {kv("FCP", "first-contentful-paint")}
          {kv("LCP", "largest-contentful-paint")}
          {kv("CLS", "cumulative-layout-shift")}
          {kv("Speed Index", "speed-index")}
          {kv("TBT", "total-blocking-time")}
          {kv("Server Response", "server-response-time")}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {renderOne("Mobile", ps.mobile)}
      {renderOne("Desktop", ps.desktop)}
      {ps.mobile?.error || ps.desktop?.error ? (
        <div className="text-xs text-red-600">
          {ps.mobile?.error ? `Mobile: ${ps.mobile.error}` : null}
          {ps.desktop?.error ? ` | Desktop: ${ps.desktop.error}` : null}
        </div>
      ) : null}
    </div>
  );
}

/* ----------------------- AMP Compare (if any) ---------------------- */

function AmpCompare({ cmp }: { cmp?: { rows: any[]; changes: number } }) {
  if (!cmp?.rows?.length) return <div className="text-sm text-slate-500">No AMP comparison.</div>;
  const headers = ["Metric", "Non-AMP", "AMP", "Changed"];
  const rows = cmp.rows.map((r, i) => [
    <span key={`m${i}`} className="font-medium">{r.label}</span>,
    String(r.non_amp ?? "—"),
    String(r.amp ?? "—"),
    r.changed ? <Chip className="bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200">Yes</Chip>
              : <Chip className="bg-green-50 text-green-700 ring-1 ring-green-200">No</Chip>,
  ]);
  return (
    <div className="space-y-2">
      <div className="text-xs text-slate-500">Changes detected: {cmp.changes}</div>
      <DataTable headers={headers} rows={rows} />
    </div>
  );
}

/* ----------------------------- Main UI ----------------------------- */

export default function Results({ data }: { data?: Analysis }) {
  if (!data) return null;

  const checks = data.checks || {};
  const og = data.open_graph || {};
  const tw = data.twitter_card || {};

  /* Network + Security (from available fields) */
  const isHttps = (() => {
    try {
      return new URL(data.url || "").protocol === "https:";
    } catch {
      return false;
    }
  })();

  return (
    <div className="space-y-6">
      {/* Overview */}
      <Section title="Overview" defaultOpen>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <KeyVal k="URL" v={<Copyable text={data.url} />} />
            <KeyVal k="Status" v={String(data.status_code ?? "—")} />
            <KeyVal k="Title" v={<Copyable text={data.title} />} />
            <KeyVal k="Meta Description" v={<Copyable text={data.description} />} />
            <KeyVal k="Canonical" v={<Copyable text={data.canonical} />} />
            <KeyVal
              k="Viewport Meta"
              v={data.viewport_meta ? <Copyable text={data.viewport_meta} /> : <em className="text-slate-400">missing</em>}
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Open Graph</span>
              <Chip className={boolVariant(!!data.has_open_graph)}>{data.has_open_graph ? "Present" : "Missing"}</Chip>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Twitter Card</span>
              <Chip className={boolVariant(!!data.has_twitter_card)}>{data.has_twitter_card ? "Present" : "Missing"}</Chip>
            </div>
          </div>

          <div className="space-y-2">
            <KeyVal k="Load time (ms)" v={String(data.load_time_ms ?? "—")} />
            <KeyVal k="Page size (bytes)" v={String(data.content_length ?? "—")} />
            <KeyVal k="Lang" v={checks?.lang?.value || "—"} />
            <KeyVal k="Charset" v={checks?.charset?.value || "—"} />
            <KeyVal k="Compression" v={checks?.compression?.value || "none"} />
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">HTTPS</span>
              <Chip className={boolVariant(isHttps)}>{isHttps ? "Yes" : "No"}</Chip>
            </div>
            {data.amp_url ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">AMP</span>
                <a href="#amp-compare" className="text-xs underline underline-offset-2 text-sky-700">
                  Compare AMP vs Non-AMP
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </Section>

      {/* Rendered Compare */}
      <Section title="Rendered Compare (JS vs. Static)" defaultOpen>
        <RenderedCompare diff={data.rendered_diff} />
      </Section>

      {/* Social Metadata */}
      <Section title="Social Metadata (OG & Twitter)">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-semibold mb-2">Open Graph</h4>
            <KeyVal k="Title" v={<Copyable text={og.title} />} />
            <KeyVal k="Description" v={<Copyable text={og.description} />} />
            <KeyVal k="Image" v={<Copyable text={og.image} />} />
            <KeyVal k="URL" v={<Copyable text={og.url} />} />
            <KeyVal k="Locale / Lang" v={og.locale || "—"} />
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-2">Twitter</h4>
            <KeyVal k="Card" v={tw.card || "—"} />
            <KeyVal k="Title" v={<Copyable text={tw.title} />} />
            <KeyVal k="Description" v={<Copyable text={tw.description} />} />
            <KeyVal k="Image" v={<Copyable text={tw.image} />} />
            <KeyVal k="URL" v={<Copyable text={tw.url} />} />
          </div>
        </div>
      </Section>

      {/* Content Structure & EEAT */}
      <Section title="Content Structure & EEAT">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-2">
            <h4 className="text-sm font-semibold">Headings</h4>
            <div className="space-y-2">
              <div>
                <div className="text-xs text-slate-500 mb-1">H1</div>
                <ul className="list-disc pl-5 text-sm">
                  {(data.h1 || []).map((t: string, i: number) => <li key={i}>{t}</li>)}
                </ul>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">H2</div>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  {(data.h2 || []).map((t: string, i: number) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1 space-y-2">
            <h4 className="text-sm font-semibold">Keywords (Top 20)</h4>
            <DataTable
              headers={["Term", "Count", "Density %"]}
              rows={(data.content_structure?.keywords || []).map((k: any) => [
                k.term,
                String(k.count),
                String(k.density),
              ])}
              dense
            />
          </div>

          <div className="lg:col-span-1 space-y-2">
            <h4 className="text-sm font-semibold">EEAT Signals (Heuristic)</h4>
            <KeyVal k="Word Count" v={String(data.content_structure?.word_count ?? "—")} />
            <KeyVal
              k="Score"
              v={<Chip className={scoreVariant(Number(data.content_structure?.eeat?.score) || 0)}>
                {String(data.content_structure?.eeat?.score ?? "—")}
              </Chip>}
            />
            <div className="text-xs text-slate-600">
              {data.content_structure?.eeat?.summary || "—"}
            </div>
          </div>
        </div>
      </Section>

      {/* Links & Crawlability */}
      <Section title="Links & Crawlability">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold mb-1">Indexability Flags</h4>
            <KeyVal
              k="Indexable"
              v={<Chip className={boolVariant(!!data.indexability?.indexable)}>
                {data.indexability?.indexable ? "index" : "noindex"}
              </Chip>}
            />
            <KeyVal k="Robots meta" v={<Copyable text={data.indexability?.robots_meta_index || ""} />} />
            <KeyVal
              k="Follow"
              v={<Chip className={boolVariant(!!data.indexability?.follow)}>
                {data.indexability?.follow ? "follow" : "nofollow"}
              </Chip>}
            />
            <KeyVal k="X-Robots-Tag" v={<Copyable text={data.indexability?.x_robots_tag || ""} />} />
            <KeyVal k="Lang attr" v={data.indexability?.lang || "—"} />
            <KeyVal k="Charset" v={data.indexability?.charset || "—"} />
            <KeyVal k="Compression" v={data.indexability?.compression || "none"} />
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold">robots.txt & Sitemaps</h4>
            <KeyVal k="robots.txt" v={<Copyable text={data.robots_url || ""} />} />
            <div className="text-xs text-slate-500 mb-1">Discovered sitemaps</div>
            <ul className="list-disc pl-5 text-sm space-y-1">
              {(data.crawl_checks?.sitemaps || []).map((sm: any, i: number) => (
                <li key={i}>
                  {sm.url}
                  {sm.status ? <span className="text-xs text-slate-500"> (HTTP {sm.status})</span> : null}
                  {sm.note ? <span className="text-xs text-slate-500"> ({sm.note})</span> : null}
                </li>
              ))}
              {(!data.crawl_checks?.sitemaps || data.crawl_checks.sitemaps.length === 0) && (
                <li className="text-slate-500">None</li>
              )}
            </ul>
            {data.sitemap_membership ? (
              <div className="mt-2">
                <div className="text-xs text-slate-500 mb-1">This URL in sitemaps?</div>
                {data.sitemap_membership.found ? (
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    {data.sitemap_membership.matches.map((u: string, i: number) => <li key={i}>{u}</li>)}
                  </ul>
                ) : (
                  <div className="text-sm text-slate-500">Not found in checked sitemaps.</div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Link checks */}
        <div className="grid md:grid-cols-2 gap-6 mt-4">
          <div>
            <h4 className="text-sm font-semibold mb-2">Internal Link Checks</h4>
            <DataTable
              headers={["URL", "Status"]}
              rows={(data.link_checks?.internal || []).map((r: any) => [
                <Copyable key={r.url} text={r.url} />,
                <Chip className={statusVariantFromCode(r.status)}>{String(r.status ?? "—")}</Chip>,
              ])}
            />
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-2">External Link Checks</h4>
            <DataTable
              headers={["URL", "Status"]}
              rows={(data.link_checks?.external || []).map((r: any) => [
                <Copyable key={r.url} text={r.url} />,
                <Chip className={statusVariantFromCode(r.status)}>{String(r.status ?? "—")}</Chip>,
              ])}
            />
          </div>
        </div>
      </Section>

      {/* Performance */}
      <Section title="Performance">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold mb-1">Network Snapshot</h4>
            <KeyVal k="Load time (ms)" v={String(data.load_time_ms ?? "—")} />
            <KeyVal k="Page size (bytes)" v={String(data.content_length ?? "—")} />
            <KeyVal k="HTTP version" v={data.http_version || "—"} />
            <KeyVal k="Redirects" v={String(data.redirects ?? "—")} />
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold mb-1">Security</h4>
            <KeyVal
              k="HTTPS"
              v={<Chip className={boolVariant(isHttps)}>{isHttps ? "Yes" : "No"}</Chip>}
            />
            <KeyVal k="SSL checked" v="No" />
            <KeyVal k="SSL OK" v="—" />
          </div>
        </div>
        <div className="mt-4">
          <PageSpeedBlock ps={data.pagespeed} />
        </div>
      </Section>

      {/* Images Alt Coverage */}
      <Section title="Images: Alt Coverage & Samples">
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <h4 className="text-sm font-semibold mb-2">Coverage</h4>
            <DataTable
              headers={["Metric", "Value"]}
              rows={[
                ["With alt", String(data.images_alt?.coverage?.with_alt ?? "—")],
                ["Total images", String(data.images_alt?.coverage?.total_imgs ?? "—")],
                ["Percent", String(data.images_alt?.coverage?.percent ?? "—")],
              ]}
              dense
            />
          </div>
          <div className="md:col-span-1">
            <h4 className="text-sm font-semibold mb-2">With Alt (sample)</h4>
            <ul className="text-sm space-y-2">
              {(data.images_alt?.with_alt || []).map((im: any, i: number) => (
                <li key={i} className="border rounded p-2">
                  <div className="text-xs text-slate-500 break-all">{im.src || "—"}</div>
                  <div className="text-xs text-slate-600">Alt: {im.alt || "—"}</div>
                  {im.link ? <div className="text-xs text-slate-500 break-all">Link: {im.link}</div> : null}
                </li>
              ))}
              {(!data.images_alt?.with_alt || data.images_alt.with_alt.length === 0) && (
                <li className="text-sm text-slate-500">None</li>
              )}
            </ul>
          </div>
          <div className="md:col-span-1">
            <h4 className="text-sm font-semibold mb-2">Missing Alt (sample)</h4>
            <ul className="text-sm space-y-2">
              {(data.images_alt?.missing_alt || []).map((im: any, i: number) => (
                <li key={i} className="border rounded p-2">
                  <div className="text-xs text-slate-500 break-all">{im.src || "—"}</div>
                  {im.link ? <div className="text-xs text-slate-500 break-all">Link: {im.link}</div> : null}
                </li>
              ))}
              {(!data.images_alt?.missing_alt || data.images_alt.missing_alt.length === 0) && (
                <li className="text-sm text-slate-500">None</li>
              )}
            </ul>
          </div>
        </div>
      </Section>

      {/* AMP compare (anchor target) */}
      {data?.amp_compare && (
        <Card id="amp-compare" className="p-5">
          <h2 className="text-lg font-semibold mb-4">AMP vs Non-AMP (full table)</h2>
          <AmpCompare cmp={data.amp_compare} />
        </Card>
      )}
    </div>
  );
}
