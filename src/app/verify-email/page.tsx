import Link from "next/link";
import { ArrowLeft, Check, MailCheck, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { MiloLogo } from "@/components/brand/MiloLogo";
import { getMessages } from "@/lib/i18n";
import { getServerLanguage } from "@/lib/i18n-server";

export default async function VerifyEmailPage() {
  const language = await getServerLanguage();
  const messages = await getMessages(language);

  return (
    <main className="flex min-h-screen w-full flex-col bg-white font-body text-slate-900 lg:flex-row">
      <section className="relative z-10 flex min-h-screen w-full flex-col justify-between bg-white px-6 py-8 sm:px-12 sm:py-10 lg:w-1/2 lg:px-14 xl:px-20">
        <header className="flex w-full items-center justify-between">
          <Link
            href="/"
            title="Avenro Home"
            aria-label="Avenro home"
            className="rounded-xl py-1 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5c00]"
          >
            <BrandLogo className="h-8 w-auto text-slate-900" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5c00]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {messages.login.backToSignIn}
          </Link>
        </header>

        <div className="mx-auto my-auto w-full max-w-md py-12">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff4ec] text-[#c2410c]">
            <MailCheck className="h-7 w-7" aria-hidden="true" />
          </div>

          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c2410c]">
            {messages.login.verifyEmailEyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            {messages.login.verifyEmailTitle}
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            {messages.login.verifyEmailSubtitle}
          </p>

          <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {messages.login.verifyEmailNextTitle}
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  {messages.login.verifyEmailNextBody}
                </p>
              </div>
            </div>
          </div>

          <p className="mt-5 text-xs leading-5 text-slate-500">
            {messages.login.verifyEmailHelp}
          </p>
        </div>

        <footer className="flex items-center gap-1.5 text-xs text-slate-400">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          <span>{messages.login.secureVerification}</span>
        </footer>
      </section>

      <section className="relative hidden overflow-hidden border-l border-slate-900 bg-[#08080a] p-12 text-white lg:flex lg:w-1/2 lg:flex-col lg:justify-between xl:p-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_75%_at_50%_45%,rgba(255,92,0,0.11),transparent_70%)]" />
        <div className="relative z-10 inline-flex w-fit items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.05] px-3.5 py-1.5 text-xs font-medium text-white/80">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          {messages.login.accountProtected}
        </div>

        <div className="relative z-10 flex flex-col items-center py-8 text-center">
          <MiloLogo
            size={160}
            color="#ff5c00"
            className="h-36 w-36 sm:h-44 sm:w-44"
            priority
            animated
          />
          <h2 className="mt-8 max-w-sm text-3xl font-extrabold tracking-tight">
            {messages.login.verifyEmailVisualTitle}
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-6 text-white/60">
            {messages.login.verifyEmailVisualBody}
          </p>
        </div>

        <div className="relative z-10 border-t border-white/[0.07] pt-6 text-xs text-white/40">
          Avenro Intelligence
        </div>
      </section>
    </main>
  );
}
