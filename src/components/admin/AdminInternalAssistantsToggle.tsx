"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/i18n/LanguageProvider";

interface AdminInternalAssistantsToggleProps {
  workspaceId: string;
  enabled: boolean;
}

export function AdminInternalAssistantsToggle({
  workspaceId,
  enabled,
}: AdminInternalAssistantsToggleProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [isSaving, setIsSaving] = useState(false);
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const toggle = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/admin/workspaces/${workspaceId}/internal-assistants`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            enabled: !isEnabled,
          }),
        },
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.workspace) {
        throw new Error(payload?.error || t("settings.saveError"));
      }

      setIsEnabled(payload.workspace.internalAssistantsEnabled === true);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("settings.saveError"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#262626] bg-[#121212] p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">
            {t("admin.internalAssistants")}
          </p>
          <p className="text-sm text-neutral-300">
            {t("admin.internalAssistantsDescription")}
          </p>
          <div
            className={`inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
              isEnabled
                ? "bg-emerald-500/10 text-emerald-300"
                : "bg-neutral-800 text-neutral-400"
            }`}
          >
            {isEnabled ? t("common.enabled") : t("common.disabled")}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void toggle()}
          disabled={isSaving}
          className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
            isEnabled
              ? "bg-white text-black hover:bg-neutral-200"
              : "bg-neutral-800 text-white hover:bg-neutral-700"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {isSaving
            ? t("common.saving")
            : isEnabled
              ? t("admin.disable")
              : t("admin.enable")}
        </button>
      </div>

      {errorMessage ? (
        <p className="mt-3 text-xs text-red-300">{errorMessage}</p>
      ) : null}
    </div>
  );
}
