import Link from "next/link";
import { getMessages } from "@/lib/i18n";
import { getServerLanguage } from "@/lib/i18n-server";

export default function SettingsSubprocessorsPage() {
  const languagePromise = getServerLanguage();
  return <SettingsSubprocessorsPageContent languagePromise={languagePromise} />;
}

async function SettingsSubprocessorsPageContent({
  languagePromise,
}: {
  languagePromise: ReturnType<typeof getServerLanguage>;
}) {
  const language = await languagePromise;
  const messages = await getMessages(language);
  const providers = messages.subprocessors.providers;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="rounded-[1.7rem] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
          {messages.subprocessors.badge}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-on-surface">
          {messages.subprocessors.title}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-on-surface-variant">
          {messages.subprocessors.description}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant sm:text-sm">
          <span className="rounded-full border border-outline-variant/25 bg-surface px-3 py-1.5">
            {messages.subprocessors.lastUpdated}
          </span>
          <Link
            href="/settings"
            className="rounded-full border border-outline-variant/25 bg-surface px-3 py-1.5 transition-colors hover:bg-surface-container"
          >
            {messages.subprocessors.backToSettings}
          </Link>
          <Link
            href="/settings/data-processing"
            className="rounded-full border border-outline-variant/25 bg-surface px-3 py-1.5 transition-colors hover:bg-surface-container"
          >
            {messages.subprocessors.dataProcessing}
          </Link>
          <Link
            href="/privacy-policy"
            className="rounded-full border border-outline-variant/25 bg-surface px-3 py-1.5 transition-colors hover:bg-surface-container"
          >
            {messages.subprocessors.publicPrivacyPolicy}
          </Link>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-[1.7rem] border border-outline-variant/30 bg-surface-container-lowest shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
        <div className="grid grid-cols-1 border-b border-outline-variant/10 bg-surface-container/70 px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant md:grid-cols-[180px_1.1fr_1.2fr_1fr_160px]">
          <div>{messages.subprocessors.columns.provider}</div>
          <div>{messages.subprocessors.columns.purpose}</div>
          <div>{messages.subprocessors.columns.dataCategories}</div>
          <div>{messages.subprocessors.columns.regionNote}</div>
          <div>{messages.subprocessors.columns.officialLink}</div>
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
                {provider.linkLabel}
              </a>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
