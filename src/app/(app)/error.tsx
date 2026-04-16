'use client';

import { useEffect } from 'react';

export default function ErrorState({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Optionally log the error to an error reporting service
    console.error('App Route Error:', error);
  }, [error]);

  return (
    <div className="flex h-full w-full flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="flex max-w-md flex-col items-center gap-6 rounded-3xl bg-surface-container p-8 shadow-sm ring-1 ring-outline-variant/20">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error-container text-on-error-container">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-on-surface">Something went wrong</h2>
          <p className="text-sm text-on-surface-variant">
            {error.message || "An unexpected error occurred while loading this page. Please try again."}
          </p>
        </div>
        <button
          onClick={() => reset()}
          className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-on-primary shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all active:scale-95"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
