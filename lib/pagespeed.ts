export async function fetchPageSpeed(url: string) {
  const key = process.env.PAGESPEED_API_KEY;
  if (!key) return { enabled: false, error: "No API key" };
  const base = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
  const out: any = { enabled: true };
  for (const strat of ["mobile","desktop"]) {
    try {
      const r = await fetch(`${base}?url=${encodeURIComponent(url)}&strategy=${strat}&key=${key}`, { cache: "no-store" } as RequestInit);
      if (!r.ok) { out[strat] = { error: `HTTP ${r.status}` }; continue; }
      const data = await r.json();
      const cat = data?.lighthouseResult?.categories?.performance || {};
      const score = typeof cat.score === "number" ? Math.round(cat.score * 100) : null;
      const audits = data?.lighthouseResult?.audits || {};
      const metrics_keys = [
        "first-contentful-paint",
        "speed-index",
        "largest-contentful-paint",
        "total-blocking-time",
        "cumulative-layout-shift",
        "server-response-time",
      ];
      const metrics: any = {};
      for (const k of metrics_keys) if (audits[k]) metrics[k] = audits[k];
      out[strat] = { score, metrics };
    } catch (e:any) {
      out[strat] = { error: String(e?.message || e) };
    }
  }
  return out;
}
