'use client';

import { Eye, X } from 'lucide-react';
import { useState } from 'react';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import {
  WidgetBuilderProvider,
  useWidgetBuilder,
} from '@/components/widgets/builder/WidgetBuilderContext';
import { WidgetBuilderHeader } from '@/components/widgets/builder/WidgetBuilderHeader';
import { WidgetDevicePreview } from '@/components/widgets/builder/WidgetDevicePreview';
import { AppearanceTab } from '@/components/widgets/builder/tabs/AppearanceTab';
import { AgentsTab } from '@/components/widgets/builder/tabs/AgentsTab';
import { BehaviorTab } from '@/components/widgets/builder/tabs/BehaviorTab';
import { DeploymentTab } from '@/components/widgets/builder/tabs/DeploymentTab';

/**
 * Widget Builder Layout Component
 * Features a full-width studio workspace: left controls & expansive right live preview canvas.
 */
function WidgetBuilderLayout() {
  const { t } = useLanguage();
  const { isLoading, activeTab, summary } = useWidgetBuilder();
  const [showMobilePreview, setShowMobilePreview] = useState(false);

  if (isLoading || !summary) {
    return (
      <div className="animate-builder-enter min-h-screen bg-background">
        <header className="border-b border-outline-variant/10 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex w-full items-center justify-between gap-4 px-6 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-9 w-9 animate-pulse rounded-xl bg-surface-container-low" />
              <div className="h-6 w-36 animate-pulse rounded-lg bg-surface-container-low" />
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <div className="h-9 w-24 animate-pulse rounded-xl bg-surface-container-low" />
              <div className="h-9 w-28 animate-pulse rounded-xl bg-surface-container-low" />
            </div>
          </div>
        </header>
        <div className="flex flex-col lg:flex-row w-full h-[calc(100vh-62px)]">
          <div className="w-full lg:w-[480px] xl:w-[540px] shrink-0 border-r border-outline-variant/15 p-6 space-y-6">
            <div className="h-10 w-64 animate-pulse rounded-xl bg-surface-container-low" />
            <div className="h-64 w-full animate-pulse rounded-2xl bg-surface-container-low" />
            <div className="h-48 w-full animate-pulse rounded-2xl bg-surface-container-low" />
          </div>
          <div className="hidden lg:flex flex-1 p-6 bg-surface-container-low/30">
            <div className="h-full w-full animate-pulse rounded-2xl bg-surface-container-low" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-builder-enter min-h-screen bg-background flex flex-col">
      <WidgetBuilderHeader />

      {/* Full-width Studio Split Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row w-full min-h-0">
        {/* Left Column: Configuration Controls (Scrollable) */}
        <div className="w-full lg:w-[420px] xl:w-[460px] 2xl:w-[480px] shrink-0 border-r border-outline-variant/15 p-6 lg:p-7 xl:p-8 overflow-y-auto pb-28 lg:pb-12 bg-background">
          {activeTab === 'aesthetics' && <AppearanceTab />}
          {activeTab === 'agents' && <AgentsTab />}
          {activeTab === 'behavior' && <BehaviorTab />}
          {activeTab === 'deploy' && <DeploymentTab />}
        </div>

        {/* Right Column: Full-Height Expansive Live Studio Canvas */}
        <main className="hidden lg:flex flex-1 min-w-0 bg-surface-container-low/20 p-3 xl:p-5 flex-col sticky top-[57px] h-[calc(100vh-57px)] overflow-hidden">
          <WidgetDevicePreview />
        </main>
      </div>

      {/* Floating Preview Trigger for Mobile & Small Tablets */}
      <div className="fixed bottom-6 right-6 z-40 lg:hidden">
        <button
          type="button"
          onClick={() => setShowMobilePreview(true)}
          className="flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-xs font-bold text-white shadow-xl transition-transform hover:scale-105 active:scale-95"
        >
          <Eye className="h-4 w-4" />
          <span>{t('widgetBuilder.devicePreviewTitle')}</span>
        </button>
      </div>

      {/* Mobile Preview Full-Screen Modal Drawer */}
      {showMobilePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md lg:hidden">
          <div className="relative h-[92vh] w-full max-w-lg overflow-hidden rounded-3xl bg-background p-3 shadow-2xl flex flex-col">
            <button
              type="button"
              onClick={() => setShowMobilePreview(false)}
              className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex-1 pt-1 h-full">
              <WidgetDevicePreview isMobileModal />
            </div>
          </div>
        </div>
      )}
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
