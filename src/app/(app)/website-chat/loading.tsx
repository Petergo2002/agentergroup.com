'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/components/i18n/LanguageProvider';

export default function WebsiteChatLoading() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-outline-variant/10 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4 px-5 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/dashboard"
              aria-label={t('common.back')}
              className="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-outline-variant/20 px-3 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span className="hidden md:inline">{t('common.back')}</span>
            </Link>
            <h1 className="truncate text-xl font-headline font-bold tracking-tight text-on-surface">
              {t('widgetBuilder.websiteChat')}
            </h1>
          </div>
          <div className="hidden items-center gap-3 sm:flex" aria-hidden="true">
            <div className="h-10 w-28 animate-skeleton rounded-md bg-surface-container-low" />
            <div className="h-10 w-24 animate-skeleton rounded-md bg-surface-container-low" />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1320px] px-5 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="flex-1 space-y-8">
            <div className="h-8 w-48 animate-skeleton rounded-full bg-surface-container-low" />
            <div className="h-64 w-full animate-skeleton rounded-[2rem] bg-surface-container-low" />
            <div className="h-64 w-full animate-skeleton rounded-[2rem] bg-surface-container-low" />
          </div>
          <div className="hidden w-[360px] shrink-0 lg:block">
            <div className="h-[600px] w-full animate-skeleton rounded-[2.5rem] bg-surface-container-low" />
          </div>
        </div>
      </main>
    </div>
  );
}
