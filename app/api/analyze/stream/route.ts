// app/api/analyze/stream/route.ts
export const runtime = "nodejs";

import { fetchRaw, parseHTML, linkAudit, robotsAudit } from "@/lib/seo";
import { renderHTML, summarizeRendered, makeRenderedDiff } from "@/lib/render";

async function fetchPageSpeed(url: string) {
  const key = process.env.PAGESPEED_API_KEY;
  if (!key) return { enabled: false };
  const base = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
  const out: any = { enabled: true };
  for (const strategy of ["mobile", "desktop"]) {
    try {
      const r = await fetch(`${base}?url=${encodeURIComponent(url)}&strategy=${strategy}&key=${key}`, { cache: "no-store" });
      if (!r.ok) { out[strategy] = { error: `HTTP ${r.status}` }; continue; }
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
      out[strategy] = { score, metrics: Object.fromEntries(keys.map(k => [k, audits[k]])) };
    } catch (e: any) {
      out[strategy] = { error: String(e?.message || e) };
    }
  }
  return out;
}

function sse(data: any, event = "message") {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  const doRendered = searchParams.get("do_rendered_check") === "true";

  if (!url) {
    return new Response("url required", { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (obj: any, event?: string) => controller.enqueue(enc.encode(sse(obj, event)));

      try {
        send({ stage: "fetch", status: "start" }, "stage");
        const net = await fetchRaw(url);
        send({ stage: "fetch", status: "done", ms: net.load_ms }, "stage");

        send({ stage: "parse", status: "start" }, "stage");
        const base: any = parseHTML(url, net.body, { ...net.headers, status: String(net.status) }, net.load_ms);
        base.performance = {
          load_time_ms: net.load_ms,
          http_version: net.http_version || null,
          redirects: net.redirects || 0,
          final_url: net.final_url || url,
        };
        send({ stage: "parse", status: "done", title: base.title }, "stage");

        send({ stage: "links", status: "start" }, "stage");
        base.link_checks = await linkAudit(base);
        send({ stage: "links", status: "done" }, "stage");

        send({ stage: "robots", status: "start" }, "stage");
        base.crawl_checks = await robotsAudit(base);
        send({ stage: "robots", status: "done" }, "stage");

        send({ stage: "pagespeed", status: "start" }, "stage");
        base.pagespeed = await fetchPageSpeed(base.performance.final_url || url);
        send({ stage: "pagespeed", status: "done" }, "stage");

        if (doRendered) {
          send({ stage: "rendered", status: "start" }, "stage");
          const html = await renderHTML(base.performance.final_url || url);
          if (html) {
            const summary = summarizeRendered(base.performance.final_url || url, html);
            base.rendered_diff = makeRenderedDiff(base, summary);
            base.rendered_diff.render_excerpt = html.slice(0, 2000);
            send({ stage: "rendered", status: "done" }, "stage");
          } else {
            base.rendered_diff = { rendered: false, error: "Playwright render failed or blocked" };
            send({ stage: "rendered", status: "error" }, "stage");
          }
        } else {
          send({ stage: "rendered", status: "skipped" }, "stage");
        }

        send({ result: base }, "done");
        controller.close();
      } catch (e: any) {
        const err = String(e?.message || e);
        controller.enqueue(new TextEncoder().encode(sse({ error: err }, "error")));
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
