import type { Metadata } from "next";
import Link from "next/link";
import {
  getMessages,
  resolvePlatformLanguage,
  type PlatformLanguage,
} from "@/lib/i18n";
import { getServerLanguage } from "@/lib/i18n-server";

export const metadata: Metadata = {
  title: "Privacy Policy | Agentergroup",
  description:
    "Public privacy policy for Agentergroup and Agentergroup-powered widgets.",
};

export default async function PrivacyPolicyPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang } = await searchParams;
  const defaultLanguage = await getServerLanguage();
  const language: PlatformLanguage = lang
    ? resolvePlatformLanguage(lang)
    : defaultLanguage;
  const copy = (await getMessages(language)).privacyPolicy;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f8fb_0%,#eef2f6_100%)] text-on-surface">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-16 sm:px-8 sm:py-20">
        <div className="rounded-[28px] border border-outline-variant/20 bg-white/90 p-8 shadow-sm shadow-slate-200/60 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
            {copy.badge}
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-on-surface sm:text-5xl">
            {copy.title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-on-surface-variant sm:text-base">
            {copy.intro}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant sm:text-sm">
            <span className="rounded-full border border-outline-variant/25 bg-surface px-3 py-1.5">
              {copy.lastUpdated}
            </span>
            <div className="inline-flex items-center gap-1 rounded-full border border-outline-variant/25 bg-surface p-1">
              <span className="px-2 text-[11px] font-medium text-on-surface-variant">
                {copy.languageLabel}
              </span>
              <Link
                href="/privacy-policy?lang=en"
                className={`rounded-full px-3 py-1.5 transition-colors ${
                  language === "en"
                    ? "bg-on-surface text-background"
                    : "text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                {copy.languages.en}
              </Link>
              <Link
                href="/privacy-policy?lang=sv"
                className={`rounded-full px-3 py-1.5 transition-colors ${
                  language === "sv"
                    ? "bg-on-surface text-background"
                    : "text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                {copy.languages.sv}
              </Link>
            </div>
            <Link
              href="/login"
              className="rounded-full border border-outline-variant/25 bg-surface px-3 py-1.5 transition-colors hover:bg-surface-container"
            >
              {copy.backToSignIn}
            </Link>
          </div>
        </div>

        <div className="grid gap-4">
          {copy.sections.map((section) => (
            <section
              key={section.title}
              className="rounded-[24px] border border-outline-variant/15 bg-white/85 p-6 shadow-sm shadow-slate-200/40 sm:p-7"
            >
              <h2 className="text-xl font-semibold tracking-tight text-on-surface">
                {section.title}
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-on-surface-variant sm:text-[15px]">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
