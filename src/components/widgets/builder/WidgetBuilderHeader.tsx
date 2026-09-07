'use client';

import Link from 'next/link';
import { ArrowLeft, Power, RefreshCw, Rocket, Save } from 'lucide-react';
import { useRef, useState } from 'react';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { useWidgetBuilder, type WidgetBuilderTab } from './WidgetBuilderContext';

export function WidgetBuilderHeader() {
  const { t } = useLanguage();
  const { summary, form, setForm, activeTab, setActiveTab, isSaving, isUpdatingDeployment, persistWidget, updateWidgetDeployment, isPrimaryMiloWidget } = useWidgetBuilder();

  // Local state for the inline name editor
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  if (!summary) return null;

  const isDeployed = summary.widget.status === 'deployed';
  const needsRedeploy = summary.needsRedeploy;
  const tabs: { id: WidgetBuilderTab; label: string }[] = [
    { id: 'aesthetics', label: isPrimaryMiloWidget ? t('widgetBuilder.tabs.appearance') : t('widgetBuilder.tabs.aesthetics') },
    { id: 'agents', label: isPrimaryMiloWidget ? t('widgetBuilder.tabs.miloChat') : t('widgetBuilder.tabs.specialists') },
    { id: 'behavior', label: t('widgetBuilder.tabs.behavior') },
    { id: 'deploy', label: isPrimaryMiloWidget ? t('widgetBuilder.tabs.publish') : t('widgetBuilder.tabs.deployment') },
  ];

  /** Opens the inline name editor and pre-fills with current form name */
  const startEditing = () => {
    setNameDraft(form?.name ?? summary.widget.name);
    setIsEditingName(true);
    // Focus the input on the next paint
    setTimeout(() => nameInputRef.current?.focus(), 30);
  };

  /** Commits the name change to the form state and exits edit mode */
  const commitName = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== (form?.name ?? summary.widget.name)) {
      setForm((current) => (current ? { ...current, name: trimmed } : current));
    }
    setIsEditingName(false);
  };

  /** Cancels the rename without saving */
  const cancelEdit = () => {
    setIsEditingName(false);
  };

  const displayName = form?.name ?? summary.widget.name;

  return (
    <div className="sticky top-0 z-30 border-b border-outline-variant/15 bg-background/95 backdrop-blur-xl">
      <div className="mx-auto max-w-[1320px] px-5 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Breadcrumbs & Title */}
          <div className="flex min-w-0 items-start gap-3">
            {isPrimaryMiloWidget ? (
              <Link
                href="/dashboard"
                aria-label={t('common.back')}
                className="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-outline-variant/20 bg-background px-3 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span className="hidden md:inline">{t('common.back')}</span>
              </Link>
            ) : null}
            <div className="min-w-0">
              {!isPrimaryMiloWidget ? (
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">
                  <Link href="/widgets" className="transition-colors hover:text-on-surface">
                    {t('widgetBuilder.widgetRegistry')}
                  </Link>
                  <span>/</span>
                  <span className="truncate text-on-surface-variant/80">{displayName}</span>
                </div>
              ) : null}
              <div className={`${isPrimaryMiloWidget ? 'mt-0' : 'mt-2'} flex flex-wrap items-center gap-3`}>
                {/* Inline-editable widget name */}
                {isEditingName && !isPrimaryMiloWidget ? (
                  <div className="flex items-center gap-2">
                    <input
                      ref={nameInputRef}
                      id="widget-name-inline-input"
                      type="text"
                      value={nameDraft}
                      maxLength={80}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitName();
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      onBlur={commitName}
                      className="rounded-md border border-primary bg-background px-3 py-1.5 text-xl font-headline font-bold tracking-tight text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      style={{ minWidth: '12ch', width: `${Math.max(12, nameDraft.length + 2)}ch` }}
                    />
                    <button
                      type="button"
                      onClick={commitName}
                      className="app-primary-surface rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded-md border border-outline-variant/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant transition-all duration-150 hover:text-on-surface hover:bg-on-surface/5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      ✕
                    </button>
                  </div>
                ) : isPrimaryMiloWidget ? (
                  <h1 className="text-xl font-headline font-bold tracking-tight text-on-surface">
                    {t('widgetBuilder.websiteChat')}
                  </h1>
                ) : (
                  <button
                    type="button"
                    onClick={startEditing}
                    title="Click to rename"
                    className="group flex items-center gap-2 rounded-md px-1 py-0.5 -mx-1 transition-all duration-150 hover:bg-surface-container-low active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <h1 className="text-xl font-headline font-bold tracking-tight text-on-surface">
                      {displayName}
                    </h1>
                    {/* Pencil icon — visible on hover */}
                    <span className="opacity-0 text-sm text-on-surface-variant/40 transition-opacity group-hover:opacity-100" aria-hidden>
                      ✏️
                    </span>
                  </button>
                )}

                <div className="flex items-center gap-1.5 rounded-full bg-surface-container-low px-2.5 py-1 ring-1 ring-inset ring-outline-variant/15">
                  <span className={`h-1.5 w-1.5 rounded-full ${isDeployed ? 'bg-primary' : 'bg-on-surface-variant/30'} shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]`} />
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/80">
                    {isDeployed ? (needsRedeploy ? t('widgetBuilder.needsSync') : t('common.live')) : t('common.draft')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Global Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => void persistWidget()}
              disabled={isSaving || isUpdatingDeployment}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-outline-variant/20 bg-background px-3.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-low active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-40"
            >
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              {isSaving ? t('common.saving') : t('agentBuilder.saveDraft')}
            </button>

            {isDeployed && needsRedeploy && (
              <button
                onClick={() => void updateWidgetDeployment('deployed')}
                disabled={isUpdatingDeployment || isSaving}
                className="app-primary-surface group relative flex h-9 items-center gap-2 overflow-hidden rounded-lg px-4 text-sm font-semibold transition-all duration-150 hover:scale-[1.01] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
              >
                <RefreshCw className={`relative z-10 h-3.5 w-3.5 ${isUpdatingDeployment ? 'animate-spin' : ''}`} aria-hidden="true" />
                <span className="relative z-10">
                  {isUpdatingDeployment ? t('widgetBuilder.syncing') : t('widgetBuilder.syncChanges')}
                </span>
                {!isUpdatingDeployment && (
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
                )}
              </button>
            )}

            <button
              onClick={() => void updateWidgetDeployment(isDeployed ? 'draft' : 'deployed')}
              disabled={isUpdatingDeployment || isSaving}
              className={`group relative flex h-9 items-center gap-2 overflow-hidden rounded-lg px-4 text-sm font-semibold transition-all duration-150 hover:scale-[1.01] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 ${
                isDeployed
                  ? 'border border-error/20 bg-background text-error hover:bg-error/5'
                  : 'app-primary-surface'
              }`}
            >
              {isDeployed ? (
                <Power className="relative z-10 h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Rocket className="relative z-10 h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span className="relative z-10">
                {isUpdatingDeployment && (!isDeployed || !needsRedeploy)
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
        <div className="mt-3 flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-surface-container-low p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative shrink-0 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                activeTab === tab.id
                  ? 'bg-background text-on-surface shadow-sm'
                  : 'text-on-surface-variant/60 hover:bg-background/60 hover:text-on-surface'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
