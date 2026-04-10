import Link from "next/link";
import { getMessages } from "@/lib/i18n";
import { getServerLanguage } from "@/lib/i18n-server";

export default function SettingsDataProcessingPage() {
  const languagePromise = getServerLanguage();
  return <SettingsDataProcessingPageContent languagePromise={languagePromise} />;
}

async function SettingsDataProcessingPageContent({
  languagePromise,
}: {
  languagePromise: ReturnType<typeof getServerLanguage>;
}) {
  const language = await languagePromise;
  const messages = await getMessages(language);
  const sections = messages.dataProcessing.sections;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="rounded-[1.7rem] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
          {messages.dataProcessing.badge}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-on-surface">
          {messages.dataProcessing.title}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-on-surface-variant">
          {messages.dataProcessing.description}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant sm:text-sm">
          <span className="rounded-full border border-outline-variant/25 bg-surface px-3 py-1.5">
            {messages.dataProcessing.lastUpdated}
          </span>
          <Link
            href="/settings"
            className="rounded-full border border-outline-variant/25 bg-surface px-3 py-1.5 transition-colors hover:bg-surface-container"
          >
            {messages.dataProcessing.backToSettings}
          </Link>
          <Link
            href="/settings/subprocessors"
            className="rounded-full border border-outline-variant/25 bg-surface px-3 py-1.5 transition-colors hover:bg-surface-container"
          >
            {messages.dataProcessing.subprocessors}
          </Link>
          <Link
            href="/privacy-policy"
            className="rounded-full border border-outline-variant/25 bg-surface px-3 py-1.5 transition-colors hover:bg-surface-container"
          >
            {messages.dataProcessing.publicPrivacyPolicy}
          </Link>
        </div>
      </section>

      <div className="mt-6 grid gap-4">
        {sections.map((section) => (
          <section
            key={section.title}
            className="rounded-[1.7rem] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]"
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
  );
}
