'use client';

import { useState } from 'react';
import { LineChart, Upload } from 'lucide-react';
import { Container } from '@/components/container';
import { StreamingChat } from '@/components/streaming-chat';
import { UploadModal } from '@/components/upload-modal';

export default function Home() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <Container className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
              <LineChart className="h-4 w-4" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-foreground">
              gpt-finance
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-border px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Add document</span>
            <span className="sr-only sm:hidden">Add document</span>
          </button>
        </Container>
      </header>

      <main id="main" className="flex-1 py-10 sm:py-14">
        <Container>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Equity research, on demand
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Answers grounded in filings and news, or a full three-stream analysis of any ticker.
          </p>

          <div className="mt-8">
            <StreamingChat />
          </div>
        </Container>
      </main>

      <footer className="border-t border-border py-6">
        <Container className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} gpt-finance</p>
          <p>Generated analysis — not investment advice.</p>
        </Container>
      </footer>

      <UploadModal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} />
    </div>
  );
}
