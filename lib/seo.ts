// lib/seo.ts
import * as cheerio from "cheerio";
import type { Cheerio, Element } from "cheerio";

/** Network types */
export type FetchResult = {
  load_ms: number;
  body: string;
  headers: Record<string, string>;
  status: number;
  final_url: string;
  redirects: number;
  http_version?: string | null;
};

export const UA =
  process.env.SEO_UA ||
  "Mozilla/5.0 (compatible; SEO-Analyzer-Next/1.0; +https://example.local)";

const HTTP_TIMEOUT_MS = Number(process.env.HTTP_TIMEOUT_MS || 20000);

/** Fetch raw HTML with a timeout and basic headers */
export async function fetchRaw(target: string): Promise<FetchResult> {
  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

  const res = await fetch(target, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-IN,en;q=0.9",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
    redirect: "follow",
    cache: "no-store",
    signal: controller.signal,
  } as RequestInit).finally(() => clearTimeout(timer));

  const body = await res.text();
  const load_ms = Date.now() - t0;

  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));

  return {
    load_ms,
    body,
    headers,
    status: res.status,
    final_url: res.url || target,
    redirects: 0,
    http_version: null,
  };
}

/** Text helper with proper Cheerio typing */
function text($el: Cheerio<Element>): string {
  return ($el.text() || "").trim().replace(/\s+/g, " ");
}

/** Simple whitespace normalize */
function textify(s: string) {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Resolve absolute URL safely */
function abs(base: string, href?: string | null): string | null {
  try {
    if (!href) return null;
    return new URL(href, base).toString();
  } catch {
    return href || null;
  }
}

/** Lightweight EN stopwords for keyword density */
const STOP = new Set([
  "the","a","an","and","or","of","to","in","on","for","is","it","as","at","by","be","are","was","were",
  "this","that","with","from","but","not","your","you","we","our","they","their","i","me","my"
]);

/** JSON parsing that tolerates trailing commas a bit */
function safeJson(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    try {
      return JSON.parse(s.replace(/,(\s*[}\]])/g, "$1"));
    } catch {
      return null;
    }
  }
}

/** Extract JSON-LD, Microdata, RDFa */
export function extractStructured(html: string, baseUrl: string) {
  const $ = cheerio.load(html);

  // JSON-LD
  const json_ld: any[] = [];
  $('script[type*="ld+json"]').each((_, el) => {
    const raw = $(el).text() || "";
    const data = safeJson(raw);
    if (!data) return;
    if (Array.isArray(data)) json_ld.push(...data);
    else json_ld.push(data);
  });

  // Microdata
  const microdata: any[] = [];
  $("[itemscope]").each((_, el) => {
    const itemtype = (el as any).attribs?.["itemtype"];
    const props: any[] = [];
    $(el)
      .find("[itemprop]")
      .each((__, p) => {
        const prop = (p as any).attribs?.["itemprop"] || "";
        const value =
          (p as any).attribs?.["content"] || text($(p) as Cheerio<Element>);
        props.push({ prop, value });
      });
    microdata.push({ itemtype, properties: props });
  });

  // RDFa
  const rdfa: any[] = [];
  $("[typeof]").each((_, el) => {
    const tf = (el as any).attribs?.["typeof"] || "";
    const about =
      (el as any).attribs?.["about"] ||
      (el as any).attribs?.["resource"] ||
      "";
    const props = $(el)
      .find("[property]")
      .map((__, p) => (p as any).attribs?.["property"])
      .get();
    rdfa.push({ typeof: tf, about, props });
  });

  return { json_ld, microdata, rdfa };
}

/** Helpers for JSON-LD validation */
function localname(t?: string | null) {
  if (!t) return null;
  let s = t;
  if (s.includes("#")) s = s.split("#").pop() as string;
  if (s.includes("/")) s = s.replace(/\/$/, "").split("/").pop() as string;
  s = s.trim();
  return s || null;
}

function jsonldItems(jsonld: any[]) {
  const items: any[] = [];
  function push(node: any) {
    if (Array.isArray(node)) node.forEach(push);
    else if (node && typeof node === "object") items.push(node);
  }
  (jsonld || []).forEach((block) => {
    if (block && typeof block === "object" && block["@graph"]) push(block["@graph"]);
    else push(block);
  });
  return items;
}

function requiredFor(typ: string) {
  const t = typ.toLowerCase();
  if (["article", "newsarticle", "blogposting"].includes(t)) return ["headline"];
  if (["organization", "localbusiness"].includes(t)) return ["name"];
  if (["product"].includes(t)) return ["name"];
  if (["breadcrumblist"].includes(t)) return ["itemListElement"];
  if (["faqpage"].includes(t)) return ["mainEntity"];
  if (["event"].includes(t)) return ["name", "startDate"];
  return [];
}

export function validateJSONLD(jsonld: any[]) {
  const items = jsonldItems(jsonld);
  const report = items.map((it: any) => {
    const typ = it["@type"];
    const typVal = Array.isArray(typ) ? typ[0] || "Unknown" : typ || "Unknown";
    const req = requiredFor(String(typVal));
    const missing = req.filter(
      (f) => !(f in it) || (typeof it[f] === "string" && !it[f].trim())
    );
    return { type: typVal, missing, ok: req.length ? missing.length === 0 : true };
  });
  const summary = {
    total_items: items.length,
    ok_count: report.filter((r: any) => r.ok).length,
    has_errors: report.some((r: any) => !r.ok),
  };
  return { summary, items: report };
}

/** Summarize all structured data types encountered */
export function summarizeTypes(jsonld: any[], microdata: any[], rdfa: any[]) {
  const types = new Set<string>();
  jsonldItems(jsonld).forEach((it: any) => {
    const t = it["@type"];
    if (Array.isArray(t))
      t.forEach((x) => {
        const ln = localname(String(x));
        if (ln) types.add(ln);
      });
    else if (typeof t === "string") {
      const ln = localname(t);
      if (ln) types.add(ln);
    }
  });
  (microdata || []).forEach((md: any) => {
    const it = md.itemtype;
    if (Array.isArray(it))
      it.forEach((x: string) => {
        const ln = localname(x);
        if (ln) types.add(ln);
      });
    else if (typeof it === "string") {
      const ln = localname(it);
      if (ln) types.add(ln);
    }
  });
  (rdfa || []).forEach((rd: any) => {
    const tf = rd.typeof;
    if (typeof tf === "string")
      tf.split(/\s+/).forEach((tok) => {
        const ln = localname(tok);
        if (ln) types.add(ln);
      });
  });
  const has_newsarticle = Array.from(types).some(
    (t) => t.toLowerCase() === "newsarticle"
  );
  return { types: Array.from(types).sort(), has_newsarticle };
}

/** Robots helpers */
export function parseRobotsMeta(val?: string | null) {
  const d = { noindex: false, nofollow: false };
  if (!val) return d;
  const toks = (val || "")
    .toLowerCase()
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  d.noindex = toks.includes("noindex");
  d.nofollow = toks.includes("nofollow");
  return d;
}
export function parseXRobots(val?: string | null) {
  const d = { noindex: false, nofollow: false };
  if (!val) return d;
  const s = (val || "").toLowerCase();
  d.noindex = s.includes("noindex");
  d.nofollow = s.includes("nofollow");
  return d;
}

/** Parse the static HTML and compute SEO checks (ENHANCED) */
export function parseHTML(
  url: string,
  body: string,
  headers: Record<string, string>,
  load_ms: number
) {
  const $ = cheerio.load(body);

  // --- Meta basics (avoid assigning $("head") to prevent Element/Document type mismatch)
  const title = $("head > title").text() ? text($("head > title") as Cheerio<Element>) : null;

  let desc: string | null = null;
  let robots: string | null = null;
  $("head meta").each((_, el) => {
    const name =
      ((el as any).attribs?.["name"] || (el as any).attribs?.["property"] || "").toLowerCase();
    if (name === "description" || name === "og:description") {
      desc = desc || (el as any).attribs?.["content"] || null;
    }
    if (name === "robots") {
      robots = (el as any).attribs?.["content"] || null;
    }
  });

  // Canonical
  let canonical: string | null = null;
  {
    const linkCanon = $('head link[rel*="canonical"]').attr("href");
    if (linkCanon) canonical = abs(url, linkCanon);
  }

  // AMP
  const amp_href = $('head link[rel*="amphtml"]').attr("href") || null;
  const amp_url = amp_href ? abs(url, amp_href) : null;
  const is_amp =
    Boolean(amp_href) || body.slice(0, 5000).toLowerCase().includes("amp-boilerplate");

  // Headings
  const h1 = $("h1").map((_, h) => text($(h) as Cheerio<Element>)).get();
  const h2 = $("h2").map((_, h) => text($(h) as Cheerio<Element>)).get();

  // Links (internal/external/nofollow)
  const parsed = new URL(url);
  const baseHost = parsed.host.toLowerCase();
  const internal_links: string[] = [];
  const external_links: string[] = [];
  const nofollow_links: string[] = [];

  $("a[href]").each((_, a) => {
    const href = (a as any).attribs?.["href"] || "";
    const absu = abs(url, href);
    if (!absu) return;
    try {
      const host = new URL(absu).host.toLowerCase();
      if (host === baseHost) internal_links.push(absu);
      else external_links.push(absu);
    } catch {}
    const rel = ((a as any).attribs?.["rel"] || "").toLowerCase();
    if (rel.includes("nofollow")) nofollow_links.push(absu);
  });

  // --- Open Graph & Twitter (full objects)
  const htmlTag = $("html").get(0) as any;
  const langAttr = htmlTag?.attribs?.["lang"] || null;

  const og = {
    title: $('head meta[property="og:title"]').attr("content") || title,
    description: $('head meta[property="og:description"]').attr("content") || desc,
    image: $('head meta[property="og:image"]').attr("content") || null,
    url: $('head meta[property="og:url"]').attr("content") || canonical || url,
    locale: $('head meta[property="og:locale"]').attr("content") || langAttr || null,
  };
  const twitter = {
    card: $('head meta[name="twitter:card"]').attr("content") || null,
    title: $('head meta[name="twitter:title"]').attr("content") || og.title || title,
    description: $('head meta[name="twitter:description"]').attr("content") || og.description || desc,
    image: $('head meta[name="twitter:image"], head meta[name="twitter:image:src"]').attr("content") || og.image || null,
    url: $('head meta[name="twitter:url"]').attr("content") || og.url,
  };

  // Viewport (full content)
  const viewport_meta = $('head meta[name="viewport"]').attr("content") || null;

  // Structured data
  const sd = extractStructured(body, url);
  const jsonld = sd.json_ld || [];
  const microdata = sd.microdata || [];
  const rdfa = sd.rdfa || [];
  const json_ld_validation = validateJSONLD(jsonld);
  const sd_types = summarizeTypes(jsonld, microdata, rdfa);

  // hreflang
  const hreflang = $('head link[rel*="alternate"][hreflang]')
    .map((_, ln) => {
      const href = (ln as any).attribs?.["href"];
      const h = ((ln as any).attribs?.["hreflang"] || "").trim().toLowerCase();
      if (!href || !h) return null;
      try {
        return { hreflang: h, href: new URL(href, url).toString() };
      } catch {
        return null;
      }
    })
    .get()
    .filter(Boolean);

  // --- Checks
  const checks: any = {};
  const title_len = (title || "").length;
  const desc_len = (desc || "").trim().length;

  checks.title_length = { chars: title_len, ok: title_len >= 30 && title_len <= 65 };
  checks.meta_description_length = { chars: desc_len, ok: desc_len >= 70 && desc_len <= 160 };
  checks.h1_count = { count: h1.length, ok: h1.length === 1 };

  checks.viewport_meta = {
    present: !!viewport_meta,
    ok: !!viewport_meta,
    value: viewport_meta || "missing",
  };

  checks.canonical = {
    present: !!canonical,
    absolute: !!(canonical && canonical.startsWith("http")),
    self_ref: canonical === url,
    ok: !!(canonical && canonical.startsWith("http")),
    value: canonical || "",
  };

  // Image alt coverage + lists (with/without alt, plus anchor link if present)
  const images_with_alt: Array<{src:string|null; link:string|null; alt:string}> = [];
  const images_missing_alt: Array<{src:string|null; link:string|null}> = [];
  $("img").each((_, im) => {
    const $im = $(im);
    const alt = ($im.attr("alt") || "").trim();
    const src = abs(url, $im.attr("src") || $im.attr("data-src") || null);
    const parentLink = $im.closest("a").first();
    const link = parentLink.length ? abs(url, parentLink.attr("href") || "") : null;
    if (alt) images_with_alt.push({ src, link, alt });
    else images_missing_alt.push({ src, link });
  });

  const imgsTotal = images_with_alt.length + images_missing_alt.length;
  checks.alt_coverage = {
    with_alt: images_with_alt.length,
    total_imgs: imgsTotal,
    percent: imgsTotal ? Math.round((images_with_alt.length / imgsTotal) * 1000) / 10 : 100.0,
    ok: imgsTotal ? (images_with_alt.length / imgsTotal) >= 0.8 : true,
  };

  // Lang & charset
  const langVal = langAttr;
  checks.lang = { value: langVal, present: !!langVal, ok: !!langVal };

  let charset: string | null = null;
  const mc = $("head meta[charset]").attr("charset");
  if (mc) charset = mc;
  else {
    const ct = $('head meta[http-equiv="Content-Type"]').attr("content") || "";
    const part = ct
      .split(";")
      .map((x) => x.trim().toLowerCase())
      .find((x) => x.startsWith("charset="));
    if (part) charset = part.split("=", 2)[1];
  }
  checks.charset = { value: charset, present: !!charset, ok: !!charset };

  // Compression
  const enc = (headers["content-encoding"] || "").toLowerCase();
  const compression_value = enc.includes("br")
    ? "br"
    : enc.includes("gzip")
    ? "gzip"
    : "none";
  checks.compression = {
    gzip: enc.includes("gzip"),
    brotli: enc.includes("br"),
    value: compression_value,
    ok: ["gzip", "br"].includes(compression_value),
  };

  // Social cards completeness
  const og_required = ["og:title", "og:description", "og:image"];
  const og_present = Object.fromEntries(
    og_required.map((p) => [p, $(`head meta[property="${p}"]`).length > 0])
  );
  const tw_required = [
    "twitter:card",
    "twitter:title",
    "twitter:description",
    "twitter:image",
  ];
  const tw_present = Object.fromEntries(
    tw_required.map((n) => [n, $(`head meta[name="${n}"]`).length > 0])
  );
  checks.social_cards = {
    og_complete: Object.values(og_present).every(Boolean),
    twitter_complete: Object.values(tw_present).every(Boolean),
    ok:
      Object.values(og_present).every(Boolean) &&
      Object.values(tw_present).every(Boolean),
    value: `OG:${Object.values(og_present).every(Boolean) ? "ok" : "miss"} / TW:${
      Object.values(tw_present).every(Boolean) ? "ok" : "miss"
    }`,
  };

  // Robots meta / X-Robots
  const xr_raw = headers["x-robots-tag"];
  const meta_flags = parseRobotsMeta(robots || undefined);
  const header_flags = parseXRobots(xr_raw || undefined);
  const noindex_flag = meta_flags.noindex || header_flags.noindex;
  const nofollow_flag = meta_flags.nofollow || header_flags.nofollow;

  checks.robots_meta_index = {
    value: meta_flags.noindex ? "noindex" : "index",
    ok: !meta_flags.noindex,
  };
  checks.robots_meta_follow = {
    value: meta_flags.nofollow ? "nofollow" : "follow",
    ok: !meta_flags.nofollow,
  };
  checks.x_robots_tag = {
    value: xr_raw || "",
    ok: !(header_flags.noindex || header_flags.nofollow),
  };
  checks.indexable = {
    value:
      !noindex_flag && !nofollow_flag
        ? "index,follow"
        : noindex_flag && nofollow_flag
        ? "noindex,nofollow"
        : noindex_flag
        ? "noindex"
        : "nofollow",
    ok: !noindex_flag,
  };

  // --- Content structure: body text, top keywords, heuristic EEAT
  const $bodyClone = $("body").clone();
  $bodyClone.find("script,style,noscript,svg,nav,footer,header,form,iframe").remove();
  const bodyText = textify($bodyClone.text() || "");
  const tokens = (bodyText.toLowerCase().match(/\b[a-z0-9][a-z0-9-]*\b/g) || [])
    .filter((w) => !STOP.has(w) && w.length > 2);
  const counts = new Map<string, number>();
  tokens.forEach((w) => counts.set(w, (counts.get(w) || 0) + 1));
  const word_count = tokens.length;
  const top_keywords = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([term, count]) => ({
      term,
      count,
      density: +(((count / Math.max(1, word_count)) * 100).toFixed(2)),
    }));

  const eeat_signals = {
    author_found:
      !!$('meta[name="author"]').length ||
      !!$('[itemprop="author"]').length ||
      !!$('a[rel="author"]').length ||
      !!$(".author, .byline").length,
    org_schema: (jsonld || []).some((x: any) => {
      const t = Array.isArray(x?.["@type"]) ? x["@type"][0] : x?.["@type"];
      return /Organization|LocalBusiness/i.test(String(t || ""));
    }),
    date_published:
      !!$('meta[property="article:published_time"]').length ||
      !!$("time[datetime]").length ||
      !!$('[itemprop="datePublished"]').length,
    contact_link: !!$('a[href*="contact"]').length,
    about_link: !!$('a[href*="about"]').length,
    references_outbound: external_links.length > 3,
  };
  const eeat_score = Math.round(
    (Number(eeat_signals.author_found) +
      Number(eeat_signals.org_schema) +
      Number(eeat_signals.date_published) +
      Number(eeat_signals.contact_link) +
      Number(eeat_signals.about_link) +
      (eeat_signals.references_outbound ? 1 : 0)) /
      6 *
      100
  );

  // robots URL
  const robots_url =
    parsed.protocol && parsed.host ? `${parsed.protocol}//${parsed.host}/robots.txt` : null;

  // Explicit indexability flags object for UI
  const indexability = {
    indexable: !noindex_flag,
    robots_meta_index: robots || "",
    follow: !nofollow_flag,
    x_robots_tag: xr_raw || "",
    lang: langVal || null,
    charset,
    compression: compression_value,
  };

  return {
    url,
    status_code: Number(headers["status"] || 0),
    load_time_ms: load_ms,
    content_length: Number(
      headers["content-length"] || Buffer.byteLength(body, "utf8")
    ),
    title,
    description: desc,
    canonical: canonical,
    robots_meta: robots,

    // AMP
    is_amp,
    amp_url,

    // headings & links
    h1,
    h2,
    internal_links: internal_links.slice(0, 200),
    external_links: external_links.slice(0, 200),
    nofollow_links: nofollow_links.slice(0, 200),

    // structured data
    json_ld: jsonld,
    json_ld_validation,
    microdata,
    microdata_summary: { count: microdata.length },
    rdfa,
    rdfa_summary: { count: rdfa.length },
    sd_types,

    // social + viewport
    has_open_graph: Object.values(og_present).some(Boolean),
    has_twitter_card: Object.values(tw_present).some(Boolean),
    open_graph: og,
    twitter_card: twitter,
    viewport_meta,

    // images alt lists
    images_alt: {
      coverage: checks.alt_coverage,
      with_alt: images_with_alt.slice(0, 100),
      missing_alt: images_missing_alt.slice(0, 100),
    },

    // indexability (explicit)
    indexability,

    // robots + hreflang
    robots_url,
    hreflang,

    // content structure + EEAT (heuristic)
    content_structure: {
      h1,
      h2,
      word_count,
      keywords: top_keywords,
      eeat: {
        score: eeat_score,
        signals: eeat_signals,
        summary:
          `Heuristic EEAT signals: ${
            Object.entries(eeat_signals)
              .filter(([, v]) => v)
              .map(([k]) => k.replace(/_/g, " "))
              .join(", ") || "none found"
          }`,
      },
    },

    // original checks
    checks,
  };
}

/** Sample link HEAD/GET checks */
export async function linkAudit(data: any) {
  const internal: string[] = (data.internal_links || []).slice(0, 25);
  const external: string[] = (data.external_links || []).slice(0, 10);

  async function check(u: string) {
    const item: any = { url: u };
    try {
      const r = await fetch(u, {
        method: "HEAD",
        redirect: "follow",
        cache: "no-store",
      } as RequestInit);
      if ([405, 501].includes(r.status)) {
        const r2 = await fetch(u, {
          method: "GET",
          redirect: "follow",
          cache: "no-store",
        } as RequestInit);
        item.status = r2.status;
        item.final_url = (r2 as any).url;
        // note: we skip redirects count for simplicity
      } else {
        item.status = r.status;
        item.final_url = (r as any).url;
      }
    } catch (e: any) {
      item.error = String(e?.message || e);
    }
    return item;
  }

  const res_int = await Promise.all(internal.map(check));
  const res_ext = await Promise.all(external.map(check));
  return { internal: res_int, external: res_ext };
}

/** Fetch robots.txt, list sitemaps, quick reachability check */
export async function robotsAudit(data: any) {
  const robots_url = data.robots_url;
  const out: any = { robots_txt: null, sitemaps: [], blocked_by_robots: null };
  if (!robots_url) return out;

  try {
    const r = await fetch(robots_url, { cache: "no-store" } as RequestInit);
    const txt = r.ok ? await r.text() : "";
    out.robots_txt = { url: robots_url, status: r.status, length: txt.length };

    if (txt) {
      const sitemaps: string[] = [];
      for (const line of txt.split(/\r?\n/)) {
        const m = line.match(/^sitemap:\s*(.+)$/i);
        if (m && m[1]) sitemaps.push(m[1].trim());
      }
      const seen = new Set<string>();
      for (const sm of sitemaps) {
        if (seen.has(sm)) continue;
        seen.add(sm);
        if (sm.toLowerCase().endsWith("sitemap_index.xml")) {
          out.sitemaps.push({ url: sm, note: "listed in robots; skipped index fetch" });
          continue;
        }
        try {
          const h = await fetch(sm, {
            method: "HEAD",
            redirect: "follow",
            cache: "no-store",
          } as RequestInit);
          out.sitemaps.push({ url: sm, status: h.status });
        } catch (e: any) {
          out.sitemaps.push({ url: sm, error: String(e?.message || e) });
        }
      }
    }
  } catch (e: any) {
    out.robots_txt = { url: robots_url, error: String(e?.message || e) };
  }
  return out;
}

// ---- Append to lib/seo.ts ---------------------------------------------------

export function compactSummary(d: any) {
  const checks = d?.checks || {};
  return {
    url: d?.url,
    status: d?.status_code,
    load_ms: d?.load_time_ms,
    size: d?.content_length,
    title: d?.title,
    description: d?.description,
    canonical: d?.canonical,
    h1_count: (d?.h1 || []).length,
    h1_first: (d?.h1 || [null])[0] ?? null,
    og: !!d?.has_open_graph,
    tw: !!d?.has_twitter_card,
    jsonld_count: (d?.json_ld || []).length,
    internal_count: (d?.internal_links || []).length,
    external_count: (d?.external_links || []).length,
    viewport: !!checks?.viewport_meta?.present,
    is_amp: !!d?.is_amp,
    amp_url: d?.amp_url,
  };
}

export function buildCompareRows(nonAmp: any, amp: any) {
  const a = compactSummary(nonAmp);
  const b = compactSummary(amp);
  const row = (label: string, key: keyof typeof a) => ({
    label,
    non_amp: (a as any)[key],
    amp: (b as any)[key],
    changed: (a as any)[key] !== (b as any)[key],
  });
  const rows = [
    row("URL", "url"),
    row("Status", "status"),
    row("Load (ms)", "load_ms"),
    row("Page size (bytes)", "size"),
    row("Title", "title"),
    row("Meta description", "description"),
    row("Canonical", "canonical"),
    row("H1 count", "h1_count"),
    row("First H1", "h1_first"),
    row("Open Graph present", "og"),
    row("Twitter Card present", "tw"),
    row("JSON-LD count", "jsonld_count"),
    row("Internal link count", "internal_count"),
    row("External link count", "external_count"),
    row("Viewport meta present", "viewport"),
  ];
  const changes = rows.filter((r) => r.changed).length;
  return { rows, changes };
}

/**
 * Find which sitemap(s) contain the target URL.
 * Checks robots-discovered sitemaps; expands one level of sitemapindex.
 */
export async function findSitemapMembership(
  targetUrl: string,
  sitemaps: string[],
  fetcher?: typeof fetch
) {
  const f = fetcher || fetch;
  const norm = (u: string) => {
    try {
      const x = new URL(u);
      // normalize trailing slash
      x.pathname = x.pathname.replace(/\/+$/, "");
      return x.toString();
    } catch {
      return u;
    }
  };
  const tnorm = norm(targetUrl);

  const checked: string[] = [];
  const matches: string[] = [];
  const queue: string[] = [...new Set(sitemaps || [])].slice(0, 10); // limit
  const children: string[] = [];

  const getText = async (u: string) => {
    const r = await f(u, { cache: "no-store" });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "";
    if (
      !/xml|text\/plain|application\/octet-stream/i.test(ct) &&
      !u.endsWith(".xml")
    ) {
      // still try reading; some servers don't set XML content-type
    }
    return await r.text();
  };

  const extractLocs = (xml: string, tag: "url" | "sitemap") => {
    const re =
      tag === "url"
        ? /<url>[\s\S]*?<loc>([\s\S]*?)<\/loc>[\s\S]*?<\/url>/gi
        : /<sitemap>[\s\S]*?<loc>([\s\S]*?)<\/loc>[\s\S]*?<\/sitemap>/gi;
    const out: string[] = [];
    let m;
    while ((m = re.exec(xml))) {
      const loc = (m[1] || "").trim();
      if (loc) out.push(loc);
    }
    return out;
  };

  while (queue.length && checked.length < 20 && matches.length < 5) {
    const u = queue.shift()!;
    checked.push(u);
    try {
      const xml = await getText(u);
      if (!xml) continue;
      const isIndex = /<sitemapindex/i.test(xml);
      if (isIndex) {
        const locs = extractLocs(xml, "sitemap").slice(0, 25);
        for (const loc of locs) if (!children.includes(loc)) children.push(loc);
        continue;
      }
      // regular urlset
      const locs = extractLocs(xml, "url");
      for (const loc of locs) {
        const n = norm(new URL(loc, u).toString());
        if (n === tnorm) {
          matches.push(u);
          break;
        }
      }
    } catch {
      // ignore
    }
  }

  // If index children exist, scan a few of them too (light scan)
  for (const child of children.slice(0, 10)) {
    if (checked.length >= 30 || matches.length >= 5) break;
    checked.push(child);
    try {
      const xml = await getText(child);
      if (!xml) continue;
      const locs = extractLocs(xml, "url");
      for (const loc of locs) {
        const n = norm(new URL(loc, child).toString());
        if (n === tnorm) {
          matches.push(child);
          break;
        }
      }
    } catch {}
  }

  return {
    found: matches.length > 0,
    matches,
    checked_count: checked.length,
    checked,
  };
}
