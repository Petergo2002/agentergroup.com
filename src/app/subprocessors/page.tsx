import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Subprocessors | Agentergroup",
  description:
    "Public list of current subprocessors used by Agentergroup and Agentergroup-powered widgets.",
};

const providers = [
  {
    name: "Supabase",
    purpose: "Database, authentication, storage, and application infrastructure.",
    data: "Workspace records, widget sessions, leads, knowledge files, and auth/account metadata.",
    region: "Provider infrastructure may process data across multiple regions depending on project setup.",
    link: "https://supabase.com/legal/dpa",
  },
  {
    name: "OpenRouter",
    purpose: "Model routing and LLM access for runtime responses.",
    data: "Prompt content, chat context, tool schemas, and response payloads needed to generate completions.",
    region: "Provider routing depends on configured privacy and model/provider availability.",
    link: "https://openrouter.ai/docs/guides/privacy/logging",
  },
  {
    name: "Composio",
    purpose: "Connected account authentication and third-party tool execution.",
    data: "Connected app auth state and the minimum action payloads/results needed to execute Gmail, Google Calendar, and Drive actions.",
    region: "Composio documentation states processing primarily occurs in the United States.",
    link: "https://composio.dev/legal/dpa",
  },
];

export default function SubprocessorsPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f8fb_0%,#eef2f6_100%)] text-on-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-16 sm:px-8 sm:py-20">
        <section className="rounded-[28px] border border-outline-variant/20 bg-white/90 p-8 shadow-sm shadow-slate-200/60 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
            Public Legal Page
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-on-surface sm:text-5xl">
            Subprocessors
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-on-surface-variant sm:text-base">
            This page lists the main subprocessors currently used to deliver Agentergroup and
            Agentergroup-powered widgets. It is intended to help customers understand which
            external providers may process data on Agentergroup&apos;s behalf.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant sm:text-sm">
            <span className="rounded-full border border-outline-variant/25 bg-surface px-3 py-1.5">
              Last updated: March 23, 2026
            </span>
            <Link
              href="/privacy-policy"
              className="rounded-full border border-outline-variant/25 bg-surface px-3 py-1.5 transition-colors hover:bg-surface-container"
            >
              Privacy policy
            </Link>
            <Link
              href="/data-processing"
              className="rounded-full border border-outline-variant/25 bg-surface px-3 py-1.5 transition-colors hover:bg-surface-container"
            >
              Data processing
            </Link>
          </div>
        </section>

        <section className="overflow-hidden rounded-[24px] border border-outline-variant/15 bg-white/85 shadow-sm shadow-slate-200/40">
          <div className="grid grid-cols-1 border-b border-outline-variant/10 bg-surface-container/70 px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant md:grid-cols-[180px_1.1fr_1.2fr_1fr_160px]">
            <div>Provider</div>
            <div>Purpose</div>
            <div>Main data categories</div>
            <div>Region note</div>
            <div>Official link</div>
          </div>

          {providers.map((provider) => (
            <div
              key={provider.name}
              className="grid grid-cols-1 gap-4 border-b border-outline-variant/10 px-6 py-5 text-sm leading-6 text-on-surface-variant last:border-b-0 md:grid-cols-[180px_1.1fr_1.2fr_1fr_160px]"
            >
              <div className="font-semibold text-on-surface">{provider.name}</div>
              <div>{provider.purpose}</div>
              <div>{provider.data}</div>
              <div>{provider.region}</div>
              <div>
                <a
                  href={provider.link}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-on-surface underline decoration-outline-variant/40 underline-offset-4 transition-colors hover:text-primary"
                >
                  Open reference
                </a>
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
