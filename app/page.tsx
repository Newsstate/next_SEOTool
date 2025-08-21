"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { Results } from "@/components/Results";
import { Loader } from "@/components/Loader";
import { ProgressBar } from "@/components/Progress";

type StageKey = "fetch" | "parse" | "links" | "robots" | "pagespeed" | "rendered";

export default function Page() {
  const [url, setUrl] = useState("");
  const [doRendered, setDoRendered] = useState(true);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [stages, setStages] = useState<Partial<Record<StageKey, "idle" | "start" | "done" | "error" | "skipped">>>({});
  const evtRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      evtRef.current?.close();
    };
  }, []);

  function resetStages() {
    setStages({ fetch: "idle", parse: "idle", links: "idle", robots: "idle", pagespeed: "idle", rendered: "idle" });
  }

  async function onAnalyze(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setData(null);
    resetStages();

    // Use SSE stream to get live progress
    const qs = new URLSearchParams({ url, do_rendered_check: String(doRendered) });
    const es = new EventSource(`/api/analyze/stream?${qs.toString()}`);
    evtRef.current = es;

    es.addEventListener("stage", (ev: MessageEvent) => {
      try {
        const payload = JSON.parse(ev.data);
        const k = payload.stage as StageKey;
        setStages((prev) => ({ ...prev, [k]: payload.status }));
      } catch {}
    });

    es.addEventListener("done", (ev: MessageEvent) => {
      try {
        const payload = JSON.parse(ev.data);
        setData(payload.result);
      } catch (e: any) {
        setError(String(e?.message || e));
      } finally {
        setLoading(false);
        es.close();
      }
    });

    es.addEventListener("error", (ev: MessageEvent) => {
      try {
        const payload = JSON.parse(ev.data);
        setError(payload.error || "Scan failed");
      } catch {
        setError("Scan failed");
      } finally {
        setLoading(false);
        es.close();
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Analyze form */}
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
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
              {loading ? "Analyzing…" : "Analyze"}
            </Button>
          </div>
        </form>
      </Card>

      {/* Progress bar (always visible during scans) */}
      {(loading || Object.values(stages).some((s) => s && s !== "idle")) && (
        <ProgressBar stages={stages} showRendered={doRendered} />
      )}

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
