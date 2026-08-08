'use client';

import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { AlertCircle, Layers, Loader2, RefreshCw, Search, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalysisReport, AnalysisSkeleton, type AgentAnalysis } from '@/components/analysis-report';

type ModeId = 'research' | 'analysis';

const MODES = [
  {
    id: 'research' as const,
    label: 'Research',
    icon: Search,
    hint: 'Streams a grounded answer from indexed filings, news and your uploads.',
    placeholder: 'Ask about a company, a filing, or a market trend...',
    examples: ['Main risks in the latest Apple 10-K', 'How is NVDA revenue trending?'],
  },
  {
    id: 'analysis' as const,
    label: 'Deep analysis',
    icon: Layers,
    hint: 'Runs fundamentals, momentum and sentiment in parallel, then merges them into one call. Takes up to a minute.',
    placeholder: 'Company name or ticker (e.g. Apple, AAPL)',
    examples: ['AAPL', 'MSFT', 'NVDA'],
  },
];

export function StreamingChat() {
  const [mode, setMode] = useState<ModeId>('research');
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [agentResponse, setAgentResponse] = useState<AgentAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const activeMode = MODES.find((m) => m.id === mode)!;

  useEffect(() => {
    if (!isLoading) return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [isLoading]);

  const handleLLMStream = async () => {
    const res = await fetch('/api/llm/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // sem `model`: o backend usa LLM_MODEL, senao o modelo fica preso a
        // um id que a Groq pode descomissionar (foi o caso do llama3-8b-8192)
        query,
        temperature: 0.0,
        max_output_tokens: 4096,
        limit: 5,
        filters: {},
      }),
    });

    if (!res.ok) {
      throw new Error(`Request failed (${res.status}): ${await res.text()}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('Streaming is not supported by this response');

    const decoder = new TextDecoder();
    let buffer = '';

    const consume = (line: string) => {
      if (!line.startsWith('data: ')) return;
      const payload = line.slice(6);
      if (payload === '[DONE]') return;

      let parsed: { type?: string; delta?: string; message?: string };
      try {
        parsed = JSON.parse(payload);
      } catch {
        return; // partial or non-JSON keepalive frame
      }

      // Errors must surface, not get swallowed by the JSON try/catch.
      if (parsed.type === 'error') throw new Error(parsed.message ?? 'Stream error');
      if (parsed.type === 'text_delta') setResponse((prev) => prev + (parsed.delta ?? ''));
    };

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) if (line.trim()) consume(line);
    }
    if (buffer.trim()) consume(buffer);
  };

  const handleAgentAnalysis = async () => {
    const res = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: query }),
    });

    if (!res.ok) {
      throw new Error(`Request failed (${res.status}): ${await res.text()}`);
    }

    setAgentResponse((await res.json()) as AgentAnalysis);
  };

  const run = async () => {
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    setResponse('');
    setAgentResponse(null);
    setError(null);

    try {
      await (mode === 'analysis' ? handleAgentAnalysis() : handleLLMStream());
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setResponse('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void run();
  };

  const switchMode = (next: ModeId) => {
    setMode(next);
    setResponse('');
    setAgentResponse(null);
    setError(null);
  };

  const isIdle = !isLoading && !error && !response && !agentResponse;

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit}>
        <div
          role="radiogroup"
          aria-label="Analysis mode"
          className="inline-flex rounded-lg border border-border bg-surface p-1"
        >
          {MODES.map((m) => {
            const selected = m.id === mode;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => switchMode(m.id)}
                disabled={isLoading}
                className={cn(
                  'inline-flex h-10 items-center gap-2 rounded-md px-3.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  selected
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <m.icon className="h-4 w-4" />
                {m.label}
              </button>
            );
          })}
        </div>

        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {activeMode.hint}
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="query" className="sr-only">
            {activeMode.placeholder}
          </label>
          <input
            id="query"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={activeMode.placeholder}
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
                {mode === 'analysis' ? 'Analyze' : 'Search'}
                <Send className="h-4 w-4" />
              </>
            )}
          </button>
        </div>

        {isIdle && !query && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Try</span>
            {activeMode.examples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setQuery(example)}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
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
        ) : mode === 'analysis' ? (
          agentResponse ? (
            <AnalysisReport data={agentResponse} />
          ) : isLoading ? (
            <AnalysisSkeleton elapsed={elapsed} />
          ) : (
            <EmptyState mode={mode} />
          )
        ) : response || isLoading ? (
          <article className="animate-enter rounded-xl border border-border bg-surface p-5 sm:p-6">
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{response}</ReactMarkdown>
            </div>
            {isLoading && (
              <span className="inline-block h-4 w-[2px] translate-y-0.5 animate-blink bg-primary" />
            )}
          </article>
        ) : (
          <EmptyState mode={mode} />
        )}
      </div>
    </div>
  );
}

function EmptyState({ mode }: { mode: ModeId }) {
  const Icon = mode === 'analysis' ? Layers : Search;
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-4 text-sm font-medium text-foreground">
        {mode === 'analysis' ? 'No ticker analyzed yet' : 'No question asked yet'}
      </p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        {mode === 'analysis'
          ? 'Results appear here as a recommendation, three stream scores, and the risks behind them.'
          : 'The answer streams in here, grounded in the documents indexed for this workspace.'}
      </p>
    </div>
  );
}
