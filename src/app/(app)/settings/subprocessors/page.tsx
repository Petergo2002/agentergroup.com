import Link from "next/link";

const providers = [
  {
    name: "Supabase",
    purpose: "Database, authentication, storage, and application infrastructure.",
    data: "Workspace records, widget sessions, leads, knowledge files, and auth/account metadata.",
    region:
      "Provider infrastructure may process data across multiple regions depending on project setup.",
    link: "https://supabase.com/legal/dpa",
  },
  {
    name: "OpenRouter",
    purpose: "Model routing and LLM access for runtime responses.",
    data: "Prompt content, chat context, tool schemas, and response payloads needed to generate completions.",
    region:
      "Provider routing depends on configured privacy and model/provider availability.",
    link: "https://openrouter.ai/docs/guides/privacy/logging",
  },
  {
    name: "Composio",
    purpose: "Connected account authentication and third-party tool execution.",
    data: "Connected app auth state and the minimum action payloads/results needed to execute Gmail, Google Calendar, and Drive actions.",
    region:
      "Composio documentation states processing primarily occurs in the United States.",
    link: "https://composio.dev/legal/dpa",
  },
];

export default function SettingsSubprocessorsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="rounded-[1.7rem] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
          Customer Compliance
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-on-surface">
          Subprocessors
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-on-surface-variant">
          This page is intended for signed-in customers who need an overview of
          the current subprocessors used to deliver Agentergroup and
          Agentergroup-powered widgets.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant sm:text-sm">
          <span className="rounded-full border border-outline-variant/25 bg-surface px-3 py-1.5">
            Last updated: March 23, 2026
          </span>
          <Link
            href="/settings"
            className="rounded-full border border-outline-variant/25 bg-surface px-3 py-1.5 transition-colors hover:bg-surface-container"
          >
            Back to settings
          </Link>
          <Link
            href="/settings/data-processing"
            className="rounded-full border border-outline-variant/25 bg-surface px-3 py-1.5 transition-colors hover:bg-surface-container"
          >
            Data processing
          </Link>
          <Link
            href="/privacy-policy"
            className="rounded-full border border-outline-variant/25 bg-surface px-3 py-1.5 transition-colors hover:bg-surface-container"
          >
            Public privacy policy
          </Link>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-[1.7rem] border border-outline-variant/30 bg-surface-container-lowest shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
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
  );
}
