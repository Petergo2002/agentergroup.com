import Link from "next/link";
import Image from "next/image";
import { sanitizeRedirectTo } from "@/lib/auth-redirect";
import { hasSupabaseEnv } from "@/lib/env";
import { getMessages } from "@/lib/i18n";
import { getServerLanguage } from "@/lib/i18n-server";
import { login, signup } from "@/app/login/actions";

interface LoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getSearchValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const language = await getServerLanguage();
  const messages = await getMessages(language);
  const error = getSearchValue(params.error);
  const notice = getSearchValue(params.notice);
  const redirectTo = sanitizeRedirectTo(getSearchValue(params.redirectTo));

  if (!hasSupabaseEnv()) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6 text-on-surface">
        <div className="mx-auto flex max-w-2xl flex-col gap-8 rounded-[2.5rem] border border-outline-variant/15 bg-surface-container-lowest p-12 shadow-2xl">
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
              {messages.login.systemConfiguration}
            </p>
            <h1 className="font-headline text-4xl font-bold tracking-tight">
              {messages.login.readyToBuild}
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-on-surface-variant">
              {messages.login.setupDatabase}
            </p>
          </div>
          <pre className="overflow-x-auto rounded-2xl bg-surface-container-low p-6 text-xs text-on-surface-variant border border-outline-variant/10">
{`NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
OPENROUTER_API_KEY=
OPENROUTER_DATA_COLLECTION=deny
OPENROUTER_REQUIRE_ZDR=true
COMPOSIO_API_KEY=`}
          </pre>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col lg:flex-row bg-background overflow-hidden font-body">
      {/* Left Column: Branding & Visuals */}
      <section className="relative flex-1 border-b border-outline-variant/10 bg-background p-12 lg:min-h-screen lg:border-b-0 lg:border-r lg:border-outline-variant/10 lg:p-20 flex flex-col justify-between overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary rounded-full blur-[120px] opacity-18" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary-container rounded-full blur-[100px] opacity-12" />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.04) 1px, transparent 0)",
              backgroundSize: "32px 32px",
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col gap-12 max-w-xl">
          <div className="flex items-center">
            <Image
              src="/dashboardlogo.svg"
              alt={messages.login.logoAlt}
              width={220}
              height={73}
              priority
              className="h-[72px] w-auto object-contain object-left"
            />
          </div>

          <div className="space-y-6">
            <h1 className="text-5xl lg:text-6xl font-headline font-bold text-on-surface leading-[1.1] tracking-tight">
              {messages.login.headline}
            </h1>
            <p className="text-lg text-on-surface-variant leading-relaxed font-medium">
              {messages.login.subheadline}
            </p>
          </div>
        </div>

        <div className="relative z-10 flex gap-8 mt-12 lg:mt-0">
          <div className="flex flex-col gap-1">
            <span className="text-on-surface font-bold text-xl font-headline">{messages.login.seamless}</span>
            <span className="text-on-surface-variant text-xs font-semibold uppercase tracking-widest">{messages.login.architecture}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-on-surface font-bold text-xl font-headline">{messages.login.scalable}</span>
            <span className="text-on-surface-variant text-xs font-semibold uppercase tracking-widest">{messages.login.deployment}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-on-surface font-bold text-xl font-headline">{messages.login.secure}</span>
            <span className="text-on-surface-variant text-xs font-semibold uppercase tracking-widest">{messages.login.runtime}</span>
          </div>
        </div>
      </section>

      {/* Right Column: Auth Form */}
      <section className="w-full lg:w-[450px] xl:w-[500px] flex items-center justify-center p-8 lg:p-16 bg-surface-container-lowest">
        <div className="w-full max-w-sm space-y-10">
          <div className="space-y-3 text-center lg:text-left">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
              {messages.login.workspacePortal}
            </p>
            <h2 className="font-headline text-3xl font-bold tracking-tight text-on-background">
              {messages.login.signInTitle}
            </h2>
            <p className="text-sm text-on-surface-variant font-medium">
              {messages.login.signInSubtitle}
            </p>
          </div>

          {error ? (
            <div className="rounded-2xl border border-error/20 bg-error-container px-4 py-3 text-sm text-error font-medium">
              {error}
            </div>
          ) : null}

          {notice ? (
            <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary font-medium">
              {notice}
            </div>
          ) : null}

          <form className="space-y-6">
            <input type="hidden" name="redirectTo" value={redirectTo} />

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                {messages.login.emailAddress}
              </label>
              <input
                className="w-full rounded-2xl border border-outline-variant/15 bg-surface-container-low px-5 py-4 text-sm text-on-surface outline-none transition-all focus:border-primary/40 focus:ring-4 focus:ring-primary/10 placeholder:text-on-surface-variant/40"
                name="email"
                type="email"
                placeholder={messages.login.emailPlaceholder}
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                  {messages.login.password}
                </label>
              </div>
              <input
                className="w-full rounded-2xl border border-outline-variant/15 bg-surface-container-low px-5 py-4 text-sm text-on-surface outline-none transition-all focus:border-primary/40 focus:ring-4 focus:ring-primary/10 placeholder:text-on-surface-variant/40"
                name="password"
                type="password"
                placeholder={messages.login.passwordPlaceholder}
                minLength={6}
                required
              />
            </div>

            <div className="grid gap-3 pt-4 sm:grid-cols-2">
              <button
                formAction={login}
                className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-5 py-4 text-sm font-bold text-on-surface transition-all hover:border-primary/20 hover:bg-surface-container active:scale-[0.98]"
              >
                {messages.login.signIn}
              </button>
              <button
                formAction={signup}
                className="signature-gradient rounded-2xl px-5 py-4 text-sm font-bold shadow-xl shadow-black/20 transition-all hover:border-primary/25 hover:bg-primary/8 active:scale-[0.98]"
              >
                {messages.login.createAccount}
              </button>
            </div>
          </form>

          <p className="text-[11px] text-center text-on-surface-variant leading-relaxed opacity-60 px-4">
            {messages.login.legalPrefix}{" "}
            <span className="underline-offset-4 hover:text-on-surface">
              {messages.login.termsOfService}
            </span>{" "}
            {messages.login.legalAnd}{" "}
            <Link
              href="/privacy-policy"
              className="underline underline-offset-4 transition-colors hover:text-on-surface"
            >
              {messages.login.privacyPolicy}
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
