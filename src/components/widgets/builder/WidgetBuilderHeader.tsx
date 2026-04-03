'use client';

import Link from 'next/link';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { useWidgetBuilder, type WidgetBuilderTab } from './WidgetBuilderContext';

export function WidgetBuilderHeader() {
  const { t } = useLanguage();
  const { summary, activeTab, setActiveTab, isSaving, isUpdatingDeployment, persistWidget, updateWidgetDeployment } = useWidgetBuilder();

  if (!summary) return null;

  const isDeployed = summary.widget.status === 'deployed';
  const needsRedeploy = summary.needsRedeploy;
  const tabs: { id: WidgetBuilderTab; label: string }[] = [
    { id: 'aesthetics', label: t('widgetBuilder.tabs.aesthetics') },
    { id: 'agents', label: t('widgetBuilder.tabs.specialists') },
    { id: 'behavior', label: t('widgetBuilder.tabs.behavior') },
    { id: 'deploy', label: t('widgetBuilder.tabs.deployment') },
  ];

  return (
    <div className="sticky top-0 z-30 border-b border-outline-variant/10 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto max-w-[1440px] px-6 py-4 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          {/* Breadcrumbs & Title */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">
              <Link href="/widgets" className="transition-colors hover:text-on-surface">
                {t('widgetBuilder.widgetRegistry')}
              </Link>
              <span>/</span>
              <span className="truncate text-on-surface-variant/80">{summary.widget.name}</span>
            </div>
            <div className="mt-3 flex items-center gap-4">
              <h1 className="text-2xl font-headline font-bold tracking-tight text-on-surface">
                {summary.widget.name}
              </h1>
              <div className="flex items-center gap-1.5 rounded-full bg-surface-container-low px-3 py-1 ring-1 ring-inset ring-outline-variant/10">
                <span className={`h-1.5 w-1.5 rounded-full ${isDeployed ? 'bg-primary' : 'bg-on-surface-variant/30'} shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]`} />
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/80">
                  {isDeployed ? (needsRedeploy ? t('widgetBuilder.needsSync') : t('common.live')) : t('common.draft')}
                </span>
              </div>
            </div>
          </div>

          {/* Global Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => void persistWidget()}
              disabled={isSaving || isUpdatingDeployment}
              className="rounded-full border border-outline-variant/15 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant transition-all hover:border-on-surface/15 hover:text-on-surface disabled:opacity-40"
            >
              {isSaving ? t('common.saving') : t('agentBuilder.saveDraft')}
            </button>
            <button
              onClick={() => void updateWidgetDeployment(isDeployed ? 'draft' : 'deployed')}
              disabled={isUpdatingDeployment || isSaving}
              className="group relative flex items-center gap-2 overflow-hidden rounded-full bg-on-surface px-6 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-background transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
            >
              <span className="relative z-10">
                {isUpdatingDeployment
                  ? t('widgetBuilder.processing')
                  : isDeployed
                    ? t('widgetBuilder.takeOffline')
                    : t('widgetBuilder.goLive')}
              </span>
              {!isUpdatingDeployment && !isDeployed && (
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
              )}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-8 flex items-center gap-8 border-t border-outline-variant/10 pt-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative pb-4 text-xs font-bold uppercase tracking-[0.2em] transition-colors ${
                activeTab === tab.id
                  ? 'text-on-surface'
                  : 'text-on-surface-variant/50 hover:text-on-surface-variant'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 h-0.5 w-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
