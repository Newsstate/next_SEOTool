// app/api/analyze/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { fetchRaw, parseHTML, linkAudit, robotsAudit } from "@/lib/seo";
import { renderHTML, summarizeRendered, makeRenderedDiff } from "@/lib/render";
import { buildCompareRows, findSitemapMembership } from "@/lib/seo";

// PageSpeed helper
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
    const { url, do_rendered_check = true, do_pagespeed = true } = await req.json();
    if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

    const net = await fetchRaw(url);
    const base: any = parseHTML(url, net.body, { ...net.headers, status: String(net.status) }, net.load_ms);
    base.performance = {
      load_time_ms: net.load_ms,
      http_version: net.http_version || null,
      redirects: net.redirects || 0,
      final_url: net.final_url || url,
    };

    // Phase 2
    const [links, crawl] = await Promise.all([linkAudit(base), robotsAudit(base)]);
    base.link_checks = links;
    base.crawl_checks = crawl;

    // Find which sitemap contains this URL
    const smUrls = (base?.crawl_checks?.sitemaps || []).map((s: any) => s.url).filter(Boolean);
    base.sitemap_membership = await findSitemapMembership(base.performance.final_url || url, smUrls);

    // AMP compare (static)
    let ampCompare: any = null;
    const is_amp = !!base.is_amp;
    const amp_url = base.amp_url as string | undefined;
    const canonical = base.canonical as string | undefined;
    let nonAmpObj = base;
    let ampObj: any = null;

    if (is_amp && canonical) {
      const otherNet = await fetchRaw(canonical);
      ampObj = base;
      nonAmpObj = parseHTML(canonical, otherNet.body, { ...otherNet.headers, status: String(otherNet.status) }, otherNet.load_ms);
    } else if (!is_amp && amp_url) {
      const otherNet = await fetchRaw(amp_url);
      ampObj = parseHTML(amp_url, otherNet.body, { ...otherNet.headers, status: String(otherNet.status) }, otherNet.load_ms);
    }

    if (ampObj) {
      const cmp = buildCompareRows(nonAmpObj, ampObj);
      ampCompare = { non_amp: nonAmpObj, amp: ampObj, ...cmp };
    }
    base.amp_compare = ampCompare;

    // PageSpeed (optional)
    base.pagespeed = do_pagespeed ? await fetchPageSpeed(base.performance.final_url || url) : { enabled: false, skipped: true };

    // Rendered compare (optional)
    if (do_rendered_check) {
      const html = await renderHTML(base.performance.final_url || url);
      if (html) {
        const summary = summarizeRendered(base.performance.final_url || url, html);
        base.rendered_diff = makeRenderedDiff(base, summary);
        base.rendered_diff.render_excerpt = html.slice(0, 2000);
      } else {
        base.rendered_diff = { rendered: false, error: "Playwright render failed or blocked" };
      }
    }

    return NextResponse.json(base);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
