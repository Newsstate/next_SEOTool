// lib/render.ts
import * as cheerio from "cheerio";
import type { Cheerio, Element } from "cheerio";
import { UA } from "@/lib/seo";

export const RUNTIME_NODE_ONLY = true; // just a marker to remind this must run in node

export async function renderHTML(url: string, timeoutMs = 30000): Promise<string | null> {
  // IMPORTANT: This route must run in Node.js runtime, not Edge
  const { chromium } = await import("playwright"); // dynamic to avoid edge bundling
  try {
    const browser = await chromium.launch({ args: ["--no-sandbox"] });
    try {
      const context = await browser.newContext({ userAgent: UA });
      const page = await context.newPage();
      await page.goto(url, { waitUntil: "networkidle", timeout: timeoutMs });
      const html = await page.content();
      await context.close();
      return html;
    } finally {
      await browser.close();
    }
  } catch {
    return null;
  }
}

function text($el: Cheerio<Element>): string {
  return ($el.text() || "").trim().replace(/\s+/g, " ");
}

export function summarizeRendered(url: string, html: string) {
  const $ = cheerio.load(html);
  const title = $("head > title").text() || null;

  let desc: string | null = null;
  let robots: string | null = null;
  $("head meta").each((_, el) => {
    const name = ((el as any).attribs?.name || (el as any).attribs?.property || "").toLowerCase();
    if (name === "description" || name === "og:description") desc = desc || (el as any).attribs?.content;
    if (name === "robots") robots = (el as any).attribs?.content;
  });

  let canon: string | null = null;
  const linkCanon = $('head link[rel*="canonical"]').attr("href");
  if (linkCanon) {
    try { canon = new URL(linkCanon, url).toString(); } catch {}
  }

  const h1 = $("h1").map((_, h) => text($(h) as Cheerio<Element>)).get();

  const og_ok = $('head meta[property="og:title"]').length > 0;
  const tw_ok = $('head meta[name="twitter:card"]').length > 0;

  const jsonld = $('script[type*="ld+json"]').length;
  const micro = $("[itemscope]").length;
  const rdfa = $("[typeof]").length;

  const baseHost = new URL(url).host.toLowerCase();
  const links = $("a").map((_, a) => (a as any).attribs?.href || "").get();
  let internal = 0, external = 0;
  links.forEach((href) => {
    if (!href) return;
    try {
      const abs = new URL(href, url).toString();
      const host = new URL(abs).host.toLowerCase();
      if (host === baseHost) internal++; else external++;
    } catch {}
  });

  const viewport_present = $('head meta[name="viewport"]').length > 0;

  return {
    title,
    description: desc,
    canonical: canon,
    robots_meta: robots,
    h1_count: h1.length,
    h1_first: h1[0] || null,
    has_open_graph: og_ok,
    has_twitter_card: tw_ok,
    json_ld_count: jsonld,
    microdata_count: micro,
    rdfa_count: rdfa,
    internal_links_count: internal,
    external_links_count: external,
    viewport_present,
  };
}

export function makeRenderedDiff(original: any, rendered: any) {
  const before = {
    title: original?.title,
    description: original?.description,
    canonical: original?.canonical,
    robots_meta: original?.robots_meta,
    h1_count: (original?.h1 || []).length,
    h1_first: (original?.h1 || [null])[0] ?? null,
    has_open_graph: !!original?.has_open_graph,
    has_twitter_card: !!original?.has_twitter_card,
    json_ld_count: (original?.json_ld || []).length,
    microdata_count: (original?.microdata || []).length,
    rdfa_count: (original?.rdfa || []).length,
    internal_links_count: (original?.internal_links || []).length,
    external_links_count: (original?.external_links || []).length,
    viewport_present: !!original?.checks?.viewport_meta?.present,
  };

  const after = rendered;

  const row = (label: string, key: keyof typeof before) => ({
    label,
    key,
    before: (before as any)[key],
    after: (after as any)[key],
    changed: (before as any)[key] !== (after as any)[key],
  });

  const matrix = [
    row("Title", "title"),
    row("Meta Description", "description"),
    row("Canonical", "canonical"),
    row("Robots Meta", "robots_meta"),
    row("H1 Count", "h1_count"),
    row("First H1", "h1_first"),
    row("Open Graph Present", "has_open_graph"),
    row("Twitter Card Present", "has_twitter_card"),
    row("JSON-LD Count", "json_ld_count"),
    row("Microdata Count", "microdata_count"),
    row("RDFa Count", "rdfa_count"),
    row("Internal Links (count)", "internal_links_count"),
    row("External Links (count)", "external_links_count"),
    row("Viewport Meta Present", "viewport_present"),
  ];

  return {
    rendered: true,
    title_changed: before.title !== after.title,
    description_changed: before.description !== after.description,
    h1_count_changed: before.h1_count !== after.h1_count,
    matrix,
    before,
    after,
  };
}
