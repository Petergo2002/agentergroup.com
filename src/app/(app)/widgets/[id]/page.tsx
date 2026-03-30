'use client';

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
  const { isLoading, activeTab, summary } = useWidgetBuilder();

  if (isLoading || !summary) {
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
      
      <main className="mx-auto max-w-[1440px] px-6 py-10 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-12 lg:flex-row lg:items-start">
          
          {/* Configuration Column (Scrollable Content) */}
          <div className="flex-1 min-w-0">
            {activeTab === 'aesthetics' && <AppearanceTab />}
            {activeTab === 'agents' && <AgentsTab />}
            {activeTab === 'behavior' && <BehaviorTab />}
            {activeTab === 'deploy' && <DeploymentTab />}
          </div>

          {/* Persistent Preview Column (Sticky) */}
          <aside className="hidden w-[420px] shrink-0 lg:block">
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
