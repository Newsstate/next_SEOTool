"use client";
import { Card } from "@/components/ui/Card";
import { Accordion, AccordionItem } from "@/components/ui/Accordion";
import { Badge } from "@/components/ui/Badge";
import { copy } from "@/lib/format";

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

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Overview */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Overview</h2>
          <div className="flex gap-2">
            {data.has_open_graph && <Badge>OpenGraph</Badge>}
            {data.has_twitter_card && <Badge>Twitter</Badge>}
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
      </Card>

      {/* Checks */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold mb-4">SEO Checks</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {Object.entries(data.checks || {}).map(([k, v]: any) => (
            <div key={k} className="rounded-xl border border-slate-200/60 dark:border-slate-800 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{labelize(k)}</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs ${
                    v.ok ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                  }`}
                >
                  {v.ok ? "OK" : "Check"}
                </span>
              </div>
              {"value" in v && <div className="mt-1 text-slate-600 dark:text-slate-300">{String(v.value)}</div>}
              {"chars" in v && (
                <div className="mt-1 text-xs text-slate-500">chars: {v.chars}</div>
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
          <AccordionItem title={`JSON-LD (${(data.json_ld || []).length})`}>
            <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-slate-950/90 text-slate-100 p-3 text-xs">
              {JSON.stringify(data.json_ld || [], null, 2)}
            </pre>
          </AccordionItem>
          <AccordionItem title={`JSON-LD Validation`}>
            <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-slate-950/90 text-slate-100 p-3 text-xs">
              {JSON.stringify(data.json_ld_validation || {}, null, 2)}
            </pre>
          </AccordionItem>
          <AccordionItem title={`Microdata (${data.microdata_summary?.count || 0})`}>
            <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-slate-950/90 text-slate-100 p-3 text-xs">
              {JSON.stringify(data.microdata || [], null, 2)}
            </pre>
          </AccordionItem>
          <AccordionItem title={`RDFa (${data.rdfa_summary?.count || 0})`}>
            <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-slate-950/90 text-slate-100 p-3 text-xs">
              {JSON.stringify(data.rdfa || [], null, 2)}
            </pre>
          </AccordionItem>
        </Accordion>
      </Card>

      {/* Links & Crawlability */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold mb-4">Links & Crawlability</h2>
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
          <AccordionItem title="Robots & Sitemaps">
            <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-slate-950/90 text-slate-100 p-3 text-xs">
              {JSON.stringify(data.crawl_checks || {}, null, 2)}
            </pre>
          </AccordionItem>
        </Accordion>
      </Card>

      {/* Performance */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold mb-2">Performance</h2>
        <div className="text-sm text-slate-600 dark:text-slate-300">
          <div>Load: <span className="font-medium">{data?.performance?.load_time_ms ?? data.load_time_ms} ms</span></div>
          <div>HTTP: <span className="font-medium">{data?.performance?.http_version || "—"}</span></div>
          <div>Redirects: <span className="font-medium">{data?.performance?.redirects ?? 0}</span></div>
        </div>
        {data.pagespeed?.enabled && (
          <Accordion className="mt-4">
            <AccordionItem title="PageSpeed (mobile)">
              <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-slate-950/90 text-slate-100 p-3 text-xs">
                {JSON.stringify(data.pagespeed?.mobile || {}, null, 2)}
              </pre>
            </AccordionItem>
            <AccordionItem title="PageSpeed (desktop)">
              <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-slate-950/90 text-slate-100 p-3 text-xs">
                {JSON.stringify(data.pagespeed?.desktop || {}, null, 2)}
              </pre>
            </AccordionItem>
          </Accordion>
        )}
      </Card>

      {/* Rendered Diff */}
      {data.rendered_diff && (
        <Card className="p-5">
          <h2 className="text-lg font-semibold mb-4">Rendered Compare</h2>
          {!data.rendered_diff.rendered ? (
            <div className="text-sm text-slate-500">Render skipped or failed.</div>
          ) : (
            <Accordion>
              <AccordionItem title="Matrix">
                <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-slate-950/90 text-slate-100 p-3 text-xs">
                  {JSON.stringify(data.rendered_diff.matrix || [], null, 2)}
                </pre>
              </AccordionItem>
              <AccordionItem title="Before / After Summary">
                <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-slate-950/90 text-slate-100 p-3 text-xs">
                  {JSON.stringify({ before: data.rendered_diff.before, after: data.rendered_diff.after }, null, 2)}
                </pre>
              </AccordionItem>
              <AccordionItem title="Rendered HTML Excerpt">
                <button
                  onClick={() => copy(data.rendered_diff.render_excerpt || "")}
                  className="mb-2 text-xs underline text-sky-600 dark:text-sky-300"
                >
                  Copy excerpt
                </button>
                <pre className="max-h-72 overflow-auto rounded-lg bg-slate-950/90 text-slate-100 p-3 text-xs">
                  {data.rendered_diff.render_excerpt || ""}
                </pre>
              </AccordionItem>
            </Accordion>
          )}
        </Card>
      )}
    </div>
  );
}

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

function labelize(k: string) {
  return k
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}
