'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { 
  WidgetBuilderProvider, 
  useWidgetBuilder 
} from '@/components/widgets/builder/WidgetBuilderContext';
import { WidgetBuilderHeader } from '@/components/widgets/builder/WidgetBuilderHeader';
import { WidgetDevicePreview } from '@/components/widgets/builder/WidgetDevicePreview';
import { AppearanceTab } from '@/components/widgets/builder/tabs/AppearanceTab';
import { AgentsTab } from '@/components/widgets/builder/tabs/AgentsTab';
import { BehaviorTab } from '@/components/widgets/builder/tabs/BehaviorTab';
import { DeploymentTab } from '@/components/widgets/builder/tabs/DeploymentTab';

/**
 * Widget Builder Layout Component
 * Orchestrates the 2-column configuration experience.
 */
function WidgetBuilderLayout() {
  const { t } = useLanguage();
  const { isLoading, activeTab, summary, isPrimaryMiloWidget } = useWidgetBuilder();

  if (isLoading || !summary) {
    if (isPrimaryMiloWidget) {
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
                <div className="h-10 w-28 animate-pulse rounded-md bg-surface-container-low" />
                <div className="h-10 w-24 animate-pulse rounded-md bg-surface-container-low" />
              </div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1320px] px-5 py-8 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-8 lg:flex-row">
              <div className="flex-1 space-y-8">
                <div className="h-8 w-48 animate-pulse rounded-full bg-surface-container-low" />
                <div className="h-64 w-full animate-pulse rounded-[2rem] bg-surface-container-low" />
                <div className="h-64 w-full animate-pulse rounded-[2rem] bg-surface-container-low" />
              </div>
              <div className="hidden w-[360px] shrink-0 lg:block">
                <div className="h-[600px] w-full animate-pulse rounded-[2.5rem] bg-surface-container-low" />
              </div>
            </div>
          </main>
        </div>
      );
    }

    return (
      <div className="mx-auto w-full max-w-[1440px] px-6 py-12 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-12 lg:flex-row">
          <div className="flex-1 space-y-8">
             <div className="h-8 w-48 animate-pulse rounded-full bg-surface-container-low" />
             <div className="h-64 w-full animate-pulse rounded-[2rem] bg-surface-container-low" />
             <div className="h-64 w-full animate-pulse rounded-[2rem] bg-surface-container-low" />
          </div>
          <div className="hidden w-[420px] shrink-0 lg:block">
             <div className="h-[600px] w-full animate-pulse rounded-[2.5rem] bg-surface-container-low" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <WidgetBuilderHeader />
      
      <main className="mx-auto max-w-[1320px] px-5 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          
          {/* Configuration Column (Scrollable Content) */}
          <div className="flex-1 min-w-0">
            {activeTab === 'aesthetics' && <AppearanceTab />}
            {activeTab === 'agents' && <AgentsTab />}
            {activeTab === 'behavior' && <BehaviorTab />}
            {activeTab === 'deploy' && <DeploymentTab />}
          </div>

          {/* Persistent Preview Column (Sticky) */}
          <aside className="hidden w-[360px] shrink-0 lg:block">
            <WidgetDevicePreview />
          </aside>
        </div>
      </main>

      {/* Mobile Preview Trigger (Floating - Future enhancement) */}
      <div className="fixed bottom-8 right-8 z-50 lg:hidden">
         {/* Could toggle a full-screen preview modal on mobile */}
      </div>
    </div>
  );
}

/**
 * Main Entry Point
 */
export default function WidgetDetailPage() {
  return (
    <WidgetBuilderProvider>
      <WidgetBuilderLayout />
    </WidgetBuilderProvider>
  );
}
