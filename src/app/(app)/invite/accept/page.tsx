'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

type AcceptState = 'loading' | 'success' | 'error';

export default function AcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState<AcceptState>(token ? 'loading' : 'error');
  const [errorMessage, setErrorMessage] = useState(token ? '' : 'No invite token provided. Please check your invite link.');

  useEffect(() => {
    if (!token) return;

    const acceptInvite = async () => {
      try {
        const response = await fetch('/api/invites/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const payload = await response.json();

        if (!response.ok) {
          setState('error');
          setErrorMessage(payload.error ?? 'Failed to accept invite.');
          return;
        }

        setState('success');

        // Redirect to dashboard after a short delay
        setTimeout(() => {
          router.push('/dashboard');
        }, 2500);
      } catch {
        setState('error');
        setErrorMessage('Something went wrong. Please try again.');
      }
    };

    acceptInvite();
  }, [token, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-[2rem] border border-outline-variant/20 bg-surface-container-lowest p-10 shadow-[0_24px_60px_rgba(15,23,42,0.08)] text-center">
        {state === 'loading' && (
          <>
            <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-outline-variant/20 border-t-primary" />
            <h1 className="mt-8 font-headline text-2xl font-bold tracking-tight text-on-surface">
              Accepting invite...
            </h1>
            <p className="mt-3 text-sm text-on-surface-variant">
              Setting up your workspace access.
            </p>
          </>
        )}

        {state === 'success' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
              <span className="material-symbols-outlined text-4xl text-green-500">check_circle</span>
            </div>
            <h1 className="mt-8 font-headline text-2xl font-bold tracking-tight text-on-surface">
              You&apos;re in!
            </h1>
            <p className="mt-3 text-sm text-on-surface-variant">
              You now have access to the workspace. Redirecting to your dashboard...
            </p>
            <Link
              href="/dashboard"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-on-surface px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
            >
              Go to Dashboard →
            </Link>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-error/10">
              <span className="material-symbols-outlined text-4xl text-error">error</span>
            </div>
            <h1 className="mt-8 font-headline text-2xl font-bold tracking-tight text-on-surface">
              Invite Error
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
              {errorMessage}
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-on-surface px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
              >
                Go to Dashboard
              </Link>
              <Link
                href="/auth/login"
                className="text-sm font-medium text-primary hover:underline"
              >
                Sign in with a different account
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
