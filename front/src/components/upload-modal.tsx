'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MAX_BYTES = 100 * 1024 * 1024;

export function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // <dialog> gives us Esc, focus trapping and the top layer for free.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
    if (isOpen) {
      setFile(null);
      setError(null);
      setProgress(0);
    }
  }, [isOpen]);

  const validateAndSetFile = (candidate: File | null) => {
    setError(null);
    if (!candidate) return;
    if (candidate.type !== 'application/pdf') {
      setError('Only PDF files are accepted.');
      return;
    }
    if (candidate.size > MAX_BYTES) {
      setError('File must be smaller than 100 MB.');
      return;
    }
    setFile(candidate);
  };

  // XHR instead of fetch: it is the only way to get real upload progress.
  const sendFile = (payload: File) =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const form = new FormData();
      form.append('file', payload);

      xhr.open('POST', '/api/upload');
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`));
      xhr.onerror = () => reject(new Error('Network error during upload.'));
      xhr.send(form);
    });

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    setProgress(0);

    try {
      await sendFile(file);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
      setProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current && !isUploading) onClose();
      }}
      className="w-[calc(100%-2rem)] max-w-lg rounded-xl border border-border bg-surface p-0 text-foreground backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      aria-labelledby="upload-title"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="upload-title" className="text-lg font-semibold tracking-tight">
              Add a document
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              PDFs are indexed and become searchable in Research mode.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            aria-label="Close"
            className="-mr-2 -mt-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-lg border border-negative/30 bg-negative/5 p-3 text-sm text-negative"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="break-words">{error}</span>
          </p>
        )}

        <label
          htmlFor="file-upload"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            validateAndSetFile(e.dataTransfer.files[0] ?? null);
          }}
          className={cn(
            'mt-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : file
                ? 'border-primary/40 bg-primary/5'
                : 'border-border bg-muted/40 hover:border-primary/40'
          )}
        >
          <input
            id="file-upload"
            type="file"
            accept="application/pdf"
            onChange={(e) => validateAndSetFile(e.target.files?.[0] ?? null)}
            disabled={isUploading}
            className="sr-only"
          />

          {file ? (
            <>
              <FileText className="h-8 w-8 text-primary" />
              <p className="mt-3 break-all text-sm font-medium text-foreground">{file.name}</p>
              <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
                {(file.size / (1024 * 1024)).toFixed(1)} MB
              </p>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium text-foreground">
                Drop a PDF here, or click to browse
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Up to 100 MB</p>
            </>
          )}
        </label>

        {isUploading && (
          <div className="mt-4">
            <div
              role="progressbar"
              aria-label="Upload progress"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              {progress < 100 ? (
                <>
                  <span className="font-mono tabular-nums">{progress}%</span> uploading
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  Uploaded — indexing on the server
                </>
              )}
            </p>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="inline-flex h-11 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
