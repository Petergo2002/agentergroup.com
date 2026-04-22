"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, Zap, Shield, Sparkles, XCircle } from "lucide-react";
import { completeOnboarding } from "./actions";

const PLAN_FEATURES = {
  free: ["50 messages per month", "1 active agent", "10 MB Knowledge Base storage", "Community support"],
  starter: [
    "500 messages per month",
    "Up to 3 agents",
    "25 MB Knowledge Base storage",
    "Full integrations",
    "Priority support",
  ],
  premium: [
    "4000 messages per month",
    "Unlimited agents",
    "50 MB Knowledge Base storage",
    "Full integrations",
    "Dedicated support",
  ],
};

const PLAN_PRICES = { free: "$0", starter: "$30", premium: "$110" };

interface OnboardingContentProps {
  workspaceId: string;
  workspaceName: string;
  currentPlan: string;
}

export default function OnboardingContent({
  workspaceId,
  workspaceName,
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
      // Proactively mark as completed when returning from Stripe
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
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0a0a0b] font-sans text-white">
      {/* Toast for status */}
      {status !== 'idle' && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-4 shadow-xl text-sm font-semibold animate-in slide-in-from-top-2 ${
          status === 'success' ? 'bg-success/10 text-success border border-success/20' : 'bg-error/10 text-error border border-error/20'
        }`}>
          {status === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
          {status === 'success' ? 'Payment successful! Finalizing setup...' : 'Payment canceled. Please choose a plan to continue.'}
        </div>
      )}

      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute -top-[20%] -left-[10%] h-[70%] w-[70%] rounded-full bg-primary/20 blur-[120px] animate-pulse" />
        <div className="absolute -bottom-[20%] -right-[10%] h-[70%] w-[70%] rounded-full bg-secondary/10 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center px-6 py-20 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold tracking-wider text-primary uppercase">
            <Sparkles className="h-3.5 w-3.5" />
            Welcome to Agentergroup
          </div>
          <h1 className="mt-8 text-4xl font-bold tracking-tight sm:text-6xl">
            Choose your <span className="text-primary">Experience</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-400 max-w-2xl mx-auto">
            Get started with <strong>{workspaceName}</strong>. Select the plan
             that fits your workflow. You can change this anytime.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="mt-20 grid w-full grid-cols-1 gap-8 md:grid-cols-3">
          {(["free", "starter", "premium"] as const).map((plan) => {
            const isPremium = plan === "premium";
            const isStarter = plan === "starter";

            return (
              <div
                key={plan}
                className={`group relative flex flex-col rounded-[2.5rem] border p-10 transition-all duration-500 hover:scale-[1.02] ${
                  isPremium
                    ? "border-primary/50 bg-primary/5 shadow-[0_0_80px_-20px_rgba(var(--primary-rgb),0.3)]"
                    : "border-white/10 bg-white/[0.02] hover:border-white/20"
                }`}
              >
                {isPremium && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-[10px] font-bold uppercase tracking-widest">
                    Most Powerful
                  </div>
                )}

                <div className="mb-8 flex items-center justify-between">
                  <h3 className="text-2xl font-bold capitalize">{plan}</h3>
                  {isPremium ? (
                    <Zap className="h-6 w-6 text-primary" />
                  ) : isStarter ? (
                    <Sparkles className="h-6 w-6 text-secondary" />
                  ) : (
                    <Shield className="h-6 w-6 text-gray-500" />
                  )}
                </div>

                <div className="mb-8 flex items-baseline gap-1">
                  <span className="text-5xl font-bold tracking-tight">
                    {PLAN_PRICES[plan]}
                  </span>
                  <span className="text-sm font-medium text-gray-500">/mo</span>
                </div>

                <ul className="mb-10 space-y-4">
                  {PLAN_FEATURES[plan].map((feature, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-sm text-gray-300"
                    >
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelectPlan(plan)}
                  disabled={loading !== null}
                  className={`mt-auto w-full rounded-2xl py-4 text-sm font-bold uppercase tracking-widest transition-all ${
                    isPremium
                      ? "bg-primary text-white hover:opacity-90 shadow-xl shadow-primary/20"
                      : "bg-white/10 text-white hover:bg-white/20"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loading === plan ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </div>
                  ) : plan === "free" ? (
                    "Get Started Free"
                  ) : (
                    `Upgrade to ${plan}`
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <p className="mt-12 text-sm text-gray-500">
          Secure payment processing by Stripe. All plans include VAT where
          applicable.
        </p>
      </div>
    </div>
  );
}
