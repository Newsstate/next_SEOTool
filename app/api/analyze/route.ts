import { NextRequest, NextResponse } from "next/server";
import { fetchRaw, parseHTML, linkAudit, robotsAudit, UA } from "@/lib/seo";
import { fetchPageSpeed } from "@/lib/pagespeed";
export const runtime = "nodejs"; // needed for Playwright

async function renderWithPlaywright(url: string, timeoutMs = 30000): Promise<string | null> {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    const context = await browser.newContext({ userAgent: UA });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: timeoutMs });
    const html = await page.content();
    await browser.close();
    return html;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = String(body?.url || "").trim();
    const do_rendered_check = Boolean(body?.do_rendered_check);
    if (!url) return NextResponse.json({ error: "No URL" }, { status: 400 });

    // Phase 1: Static fetch + parse
    const raw = await fetchRaw(url);
    const base = parseHTML(url, raw.body, { ...raw.headers, status: String(raw.status) }, raw.load_ms);

    // Performance snapshot
    const final_url = raw.final_url || url;
    const is_https = (new URL(final_url)).protocol === "https:";
    (base as any).performance = {
      load_time_ms: raw.load_ms,
      page_size_bytes: Number(raw.headers["content-length"] || Buffer.byteLength(raw.body, "utf8")),
      http_version: raw.http_version,
      redirects: raw.redirects,
      final_url,
      https: { is_https, ssl_checked: false, ssl_ok: null },
    };

    // Phase 2: link checks + robots/sitemaps
    (base as any).link_checks = await linkAudit(base);
    (base as any).crawl_checks = await robotsAudit(base);

    // Optional rendered comparison
    let used_js_primary = false;
    if (do_rendered_check) {
      const html2 = await renderWithPlaywright(final_url);
      if (html2) {
        const rParsed = parseHTML(final_url, html2, { status: "200" }, raw.load_ms);
        (base as any).rendered_diff = {
          rendered: true,
          title_changed: (base as any).title !== rParsed.title,
          description_changed: (base as any).description !== rParsed.description,
          h1_count_changed: ((base as any).h1 || []).length !== (rParsed.h1 || []).length,
          after: {
            title: rParsed.title,
            description: rParsed.description,
            h1_count: (rParsed.h1 || []).length,
            json_ld_count: (rParsed.json_ld || []).length,
          }
        };
        used_js_primary = true;
      } else {
        (base as any).rendered_diff = { rendered: false, error: "Playwright render skipped/failed" };
      }
    }

    // PSI
    (base as any).pagespeed = await fetchPageSpeed(final_url);
    (base as any).notes = Object.assign({}, (base as any).notes || {}, { used_js_fallback: used_js_primary });

    return NextResponse.json(base);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
