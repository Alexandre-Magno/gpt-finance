'use client';

import React from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  FileText,
  Loader2,
  Minus,
  Newspaper,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AgentAnalysis {
  ticker: string;
  execution_time: number;
  fundamental_analysis: {
    overall_investment_thesis: string;
    investment_grade: string; // A | B | C | D
    confidence_score: number; // 0-1
    key_strengths: string[];
    key_concerns: string[];
    recommendation: string; // buy | hold | sell | avoid
  };
  momentum_analysis: {
    overall_momentum: string; // positive | neutral | negative
    momentum_strength: string; // strong | moderate | weak
    key_momentum_drivers: string[];
    momentum_risks: string[];
    short_term_outlook: string; // bullish | neutral | bearish
    momentum_score: number; // 0-10
  };
  market_sentiment: {
    sentiment_score: number; // 1-10
    sentiment_direction: string; // Positive | Neutral | Negative
    key_news_themes: string[];
    recent_catalysts: string[];
    market_outlook: string;
  };
  final_recommendation: {
    action: string; // BUY | HOLD | SELL
    confidence: number; // 0-1
    rationale: string;
    key_risks: string[];
    key_opportunities: string[];
    time_horizon: string;
  };
}

type Tone = 'positive' | 'negative' | 'neutral';

const POSITIVE = /^(buy|strong buy|positive|bullish|strong|outperform|a)$/i;
const NEGATIVE = /^(sell|avoid|negative|bearish|weak|underperform|d)$/i;

function toneOf(value: string | undefined): Tone {
  const v = value?.trim() ?? '';
  if (POSITIVE.test(v)) return 'positive';
  if (NEGATIVE.test(v)) return 'negative';
  return 'neutral';
}

const TONE_TEXT: Record<Tone, string> = {
  positive: 'text-positive',
  negative: 'text-negative',
  neutral: 'text-warning',
};

const TONE_CHIP: Record<Tone, string> = {
  positive: 'bg-positive/10 text-positive ring-positive/25',
  negative: 'bg-negative/10 text-negative ring-negative/25',
  neutral: 'bg-warning/10 text-warning ring-warning/25',
};

const TONE_BAR: Record<Tone | 'brand', string> = {
  positive: 'bg-positive',
  negative: 'bg-negative',
  neutral: 'bg-warning',
  brand: 'bg-primary',
};

const TONE_ICON: Record<Tone, React.ComponentType<{ className?: string }>> = {
  positive: ArrowUpRight,
  negative: ArrowDownRight,
  neutral: Minus,
};

/** Value + icon, so meaning never rides on colour alone. */
function Badge({ value }: { value?: string }) {
  if (!value) return null;
  const tone = toneOf(value);
  const Icon = TONE_ICON[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset',
        TONE_CHIP[tone]
      )}
    >
      <Icon className="h-3 w-3" />
      {value}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Meter({
  label,
  value,
  max,
  unit,
  tone = 'brand',
}: {
  label: string;
  value: number;
  max: number;
  unit?: string;
  tone?: Tone | 'brand';
}) {
  const safe = Number.isFinite(value) ? value : 0;
  const pct = Math.min(100, Math.max(0, (safe / max) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="font-mono text-sm tabular-nums text-foreground">
          {unit ? `${Math.round(safe)}${unit}` : safe.toFixed(1)}
          {!unit && <span className="text-muted-foreground">/{max}</span>}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(safe)}
        aria-valuemin={0}
        aria-valuemax={max}
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-300', TONE_BAR[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function PointList({
  label,
  items,
  tone,
}: {
  label?: string;
  items?: string[];
  tone: Tone;
}) {
  if (!items?.length) return null;
  return (
    <div>
      {label && (
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      )}
      <ul className={cn('space-y-1.5', label && 'mt-2')}>
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm leading-snug text-foreground/90">
            <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', TONE_BAR[tone])} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StreamCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
      </h3>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function AnalysisReport({ data }: { data: AgentAnalysis }) {
  const { fundamental_analysis: fa, momentum_analysis: ma, market_sentiment: ms } = data;
  const final = data.final_recommendation;
  const verdict = toneOf(final.action);
  const VerdictIcon = TONE_ICON[verdict];

  return (
    <div className="animate-enter space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-mono text-xl font-semibold tracking-tight text-foreground">
          {data.ticker}
        </h2>
        <p className="font-mono text-xs tabular-nums text-muted-foreground">
          3 streams · {data.execution_time.toFixed(1)}s
        </p>
      </header>

      <section className={cn('rounded-xl border border-border bg-surface p-5 sm:p-6')}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'grid h-11 w-11 place-items-center rounded-lg ring-1 ring-inset',
                TONE_CHIP[verdict]
              )}
            >
              <VerdictIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Recommendation
              </p>
              <p className={cn('font-mono text-2xl font-semibold leading-tight', TONE_TEXT[verdict])}>
                {final.action}
              </p>
            </div>
          </div>
          <div className="w-full max-w-[220px]">
            <Meter label="Confidence" value={final.confidence * 100} max={100} unit="%" />
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-foreground/90">{final.rationale}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          Time horizon · <span className="text-foreground">{final.time_horizon}</span>
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <StreamCard title="Fundamentals" icon={FileText}>
          <Field label="Grade">
            <span className={cn('font-mono text-lg font-semibold', TONE_TEXT[toneOf(fa.investment_grade)])}>
              {fa.investment_grade}
            </span>
          </Field>
          <Field label="Call">
            <Badge value={fa.recommendation} />
          </Field>
          <Meter label="Confidence" value={fa.confidence_score * 100} max={100} unit="%" />
          <p className="text-sm leading-snug text-foreground/90">{fa.overall_investment_thesis}</p>
          <PointList label="Strengths" items={fa.key_strengths} tone="positive" />
          <PointList label="Concerns" items={fa.key_concerns} tone="negative" />
        </StreamCard>

        <StreamCard title="Momentum" icon={Activity}>
          <Meter
            label="Momentum score"
            value={ma.momentum_score}
            max={10}
            tone={toneOf(ma.overall_momentum)}
          />
          <Field label="Direction">
            <Badge value={ma.overall_momentum} />
          </Field>
          <Field label="Strength">
            <Badge value={ma.momentum_strength} />
          </Field>
          <Field label="Short term">
            <Badge value={ma.short_term_outlook} />
          </Field>
          <PointList label="Drivers" items={ma.key_momentum_drivers} tone="positive" />
          <PointList label="Risks" items={ma.momentum_risks} tone="negative" />
        </StreamCard>

        <StreamCard title="Sentiment" icon={Newspaper}>
          <Meter
            label="Sentiment score"
            value={ms.sentiment_score}
            max={10}
            tone={toneOf(ms.sentiment_direction)}
          />
          <Field label="Direction">
            <Badge value={ms.sentiment_direction} />
          </Field>
          <p className="text-sm leading-snug text-foreground/90">{ms.market_outlook}</p>
          {!!ms.key_news_themes?.length && (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                News themes
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ms.key_news_themes.map((theme, i) => (
                  <span
                    key={i}
                    className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          )}
          <PointList label="Catalysts" items={ms.recent_catalysts} tone="neutral" />
        </StreamCard>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 text-negative" />
            Key risks
          </h3>
          <PointList items={final.key_risks} tone="negative" />
        </section>
        <section className="rounded-xl border border-border bg-surface p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Target className="h-4 w-4 text-positive" />
            Key opportunities
          </h3>
          <PointList items={final.key_opportunities} tone="positive" />
        </section>
      </div>
    </div>
  );
}

const SKELETON_STREAMS = ['Fundamentals', 'Momentum', 'Sentiment'];

/** Agent runs take ~30-60s; show the shape of the answer plus elapsed time. */
export function AnalysisSkeleton({ elapsed }: { elapsed: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface px-5 py-4">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Running three analysis streams...
        </p>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{elapsed}s</span>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {SKELETON_STREAMS.map((name) => (
          <section key={name} className="rounded-xl border border-border bg-surface p-5">
            <h3 className="text-sm font-semibold text-muted-foreground">{name}</h3>
            <div className="mt-4 animate-pulse space-y-3">
              <div className="h-1.5 w-full rounded-full bg-muted" />
              <div className="h-3 w-3/4 rounded bg-muted" />
              <div className="h-3 w-full rounded bg-muted" />
              <div className="h-3 w-5/6 rounded bg-muted" />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
