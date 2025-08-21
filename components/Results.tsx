"use client";
import { Card } from "@/components/ui/Card";
import { Accordion, AccordionItem } from "@/components/ui/Accordion";
import { Badge } from "@/components/ui/Badge";
import {
  copy,
  labelize,
  scoreVariant,
  statusVariantFromCode,
  boolVariant,
  metricValue,
  metricVariant,
  Table,
} from "@/lib/format";

export function Results({ data }: { data: any }) {
  const basic = [
    ["URL", data.url],
    ["Final URL", data?.performance?.final_url || data.url],
    ["Status", data.status_code],
    ["Load (ms)", data.load_time_ms],
    ["Page size (bytes)", data.content_length],
    ["Title", data.title],
    ["Meta description", data.description],
    ["Canonical", data.canonical],
    ["AMP", data.is_amp ? "Yes" : "No"],
    ["AMP URL", data.amp_url],
  ];

  const ampChanges = data?.amp_compare?.changes ?? 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Overview */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Overview</h2>
          <div className="flex gap-2">
            {data.has_open_graph && <Badge variant="blue">OpenGraph</Badge>}
            {data.has_twitter_card && <Badge variant="purple">Twitter</Badge>}
            {data.sd_types?.has_newsarticle && <Badge variant="blue">NewsArticle</Badge>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {basic.map(([label, value]) => (
            <div key={label as string} className="flex flex-col">
              <span className="text-slate-500 dark:text-slate-400">{label}</span>
              <span className="font-medium break-all">{String(value ?? "—")}</span>
            </div>
          ))}
        </div>

        {/* AMP quick collapsible inside Overview */}
        {data?.amp_compare && (
          <Accordion className="mt-4">
            <AccordionItem title={`AMP vs Non-AMP (${ampChanges} change${ampChanges === 1 ? "" : "s"})`}>
              <AmpCompare cmp={data.amp_compare} />
            </AccordionItem>
          </Accordion>
        )}
      </Card>

      {/* Checks */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold mb-4">SEO Checks</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {Object.entries(data.checks || {}).map(([k, v]: any) => (
            <div key={k} className="rounded-xl border border-slate-200/60 dark:border-slate-800 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{labelize(k)}</span>
                <Badge variant={boolVariant(v?.ok) as any}>{v?.ok ? "OK" : "Check"}</Badge>
              </div>

              {"value" in v && v.value && (
                <div className="mt-1 text-slate-600 dark:text-slate-300">{String(v.value)}</div>
              )}

              {"chars" in v && (
                <div className="mt-1 text-xs text-slate-500">length: {v.chars}</div>
              )}

              {k === "alt_coverage" && typeof v?.percent === "number" && (
                <div className="mt-2">
                  <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full ${
                        v.percent < 60 ? "bg-rose-500" : v.percent < 80 ? "bg-amber-500" : "bg-green-500"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, v.percent))}%` }}
                    />
                  </div>
                  <div className="text-xs mt-1 text-slate-500">
                    {v.with_alt}/{v.total_imgs} images have alt ({v.percent}%)
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Structured Data */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold mb-4">Structured Data</h2>

        <div className="mb-3 text-sm">
          <div className="flex flex-wrap gap-2">
            {(data.sd_types?.types || []).map((t: string) => (
              <Badge key={t} variant="purple">{t}</Badge>
            ))}
          </div>
        </div>

        <Accordion>
          <AccordionItem title={`JSON-LD Validation (items: ${data?.json_ld_validation?.summary?.total_items ?? 0})`}>
            <JsonLdValidation summary={data?.json_ld_validation} />
          </AccordionItem>

          <AccordionItem title={`JSON-LD (${(data.json_ld || []).length}) • raw`}>
            <pre className="mt-3">{JSON.stringify(data.json_ld || [], null, 2)}</pre>
          </AccordionItem>
          <AccordionItem title={`Microdata (${data.microdata_summary?.count || 0}) • raw`}>
            <pre className="mt-3">{JSON.stringify(data.microdata || [], null, 2)}</pre>
          </AccordionItem>
          <AccordionItem title={`RDFa (${data.rdfa_summary?.count || 0}) • raw`}>
            <pre className="mt-3">{JSON.stringify(data.rdfa || [], null, 2)}</pre>
          </AccordionItem>
        </Accordion>
      </Card>

      {/* Links & Crawlability */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold mb-4">Links & Crawlability</h2>

        {/* Robots & Sitemaps pretty */}
        <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 p-3 mb-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">robots.txt:</span>
            {(() => {
              const s = data?.crawl_checks?.robots_txt?.status as number | undefined;
              const u = data?.crawl_checks?.robots_txt?.url as string | undefined;
              return (
                <>
                  <Badge variant={statusVariantFromCode(s) as any}>{s ?? "—"}</Badge>
                  {u && (
                    <a href={u} target="_blank" rel="noreferrer" className="text-sky-600 underline">
                      {u}
                    </a>
                  )}
                </>
              );
            })()}
          </div>
          <div className="mt-2">
            <span className="font-medium">Blocked by robots:</span>{" "}
            <Badge variant={data?.crawl_checks?.blocked_by_robots ? "warning" : "success"}>
              {data?.crawl_checks?.blocked_by_robots ? "Possibly" : "Allowed"}
            </Badge>
          </div>

          {/* Which sitemap contains this URL */}
          <div className="mt-3">
            <div className="font-medium mb-1">Sitemap membership</div>
            {data?.sitemap_membership?.found ? (
              <div className="space-y-1">
                <div className="text-sm">
                  Found in:{" "}
                  {data.sitemap_membership.matches.map((m: string, i: number) => (
                    <a key={i} className="underline" href={m} target="_blank" rel="noreferrer">
                      {m}
                    </a>
                  ))}
                </div>
                <div className="text-xs text-slate-500">
                  Checked {data.sitemap_membership.checked_count} sitemap{data.sitemap_membership.checked_count === 1 ? "" : "s"}.
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">
                Not found in discovered sitemaps (checked {data?.sitemap_membership?.checked_count ?? 0}).
              </div>
            )}
          </div>
        </div>

        {/* Link buckets */}
        <Accordion>
          <AccordionItem title={`Internal Links (${(data.internal_links || []).length})`}>
            <List urls={data.internal_links} />
          </AccordionItem>
          <AccordionItem title={`External Links (${(data.external_links || []).length})`}>
            <List urls={data.external_links} />
          </AccordionItem>
          <AccordionItem title={`Nofollow Links (${(data.nofollow_links || []).length})`}>
            <List urls={data.nofollow_links} />
          </AccordionItem>
        </Accordion>
      </Card>

      {/* Performance + PageSpeed */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold mb-2">Performance</h2>
        <div className="text-sm text-slate-600 dark:text-slate-300">
          <div>Load: <span className="font-medium">{data?.performance?.load_time_ms ?? data.load_time_ms} ms</span></div>
          <div>HTTP: <span className="font-medium">{data?.performance?.http_version || "—"}</span></div>
          <div>Redirects: <span className="font-medium">{data?.performance?.redirects ?? 0}</span></div>
        </div>

        {data.pagespeed?.enabled && !data.pagespeed?.skipped && (
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <PSCard label="Mobile" payload={data.pagespeed?.mobile} />
            <PSCard label="Desktop" payload={data.pagespeed?.desktop} />
          </div>
        )}
        {data.pagespeed?.skipped && (
          <div className="text-sm text-slate-500 mt-2">PageSpeed skipped for faster scan.</div>
        )}
      </Card>

      {/* Rendered Compare */}
      {data.rendered_diff && (
        <Card className="p-5">
          <h2 className="text-lg font-semibold mb-4">Rendered Compare</h2>
          {!data.rendered_diff.rendered ? (
            <div className="text-sm text-slate-500">Render skipped or failed.</div>
          ) : (
            <Accordion>
              <AccordionItem title="Matrix (table)">
                <RenderMatrix matrix={data.rendered_diff.matrix || []} />
              </AccordionItem>
              <AccordionItem title="Before / After Summary (table)">
                <RenderBeforeAfter before={data.rendered_diff.before} after={data.rendered_diff.after} />
              </AccordionItem>
              <AccordionItem title="Rendered HTML Excerpt">
                <button
                  onClick={() => copy(data.rendered_diff.render_excerpt || "")}
                  className="mb-2 text-xs underline text-sky-600 dark:text-sky-300"
                >
                  Copy excerpt
                </button>
                <pre className="max-h-72 overflow-auto">{data.rendered_diff.render_excerpt || ""}</pre>
              </AccordionItem>
            </Accordion>
          )}
        </Card>
      )}

      {/* Dedicated AMP Compare card too (in case user misses Overview link) */}
      {data?.amp_compare && (
        <Card id="amp-compare" className="p-5">
          <h2 className="text-lg font-semibold mb-4">AMP vs Non-AMP (full table)</h2>
          <AmpCompare cmp={data.amp_compare} />
        </Card>
      )}
    </div>
  );
}

/* ---------- Sub-components ---------- */

function List({ urls = [] as string[] }) {
  return (
    <div className="mt-3 grid gap-2 max-h-72 overflow-auto pr-1">
      {urls.slice(0, 200).map((u, i) => (
        <a
          key={i}
          href={u}
          target="_blank"
          className="text-sm underline break-all decoration-sky-500/60 hover:decoration-sky-600"
          rel="noreferrer"
        >
          {u}
        </a>
      ))}
      {!urls?.length && <div className="text-sm text-slate-500">None</div>}
    </div>
  );
}

function PSCard({ label, payload }: { label: string; payload: any }) {
  const score: number | undefined = payload?.score;
  const v = scoreVariant(score);
  const audits = payload?.metrics || {};
  const A = (k: string) => audits?.[k];

  const row = (name: string, key: string) => {
    const audit = A(key);
    return (
      <div className="rounded-lg border border-slate-200/60 dark:border-slate-800 p-2 flex items-center justify-between">
        <span className="text-slate-500 text-xs">{name}</span>
        <Badge variant={metricVariant(key, audit) as any}>{String(metricValue(audit))}</Badge>
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 p-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold">{label}</div>
        <Badge variant={v as any} className="text-sm">{score ?? "—"}</Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        {row("FCP", "first-contentful-paint")}
        {row("Speed Index", "speed-index")}
        {row("LCP", "largest-contentful-paint")}
        {row("TBT", "total-blocking-time")}
        {row("CLS", "cumulative-layout-shift")}
        {row("Server RT", "server-response-time")}
      </div>
    </div>
  );
}

function RenderMatrix({ matrix = [] as any[] }) {
  const headers = ["Field", "Before", "After", "Changed"];
  const rows = matrix.map((r) => [r.label, String(r.before ?? "—"), String(r.after ?? "—"), r.changed ? "Yes" : "No"]);
  return <Table headers={headers} rows={rows} />;
}

function RenderBeforeAfter({ before, after }: { before: any; after: any }) {
  const keys = [
    "title",
    "description",
    "canonical",
    "robots_meta",
    "h1_count",
    "h1_first",
    "has_open_graph",
    "has_twitter_card",
    "json_ld_count",
    "microdata_count",
    "rdfa_count",
    "internal_links_count",
    "external_links_count",
    "viewport_present",
  ];
  const headers = ["Field", "Before", "After"];
  const rows = keys.map((k) => [labelize(k), String(before?.[k] ?? "—"), String(after?.[k] ?? "—")]);
  return <Table headers={headers} rows={rows} />;
}

function AmpCompare({ cmp }: { cmp: any }) {
  const headers = ["Metric", "Non-AMP", "AMP", "Changed"];
  const rows = (cmp?.rows || []).map((r: any) => [
    r.label,
    String(r.non_amp ?? "—"),
    String(r.amp ?? "—"),
    r.changed ? "Yes" : "No",
  ]);
  return (
    <div>
      <div className="mb-2 text-sm text-slate-600 dark:text-slate-300">
        Changes detected: <span className="font-medium">{cmp?.changes ?? 0}</span>
      </div>
      <Table headers={headers} rows={rows} />
    </div>
  );
}

function JsonLdValidation({ summary }: { summary: any }) {
  const ok = summary?.summary?.ok_count ?? 0;
  const total = summary?.summary?.total_items ?? 0;
  const hasErrors = !!summary?.summary?.has_errors;

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <Badge variant="success">OK: {ok}</Badge>
        <Badge variant={hasErrors ? "warning" : "success"}>{hasErrors ? "Has Issues" : "All Good"}</Badge>
      </div>
      <div className="mt-2 space-y-2">
        {(summary?.items || []).map((it: any, i: number) => (
          <div
            key={i}
            className="rounded-lg border border-slate-200/60 dark:border-slate-800 p-3 flex items-start justify-between gap-3"
          >
            <div>
              <div className="font-medium">{it.type || "Unknown"}</div>
              {it.missing?.length ? (
                <div className="text-xs text-amber-700 dark:text-amber-200 mt-1">
                  Missing: {it.missing.join(", ")}
                </div>
              ) : (
                <div className="text-xs text-slate-500">All required fields present</div>
              )}
            </div>
            <Badge variant={it.ok ? "success" : "warning"}>{it.ok ? "OK" : "Fix"}</Badge>
          </div>
        ))}
        {!total && <div className="text-xs text-slate-500">No JSON-LD items detected.</div>}
      </div>
    </div>
  );
}
