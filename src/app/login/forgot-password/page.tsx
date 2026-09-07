import Link from "next/link";
import { forgotPasswordAction } from "@/app/login/actions";
import { BrandLogo } from "@/components/BrandLogo";

interface ForgotPasswordPageProps {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
}

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const { error, success } = await searchParams;

  return (
    <main className="relative min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-[#050505] font-body text-[#f5f1eb] selection:bg-[#ff5c00] selection:text-white">

      {/* Left Column: Symmetrical, Pristine Minimalist Typographic Branding */}
      <section className="relative hidden lg:flex bg-[#050505] text-[#f5f1eb] p-16 xl:p-24 flex-col justify-between overflow-hidden border-r border-[#161616] h-full">
        <div className="relative z-10 flex items-center justify-between">
          <Link
            href="/"
            title="Avenro Home"
            aria-label="Back to landing page"
            className="group inline-flex items-center transition-all duration-200 hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5c00] rounded-xl"
          >
            <BrandLogo
              className="h-10 w-auto text-white transition-transform duration-200 group-hover:scale-[1.02]"
              textColor="#ffffff"
            />
          </Link>
        </div>

        {/* Super Simple Pure Typographic Headline Block with vast negative space */}
        <div className="relative z-10 my-auto w-full space-y-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#ff5c00]">
            ACCOUNT RECOVERY
          </p>
          <p className="text-4xl xl:text-5xl font-headline font-extrabold text-white tracking-tight leading-tight max-w-lg">
            Reset your password
          </p>
          <p className="text-base text-[#9d948a] font-medium leading-relaxed max-w-md">
            Enter your email and we&apos;ll send you a secure link to set a new password.
          </p>
        </div>

        {/* Clean minimal version pill at bottom left */}
        <div className="relative z-10 flex">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#9d948a]/40">
            Platform Release v2.4.0
          </span>
        </div>
      </section>

      {/* Right Column: Unified Symmetrical, Super Clean, Elegant Credentials Form */}
      <section className="w-full flex flex-col justify-between p-8 lg:p-16 xl:p-24 bg-[#050505] border-t lg:border-t-0 border-[#161616] animate-in fade-in duration-500 min-h-screen lg:min-h-0">

        {/* Mobile Header Banner - Uses clean natural logo matching unified dark theme */}
        <div className="flex lg:hidden items-center justify-between mb-12">
          <Link
            href="/"
            title="Avenro Home"
            aria-label="Back to landing page"
            className="group inline-flex items-center transition-all duration-200 hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5c00] rounded-xl"
          >
            <BrandLogo
              className="h-8 w-auto text-white transition-transform duration-200 group-hover:scale-[1.02]"
              textColor="#ffffff"
            />
          </Link>
          <div className="rounded-[2px] bg-[#111] border border-[#222] px-3 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-[#9d948a]/80">
            v2.4.0
          </div>
        </div>

        {/* Credentials Form Container (Centered Symmetrically) */}
        <div className="my-auto w-full max-w-sm mx-auto space-y-8 animate-slide-up-fade">

          {/* Headline block */}
          <div className="space-y-2 text-center lg:text-left">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#ff5c00]">
              ACCOUNT RECOVERY
            </p>
            <h1 className="font-headline text-3xl font-extrabold tracking-tight text-white">
              Reset Password
            </h1>
            <p className="text-xs text-[#9d948a] font-medium leading-relaxed">
              We will send a password reset link to your email address.
            </p>
          </div>

          {/* Dynamic Flash Notifications (Error or Success) */}
          {error && (
            <div
              role="alert"
              className="rounded-[2px] border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-400 font-semibold text-center animate-shake"
            >
              {error}
            </div>
          )}

          {success ? (
            <div className="space-y-6">
              <div
                role="status"
                aria-live="polite"
                className="rounded-[2px] border border-emerald-500/20 bg-emerald-500/10 p-5 text-center space-y-2"
              >
                <p className="text-sm font-bold text-emerald-400">
                  Reset link sent
                </p>
                <p className="text-xs text-[#9d948a] leading-relaxed">
                  Check your inbox for instructions to reset your password.
                </p>
              </div>

              <Link
                href="/login"
                className="w-full inline-flex items-center justify-center rounded-[2px] border border-[#222] bg-[#111] px-4 py-3 text-xs font-bold text-white hover:bg-[#1a1a1a] transition-colors"
              >
                Back to Sign In
              </Link>
            </div>
          ) : (
            <form action={forgotPasswordAction} className="space-y-6">
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="recovery-email"
                    className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9d948a]/75 ml-1"
                  >
                    Email Address
                  </label>
                  <input
                    id="recovery-email"
                    className="w-full rounded-[2px] border border-[#1f1f1f] bg-[#050505] px-4 py-3 text-sm text-white outline-none transition-all focus:border-[#ff5c00]/60 focus:ring-1 focus:ring-[#ff5c00]/10 placeholder:text-[#9d948a]/30 font-medium"
                    name="email"
                    type="email"
                    placeholder="name@company.com"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-[2px] bg-[#ff5c00] py-3.5 px-4 text-xs font-bold uppercase tracking-[0.2em] text-white transition-all duration-150 hover:bg-[#ff6d1a] active:scale-[0.99] shadow-lg shadow-[#ff5c00]/20 cursor-pointer"
              >
                Send Reset Link
              </button>

              <div className="text-center pt-2">
                <p className="text-xs text-[#9d948a]">
                  Remember your password?{" "}
                  <Link
                    href="/login"
                    className="text-white hover:text-[#ff5c00] transition-colors font-semibold underline underline-offset-4 decoration-white/20 hover:decoration-[#ff5c00]"
                  >
                    Back to Sign In
                  </Link>
                </p>
              </div>
            </form>
          )}
        </div>

        {/* Footer info panel */}
        <div className="mt-8 pt-6 border-t border-[#161616] flex flex-col sm:flex-row items-center justify-between text-[10px] text-[#9d948a]/30 font-medium gap-2 text-center sm:text-left">
          <span>&copy; 2026 Avenro AB. All rights reserved.</span>
          <div className="flex gap-4">
            <span className="hover:text-white transition-colors cursor-pointer">Status</span>
            <span className="hover:text-white transition-colors cursor-pointer">Contact</span>
          </div>
        </div>
      </section>
    </main>
  );
}
