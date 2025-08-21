'use client';
import React from "react";
import Card from "@/components/Card";

type AnalyzeResponse = any;

export default function Home() {
  const [url, setUrl] = React.useState<string>("");
  const [rendered, setRendered] = React.useState<boolean>(false);
  const [status, setStatus] = React.useState<string>("");
  const [data, setData] = React.useState<AnalyzeResponse | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Scanning...");
    setData(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, do_rendered_check: rendered }),
      });
      const json = await res.json();
      setData(json);
      setStatus(res.ok ? "Done." : "Error");
    } catch (err: any) {
      setStatus("Error: " + String(err?.message || err));
    }
  }

  const kv = (obj: any) => {
    if (!obj) return <em className="text-gray-400">none</em>;
    const entries = Object.entries(obj);
    return (
      <table className="text-sm">
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k}>
              <td className="py-1 pr-3 text-gray-500 align-top">{k}</td>
              <td className="py-1 font-mono break-all whitespace-pre-wrap">
                {typeof v === "object" ? JSON.stringify(v, null, 2) : String(v)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const list = (items?: any[], max = 50) => {
    if (!items || !items.length) return <em className="text-gray-400">none</em>;
    return (
      <ul className="list-disc ml-5">
        {items.slice(0, max).map((x, i) => (
          <li key={i} className="break-all">{String(x)}</li>
        ))}
      </ul>
    );
  };

  return (
    <>
      <header className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-semibold text-gray-800">SEO Insight (Next.js)</h1>
          <p className="text-sm text-gray-500">
            Real-time scan — HTML checks, robots/sitemaps, rendered diff (optional), and PageSpeed.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <form onSubmit={onSubmit} className="bg-white shadow rounded-2xl p-4 space-y-3">
          <label className="block text-sm font-medium text-gray-700">URL to analyze</label>
          <input
            type="url"
            required
            placeholder="https://example.com/article"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={rendered} onChange={(e) => setRendered(e.target.checked)} className="rounded border-gray-300" />
            Render with JS (Playwright)
          </label>
          <div className="flex items-center gap-3">
            <button type="submit" className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">Analyze</button>
            <span className="text-sm text-gray-500">{status}</span>
          </div>
        </form>

        {data && (
          <div className="space-y-4">
            <Card title="Summary">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-gray-500 text-xs">Final URL</div>
                  <div className="font-mono break-all">{(data.performance && data.performance.final_url) || data.url}</div>
                </div>
                <div><div className="text-gray-500 text-xs">Status</div><div>{data.status_code}</div></div>
                <div><div className="text-gray-500 text-xs">Load (ms)</div><div>{data.load_time_ms}</div></div>
                <div><div className="text-gray-500 text-xs">Size (bytes)</div><div>{data.content_length}</div></div>
                <div><div className="text-gray-500 text-xs">Title</div><div className="break-words">{data.title||''}</div></div>
                <div><div className="text-gray-500 text-xs">Description</div><div className="break-words">{data.description||''}</div></div>
                <div><div className="text-gray-500 text-xs">Canonical</div><div className="font-mono break-all">{data.canonical||''}</div></div>
                <div><div className="text-gray-500 text-xs">AMP URL</div><div className="font-mono break-all">{data.amp_url||''}</div></div>
              </div>
            </Card>

            <Card title="Meta & Indexability">
              {kv({
                robots_meta: data.robots_meta,
                indexable: data.checks && data.checks.indexable,
                robots_meta_index: data.checks && data.checks.robots_meta_index,
                robots_meta_follow: data.checks && data.checks.robots_meta_follow,
                x_robots_tag: data.checks && data.checks.x_robots_tag,
                viewport_meta: data.checks && data.checks.viewport_meta,
                title_length: data.checks && data.checks.title_length,
                meta_description_length: data.checks && data.checks.meta_description_length,
                h1_count: data.checks && data.checks.h1_count,
                alt_coverage: data.checks && data.checks.alt_coverage,
                lang: data.checks && data.checks.lang,
                charset: data.checks && data.checks.charset,
                compression: data.checks && data.checks.compression,
                social_cards: data.checks && data.checks.social_cards,
              })}
            </Card>

            <Card title="Structured Data">
              <div className="mb-2"><strong>Types:</strong> {JSON.stringify(data.sd_types || {})}</div>
              <div className="mb-2"><strong>JSON-LD validation:</strong> {JSON.stringify(data.json_ld_validation || {})}</div>
              <div><strong>JSON-LD blocks:</strong>
                <div className="space-y-2 mt-2">
                  {(data.json_ld || []).map((x: any, i: number) => (
                    <pre key={i} className="whitespace-pre-wrap bg-gray-50 p-2 rounded text-xs">{JSON.stringify(x, null, 2)}</pre>
                  ))}
                </div>
              </div>
            </Card>

            <Card title="Links">
              <div className="mb-2"><strong>Internal (sample):</strong>{list(data.internal_links)}</div>
              <div className="mb-2"><strong>External (sample):</strong>{list(data.external_links)}</div>
              <div><strong>Nofollow (sample):</strong>{list(data.nofollow_links)}</div>
            </Card>

            <Card title="Link Checks (HEAD/GET samples)">
              {kv(data.link_checks)}
            </Card>

            <Card title="Robots & Sitemaps">
              {kv(data.crawl_checks)}
            </Card>

            <Card title="Rendered Diff (Playwright)">
              {data.rendered_diff ? kv(data.rendered_diff) : <em className="text-gray-400">not requested</em>}
            </Card>

            <Card title="PageSpeed Insights">
              {kv(data.pagespeed)}
            </Card>

            <Card title="Network / Performance">
              {kv(data.performance)}
            </Card>
          </div>
        )}
      </main>
    </>
  );
}
