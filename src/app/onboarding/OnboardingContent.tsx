"use client";

import Image from "next/image";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Clock3,
  LogOut,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

interface OnboardingContentProps {
  workspaceName: string;
  userName: string;
}

export default function OnboardingContent({
  workspaceName,
  userName,
}: OnboardingContentProps) {
  const router = useRouter();
  const [isChecking, startChecking] = useTransition();

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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#121212] px-4 py-10 text-white sm:px-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <section className="relative z-10 w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-[#191919] shadow-[0_28px_80px_-32px_rgba(0,0,0,0.8)]">
        <div className="border-b border-white/8 px-6 py-5 sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Image
                src="/svgfavicon.svg"
                alt="Agentergroup"
                width={42}
                height={42}
                priority
                className="h-10 w-10 object-contain"
              />
              <div>
                <p className="text-sm font-bold tracking-tight text-white">
                  Agentergroup
                </p>
                <p className="text-xs text-white/45">Managed pilot access</p>
              </div>
            </div>

            <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              Approval pending
            </span>
          </div>
        </div>

        <div className="px-6 py-8 sm:px-8 sm:py-9">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-[#181818] shadow-sm">
            <Clock3 className="h-5 w-5" strokeWidth={2.2} />
          </div>

          <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Workspace activation
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Your workspace is being prepared
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/60">
            Welcome{userName ? `, ${userName}` : ""}. Your account has been
            created successfully. We are assigning the right plan and usage
            credits to <span className="font-semibold text-white/85">{workspaceName}</span>.
          </p>

          <div className="mt-7 rounded-2xl border border-white/8 bg-white/[0.025] p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.2} />
              <p className="text-xs leading-5 text-white/55">
                You do not need to choose a plan or enter payment details.
                Access will unlock automatically as soon as your account
                manager activates the workspace.
              </p>
            </div>
          </div>

          <div className="mt-7 space-y-1">
            <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
              <div>
                <p className="text-sm font-semibold text-white/90">Account created</p>
                <p className="text-xs text-white/40">Your login is ready</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-primary/[0.07] px-3 py-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                <Clock3 className="h-3.5 w-3.5" strokeWidth={2.2} />
              </span>
              <div>
                <p className="text-sm font-semibold text-white/90">Plan assignment</p>
                <p className="text-xs text-white/45">Waiting for administrator approval</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 opacity-45">
              <span className="h-7 w-7 rounded-full border border-white/15" />
              <div>
                <p className="text-sm font-semibold text-white/90">Workspace access</p>
                <p className="text-xs text-white/40">Unlocks after activation</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={checkActivation}
            disabled={isChecking}
            className="mt-7 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-[#181818] transition-colors hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${isChecking ? "animate-spin" : ""}`}
              strokeWidth={2.2}
            />
            {isChecking ? "Checking activation..." : "Check activation"}
          </button>

          <div className="mt-4 flex items-center justify-between gap-4 text-xs text-white/40">
            <span>Checking automatically every few seconds</span>
            <form action="/auth/logout" method="post">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 font-semibold transition-colors hover:text-white/70"
              >
                <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
                Sign out
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
