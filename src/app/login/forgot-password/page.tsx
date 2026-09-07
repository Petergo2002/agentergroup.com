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
    <main className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-[#050505] font-body text-[#f5f1eb]">

      {/* Left Column: Symmetrical, Pristine Minimalist Typographic Branding */}
      <section className="relative hidden lg:flex bg-[#050505] text-[#f5f1eb] p-16 xl:p-24 flex-col justify-between overflow-hidden border-r border-[#161616] h-full">
        <div className="relative z-10 flex items-center justify-between">
          <Link
            href="/"
            title="Agentergroup Home"
            aria-label="Back to landing page"
            className="group inline-flex items-center transition-all duration-200 hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5c00] rounded-xl"
          >
            <Image
              src="/dashboardlogo.svg"
              alt="Agentergroup"
              width={840}
              height={279}
              priority
              className="h-20 lg:h-24 xl:h-28 w-auto object-contain object-left max-w-full transition-transform duration-200 group-hover:scale-[1.02]"
            />
          </Link>
        </div>

        {/* Super Simple Pure Typographic Headline Block with vast negative space */}
        <div className="relative z-10 my-auto w-full space-y-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#ff5c00]">
            ACCOUNT RECOVERY
          </p>
          <p className="text-4xl xl:text-5xl font-headline font-extrabold text-white tracking-tight leading-tight max-w-lg">
            Reset your password
          </p>
          <p className="text-base text-[#9d948a] font-medium leading-relaxed max-w-md">
            Enter your email and we&apos;ll send you a secure link to set a new password.
          </p>
        </div>

        {/* Clean minimal version pill at bottom left */}
        <div className="relative z-10 flex">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#9d948a]/40">
            Platform Release v2.4.0
          </span>
        </div>
      </section>

      {/* Right Column: Unified Symmetrical, Super Clean, Elegant Credentials Form */}
      <section className="w-full flex flex-col justify-between p-8 lg:p-16 xl:p-24 bg-[#050505] border-t lg:border-t-0 border-[#161616] animate-in fade-in duration-500 min-h-screen lg:min-h-0">

        {/* Mobile Header Banner - Uses clean natural logo matching unified dark theme */}
        <div className="flex lg:hidden items-center justify-between mb-12">
          <Link
            href="/"
            title="Agentergroup Home"
            aria-label="Back to landing page"
            className="group inline-flex items-center transition-all duration-200 hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5c00] rounded-xl"
          >
            <Image
              src="/dashboardlogo.svg"
              alt="Agentergroup"
              width={840}
              height={279}
              priority
              className="h-12 w-auto object-contain object-left transition-transform duration-200 group-hover:scale-[1.02]"
            />
          </Link>
          <div className="rounded-[2px] bg-[#111] border border-[#222] px-3 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-[#9d948a]/80">
            v2.4.0
          </div>
        </div>

        {/* Credentials Form Container (Centered Symmetrically) */}
        <div className="my-auto w-full max-w-sm mx-auto space-y-8 animate-slide-up-fade">

          {/* Headline block */}
          <div className="space-y-2 text-center lg:text-left">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#ff5c00]">
              ACCOUNT RECOVERY
            </p>
            <h1 className="font-headline text-3xl font-extrabold tracking-tight text-white">
              Forgot password?
            </h1>
            <p className="text-xs font-semibold text-[#9d948a]/80">
              No worries — we&apos;ll email you a reset link.
            </p>
          </div>

          {sent ? (
            /* Success state */
            <div className="space-y-6">
              <div
                role="status"
                aria-live="polite"
                className="rounded-[2px] border border-[#ff5c00]/20 bg-[#ff5c00]/5 px-5 py-5 text-sm text-[#f5f1eb]"
              >
                <p className="font-bold text-[#ff5c00] mb-1">Check your inbox ✓</p>
                <p className="text-[#9d948a] leading-relaxed">
                  We sent a reset link to <strong>{email}</strong>. It may take a minute to arrive.
                </p>
              </div>
              <Link
                href="/login"
                className="block text-center text-xs font-bold text-[#ff5c00] uppercase tracking-widest hover:underline"
              >
                ← Back to login
              </Link>
            </div>
          ) : (
            /* Form state */
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div
                  role="alert"
                  className="rounded-[2px] border border-error/20 bg-error-container/10 px-4 py-3 text-xs text-error font-semibold animate-shake"
                >
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="recovery-email" className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9d948a]/75">
                  Email address
                </label>
                <input
                  id="recovery-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  className="w-full rounded-[2px] border border-[#1f1f1f] bg-[#0d0d0d] px-4 py-3 text-sm text-white outline-none transition-all focus:border-[#ff5c00]/60 focus:ring-1 focus:ring-[#ff5c00]/10 placeholder:text-[#9d948a]/30 font-medium"
                />
              </div>

              <div className="space-y-4 pt-2">
                <button
                  type="submit"
                  disabled={isSending}
                  className="w-full flex h-11 items-center justify-center rounded-[2px] bg-[#ff5c00] hover:bg-[#e05100] text-white text-[11px] font-bold uppercase tracking-widest active:scale-[0.98] transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSending ? 'Sending…' : 'Send Reset Link'}
                </button>
                <p className="text-center text-xs text-[#9d948a] font-medium">
                  Remember your password?{' '}
                  <Link href="/login" className="text-[#ff5c00] font-bold hover:underline">
                    Sign in
                  </Link>
                </p>
              </div>
            </form>
          )}
        </div>

        {/* Footer info panel */}
        <div className="mt-8 pt-6 border-t border-[#161616] flex flex-col sm:flex-row items-center justify-between text-[10px] text-[#9d948a]/30 font-medium gap-2 text-center sm:text-left">
          <span>&copy; 2026 Agentergroup AB. All rights reserved.</span>
          <div className="flex gap-4">
            <span className="hover:text-white transition-colors cursor-pointer">Status</span>
            <span className="hover:text-white transition-colors cursor-pointer">Contact</span>
          </div>
        </div>
      </section>
    </main>
  );
}
