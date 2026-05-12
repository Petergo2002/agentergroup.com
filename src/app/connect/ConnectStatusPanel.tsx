"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Link2, ShieldAlert } from "lucide-react";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export type PublicConnectionAuthStatus =
  | "ready"
  | "completed"
  | "expired"
  | "revoked"
  | "invalid"
  | "disabled"
  | "unsupported"
  | "pending"
  | "error";

interface ConnectStatusPanelProps {
  token?: string;
  status: PublicConnectionAuthStatus;
  workspaceName?: string;
  integrationName?: string;
}

function getStatusTone(status: PublicConnectionAuthStatus) {
  if (status === "ready" || status === "pending") {
    return "bg-primary/10 text-primary";
  }

  if (status === "completed") {
    return "bg-success/10 text-success";
  }

  return "bg-error/10 text-error";
}

export function ConnectStatusPanel({
  token,
  status,
  workspaceName,
  integrationName,
}: ConnectStatusPanelProps) {
  const { t } = useLanguage();
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canStart = status === "ready" && Boolean(token);
  const title =
    status === "ready"
      ? t("connections.publicAuth.title")
      : t(`connections.publicAuth.${status}Title`);
  const description =
    status === "ready"
      ? t("connections.publicAuth.description", {
          workspace: workspaceName ?? t("common.unknown"),
          integration: integrationName ?? t("common.unknown"),
        })
      : t(`connections.publicAuth.${status}Description`);

  const handleStart = async () => {
    if (!token) return;
    setIsStarting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/public/connection-auth-links/${encodeURIComponent(token)}/start`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? t("connections.publicAuth.startError"));
      }

      if (payload.redirectUrl) {
        window.location.href = payload.redirectUrl;
        return;
      }

      throw new Error(t("connections.publicAuth.startError"));
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("connections.publicAuth.startError"),
      );
      setIsStarting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-on-surface sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-xl items-center">
        <section className="w-full rounded-[1.75rem] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_24px_80px_rgba(15,23,42,0.10)] sm:p-8">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
                {t("common.appName")}
              </p>
              <h1 className="mt-3 font-headline text-3xl font-bold tracking-tight">
                {title}
              </h1>
            </div>
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${getStatusTone(status)}`}
            >
              {status === "completed" ? (
                <CheckCircle2 className="h-6 w-6" />
              ) : status === "ready" || status === "pending" ? (
                <Link2 className="h-6 w-6" />
              ) : (
                <ShieldAlert className="h-6 w-6" />
              )}
            </div>
          </div>

          <div className="space-y-4">
            {workspaceName && integrationName ? (
              <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant/60">
                  {t("connections.publicAuth.request")}
                </p>
                <p className="mt-2 text-sm font-semibold text-on-surface">
                  {workspaceName}
                </p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {integrationName}
                </p>
              </div>
            ) : null}

            <p className="text-sm leading-7 text-on-surface-variant">{description}</p>

            {errorMessage ? (
              <p className="rounded-2xl border border-error/20 bg-error-container px-4 py-3 text-sm font-medium text-error">
                {errorMessage}
              </p>
            ) : null}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            {canStart ? (
              <button
                type="button"
                onClick={handleStart}
                disabled={isStarting}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-on-surface px-5 py-3 text-sm font-semibold text-background shadow-sm transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isStarting
                  ? t("connections.publicAuth.starting")
                  : t("connections.publicAuth.connectButton", {
                      integration: integrationName ?? t("common.unknown"),
                    })}
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
