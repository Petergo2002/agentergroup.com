"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { MiloLogo } from "@/components/brand/MiloLogo";

export function MiloSetupCard({ canRepair }: { canRepair: boolean }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const provision = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/milo/provision", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof body?.error === "string" ? body.error : t("widgetBuilder.miloSetup.error"));
        return;
      }
      router.refresh();
    } catch {
      setError(t("widgetBuilder.miloSetup.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-6 py-6">
      <div className="mx-auto w-full max-w-7xl">
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-outline-variant/20 px-3 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("common.back")}
        </Link>
      </div>
      <div className="mx-auto flex min-h-[calc(100vh-6.5rem)] max-w-xl items-center">
        <section className="w-full rounded-3xl border border-outline-variant/15 bg-surface-container-low p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-outline-variant/15 bg-background shadow-xs">
            <MiloLogo size={44} className="h-11 w-11" priority />
          </div>
          <h1 className="text-2xl font-semibold text-on-surface">{t("widgetBuilder.miloSetup.title")}</h1>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">
            {t("widgetBuilder.miloSetup.description")}
          </p>
          {canRepair ? (
            <button
              type="button"
              onClick={provision}
              disabled={loading}
              className="mt-6 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-60"
            >
              {loading ? t("widgetBuilder.miloSetup.loading") : t("widgetBuilder.miloSetup.action")}
            </button>
          ) : (
            <p className="mt-5 text-sm font-medium text-on-surface">{t("widgetBuilder.miloSetup.askAdmin")}</p>
          )}
          {error ? <p role="alert" className="mt-4 text-sm text-error">{error}</p> : null}
        </section>
      </div>
    </main>
  );
}
