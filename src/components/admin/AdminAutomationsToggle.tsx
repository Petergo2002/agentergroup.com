"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AdminAutomationsToggleProps {
  workspaceId: string;
  enabled: boolean;
}

/**
 * Admin-only toggle to enable/disable the Automations beta feature for a workspace.
 * When disabled, the automation surface is completely hidden from all workspace users.
 */
export function AdminAutomationsToggle({
  workspaceId,
  enabled,
}: AdminAutomationsToggleProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const toggle = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/admin/workspaces/${workspaceId}/automations`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: !isEnabled }),
        },
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.workspace) {
        throw new Error(payload?.error || "Failed to save.");
      }

      setIsEnabled(payload.workspace.automationsEnabled === true);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-outline bg-surface p-4 shadow-tactile">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-on-surface-variant">
            Automations (Beta)
          </p>
          <p className="text-sm text-on-surface">
            Allow this workspace to create automation agents. Gmail triggers are activated
            separately inside each automation builder.
          </p>
          <div
            className={`inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
              isEnabled
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "bg-surface-container-high text-on-surface-variant"
            }`}
          >
            {isEnabled ? "Enabled" : "Disabled"}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void toggle()}
          disabled={isSaving}
          className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
            isEnabled
              ? "bg-on-surface text-surface hover:opacity-90"
              : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {isSaving ? "Saving…" : isEnabled ? "Disable" : "Enable"}
        </button>
      </div>

      {errorMessage ? (
        <p className="mt-3 text-xs text-error">{errorMessage}</p>
      ) : null}
    </div>
  );
}
