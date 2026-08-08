'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, Layers, Loader2, RefreshCw, Send } from 'lucide-react';
import { AnalysisReport, AnalysisSkeleton, type AgentAnalysis } from '@/components/analysis-report';

const EXAMPLES = ['AAPL', 'MSFT', 'NVDA'];

export function TickerAnalysis() {
  const [query, setQuery] = useState('');
  const [report, setReport] = useState<AgentAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isLoading) return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [isLoading]);

  const run = async () => {
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    setReport(null);
    setError(null);

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query }),
      });

      if (!res.ok) {
        throw new Error(`Request failed (${res.status}): ${await res.text()}`);
      }

      setReport((await res.json()) as AgentAnalysis);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const isIdle = !isLoading && !error && !report;

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <label htmlFor="ticker" className="block text-sm font-medium text-foreground">
          Ticker or company
        </label>

        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="ticker"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. AAPL, or Apple"
            disabled={isLoading}
            autoComplete="off"
            className="h-12 flex-1 rounded-lg border border-border bg-surface px-4 text-base text-foreground placeholder:text-muted-foreground/70 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running
              </>
            ) : (
              <>
                Analyze
                <Send className="h-4 w-4" />
              </>
            )}
          </button>
        </div>

        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Fundamentals, momentum and sentiment run in parallel, then merge into a single call. Takes
          up to a minute.
        </p>

        {isIdle && !query && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Try</span>
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setQuery(example)}
                className="rounded-full border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {example}
              </button>
            ))}
          </div>
        )}
      </form>

      <div className="mt-8">
        {error ? (
          <div className="animate-enter rounded-xl border border-negative/30 bg-negative/5 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-negative">
              <AlertCircle className="h-4 w-4" />
              Request failed
            </p>
            <p className="mt-2 break-words text-sm text-foreground/90">{error}</p>
            <button
              type="button"
              onClick={() => void run()}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        ) : report ? (
          <AnalysisReport data={report} />
        ) : isLoading ? (
          <AnalysisSkeleton elapsed={elapsed} />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground">
        <Layers className="h-5 w-5" />
      </span>
      <p className="mt-4 text-sm font-medium text-foreground">No ticker analyzed yet</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Results appear here as a recommendation, three stream scores, and the risks behind them.
      </p>
    </div>
  );
}
