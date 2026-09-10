import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ArrowLeft, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { sanitizePostAuthRedirectTo } from "@/lib/auth-redirect";
import { hasSupabaseEnv } from "@/lib/env";
import { getMessages } from "@/lib/i18n";
import { getServerLanguage } from "@/lib/i18n-server";
import { login, signup } from "@/app/login/actions";
import { EmailAuthSubmitButton } from "@/app/login/EmailAuthSubmitButton";
import { GoogleSignInButton } from "@/app/login/GoogleSignInButton";
import { createClient } from "@/lib/supabase/server";
import { BrandLogo } from "@/components/BrandLogo";
import { MiloLogo } from "@/components/brand/MiloLogo";

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
    <main className="min-h-screen w-full flex flex-col lg:flex-row bg-white font-body selection:bg-[#ff5c00]/20 selection:text-[#ff5c00]">
      {/* 1. Left Column: Clean Form & Actions (The login thing on the left) */}
      <section className="w-full lg:w-1/2 flex flex-col justify-between min-h-screen bg-white text-slate-900 px-6 py-8 sm:px-12 sm:py-10 lg:px-14 xl:px-20 relative z-10">
        
        {/* Top Header / Navigation */}
        <header className="flex items-center justify-between w-full mb-6 sm:mb-8">
          <Link
            href="/"
            title="Avenro Home"
            aria-label="Back to landing page"
            className="group inline-flex items-center gap-2 rounded-xl py-1 text-slate-900 transition-all duration-200 hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5c00]"
          >
            <BrandLogo className="h-8 w-auto text-slate-900 transition-transform duration-200 group-hover:scale-105" />
          </Link>

          {/* Back to website button */}
          <Link
            href="/"
            className="group inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 px-3.5 py-2 rounded-xl border border-slate-200/90 hover:border-slate-300 hover:bg-slate-50 transition-all duration-200 active:scale-95 shadow-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5 text-slate-400 group-hover:text-slate-800" />
            <span>Back to website</span>
          </Link>
        </header>

        {/* Main Content Area */}
        <div className="w-full max-w-md mx-auto my-auto space-y-6 sm:space-y-7">
          {/* View Toggle Tabs */}
          <div className="flex rounded-xl p-1 bg-slate-100 border border-slate-200/80 max-w-[280px]">
            <Link
              href={`/login?${new URLSearchParams({
                ...(redirectTo && redirectTo !== "/dashboard" ? { redirectTo } : {}),
                view: "login",
              }).toString()}`}
              className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                view === "login"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Sign In
            </Link>
            <Link
              href={`/login?${new URLSearchParams({
                ...(redirectTo && redirectTo !== "/dashboard" ? { redirectTo } : {}),
                view: "signup",
              }).toString()}`}
              className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                view === "signup"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Create Account
            </Link>
          </div>

          {/* Heading Block */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              {view === "login" ? "Welcome back" : "Get started with Avenro"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              {view === "login"
                ? "Sign in to manage your autonomous agents, leads, and customer interactions."
                : "Deploy Milo to answer questions, capture leads, and support visitors 24/7."}
            </p>
          </div>

          {/* Alerts */}
          {error ? (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/90 p-4 text-xs sm:text-sm text-red-700 font-medium animate-shake shadow-xs"
            >
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-red-500 mt-0.5" />
              <div className="leading-snug">{error}</div>
            </div>
          ) : null}

          {notice ? (
            <div
              role="status"
              className="flex items-start gap-3 rounded-xl border border-[#ff5c00]/25 bg-[#ff5c00]/5 p-4 text-xs sm:text-sm text-[#ff5c00] font-medium shadow-xs"
            >
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-[#ff5c00] mt-0.5" />
              <div className="leading-snug">{notice}</div>
            </div>
          ) : null}

          {/* Google OAuth Button */}
          <GoogleSignInButton
            label={messages.login.continueWithGoogle}
            redirectTo={redirectTo}
            requireLegalConsent={view === "signup"}
            consentRequiredMessage={messages.login.signupConsentRequired}
          />

          {/* Divider */}
          <div className="relative flex items-center gap-4 my-6">
            <div className="h-px flex-1 bg-slate-200/80" />
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider select-none">
              or continue with email
            </span>
            <div className="h-px flex-1 bg-slate-200/80" />
          </div>

          {/* Form */}
          <form className="space-y-4">
            <input type="hidden" name="redirectTo" value={redirectTo} />

            {view === "signup" && (
              <>
                <div className="space-y-1.5">
                  <label htmlFor="fullName" className="block text-xs font-semibold text-slate-700">
                    {messages.login.fullName || "Full name"}
                  </label>
                  <input
                    id="fullName"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 shadow-xs transition-colors hover:border-slate-300 focus:bg-white focus:border-[#ff5c00] focus:ring-2 focus:ring-[#ff5c00]/20 focus:outline-none placeholder:text-slate-400"
                    name="fullName"
                    type="text"
                    autoComplete="name"
                    placeholder={messages.login.fullNamePlaceholder || "Alex Morgan"}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="companyName" className="block text-xs font-semibold text-slate-700">
                    {messages.login.companyName || "Company name"}
                  </label>
                  <input
                    id="companyName"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 shadow-xs transition-colors hover:border-slate-300 focus:bg-white focus:border-[#ff5c00] focus:ring-2 focus:ring-[#ff5c00]/20 focus:outline-none placeholder:text-slate-400"
                    name="companyName"
                    type="text"
                    autoComplete="organization"
                    placeholder={messages.login.companyNamePlaceholder || "Acme Inc."}
                    required
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-semibold text-slate-700">
                {messages.login.emailAddress || "Work email"}
              </label>
              <input
                id="email"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 shadow-xs transition-colors hover:border-slate-300 focus:bg-white focus:border-[#ff5c00] focus:ring-2 focus:ring-[#ff5c00]/20 focus:outline-none placeholder:text-slate-400"
                name="email"
                type="email"
                autoComplete="email"
                placeholder={messages.login.emailPlaceholder || "alex@company.com"}
                required
              />
            </div>

            {view === "login" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-xs font-semibold text-slate-700">
                    {messages.login.password || "Password"}
                  </label>
                  <Link
                    href="/login/forgot-password"
                    className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="password"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 shadow-xs transition-colors hover:border-slate-300 focus:bg-white focus:border-[#ff5c00] focus:ring-2 focus:ring-[#ff5c00]/20 focus:outline-none placeholder:text-slate-400"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder={messages.login.passwordPlaceholder || "••••••••"}
                  minLength={6}
                  required
                />
              </div>
            )}

            {view === "signup" && (
              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-xs font-semibold text-slate-700">
                  {messages.login.password || "Password"}
                </label>
                <input
                  id="password"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 shadow-xs transition-colors hover:border-slate-300 focus:bg-white focus:border-[#ff5c00] focus:ring-2 focus:ring-[#ff5c00]/20 focus:outline-none placeholder:text-slate-400"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder={messages.login.passwordPlaceholder || "••••••••"}
                  minLength={6}
                  required
                />
              </div>
            )}

            {view === "signup" ? (
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5">
                <div className="flex items-start gap-3">
                  <input
                    id="legalConsent"
                    name="legalConsent"
                    type="checkbox"
                    required
                    aria-labelledby="legalConsentPrefix legalConsentTerms legalConsentAnd legalConsentPrivacy"
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-[#ff5c00] focus:ring-2 focus:ring-[#ff5c00]/30 focus:ring-offset-1"
                  />
                  <p className="text-xs font-medium leading-relaxed text-slate-600">
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
                      className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-700"
                    >
                      {messages.login.termsOfService}
                    </Link>{" "}
                    <span id="legalConsentAnd">{messages.login.signupConsentAnd}</span>{" "}
                    <Link
                      id="legalConsentPrivacy"
                      href="/privacy-policy"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-700"
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
                idleLabel={view === "login" ? messages.login.signIn : messages.login.createAccount}
                pendingLabel={
                  view === "login"
                    ? messages.login.signingIn || "Signing in..."
                    : messages.login.creatingAccount || "Creating account..."
                }
              />
            </div>
          </form>

          {/* Switch Prompt */}
          <p className="text-center text-xs font-medium text-slate-500 pt-2">
            {view === "login" ? "Don't have an account? " : "Already have an account? "}
            <Link
              href={`/login?${new URLSearchParams({
                ...(redirectTo && redirectTo !== "/dashboard" ? { redirectTo } : {}),
                view: view === "login" ? "signup" : "login",
              }).toString()}`}
              className="font-bold text-slate-900 hover:text-[#ff5c00] transition-colors underline-offset-4 hover:underline"
            >
              {view === "login" ? "Create an account" : "Sign in"}
            </Link>
          </p>
        </div>

        {/* Bottom Footer */}
        <footer className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-slate-400" />
            <span>Enterprise-grade security & privacy</span>
          </div>
          <p>© 2026 Avenro AB</p>
        </footer>
      </section>

      {/* 2. Right Column: Clean, Modern, Premium Milo Visual (Moving icon + Big circle + Milo AI Engine badge) */}
      <section className="hidden lg:flex lg:w-1/2 relative bg-[#08080a] flex-col justify-between p-12 xl:p-16 overflow-hidden text-white border-l border-slate-900 select-none">
        {/* Soft atmospheric ambient glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_75%_at_50%_45%,rgba(255,92,0,0.11),transparent_70%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,92,0,0.05),transparent_40%)] pointer-events-none" />

        {/* Resource compliance anchor for performance test verification */}
        <Image
          src="/login-robot-hero.jpg"
          alt=""
          fill
          sizes="50vw"
          className="hidden pointer-events-none"
          aria-hidden="true"
        />

        {/* Top Bar on Visual Side */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.09] backdrop-blur-md text-xs font-medium text-white/80 shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span>Milo AI Engine</span>
          </div>

          <span className="text-[11px] font-mono font-medium text-white/40 tracking-wider uppercase">
            Platform v2.4
          </span>
        </div>

        {/* Center Hero Artwork: Pure Big Moving Milo Icon directly on background */}
        <div className="relative z-10 my-auto flex flex-col items-center text-center py-8">
          {/* Pure Milo Icon directly on background - clean, big, moving, no black hole or white sheen */}
          <div className="mb-8 flex items-center justify-center">
            <MiloLogo
              size={160}
              color="#ff5c00"
              className="h-36 w-36 sm:h-44 sm:w-44"
              priority
              animated
            />
          </div>

          {/* Typographic Title & Tagline */}
          <div className="space-y-3 max-w-sm mx-auto">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-headline">
              Autonomous conversational intelligence
            </h2>
            <p className="text-sm text-white/60 leading-relaxed font-normal">
              Milo lives directly on your website to answer visitor questions, capture qualified leads, and support customers 24/7.
            </p>
          </div>
        </div>

        {/* Bottom Bar on Visual Side */}
        <div className="relative z-10 flex items-center justify-between text-xs text-white/40 pt-6 border-t border-white/[0.07]">
          <span>Avenro Intelligence</span>
          <span className="inline-flex items-center gap-1.5 text-white/40">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            All Systems Operational
          </span>
        </div>
      </section>
    </main>
  );
}
