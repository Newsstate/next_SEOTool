// app/api/analyze/route.ts
export const runtime = "nodejs"; // ensure not running on edge

import { NextResponse } from "next/server";
import { fetchRaw, parseHTML, linkAudit, robotsAudit } from "@/lib/seo";
import { renderHTML, summarizeRendered, makeRenderedDiff } from "@/lib/render";

// Minimal PageSpeed fetcher (uses env PAGESPEED_API_KEY if present)
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

export async function POST(req: Request) {
  try {
    const { url, do_rendered_check = true } = await req.json();
    if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

    // Phase 1: fetch & parse
    const net = await fetchRaw(url);
    const base = parseHTML(url, net.body, { ...net.headers, status: String(net.status) }, net.load_ms);

    // Basic perf snapshot
    (base as any).performance = {
      load_time_ms: net.load_ms,
      http_version: net.http_version || null,
      redirects: net.redirects || 0,
      final_url: net.final_url || url,
    };

    // Phase 2
    const [links, crawl] = await Promise.all([linkAudit(base), robotsAudit(base)]);
    (base as any).link_checks = links;
    (base as any).crawl_checks = crawl;

    // Optional: PageSpeed
    (base as any).pagespeed = await fetchPageSpeed((base as any).performance.final_url || url);

    // Phase 3: Rendered compare (Playwright)
    if (do_rendered_check) {
      const html = await renderHTML((base as any).performance.final_url || url);
      if (html) {
        const summary = summarizeRendered((base as any).performance.final_url || url, html);
        (base as any).rendered_diff = makeRenderedDiff(base, summary);
        (base as any).rendered_diff.render_excerpt = html.slice(0, 2000);
      } else {
        (base as any).rendered_diff = { rendered: false, error: "Playwright render failed or blocked" };
      }
    }

    return NextResponse.json(base);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
