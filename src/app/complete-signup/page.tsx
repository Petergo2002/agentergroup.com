import Image from "next/image";
import { redirect } from "next/navigation";
import { getMessages } from "@/lib/i18n";
import { getServerLanguage } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { updatePassword } from "@/app/login/actions";

interface CompleteSignupPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getSearchValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export default async function CompleteSignupPage({ searchParams }: CompleteSignupPageProps) {
  const params = await searchParams;
  const language = await getServerLanguage();
  const messages = await getMessages(language);
  const error = getSearchValue(params.error);
  const redirectTo = getSearchValue(params.redirectTo);
  const isInviteSignup = redirectTo.startsWith("/invite/accept");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=Session+expired.+Please+sign+up+again.");
  }

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center p-8 bg-[#050505] font-body text-[#f5f1eb] overflow-hidden">

      <div className="relative z-10 w-full max-w-md space-y-10 bg-[#0d0d0d] p-12 rounded-[2px] border border-[#161616] shadow-2xl">
        <div className="flex justify-center mb-8">
          <Image
            src="/dashboardlogo.svg"
            alt="Agentergroup"
            width={840}
            height={279}
            priority
            className="h-10 w-auto opacity-90 object-contain"
          />
        </div>

        <div className="space-y-3 text-center">
          <span className="inline-block text-[10px] font-bold uppercase tracking-[0.3em] text-[#ff5c00] mb-2">
            Final Step
          </span>
          <h2 className="font-headline text-3xl font-extrabold tracking-tight text-white leading-tight">
            {messages.login.completeSignupTitle}
          </h2>
          <p className="text-[13px] text-[#9d948a]/80 font-medium">
            {messages.login.completeSignupSubtitle}
          </p>
        </div>

        {error ? (
          <div className="rounded-[2px] border border-error/20 bg-error-container/10 px-4 py-3 text-xs text-error font-semibold text-center animate-shake">
            {error}
          </div>
        ) : null}

        <form action={updatePassword} className="space-y-6">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9d948a]/75 ml-1">
                Full Name
              </label>
              <input
                className="w-full rounded-[2px] border border-[#1f1f1f] bg-[#050505] px-4 py-3 text-sm text-white outline-none transition-all focus:border-[#ff5c00]/60 focus:ring-1 focus:ring-[#ff5c00]/10 placeholder:text-[#9d948a]/30 font-medium"
                name="fullName"
                type="text"
                placeholder="John Doe"
                required
              />
            </div>

            {!isInviteSignup && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9d948a]/75 ml-1">
                  Company Name
                </label>
                <input
                  className="w-full rounded-[2px] border border-[#1f1f1f] bg-[#050505] px-4 py-3 text-sm text-white outline-none transition-all focus:border-[#ff5c00]/60 focus:ring-1 focus:ring-[#ff5c00]/10 placeholder:text-[#9d948a]/30 font-medium"
                  name="companyName"
                  type="text"
                  placeholder="Agentergroup AB"
                  required
                />
              </div>
            )}

            <div className="h-px w-full bg-[#161616] my-4" />

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9d948a]/75 ml-1">
                {messages.login.setPassword}
              </label>
              <input
                className="w-full rounded-[2px] border border-[#1f1f1f] bg-[#050505] px-4 py-3 text-sm text-white outline-none transition-all focus:border-[#ff5c00]/60 focus:ring-1 focus:ring-[#ff5c00]/10 placeholder:text-[#9d948a]/30 font-medium"
                name="password"
                type="password"
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9d948a]/75 ml-1">
                {messages.login.confirmPassword}
              </label>
              <input
                className="w-full rounded-[2px] border border-[#1f1f1f] bg-[#050505] px-4 py-3 text-sm text-white outline-none transition-all focus:border-[#ff5c00]/60 focus:ring-1 focus:ring-[#ff5c00]/10 placeholder:text-[#9d948a]/30 font-medium"
                name="confirmPassword"
                type="password"
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full flex h-11 items-center justify-center rounded-[2px] bg-[#ff5c00] hover:bg-[#e05100] text-white text-[11px] font-bold uppercase tracking-widest active:scale-[0.98] transition-all duration-200 cursor-pointer"
          >
            {messages.login.finishSignup}
          </button>
        </form>
      </div>

      <p className="relative z-10 mt-12 text-[10px] font-bold text-[#9d948a]/30 uppercase tracking-[0.2em]">
        Secure Account Setup
      </p>
    </main>
  );
}
