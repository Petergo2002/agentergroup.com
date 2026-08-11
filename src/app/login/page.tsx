import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { sanitizePostAuthRedirectTo } from "@/lib/auth-redirect";
import { hasSupabaseEnv } from "@/lib/env";
import { getMessages } from "@/lib/i18n";
import { getServerLanguage } from "@/lib/i18n-server";
import { login, signup } from "@/app/login/actions";
import { EmailAuthSubmitButton } from "@/app/login/EmailAuthSubmitButton";
import { GoogleSignInButton } from "@/app/login/GoogleSignInButton";
import { createClient } from "@/lib/supabase/server";
import { BrandLogo } from "@/components/BrandLogo";

interface LoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getSearchValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

// Reusable BrandLogo component is imported from "@/components/BrandLogo"

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const language = await getServerLanguage();
  const messages = await getMessages(language);
  const error = getSearchValue(params.error);
  const notice = getSearchValue(params.notice);
  const redirectTo = sanitizePostAuthRedirectTo(getSearchValue(params.redirectTo));
  const view = getSearchValue(params.view) === "signup" ? "signup" : "login";

  if (!hasSupabaseEnv()) {
    return (
      <main className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-[#f5f1eb]">
        <div className="mx-auto flex max-w-2xl flex-col gap-8 rounded-[2px] border border-[#161616] bg-[#0d0d0d] p-12 shadow-2xl">
          <div className="space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#ff5c00]">
              {messages.login.systemConfiguration}
            </p>
            <h1 className="font-headline text-4xl font-extrabold tracking-tight text-white">
              {messages.login.readyToBuild}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-[#9d948a]">
              {messages.login.setupDatabase}
            </p>
          </div>
          <pre className="overflow-x-auto rounded-[2px] bg-[#050505] p-6 text-xs text-[#9d948a]/80 border border-[#161616]">
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(redirectTo);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 lg:p-8 bg-gradient-to-br from-[#ff5c00]/5 via-white to-[#ff5c00]/10 font-body">
      <div className="w-full max-w-[1000px] bg-white rounded-[24px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col lg:flex-row min-h-[640px] animate-in fade-in zoom-in-95 duration-500 border border-slate-100">
        
        {/* Left Column: Form */}
        <section className="w-full lg:w-1/2 flex flex-col p-8 lg:p-14 relative">
          
          <div className="mx-auto w-full max-w-[340px] flex-1 flex flex-col justify-center">
            {/* Header */}
            <div className="flex flex-col items-center text-center space-y-3 mb-8">
              <BrandLogo className="h-8 w-auto text-slate-900 mb-4" />
              <h1 className="text-[22px] font-bold tracking-tight text-slate-900">
                {view === "login" ? "Log in to Agentergroup" : "Get started with Agentergroup"}
              </h1>
              <p className="text-[13px] leading-relaxed text-slate-500">
                Start managing your work, stay organized, and keep your team moving forward.
              </p>
            </div>

            {/* Simple Message Alerts */}
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 font-medium animate-shake mb-6">
                {error}
              </div>
            ) : null}

            {notice ? (
              <div className="rounded-lg border border-[#ff5c00]/20 bg-[#ff5c00]/5 px-4 py-3 text-sm text-[#ff5c00] font-medium mb-6">
                {notice}
              </div>
            ) : null}

            {/* Credentials Email/Password form */}
            <form className="space-y-4">
              <input type="hidden" name="redirectTo" value={redirectTo} />

              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-[11px] font-bold text-slate-700">
                  Email
                </label>
                <input
                  id="email"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-colors hover:border-slate-300 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 focus:outline-none placeholder:text-slate-400"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="Enter your email"
                  required
                />
              </div>

              {view === "login" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="block text-[11px] font-bold text-slate-700">
                      Password
                    </label>
                    <Link
                      href="/login/forgot-password"
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <input
                    id="password"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-colors hover:border-slate-300 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 focus:outline-none placeholder:text-slate-400"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    minLength={6}
                    required
                  />
                </div>
              )}

              {view === "signup" ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
                  <div className="flex items-start gap-3">
                    <input
                      id="legalConsent"
                      name="legalConsent"
                      type="checkbox"
                      required
                      aria-labelledby="legalConsentPrefix legalConsentTerms legalConsentAnd legalConsentPrivacy"
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-[#ff5c00] focus:ring-2 focus:ring-[#ff5c00]/30 focus:ring-offset-1"
                    />
                    <p className="text-[12px] font-medium leading-5 text-slate-600">
                      <label
                        id="legalConsentPrefix"
                        htmlFor="legalConsent"
                        className="cursor-pointer"
                      >
                        {messages.login.signupConsentPrefix}
                      </label>{" "}
                      <Link
                        id="legalConsentTerms"
                        href="/terms-of-service"
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-700"
                      >
                        {messages.login.termsOfService}
                      </Link>{" "}
                      <span id="legalConsentAnd">{messages.login.signupConsentAnd}</span>{" "}
                      <Link
                        id="legalConsentPrivacy"
                        href="/privacy-policy"
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-700"
                      >
                        {messages.login.privacyPolicy}
                      </Link>
                      .
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="pt-2">
                <EmailAuthSubmitButton
                  action={view === "login" ? login : signup}
                  idleLabel={view === "login" ? "Log in with email" : "Sign up with email"}
                  pendingLabel={view === "login" ? "Signing in..." : "Sending link..."}
                />
              </div>
            </form>

            {/* Divider */}
            <div className="relative flex items-center gap-4 my-6">
              <div className="h-px flex-1 bg-slate-100" />
              <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-widest select-none">
                OR
              </span>
              <div className="h-px flex-1 bg-slate-100" />
            </div>

            {/* Google OAuth */}
            <GoogleSignInButton
              label={messages.login.continueWithGoogle}
              redirectTo={redirectTo}
              requireLegalConsent={view === "signup"}
              consentRequiredMessage={messages.login.signupConsentRequired}
            />

            <p className="text-center text-[12px] font-medium text-slate-500 mt-6">
              {view === "login" ? "Don't have an account? " : "Already have an account? "}
              <Link
                href={`/login?view=${view === "login" ? "signup" : "login"}&redirectTo=${encodeURIComponent(redirectTo)}`}
                className="font-bold text-slate-900 hover:text-slate-700 transition-colors"
              >
                {view === "login" ? "Sign up" : "Log in"}
              </Link>
            </p>
          </div>

          {/* Footer Terms */}
          {view === "login" ? (
            <div className="mt-8 text-center lg:mt-auto pt-8">
              <p className="text-[10px] font-medium text-slate-400">
                By continuing, you agree to Agentergroup&apos;s <Link href="/terms-of-service" className="font-bold text-slate-600 hover:text-slate-900 transition-colors">Terms of Service</Link> and <Link href="/privacy-policy" className="font-bold text-slate-600 hover:text-slate-900 transition-colors">Privacy Policy</Link>
              </p>
            </div>
          ) : null}
        </section>

        {/* Right Column: Hero Image */}
        <section className="hidden lg:block w-1/2 relative bg-slate-50 border-l border-slate-100">
          <Image
            src="/login-robot-hero.jpg"
            alt=""
            fill
            sizes="50vw"
            className="object-cover"
            priority
          />
        </section>

      </div>
    </main>
  );
}
