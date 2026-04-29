'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setError('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col lg:flex-row bg-background overflow-hidden font-body">
      {/* Left Column: Branding */}
      <section className="relative flex-1 border-b border-outline-variant/10 bg-background p-12 lg:min-h-screen lg:border-b-0 lg:border-r lg:border-outline-variant/10 lg:p-20 flex flex-col justify-between overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary rounded-full blur-[120px] opacity-18" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary-container rounded-full blur-[100px] opacity-12" />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: 'radial-gradient(circle at 2px 2px, var(--color-on-surface-variant) 1px, transparent 0)',
              backgroundSize: '32px 32px',
              opacity: 0.05,
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col gap-12 max-w-xl">
          <div className="flex items-center">
            <Image
              src="/dashboardlogo.svg"
              alt="Agentergroup"
              width={220}
              height={73}
              priority
              className="h-[72px] w-auto object-contain object-left"
            />
          </div>

          <div className="space-y-6">
            <h1 className="text-5xl lg:text-6xl font-headline font-bold text-on-surface leading-[1.1] tracking-tight">
              Reset your password
            </h1>
            <p className="text-lg text-on-surface-variant leading-relaxed font-medium">
              Enter your email and we&apos;ll send you a secure link to set a new password.
            </p>
          </div>
        </div>

        <div className="relative z-10 flex gap-8 mt-12 lg:mt-0">
          <div className="flex flex-col gap-1">
            <span className="text-on-surface font-bold text-xl font-headline">Secure</span>
            <span className="text-on-surface-variant text-xs font-semibold uppercase tracking-widest">Reset flow</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-on-surface font-bold text-xl font-headline">Fast</span>
            <span className="text-on-surface-variant text-xs font-semibold uppercase tracking-widest">Delivery</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-on-surface font-bold text-xl font-headline">Safe</span>
            <span className="text-on-surface-variant text-xs font-semibold uppercase tracking-widest">Encrypted</span>
          </div>
        </div>
      </section>

      {/* Right Column: Form */}
      <section className="w-full lg:w-[450px] xl:w-[500px] flex items-center justify-center p-8 lg:p-16 bg-surface-container-lowest">
        <div className="w-full max-w-sm space-y-10">
          <div className="space-y-3 text-center lg:text-left">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
              Account Recovery
            </p>
            <h2 className="font-headline text-3xl font-bold tracking-tight text-on-background">
              Forgot password?
            </h2>
            <p className="text-sm text-on-surface-variant font-medium">
              No worries — we&apos;ll email you a reset link.
            </p>
          </div>

          {sent ? (
            /* Success state */
            <div className="space-y-6">
              <div className="rounded-2xl border border-primary/20 bg-primary/8 px-5 py-5 text-sm text-on-surface">
                <p className="font-semibold text-primary mb-1">Check your inbox ✓</p>
                <p className="text-on-surface-variant leading-relaxed">
                  We sent a reset link to <strong>{email}</strong>. It may take a minute to arrive.
                </p>
              </div>
              <Link
                href="/login"
                className="block text-center text-sm font-medium text-primary hover:underline"
              >
                ← Back to login
              </Link>
            </div>
          ) : (
            /* Form state */
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="rounded-2xl border border-error/20 bg-error-container px-4 py-3 text-sm text-error font-medium">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full rounded-2xl border border-outline-variant/15 bg-surface-container-low px-5 py-4 text-sm text-on-surface outline-none transition-all focus:border-primary/40 focus:ring-4 focus:ring-primary/10 placeholder:text-on-surface-variant/40"
                />
              </div>

              <div className="space-y-4 pt-2">
                <button
                  type="submit"
                  disabled={isSending}
                  className="w-full signature-gradient rounded-2xl px-5 py-4 text-sm font-bold shadow-premium transition-all hover:border-primary/25 hover:bg-primary/8 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSending ? 'Sending…' : 'Send Reset Link'}
                </button>
                <p className="text-center text-sm text-on-surface-variant font-medium">
                  Remember your password?{' '}
                  <Link href="/login" className="text-primary hover:underline">
                    Sign in
                  </Link>
                </p>
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
