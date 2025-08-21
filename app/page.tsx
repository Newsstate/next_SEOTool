"use client";

// app/page.tsx
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Results } from "@/components/results";
import { Loader } from "@/components/loader";

export default function Page() {
  const [url, setUrl] = useState("");
  const [doRendered, setDoRendered] = useState(true);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function onAnalyze(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, do_rendered_check: doRendered }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err?.message || "Analyze failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 sm:p-6">
        <form onSubmit={onAnalyze} className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
          <div className="space-y-3">
            <label className="text-sm font-medium">URL to analyze</label>
            <Input
              placeholder="https://example.com/article"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              type="url"
            />
            <div className="flex items-center gap-2 text-sm">
              <Switch checked={doRendered} onCheckedChange={setDoRendered} />
              <span>Render with Playwright first (fallback to static)</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tip: render is best for JS-heavy sites. Static is faster for simple pages.
            </p>
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
              {loading ? "Analyzing…" : "Analyze"}
            </Button>
          </div>
        </form>
      </Card>

      {loading && <Loader />}

      {error && (
        <Card className="p-4 border-red-300/40 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200">
          <div className="font-medium">Error</div>
          <div className="text-sm mt-1">{error}</div>
        </Card>
      )}

      {data && <Results data={data} />}
    </div>
  );
}
