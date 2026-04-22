'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { useWidgetBuilder, type WidgetBuilderTab } from './WidgetBuilderContext';

export function WidgetBuilderHeader() {
  const { t } = useLanguage();
  const { summary, form, setForm, activeTab, setActiveTab, isSaving, isUpdatingDeployment, persistWidget, updateWidgetDeployment } = useWidgetBuilder();

  // Local state for the inline name editor
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  if (!summary) return null;

  const isDeployed = summary.widget.status === 'deployed';
  const needsRedeploy = summary.needsRedeploy;
  const tabs: { id: WidgetBuilderTab; label: string }[] = [
    { id: 'aesthetics', label: t('widgetBuilder.tabs.aesthetics') },
    { id: 'agents', label: t('widgetBuilder.tabs.specialists') },
    { id: 'behavior', label: t('widgetBuilder.tabs.behavior') },
    { id: 'deploy', label: t('widgetBuilder.tabs.deployment') },
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
              <span className="truncate text-on-surface-variant/80">{displayName}</span>
            </div>
            <div className="mt-3 flex items-center gap-4">
              {/* Inline-editable widget name */}
              {isEditingName ? (
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
                    className="rounded-md bg-primary px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-background transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
              ) : (
                <button
                  type="button"
                  onClick={startEditing}
                  title="Click to rename"
                  className="group flex items-center gap-2 rounded-md px-1 py-0.5 -mx-1 transition-all duration-150 hover:bg-surface-container-low active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <h1 className="text-2xl font-headline font-bold tracking-tight text-on-surface">
                    {displayName}
                  </h1>
                  {/* Pencil icon — visible on hover */}
                  <span className="opacity-0 text-sm text-on-surface-variant/40 transition-opacity group-hover:opacity-100" aria-hidden>
                    ✏️
                  </span>
                </button>
              )}

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
              className="rounded-md border border-outline-variant/20 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant transition-all duration-150 hover:bg-on-surface/5 hover:text-on-surface active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-40"
            >
              {isSaving ? t('common.saving') : t('agentBuilder.saveDraft')}
            </button>

            {isDeployed && needsRedeploy && (
              <button
                onClick={() => void updateWidgetDeployment('deployed')}
                disabled={isUpdatingDeployment || isSaving}
                className="group relative flex items-center gap-2 overflow-hidden rounded-md bg-primary px-6 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-background transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
              >
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
              className={`group relative flex items-center gap-2 overflow-hidden rounded-md px-6 py-2.5 text-xs font-bold uppercase tracking-[0.16em] transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 ${
                isDeployed 
                  ? 'border border-outline-variant/20 text-on-surface-variant hover:bg-on-surface/5 hover:text-on-surface' 
                  : 'bg-on-surface text-background'
              }`}
            >
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
        <div className="mt-8 flex items-center gap-8 border-t border-outline-variant/10 pt-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative pb-4 text-xs font-bold uppercase tracking-[0.2em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm ${
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
