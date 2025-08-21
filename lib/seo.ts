import * as cheerio from "cheerio";
import type { Cheerio, Element } from "cheerio";

import { URL } from "url";


export type FetchResult = {
  load_ms: number;
  body: string;
  headers: Record<string, string>;
  status: number;
  final_url: string;
  redirects: number;
  http_version?: string | null;
};

export const UA = process.env.SEO_UA || "Mozilla/5.0 (compatible; SEO-Analyzer-Next/1.0; +https://example.local)";
const HTTP_TIMEOUT_MS = Number(process.env.HTTP_TIMEOUT_MS || 20000);

export async function fetchRaw(target: string): Promise<FetchResult> {
  const t0 = Date.now();
  const res = await fetch(target, {
    headers: {
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-IN,en;q=0.9"
    },
    redirect: "follow",
    cache: "no-store"
  } as RequestInit);
  const body = await res.text();
  const load_ms = Date.now() - t0;
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => headers[k.toLowerCase()] = v);
  return {
    load_ms,
    body,
    headers,
    status: res.status,
    final_url: res.url || target,
    redirects: 0,
    http_version: null
  };
}

function text($el: Cheerio<Element>): string {
  return ($el.text() || "").trim().replace(/\s+/g, " ");
}

function safeJson(s: string) {
  try { return JSON.parse(s); } catch {
    try { return JSON.parse(s.replace(/,(\s*[}\]])/g, "$1")); } catch { return null; }
  }
}

export function extractStructured(html: string, baseUrl: string) {
  const $ = cheerio.load(html);
  const json_ld: any[] = [];
  $('script[type*="ld+json"]').each((_, el) => {
    const raw = $(el).text() || "";
    const data = safeJson(raw);
    if (!data) return;
    if (Array.isArray(data)) json_ld.push(...data);
    else json_ld.push(data);
  });
  const microdata: any[] = [];
  $('[itemscope]').each((_, el) => {
    const itemtype = $(el).attr("itemtype");
    const props: any[] = [];
    $(el).find("[itemprop]").each((__, p) => {
      const prop = $(p).attr("itemprop") || "";
      const value = $(p).attr("content") || text($(p));
      props.push({ prop, value });
    });
    microdata.push({ itemtype, properties: props });
  });
  const rdfa: any[] = [];
  $('[typeof]').each((_, el) => {
    const tf = $(el).attr("typeof") || "";
    const about = $(el).attr("about") || $(el).attr("resource") || "";
    const props = $(el).find("[property]").map((__, p) => $(p).attr("property")).get();
    rdfa.push({ typeof: tf, about, props });
  });
  return { json_ld, microdata, rdfa };
}

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
  (jsonld || []).forEach(block => {
    if (block && typeof block === "object" && block["@graph"]) push(block["@graph"]);
    else push(block);
  });
  return items;
}

function requiredFor(typ: string) {
  const t = typ.toLowerCase();
  if (["article","newsarticle","blogposting"].includes(t)) return ["headline"];
  if (["organization","localbusiness"].includes(t)) return ["name"];
  if (["product"].includes(t)) return ["name"];
  if (["breadcrumblist"].includes(t)) return ["itemListElement"];
  if (["faqpage"].includes(t)) return ["mainEntity"];
  if (["event"].includes(t)) return ["name","startDate"];
  return [];
}

export function validateJSONLD(jsonld: any[]) {
  const items = jsonldItems(jsonld);
  const report = items.map((it: any) => {
    const typ = it["@type"];
    const typVal = Array.isArray(typ) ? (typ[0] || "Unknown") : (typ || "Unknown");
    const req = requiredFor(String(typVal));
    const missing = req.filter((f) => !(f in it) || (typeof it[f] === "string" && !it[f].trim()));
    return { type: typVal, missing, ok: req.length ? missing.length === 0 : true };
  });
  const summary = {
    total_items: items.length,
    ok_count: report.filter((r: any) => r.ok).length,
    has_errors: report.some((r: any) => !r.ok)
  };
  return { summary, items: report };
}

export function parseHTML(url: string, body: string, headers: Record<string,string>, load_ms: number) {
  const $ = cheerio.load(body);
  const head = $("head").length ? $("head") : $.root();
  const title = head.find("title").text() || null;
  let desc: string | null = null;
  let robots: string | null = null;
  head.find("meta").each((_, el) => {
    const name = (el.attribs["name"] || el.attribs["property"] || "").toLowerCase();
    if (name === "description" || name === "og:description") {
      desc = desc || el.attribs["content"];
    }
    if (name === "robots") {
      robots = el.attribs["content"];
    }
  });
  let canon: string | null = null;
  const linkCanon = head.find('link[rel*="canonical"]').attr("href");
  if (linkCanon) { try { canon = new URL(linkCanon, url).toString(); } catch {} }

  const ampLink = head.find('link[rel*="amphtml"]').attr("href");
  const amp_url = ampLink ? new URL(ampLink, url).toString() : null;
  const is_amp = Boolean(ampLink) || body.slice(0,5000).toLowerCase().includes("amp-boilerplate");

  const h1 = $("h1").map((_, h) => text($(h))).get();
  const h2 = $("h2").map((_, h) => text($(h))).get();

  const parsed = new URL(url);
  const baseHost = parsed.host.toLowerCase();
  const aHrefs = $("a").map((_, a) => (a.attribs["href"] || "")).get();
  const internal_links: string[] = [];
  const external_links: string[] = [];
  const nofollow_links: string[] = [];
  aHrefs.forEach(href => {
    if (!href) return;
    try {
      const abs = new URL(href, url).toString();
      const host = new URL(abs).host.toLowerCase();
      if (host === baseHost) internal_links.push(abs);
      else external_links.push(abs);
    } catch {}
  });
  $("a[rel]").each((_, a) => {
    const rel = (a.attribs["rel"] || "").toLowerCase();
    if (rel.includes("nofollow")) {
      const href = a.attribs["href"] || "";
      try { nofollow_links.push(new URL(href, url).toString());} catch {}
    }
  });

  const sd = extractStructured(body, url);
  const jsonld = sd.json_ld || [];
  const microdata = sd.microdata || [];
  const rdfa = sd.rdfa || [];
  const json_ld_validation = validateJSONLD(jsonld);

  const hreflang = head.find('link[rel*="alternate"][hreflang]').map((_, ln) => {
    const href = ln.attribs["href"];
    const h = (ln.attribs["hreflang"] || "").trim().toLowerCase();
    if (!href || !h) return null;
    try { return { hreflang: h, href: new URL(href, url).toString() }; } catch { return null; }
  }).get().filter(Boolean);

  const checks: any = {};
  const title_len = (title || "").length;
  const desc_len = (desc || "").trim().length;
  checks.title_length = { chars: title_len, ok: title_len >= 30 && title_len <= 65 };
  checks.meta_description_length = { chars: desc_len, ok: desc_len >= 70 && desc_len <= 160 };
  checks.h1_count = { count: h1.length, ok: h1.length === 1 };
  const viewport = head.find('meta[name="viewport"]').length > 0;
  checks.viewport_meta = { present: viewport, ok: viewport, value: viewport ? "present" : "missing" };
  checks.canonical = {
    present: !!canon,
    absolute: !!(canon && canon.startsWith("http")),
    self_ref: canon === url,
    ok: !!(canon && canon.startsWith("http")),
    value: canon || ""
  };
  const imgs = $("img").get();
  const with_alt = imgs.filter((im:any) => (im.attribs["alt"] || "").trim().length > 0).length;
  checks.alt_coverage = {
    with_alt,
    total_imgs: imgs.length,
    percent: imgs.length ? Math.round((with_alt / imgs.length) * 1000)/10 : 100.0,
    ok: imgs.length ? (with_alt / imgs.length) >= 0.8 : true
  };
  const htmlTag = $("html").get(0) as any;
  const langVal = htmlTag?.attribs?.["lang"];
  checks.lang = { value: langVal, present: !!langVal, ok: !!langVal };
  let charset: string | null = null;
  const mc = head.find("meta[charset]").attr("charset");
  if (mc) charset = mc;
  else {
    const ct = head.find('meta[http-equiv="Content-Type"]').attr("content");
    if (ct) {
      const part = ct.split(";").map(x=>x.trim().toLowerCase()).find(x=>x.startsWith("charset="));
      if (part) charset = part.split("=",1)[1];
    }
  }
  checks.charset = { value: charset, present: !!charset, ok: !!charset };
  const enc = (headers["content-encoding"] || "").toLowerCase();
  const compression_value = enc.includes("gzip") ? "gzip" : (enc.includes("br") ? "br" : "none");
  checks.compression = { gzip: enc.includes("gzip"), brotli: enc.includes("br"), value: compression_value, ok: ["gzip","br"].includes(compression_value) };

  const og_required = ["og:title","og:description","og:image"];
  const og_present = Object.fromEntries(og_required.map(p => [p, head.find(`meta[property="${p}"]`).length>0]));
  const tw_required = ["twitter:card","twitter:title","twitter:description","twitter:image"];
  const tw_present = Object.fromEntries(tw_required.map(n => [n, head.find(`meta[name="${n}"]`).length>0]));
  checks.social_cards = {
    og_complete: Object.values(og_present).every(Boolean),
    twitter_complete: Object.values(tw_present).every(Boolean),
    ok: Object.values(og_present).every(Boolean) && Object.values(tw_present).every(Boolean),
    value: `OG:${Object.values(og_present).every(Boolean)?'ok':'miss'} / TW:${Object.values(tw_present).every(Boolean)?'ok':'miss'}`
  };

  const xr_raw = headers["x-robots-tag"];
  const meta_flags = parseRobotsMeta(robots);
  const header_flags = parseXRobots(xr_raw);
  const noindex_flag = meta_flags.noindex || header_flags.noindex;
  const nofollow_flag = meta_flags.nofollow || header_flags.nofollow;
  checks.robots_meta_index = { value: meta_flags.noindex ? "noindex" : "index", ok: !meta_flags.noindex };
  checks.robots_meta_follow = { value: meta_flags.nofollow ? "nofollow" : "follow", ok: !meta_flags.nofollow };
  checks.x_robots_tag = { value: xr_raw || "", ok: !(header_flags.noindex || header_flags.nofollow) };
  checks.indexable = { value: (!noindex_flag && !nofollow_flag) ? "index,follow" : (noindex_flag && nofollow_flag) ? "noindex,nofollow" : (noindex_flag ? "noindex" : "nofollow"), ok: !noindex_flag };

  const sd_types = summarizeTypes(jsonld, microdata, rdfa);

  return {
    url,
    status_code: Number(headers["status"] || 0),
    load_time_ms: load_ms,
    content_length: Number(headers["content-length"] || Buffer.byteLength(body, "utf8")),
    title,
    description: desc,
    canonical: canon,
    robots_meta: robots,
    is_amp,
    amp_url,
    h1, h2,
    internal_links: internal_links.slice(0,200),
    external_links: external_links.slice(0,200),
    nofollow_links: nofollow_links.slice(0,200),
    json_ld: jsonld,
    json_ld_validation,
    microdata,
    microdata_summary: { count: microdata.length },
    rdfa,
    rdfa_summary: { count: rdfa.length },
    sd_types,
    has_open_graph: Object.values(og_present).some(Boolean),
    has_twitter_card: Object.values(tw_present).some(Boolean),
    robots_url: (parsed.protocol && parsed.host) ? `${parsed.protocol}//${parsed.host}/robots.txt` : null,
    checks,
    hreflang
  };
}

export function parseRobotsMeta(val?: string | null) {
  const d = { noindex: false, nofollow: false };
  if (!val) return d;
  const toks = (val || "").toLowerCase().split(/[\s,]+/).map(s=>s.trim()).filter(Boolean);
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

export function summarizeTypes(jsonld: any[], microdata: any[], rdfa: any[]) {
  const types = new Set<string>();
  jsonldItems(jsonld).forEach((it:any) => {
    const t = it["@type"];
    if (Array.isArray(t)) t.forEach(x => { const ln = localname(String(x)); if (ln) types.add(ln); });
    else if (typeof t === "string") { const ln = localname(t); if (ln) types.add(ln); }
  });
  (microdata || []).forEach((md:any)=>{
    const it = md.itemtype;
    if (Array.isArray(it)) it.forEach((x:string)=>{ const ln = localname(x); if (ln) types.add(ln); });
    else if (typeof it === "string") { const ln = localname(it); if (ln) types.add(ln); }
  });
  (rdfa || []).forEach((rd:any)=>{
    const tf = rd.typeof;
    if (typeof tf === "string") tf.split(/\s+/).forEach(tok=>{ const ln = localname(tok); if (ln) types.add(ln); });
  });
  const has_newsarticle = Array.from(types).some(t=>t.toLowerCase()==="newsarticle");
  return { types: Array.from(types).sort(), has_newsarticle };
}

export async function linkAudit(data: any) {
  const internal: string[] = (data.internal_links || []).slice(0,25);
  const external: string[] = (data.external_links || []).slice(0,10);
  async function check(u: string) {
    const item: any = { url: u };
    try {
      const r = await fetch(u, { method: "HEAD", redirect: "follow", cache: "no-store" } as RequestInit);
      if ([405,501].includes(r.status)) {
        const r2 = await fetch(u, { method: "GET", redirect: "follow", cache: "no-store" } as RequestInit);
        item.status = r2.status;
        item.final_url = r2.url;
      } else {
        item.status = r.status;
        item.final_url = r.url;
      }
    } catch (e:any) {
      item.error = String(e?.message || e);
    }
    return item;
  }
  const res_int = await Promise.all(internal.map(check));
  const res_ext = await Promise.all(external.map(check));
  return { internal: res_int, external: res_ext };
}

export async function robotsAudit(data: any) {
  const robots_url = data.robots_url;
  const out: any = { robots_txt: null, sitemaps: [], blocked_by_robots: null };
  if (!robots_url) return out;
  try {
    const r = await fetch(robots_url, { cache: "no-store" } as RequestInit);
    const txt = r.ok ? await r.text() : "";
    out.robots_txt = { url: robots_url, status: r.status, length: txt.length };
    if (txt) {
      const lines = txt.split(/\r?\n/);
      const smaps = lines.filter(l => /^sitemap:/i.test(l.trim())).map(l => l.split(":")[1]).map(x=>x?.trim()).filter(Boolean) as string[];
      const seen = new Set<string>();
      for (const sm of smaps) {
        if (seen.has(sm)) continue;
        seen.add(sm);
        if (sm.toLowerCase().endsWith("sitemap_index.xml")) {
          out.sitemaps.push({ url: sm, note: "listed in robots; skipped index fetch" });
          continue;
        }
        try {
          const h = await fetch(sm, { method: "HEAD", redirect: "follow", cache: "no-store" } as RequestInit);
          out.sitemaps.push({ url: sm, status: h.status });
        } catch (e:any) {
          out.sitemaps.push({ url: sm, error: String(e?.message || e) });
        }
      }
    }
  } catch (e:any) {
    out.robots_txt = { url: robots_url, error: String(e?.message || e) };
  }
  return out;
}
