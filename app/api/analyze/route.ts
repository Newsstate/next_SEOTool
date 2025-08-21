// app/api/analyze/route.ts
import { NextResponse } from "next/server";
import * as SEO from "@/lib/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnalyzeBody = {
  url: string;
  do_rendered_check?: boolean; // default true
  do_pagespeed?: boolean;      // default true
  do_amp_compare?: boolean;    // default true
};

type AnalyzeFn = (url: string, opts?: any) => Promise<any>;

/** Find whichever export your lib/seo provides */
function getAnalyzer(): AnalyzeFn {
  const mod: any = SEO as any;
  const fn =
    mod.analyze ||
    mod.analyzeUrl ||
    mod.scan ||
    mod.scanUrl ||
    mod.default;
  if (typeof fn !== "function") {
    throw new Error("Analyzer function not found in lib/seo");
  }
  return fn as AnalyzeFn;
}

/** Replace circular refs with "[Circular]" and return a deep JSON clone */
function decycle<T>(obj: T): T {
  const seen = new WeakSet<object>();
  return JSON.parse(
    JSON.stringify(obj as any, (_k, v) => {
      if (v && typeof v === "object") {
        if (seen.has(v)) return "[Circular]";
        seen.add(v);
      }
      return v;
    })
  );
}

/** Minimal, safe snapshot used in compare tables (no nested objects) */
type Summary = {
  url: string | null;
  status_code: number | null;
  load_time_ms: number | null;
  content_length: number | null;
  title: string | null;
  description: string | null;
  canonical: string | null;
  h1_count: number | null;
  h1_first: string | null;
  has_open_graph: boolean;
  has_twitter_card: boolean;
  json_ld_count: number | null;
  internal_links_count: number | null;
  external_links_count: number | null;
  viewport_present: boolean;
  is_amp: boolean;
  amp_url: string | null;
};

function summarize(d: any): Summary {
  return {
    url: d?.url ?? null,
    status_code: d?.status_code ?? null,
    load_time_ms: d?.load_time_ms ?? null,
    content_length: d?.content_length ?? null,
    title: d?.title ?? null,
    description: d?.description ?? null,
    canonical: d?.canonical ?? null,
    h1_count: Array.isArray(d?.h1) ? d.h1.length : null,
    h1_first: Array.isArray(d?.h1) && d.h1.length ? d.h1[0] : null,
    has_open_graph: !!d?.has_open_graph,
    has_twitter_card: !!d?.has_twitter_card,
    json_ld_count: Array.isArray(d?.json_ld) ? d.json_ld.length : null,
    internal_links_count: Array.isArray(d?.internal_links) ? d.internal_links.length : null,
    external_links_count: Array.isArray(d?.external_links) ? d.external_links.length : null,
    viewport_present: !!d?.checks?.viewport_meta?.present,
    is_amp: !!d?.is_amp,
    amp_url: d?.amp_url ?? null,
  };
}

function buildAmpCompare(nonamp: any, amp: any) {
  const a = summarize(nonamp);
  const b = summarize(amp);
  const row = (label: string, key: keyof Summary) => ({
    label,
    non_amp: a[key],
    amp: b[key],
    changed: a[key] !== b[key],
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

export async function POST(req: Request) {
  const body = (await req.json()) as AnalyzeBody;

  if (!body?.url || typeof body.url !== "string") {
    return NextResponse.json({ error: "Missing 'url' in request body" }, { status: 400 });
  }

  const url = body.url.trim();
  const doRendered = body.do_rendered_check !== false; // default true
  const doPagespeed = body.do_pagespeed !== false;     // default true
  const doAmpCompare = body.do_amp_compare !== false;  // default true

  let analyze: AnalyzeFn;
  try {
    analyze = getAnalyzer();
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }

  // 1) Base scan
  const baseRaw = await analyze(url, { doRendered: doRendered, doPagespeed: doPagespeed });

  // 2) Immediately decycle & strip any cyclic fields the lib may have added
  let baseSafe: any = decycle(baseRaw);
  if (baseSafe && typeof baseSafe === "object" && "amp_compare" in baseSafe) {
    // Analyzer may have inserted a heavy/cyclic amp_compare; drop it
    try { delete baseSafe.amp_compare; } catch {}
  }

  // Start the result from the safe clone
  const result: any = { ...baseSafe };

  // 3) Build AMP compare only from summaries (no object graphs)
  if (doAmpCompare) {
    try {
      const ampUrl = baseSafe?.amp_url || null;
      const isAmp = !!baseSafe?.is_amp;

      if (ampUrl || isAmp) {
        let nonampData = baseRaw; // use original for best fidelity in summarize()
        let ampData: any = null;

        if (isAmp) {
          // current page is AMP; compare against canonical if exists
          if (baseSafe?.canonical) {
            const canonicalRaw = await analyze(baseSafe.canonical, { doRendered: false, doPagespeed: false });
            nonampData = canonicalRaw;
          }
          ampData = baseRaw;
        } else if (ampUrl) {
          // current page is non-AMP; fetch AMP variant
          const ampRaw = await analyze(ampUrl, { doRendered: false, doPagespeed: false });
          ampData = ampRaw;
        }

        if (ampData) {
          result.amp_compare = buildAmpCompare(nonampData, ampData);
        }
      }
    } catch (e: any) {
      result.amp_compare_error = String(e?.message || e);
    }
  }

  // 4) Final safety: return a decycled copy
  return NextResponse.json(decycle(result));
}
