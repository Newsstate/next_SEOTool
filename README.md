# SEO Insight (Next.js)
Real-time SEO scanner with optional JS rendering (Playwright) and PageSpeed Insights.

## Quick start
```bash
npm i
npx playwright install chromium
npm run dev
# open http://localhost:3000
```

## Docker (works great on Render)
```bash
docker build -t seo-insight-next .
docker run -p 3000:3000 seo-insight-next
```

## Environment
Copy `.env.example` to `.env.local` and set:
```
PAGESPEED_API_KEY=your_google_psi_key
SEO_UA=Mozilla/5.0 (compatible; SEO-Analyzer-Next/1.0; +https://example.local)
HTTP_TIMEOUT_MS=20000
```
