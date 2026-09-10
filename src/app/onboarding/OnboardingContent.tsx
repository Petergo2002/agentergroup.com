"use client";

import { useActionState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { MiloLogo } from "@/components/brand/MiloLogo";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock3,
  Lock,
  LogOut,
  RefreshCw,
  Save,
  ShieldCheck,
} from "lucide-react";
import { updateOnboardingDetails } from "./actions";

interface OnboardingContentProps {
  workspaceName: string;
  userName: string;
  userEmail: string;
  hasAcceptedTerms: boolean;
}

export default function OnboardingContent({
  workspaceName,
  userName,
  userEmail,
  hasAcceptedTerms,
}: OnboardingContentProps) {
  const router = useRouter();
  const [isChecking, startChecking] = useTransition();
  const [state, formAction, isPending] = useActionState(
    updateOnboardingDetails,
    null,
  );

  // Poll for activation status every 8 seconds
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      router.refresh();
    }, 8_000);

    return () => window.clearInterval(intervalId);
  }, [router]);

  const checkActivation = () => {
    startChecking(() => {
      router.refresh();
    });
  };

  return (
    <main className="min-h-screen w-full flex flex-col lg:flex-row bg-white font-body selection:bg-[#ff5c00]/20 selection:text-[#ff5c00]">
      {/* ─── Left Column: Modern Verification Center & Profile Setup ─── */}
      <section className="w-full lg:w-1/2 flex flex-col justify-between min-h-screen bg-white text-slate-900 px-6 py-8 sm:px-12 sm:py-10 lg:px-14 xl:px-20 relative z-10">
        {/* Top Header / Navigation */}
        <header className="flex items-center justify-between w-full mb-6 sm:mb-8">
          <Link
            href="/"
            title="Avenro Home"
            aria-label="Back to landing page"
            className="group inline-flex items-center gap-2 rounded-xl py-1 text-slate-900 transition-all duration-200 hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5c00]"
          >
            <BrandLogo className="h-8 w-auto text-slate-900 transition-transform duration-200 group-hover:scale-105" />
          </Link>

          <form action="/auth/logout" method="post">
            <button
              type="submit"
              className="group inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 px-3.5 py-2 rounded-xl border border-slate-200/90 hover:border-slate-300 hover:bg-slate-50 transition-all duration-200 active:scale-95 shadow-xs cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5 text-slate-400 group-hover:text-slate-800" />
              <span>Sign out</span>
            </button>
          </form>
        </header>

        {/* Main Content Area */}
        <div className="w-full max-w-lg mx-auto my-auto space-y-6 sm:space-y-7">
          {/* Verification Status Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-700">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            <span>Approval pending • Workspace verification in progress</span>
          </div>

          {/* Heading & Intro */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              {userName ? `Welcome, ${userName}` : "Welcome to Avenro"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              Your account is ready. While our team assigns your plan and usage
              credits, you can verify your profile and business details below.
            </p>
          </div>

          {/* Action Alerts */}
          {state?.error ? (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/90 p-4 text-xs sm:text-sm text-red-700 font-medium animate-shake shadow-xs"
            >
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-red-500 mt-0.5" />
              <div className="leading-snug">{state.error}</div>
            </div>
          ) : null}

          {state?.notice ? (
            <div
              role="status"
              className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/90 p-4 text-xs sm:text-sm text-emerald-700 font-medium shadow-xs"
            >
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-emerald-500 mt-0.5" />
              <div className="leading-snug">{state.notice}</div>
            </div>
          ) : null}

          {/* Interactive Profile & Company Setup Form */}
          <form
            action={formAction}
            className="space-y-4 rounded-2xl border border-slate-200/90 bg-slate-50/60 p-5 sm:p-6 shadow-xs"
          >
            <div className="border-b border-slate-200/70 pb-3 mb-2">
              <h2 className="text-sm font-bold text-slate-900">
                Your Details & Workspace Setup
              </h2>
              <p className="text-xs text-slate-500">
                Customize how your name and business appear inside Milo and on customer channels.
              </p>
            </div>

            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <label
                  htmlFor="fullName"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Full Name
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  defaultValue={userName}
                  placeholder="e.g. Alex Morgan"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-xs transition-colors hover:border-slate-300 focus:border-[#ff5c00] focus:ring-2 focus:ring-[#ff5c00]/20 focus:outline-none placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="companyName"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Company Name / Workspace
                </label>
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  defaultValue={workspaceName}
                  placeholder="e.g. Acme AB"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-xs transition-colors hover:border-slate-300 focus:border-[#ff5c00] focus:ring-2 focus:ring-[#ff5c00]/20 focus:outline-none placeholder:text-slate-400"
                />
              </div>

              {userEmail && (
                <div className="space-y-1.5">
                  <span className="block text-xs font-semibold text-slate-700">
                    Account Email
                  </span>
                  <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-100/70 px-3.5 py-2 text-xs text-slate-600">
                    <span>{userEmail}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Verified
                    </span>
                  </div>
                </div>
              )}

              {/* Legal Consent Checkbox / Badge */}
              <div className="pt-1">
                {hasAcceptedTerms ? (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200/80 px-3.5 py-2.5 text-xs text-emerald-800 font-medium">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" strokeWidth={2.5} />
                    <span>Terms of Service and Privacy Policy accepted</span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5 rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
                    <input
                      id="acceptTerms"
                      name="acceptTerms"
                      type="checkbox"
                      defaultChecked
                      required
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#ff5c00] focus:ring-[#ff5c00] cursor-pointer"
                    />
                    <label
                      htmlFor="acceptTerms"
                      className="text-xs text-slate-600 leading-snug cursor-pointer select-none"
                    >
                      I agree to the{" "}
                      <Link
                        href="/terms-of-service"
                        target="_blank"
                        className="font-bold text-slate-900 hover:text-[#ff5c00] underline underline-offset-2"
                      >
                        Terms of Service
                      </Link>{" "}
                      and acknowledge the{" "}
                      <Link
                        href="/privacy-policy"
                        target="_blank"
                        className="font-bold text-slate-900 hover:text-[#ff5c00] underline underline-offset-2"
                      >
                        Privacy Policy
                      </Link>
                      .
                    </label>
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isPending ? "Saving details..." : "Save details"}</span>
            </button>
          </form>

          {/* Modern Verification Status Steps */}
          <div className="space-y-2 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-2">
              Activation Status
            </p>

            <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
              <div>
                <p className="text-xs font-bold text-slate-800">Account created</p>
                <p className="text-[11px] text-slate-500">Authenticated and linked</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl px-2 py-1.5 bg-amber-500/5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 shrink-0">
                <Clock3 className="h-3.5 w-3.5" strokeWidth={2.2} />
              </span>
              <div>
                <p className="text-xs font-bold text-amber-900">Workspace verification</p>
                <p className="text-[11px] text-amber-700/80">Plan assignment and usage credit review</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl px-2 py-1.5 opacity-60">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400 shrink-0">
                <Lock className="h-3 w-3" />
              </span>
              <div>
                <p className="text-xs font-bold text-slate-700">Dashboard access</p>
                <p className="text-[11px] text-slate-400">Unlocks automatically once verified</p>
              </div>
            </div>
          </div>

          {/* Check Status Button & Refresh Trigger */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={checkActivation}
              disabled={isChecking}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#ff5c00] hover:bg-[#e05100] text-white text-xs font-bold uppercase tracking-wider transition-all shadow-xs active:scale-[0.98] cursor-pointer disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${isChecking ? "animate-spin" : ""}`}
                strokeWidth={2.2}
              />
              <span>{isChecking ? "Checking activation..." : "Check activation status"}</span>
            </button>
            <p className="text-center text-[11px] text-slate-400">
              Checking automatically every few seconds
            </p>
          </div>
        </div>

        {/* Bottom Footer */}
        <footer className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-slate-400" />
            <span>Enterprise-grade security & privacy</span>
          </div>
          <p>© 2026 Avenro AB</p>
        </footer>
      </section>

      {/* ─── Right Column: Premium Milo AI Engine Visual Stage ─── */}
      <section className="hidden lg:flex lg:w-1/2 relative bg-[#08080a] flex-col justify-between p-12 xl:p-16 overflow-hidden text-white border-l border-slate-900 select-none">
        {/* Soft atmospheric ambient glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_75%_at_50%_45%,rgba(255,92,0,0.11),transparent_70%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,92,0,0.05),transparent_40%)] pointer-events-none" />

        {/* Top Bar on Visual Side */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.09] backdrop-blur-md text-xs font-medium text-white/80 shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span>Milo AI Engine</span>
          </div>

          <span className="text-[11px] font-mono font-medium text-white/40 tracking-wider uppercase">
            Platform v2.4
          </span>
        </div>

        {/* Center Hero Artwork: Big Moving Milo Icon with Ambient Aura */}
        <div className="relative z-10 my-auto flex flex-col items-center text-center py-8">
          <div className="mb-8 flex items-center justify-center">
            <MiloLogo
              size={160}
              color="#ff5c00"
              className="h-36 w-36 sm:h-44 sm:w-44"
              priority
              animated
            />
          </div>

          {/* Typographic Title & Tagline */}
          <div className="space-y-3 max-w-sm mx-auto">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-headline">
              Autonomous conversational intelligence
            </h2>
            <p className="text-sm text-white/60 leading-relaxed font-normal">
              Milo lives directly on your website to answer visitor questions, capture qualified leads, and support customers 24/7.
            </p>
          </div>
        </div>

        {/* Bottom Bar on Visual Side */}
        <div className="relative z-10 flex items-center justify-between text-xs text-white/40 pt-6 border-t border-white/[0.07]">
          <span>Avenro Intelligence</span>
          <span className="inline-flex items-center gap-1.5 text-white/40">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            All Systems Operational
          </span>
        </div>
      </section>
    </main>
  );
}
