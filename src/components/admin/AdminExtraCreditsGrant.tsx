"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Coins } from "lucide-react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { formatAdminNumber } from "@/lib/admin/format";

const EXTRA_CREDIT_AMOUNTS = [50, 100, 500] as const;
type ExtraCreditAmount = (typeof EXTRA_CREDIT_AMOUNTS)[number];

interface AdminExtraCreditsGrantProps {
  workspaceId: string;
  messagesLimit: number;
  messagesUsed: number;
}

export function AdminExtraCreditsGrant({
  workspaceId,
  messagesLimit,
  messagesUsed,
}: AdminExtraCreditsGrantProps) {
  const router = useRouter();
  const { language } = useLanguage();
  const [currentLimit, setCurrentLimit] = useState(messagesLimit);
  const [activeAmount, setActiveAmount] = useState<ExtraCreditAmount | null>(
    null,
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const remainingMessages = Math.max(currentLimit - messagesUsed, 0);

  const grantCredits = async (amount: ExtraCreditAmount) => {
    if (activeAmount !== null) return;

    setActiveAmount(amount);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/admin/workspaces/${workspaceId}/extra-credits`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount }),
        },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.subscription) {
        throw new Error(payload?.error || "Failed to grant credits.");
      }

      const nextLimit = Number(payload.subscription.messagesLimit);
      if (Number.isFinite(nextLimit)) {
        setCurrentLimit(nextLimit);
      }

      setSuccessMessage(
        language === "sv"
          ? `Lade till ${amount} credits.`
          : `Added ${amount} credits.`,
      );
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to grant credits.",
      );
    } finally {
      setActiveAmount(null);
    }
  };

  return (
    <div className="rounded-2xl border border-outline bg-surface p-4 shadow-tactile">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-on-surface-variant">
            {language === "sv" ? "Extra credits" : "Extra credits"}
          </p>
          <p className="text-sm text-on-surface">
            {language === "sv"
              ? "Lägg till extra meddelanden i denna billing cycle."
              : "Add extra messages to this billing cycle."}
          </p>
        </div>
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
          <Coins aria-hidden className="h-4 w-4" />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-surface-container-low px-3 py-2">
          <dt className="text-[10px] uppercase tracking-[0.12em] text-on-surface-variant">
            {language === "sv" ? "Använt" : "Used"}
          </dt>
          <dd className="mt-1 text-sm font-semibold text-on-surface">
            {formatAdminNumber(messagesUsed, language)}
          </dd>
        </div>
        <div className="rounded-xl bg-surface-container-low px-3 py-2">
          <dt className="text-[10px] uppercase tracking-[0.12em] text-on-surface-variant">
            {language === "sv" ? "Limit" : "Limit"}
          </dt>
          <dd className="mt-1 text-sm font-semibold text-on-surface">
            {formatAdminNumber(currentLimit, language)}
          </dd>
        </div>
        <div className="rounded-xl bg-surface-container-low px-3 py-2">
          <dt className="text-[10px] uppercase tracking-[0.12em] text-on-surface-variant">
            {language === "sv" ? "Kvar" : "Left"}
          </dt>
          <dd className="mt-1 text-sm font-semibold text-on-surface">
            {formatAdminNumber(remainingMessages, language)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {EXTRA_CREDIT_AMOUNTS.map((amount) => (
          <button
            key={amount}
            type="button"
            disabled={activeAmount !== null}
            onClick={() => void grantCredits(amount)}
            className="rounded-xl bg-surface-container-high px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface transition-colors hover:bg-emerald-500/15 hover:text-emerald-700 dark:hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {activeAmount === amount ? "..." : `+${amount}`}
          </button>
        ))}
      </div>

      {successMessage ? (
        <p className="mt-3 text-xs text-emerald-700 dark:text-emerald-300">{successMessage}</p>
      ) : null}
      {errorMessage ? (
        <p className="mt-3 text-xs text-error">{errorMessage}</p>
      ) : null}
    </div>
  );
}
