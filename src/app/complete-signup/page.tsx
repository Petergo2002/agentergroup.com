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

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=Session+expired.+Please+sign+up+again.");
  }

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center p-8 bg-[#0F172A] font-body text-white overflow-hidden">
      {/* Subtle Grid Background */}
      <div className="absolute inset-0 z-0 opacity-[0.03]" 
           style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="relative z-10 w-full max-w-md space-y-10 bg-white/[0.02] p-12 rounded-[2.5rem] border border-white/5 shadow-2xl backdrop-blur-sm">
        <div className="flex justify-center mb-8">
          <Image
            src="/dashboardlogo.svg"
            alt="Agentergroup"
            width={180}
            height={60}
            className="h-10 w-auto opacity-90"
          />
        </div>

        <div className="space-y-3 text-center">
          <span className="inline-block text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-2">
            Final Step
          </span>
          <h2 className="font-headline text-3xl font-bold tracking-tight text-white leading-tight">
            {messages.login.completeSignupTitle}
          </h2>
          <p className="text-[13px] text-white/50 font-medium">
            {messages.login.completeSignupSubtitle}
          </p>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-400 font-bold tracking-tight text-center">
            {error}
          </div>
        ) : null}

        <form action={updatePassword} className="space-y-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">
                {messages.login.setPassword}
              </label>
              <input
                className="w-full rounded-2xl border border-white/5 bg-white/[0.03] px-5 py-4 text-sm text-white outline-none transition-all focus:border-primary/40 focus:ring-4 focus:ring-primary/10 placeholder:text-white/20"
                name="password"
                type="password"
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">
                {messages.login.confirmPassword}
              </label>
              <input
                className="w-full rounded-2xl border border-white/5 bg-white/[0.03] px-5 py-4 text-sm text-white outline-none transition-all focus:border-primary/40 focus:ring-4 focus:ring-primary/10 placeholder:text-white/20"
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
            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-primary py-4 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-primary/20 transition-all hover:shadow-primary/30 active:scale-[0.98]"
          >
            {messages.login.finishSignup}
          </button>
        </form>
      </div>
      
      <p className="relative z-10 mt-12 text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">
        Secure Account Setup
      </p>
    </main>
  );
}
