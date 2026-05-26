'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

type AcceptState = 'loading' | 'success' | 'auth' | 'error';

async function readJsonResponse(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return {};
  }

  return response.json().catch(() => ({}));
}

export default function AcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState<AcceptState>(token ? 'loading' : 'error');
  const [errorMessage, setErrorMessage] = useState(token ? '' : 'No invite token provided. Please check your invite link.');
  const invitePath = useMemo(
    () => (token ? `/invite/accept?token=${encodeURIComponent(token)}` : '/dashboard'),
    [token],
  );
  const authRedirect = encodeURIComponent(invitePath);

  useEffect(() => {
    if (!token) return;

    const acceptInvite = async () => {
      try {
        const response = await fetch('/api/invites/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const payload = await readJsonResponse(response) as { error?: string };

        if (response.status === 401) {
          setState('auth');
          return;
        }

        if (!response.ok) {
          setState('error');
          setErrorMessage(payload.error ?? 'Failed to accept invite.');
          return;
        }

        setState('success');

        setTimeout(() => {
          router.push('/dashboard');
        }, 1800);
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

        {state === 'auth' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <span className="material-symbols-outlined text-4xl text-primary">person_add</span>
            </div>
            <h1 className="mt-8 font-headline text-2xl font-bold tracking-tight text-on-surface">
              Sign in to accept
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
              Use the same email address that received this invite. After signing in, you will come back here automatically.
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <Link
                href={`/login?redirectTo=${authRedirect}`}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-on-surface px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
              >
                Log in
              </Link>
              <Link
                href={`/login?view=signup&redirectTo=${authRedirect}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                Create an account
              </Link>
            </div>
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
              Go to Dashboard
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
                href={`/login?redirectTo=${authRedirect}`}
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
