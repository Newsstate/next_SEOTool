// app/api/analyze/route.ts
import { NextResponse } from "next/server";
import * as SEO from "@/lib/seo";

// ensure Node runtime (Playwright etc.)
export const runtime = "nodejs";
// this route should always be dynamic
export const dynamic = "force-dynamic";

type AnalyzeBody = {
  url: string;
  do_rendered_check?: boolean; // default true
  do_pagespeed?: boolean;      // default true
  do_amp_compare?: boolean;    // default true
};

function getAnalyzer() {
  // be tolerant to different export styles
  return (
    (SEO as any).analyzeUrl ||
    (SEO as any).analyze ||
    (SEO as any).default
  );
}

/** Keep only primitive/safe fields for compare tables to avoid cycles */
function summarize(d: any) {
  if (!d || typeof d !== "object") return null;
  return {
    url: d.url ?? null,
    status_code: d.status_code ?? null,
    load_time_ms: d.load_time_ms ?? null,
    content_length: d.content_length ?? null,
    title: d.title ?? null,
    description: d.description ?? null,
    canonical: d.canonical ?? null,
    h1_count: Array.isArray(d.h1) ? d.h1.length : null,
    h1_first: Array.isArray(d.h1) && d.h1.length ? d.h1[0] : null,
    has_open_graph: !!d?.has_open_graph,
    has_twitter_card: !!d?.has_twitter_card,
    json_ld_count: Array.isArray(d.json_ld) ? d.json_ld.length : null,
    internal_links_count: Array.isArray(d.internal_links) ? d.internal_links.length : null,
    external_links_count: Array.isArray(d.external_links) ? d.external_links.length : null,
    viewport_present: !!d?.checks?.viewport_meta?.present,
    is_amp: !!d?.is_amp,
    amp_url: d?.amp_url ?? null,
  };
}

function buildAmpCompare(nonamp: any, amp: any) {
  const a = summarize(nonamp);
  const b = summarize(amp);
  const row = (label: string, key: keyof typeof a) => ({
    label,
    non_amp: a?.[key] ?? null,
    amp: b?.[key] ?? null,
    changed: (a?.[key] ?? null) !== (b?.[key] ?? null),
  });
  return {
    non_amp: a,
    amp: b,
    rows: [
      row("URL", "url"),
      row("Status", "status_code"),
      row("Load (ms)", "load_time_ms"),
      row("Page size (bytes)", "content_length"),
      row("Title", "title"),
      row("Meta description", "description"),
      row("Canonical", "canonical"),
      row("H1 count", "h1_count"),
      row("First H1", "h1_first"),
      row("Open Graph present", "has_open_graph"),
      row("Twitter Card present", "has_twitter_card"),
      row("JSON-LD count", "json_ld_count"),
      row("Internal link count", "internal_links_count"),
      row("External link count", "external_links_count"),
      row("Viewport meta present", "viewport_present"),
    ],
  };
}

/** Replace circular refs with "[Circular]" to guarantee JSON.stringify safety */
function decycle<T>(obj: T): T {
  const seen = new WeakSet();
  return JSON.parse(
    JSON.stringify(obj, (_k, v) => {
      if (typeof v === "object" && v !== null) {
        if (seen.has(v)) return "[Circular]";
        seen.add(v);
      }
      return v;
    })
  );
}

export async function POST(req: Request) {
  const body = (await req.json()) as AnalyzeBody;

  if (!body?.url || typeof body.url !== "string") {
    return NextResponse.json({ error: "Missing 'url' in request body" }, { status: 400 });
  }

  const url = body.url.trim();
  const doRendered = body.do_rendered_check !== false; // default true
  const doPagespeed = body.do_pagespeed !== false;     // default true
  const doAmpCompare = body.do_amp_compare !== false;  // default true

  const analyze = getAnalyzer();
  if (typeof analyze !== "function") {
    return NextResponse.json({ error: "Analyzer not found in lib/seo" }, { status: 500 });
  }

  // 1) Base scan
  //   Pass options if your analyzer supports them; extra options are ignored safely.
  const base = await analyze(url, { doRendered, doPagespeed });

  // 2) Optionally compute AMP compare WITHOUT embedding full objects
  const result: any = { ...base };
  if (doAmpCompare) {
    try {
      const ampUrl = base?.amp_url || null;
      const isAmp = !!base?.is_amp;

      if (ampUrl || isAmp) {
        let nonampData = base;
        let ampData: any = null;

        if (isAmp) {
          // If the scanned page is AMP, compare against canonical if present
          if (base?.canonical) {
            nonampData = await analyze(base.canonical, { doRendered: false, doPagespeed: false });
          }
          ampData = base;
        } else if (ampUrl) {
          // If the scanned page is non-AMP, fetch AMP variant
          ampData = await analyze(ampUrl, { doRendered: false, doPagespeed: false });
        }

        if (ampData) {
          result.amp_compare = buildAmpCompare(nonampData, ampData);
        }
      }
    } catch (e: any) {
      result.amp_compare_error = String(e?.message || e);
    }
  }

  // 3) Always return a decycled copy
  return NextResponse.json(decycle(result));
}
