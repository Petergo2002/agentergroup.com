"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, ArrowRight } from "lucide-react";
import { completeOnboarding } from "./actions";

const PLAN_FEATURES = {
  free: [
    "50 messages per month",
    "1 active agent",
    "10 MB Knowledge storage",
    "Community support",
  ],
  starter: [
    "500 messages per month",
    "Up to 3 agents",
    "25 MB Knowledge storage",
    "Full integrations",
    "Priority support",
  ],
  premium: [
    "4000 messages per month",
    "Unlimited agents",
    "50 MB Knowledge storage",
    "Full integrations",
    "Dedicated support",
  ],
};

const PLAN_PRICES = { free: "0", starter: "30", premium: "110" };

interface OnboardingContentProps {
  workspaceId: string;
  workspaceName: string;
  userName: string;
  currentPlan: string;
}

export default function OnboardingContent({
  workspaceId,
  workspaceName,
  userName,
  currentPlan,
}: OnboardingContentProps) {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'canceled'>('idle');

  useEffect(() => {
    const success = searchParams.get("success") === "true";
    const canceled = searchParams.get("canceled") === "true";

    if (success) {
      setStatus('success');
      setLoading('completing');
      completeOnboarding(workspaceId);
    } else if (canceled) {
      setStatus('canceled');
    }
  }, [searchParams, workspaceId]);

  async function handleSelectPlan(plan: string) {
    setLoading(plan);
    try {
      if (plan === "free") {
        await completeOnboarding(workspaceId);
      } else {
        const res = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan, workspaceId }),
        });

        const data = await res.json();
        if (res.ok && data.url) {
          window.location.href = data.url;
        } else {
          console.error("Failed to start checkout:", data.error);
          setLoading(null);
        }
      }
    } catch (err) {
      console.error("Onboarding error:", err);
      setLoading(null);
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#141414] font-body text-white selection:bg-primary/30">
      {/* Subtle Grid Background */}
      <div className="absolute inset-0 z-0 opacity-[0.03]" 
           style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      {/* Top Banner for Status */}
      {status !== 'idle' && (
        <div className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-3 px-6 py-3 text-sm font-bold tracking-tight animate-in fade-in slide-in-from-top-4 duration-500 ${
          status === 'success' ? 'bg-primary text-white' : 'bg-red-500/10 text-red-500 border-b border-red-500/20'
        }`}>
          {status === 'success' ? 'Success! Finalizing your workspace...' : 'Payment was canceled. Please select a plan to continue.'}
        </div>
      )}

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-6 py-24 lg:px-8">
        {/* Header Section */}
        <div className="text-center max-w-3xl space-y-6">
          <span className="inline-block text-[10px] font-black uppercase tracking-[0.3em] text-primary">
            Step 1: Choose your path
          </span>
          <h1 className="font-headline text-5xl font-bold tracking-tight sm:text-7xl text-white">
            Elevate your <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-400">Workflow</span>
          </h1>
          <p className="text-lg text-on-surface-variant/70 font-medium max-w-xl mx-auto leading-relaxed">
            Welcome, <span className="text-white">{userName || workspaceName.replace(" Workspace", "")}</span>. Select a plan to unlock the full potential of your autonomous agents.
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="mt-24 grid w-full grid-cols-1 gap-6 md:grid-cols-3">
          {(["free", "starter", "premium"] as const).map((plan) => {
            const isPremium = plan === "premium";
            const isFree = plan === "free";

            return (
              <div
                key={plan}
                className={`group relative flex flex-col rounded-[2rem] border p-8 transition-all duration-500 ${
                  isPremium
                    ? "border-primary/30 bg-white/[0.03] shadow-[0_32px_64px_-16px_rgba(255,92,0,0.15)] ring-1 ring-primary/20"
                    : "border-white/5 bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.02]"
                }`}
              >
                {isPremium && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-white">
                    Recommended
                  </div>
                )}

                <div className="space-y-1 mb-8">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant/40 group-hover:text-primary transition-colors">
                    {plan} Plan
                  </h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-bold text-on-surface-variant/60">$</span>
                    <span className="text-5xl font-bold tracking-tighter text-white">
                      {PLAN_PRICES[plan]}
                    </span>
                    <span className="text-xs font-bold text-on-surface-variant/40 uppercase tracking-widest ml-1">
                      / month
                    </span>
                  </div>
                </div>

                <div className="h-px w-full bg-white/5 mb-8" />

                <ul className="mb-10 space-y-4 flex-grow">
                  {PLAN_FEATURES[plan].map((feature, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-3 text-[13px] text-on-surface-variant/80 font-medium"
                    >
                      <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelectPlan(plan)}
                  disabled={loading !== null}
                  className={`relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl py-4 text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${
                    isPremium
                      ? "bg-primary text-white hover:shadow-[0_8px_20px_-4px_rgba(255,92,0,0.4)] active:scale-[0.98]"
                      : isFree 
                        ? "border border-white/10 text-white hover:bg-white/5 active:scale-[0.98]"
                        : "bg-white text-[#0F172A] hover:bg-white/90 active:scale-[0.98]"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loading === plan ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {isFree ? "Start for free" : `Upgrade to ${plan}`}
                      <ArrowRight className="h-3 w-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Minimal Footer */}
        <div className="mt-16 flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-6 grayscale opacity-30 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
            <span className="text-[10px] font-bold uppercase tracking-widest">Powered by Stripe</span>
          </div>
          <p className="text-[11px] font-medium text-on-surface-variant/40 max-w-md uppercase tracking-widest">
            Secure billing. No hidden fees. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
