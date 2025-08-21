// app/api/analyze/stream/route.ts
export const runtime = "nodejs";

import {
  fetchRaw,
  parseHTML,
  linkAudit,
  robotsAudit,
  buildCompareRows,
  findSitemapMembership,
} from "@/lib/seo";
import { renderHTML, summarizeRendered, makeRenderedDiff } from "@/lib/render";

/** very small safe-json helper to avoid accidental cycles in SSE */
function decycle<T = any>(obj: T, seen = new WeakSet()): T {
  if (obj && typeof obj === "object") {
    if (seen.has(obj as any)) return "[Circular]" as any;
    seen.add(obj as any);

    if (Array.isArray(obj)) {
      return obj.map((v) => decycle(v, seen)) as any;
    }

    const out: any = {};
    for (const [k, v] of Object.entries(obj as any)) {
      out[k] = decycle(v as any, seen);
    }
    return out;
  }
  return obj;
}

/** format a Server-Sent Events frame */
function sse(data: any, event = "message") {
  return `event: ${event}\ndata: ${JSON.stringify(decycle(data))}\n\n`;
}

/** Minimal, non-cyclic snapshot of an analyzed page */
function compactSummary(d: any) {
  if (!d) return null;
  return {
    url: d.url ?? null,
    status_code: d.status_code ?? null,
    load_time_ms: d.load_time_ms ?? null,
    content_length: d.content_length ?? null,
    title: d.title ?? null,
    description: d.description ?? null,
    canonical: d.canonical ?? null,
    h1_count: Array.isArray(d.h1) ? d.h1.length : 0,
    h1_first: Array.isArray(d.h1) && d.h1.length ? d.h1[0] : null,
    has_open_graph: !!d.has_open_graph,
    has_twitter_card: !!d.has_twitter_card,
    json_ld_count: Array.isArray(d.json_ld) ? d.json_ld.length : 0,
    internal_links_count: Array.isArray(d.internal_links) ? d.internal_links.length : 0,
    external_links_count: Array.isArray(d.external_links) ? d.external_links.length : 0,
    viewport_present: !!d?.checks?.viewport_meta?.present,
    is_amp: !!d.is_amp,
    amp_url: d.amp_url ?? null,
  };
}

/** Optional PageSpeed snapshot */
async function fetchPageSpeed(url: string) {
  const key = process.env.PAGESPEED_API_KEY;
  if (!key) return { enabled: false };
  const base = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
  const out: any = { enabled: true };
  for (const strategy of ["mobile", "desktop"] as const) {
    try {
      const r = await fetch(
        `${base}?url=${encodeURIComponent(url)}&strategy=${strategy}&key=${key}`,
        { cache: "no-store" },
      );
      if (!r.ok) {
        out[strategy] = { error: `HTTP ${r.status}` };
        continue;
      }
      const data = await r.json();
      const cat = data?.lighthouseResult?.categories?.performance;
      const score = typeof cat?.score === "number" ? Math.round(cat.score * 100) : null;
      const audits = data?.lighthouseResult?.audits || {};
      const keys = [
        "first-contentful-paint",
        "speed-index",
        "largest-contentful-paint",
        "total-blocking-time",
        "cumulative-layout-shift",
        "server-response-time",
      ];
      out[strategy] = { score, metrics: Object.fromEntries(keys.map((k) => [k, audits[k]])) };
    } catch (e: any) {
      out[strategy] = { error: String(e?.message || e) };
    }
  }
  return out;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url") || "";
  const doRendered = searchParams.get("do_rendered_check") === "true";
  const doPagespeed = searchParams.get("do_pagespeed") !== "false"; // default true

  if (!url) return new Response("url required", { status: 400 });

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (obj: any, event?: string) => controller.enqueue(enc.encode(sse(obj, event)));

      try {
        // Fetch & parse
        send({ stage: "fetch", status: "start" }, "stage");
        const net = await fetchRaw(url);
        send({ stage: "fetch", status: "done" }, "stage");

        send({ stage: "parse", status: "start" }, "stage");
        const base: any = parseHTML(
          net.final_url || url,
          net.body,
          { ...net.headers, status: String(net.status) },
          net.load_ms,
        );
        base.performance = {
          load_time_ms: net.load_ms,
          page_size_bytes: Number(net.headers?.["content-length"]) || (net.body?.length ?? 0),
          http_version: net.http_version || null,
          redirects: net.redirects || 0,
          final_url: net.final_url || url,
          https: {
            is_https: !!(net.final_url || url).toLowerCase().startsWith("https"),
            ssl_checked: false,
            ssl_ok: null,
          },
        };
        send({ stage: "parse", status: "done", title: base.title }, "stage");

        // Link audit
        send({ stage: "links", status: "start" }, "stage");
        base.link_checks = await linkAudit(base);
        send({ stage: "links", status: "done" }, "stage");

        // Robots/sitemaps + membership
        send({ stage: "robots", status: "start" }, "stage");
        base.crawl_checks = await robotsAudit(base);
        const smUrls = (base?.crawl_checks?.sitemaps || []).map((s: any) => s.url).filter(Boolean);
        base.sitemap_membership = await findSitemapMembership(base.performance.final_url || url, smUrls);
        send({ stage: "robots", status: "done" }, "stage");

        // AMP compare — IMPORTANT: do NOT store the root objects to avoid cycles
        {
          const is_amp = !!base.is_amp;
          const amp_url = base.amp_url as string | undefined;
          const canonical = base.canonical as string | undefined;

          let nonAmpObj: any = null;
          let ampObj: any = null;

          if (is_amp && canonical) {
            // current page is AMP; compare with canonical
            const otherNet = await fetchRaw(canonical);
            ampObj = base;
            nonAmpObj = parseHTML(
              canonical,
              otherNet.body,
              { ...otherNet.headers, status: String(otherNet.status) },
              otherNet.load_ms,
            );
          } else if (!is_amp && amp_url) {
            // current page is non-AMP; compare with amphtml
            const otherNet = await fetchRaw(amp_url);
            nonAmpObj = base;
            ampObj = parseHTML(
              amp_url,
              otherNet.body,
              { ...otherNet.headers, status: String(otherNet.status) },
              otherNet.load_ms,
            );
          }

          if (nonAmpObj && ampObj) {
            // Only place compact snapshots + compare rows (no references to base)
            const rowsObj = buildCompareRows(nonAmpObj, ampObj);
            base.amp_compare = {
              non_amp: compactSummary(nonAmpObj),
              amp: compactSummary(ampObj),
              rows: rowsObj.rows,
              changes: rowsObj.rows?.filter?.((r: any) => r.changed)?.length ?? 0,
            };
          } else {
            base.amp_compare = null;
          }
        }

        // PageSpeed
        if (doPagespeed) {
          send({ stage: "pagespeed", status: "start" }, "stage");
          base.pagespeed = await fetchPageSpeed(base.performance.final_url || url);
          send({ stage: "pagespeed", status: "done" }, "stage");
        } else {
          base.pagespeed = { enabled: false, skipped: true };
          send({ stage: "pagespeed", status: "skipped" }, "stage");
        }

        // Rendered compare (Playwright)
        if (doRendered) {
          send({ stage: "rendered", status: "start" }, "stage");
          const html = await renderHTML(base.performance.final_url || url);
          if (html) {
            const summary = summarizeRendered(base.performance.final_url || url, html);
            base.rendered_diff = makeRenderedDiff(base, summary);
            base.rendered_diff.render_excerpt = html.slice(0, 2000);
            send({ stage: "rendered", status: "done" }, "stage");
          } else {
            base.rendered_diff = { rendered: false, error: "Render skipped/failed" };
            send({ stage: "rendered", status: "skipped" }, "stage");
          }
        } else {
          base.rendered_diff = { rendered: false, skipped: true };
          send({ stage: "rendered", status: "skipped" }, "stage");
        }

        // Final payload
        send({ result: base }, "done");
        controller.close();
      } catch (e: any) {
        controller.enqueue(new TextEncoder().encode(sse({ error: String(e?.message || e) }, "error")));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
