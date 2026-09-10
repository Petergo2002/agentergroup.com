'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Bot,
  Check,
  Palette,
  Pencil,
  Power,
  RefreshCw,
  Rocket,
  Save,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { useWidgetBuilder, type WidgetBuilderTab } from './WidgetBuilderContext';

export function WidgetBuilderHeader() {
  const { t } = useLanguage();
  const {
    summary,
    form,
    setForm,
    activeTab,
    setActiveTab,
    isSaving,
    isUpdatingDeployment,
    persistWidget,
    updateWidgetDeployment,
    isPrimaryMiloWidget,
  } = useWidgetBuilder();

  // Local state for the inline name editor
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  if (!summary) return null;

  const isDeployed = summary.widget.status === 'deployed';
  const needsRedeploy = summary.needsRedeploy;

  const tabs: { id: WidgetBuilderTab; label: string; icon: React.ElementType }[] = [
    {
      id: 'aesthetics',
      label: isPrimaryMiloWidget ? t('widgetBuilder.tabs.appearance') : t('widgetBuilder.tabs.aesthetics'),
      icon: Palette,
    },
    {
      id: 'agents',
      label: isPrimaryMiloWidget ? t('widgetBuilder.tabs.miloChat') : t('widgetBuilder.tabs.specialists'),
      icon: isPrimaryMiloWidget ? Sparkles : Bot,
    },
    {
      id: 'behavior',
      label: t('widgetBuilder.tabs.behavior'),
      icon: SlidersHorizontal,
    },
    {
      id: 'deploy',
      label: isPrimaryMiloWidget ? t('widgetBuilder.tabs.publish') : t('widgetBuilder.tabs.deployment'),
      icon: Rocket,
    },
  ];

  /** Opens the inline name editor and pre-fills with current form name */
  const startEditing = () => {
    setNameDraft(form?.name ?? summary.widget.name);
    setIsEditingName(true);
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
    <div className="sticky top-0 z-30 border-b border-outline-variant/15 bg-background/90 backdrop-blur-xl">
      <div className="flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Left: Back button + Name + Live Badge */}
        <div className="flex min-w-0 items-center gap-3 shrink-0">
          {isPrimaryMiloWidget ? (
            <Link
              href="/dashboard"
              aria-label={t('common.back')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-outline-variant/20 bg-surface-container-lowest text-on-surface-variant transition-all hover:bg-surface-container hover:text-on-surface active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : (
            <Link
              href="/widgets"
              aria-label={t('common.back')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-outline-variant/20 bg-surface-container-lowest text-on-surface-variant transition-all hover:bg-surface-container hover:text-on-surface active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}

          <div className="flex items-center gap-2.5 min-w-0">
            {isEditingName && !isPrimaryMiloWidget ? (
              <div className="flex items-center gap-1.5">
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
                  className="rounded-lg border border-primary bg-background px-2.5 py-1 text-sm font-headline font-bold text-on-surface outline-none ring-2 ring-primary/20"
                  style={{ minWidth: '12ch', width: `${Math.max(12, nameDraft.length + 2)}ch` }}
                />
                <button
                  type="button"
                  onClick={commitName}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-outline-variant/20 bg-surface-container-low text-on-surface-variant"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : isPrimaryMiloWidget ? (
              <h1 className="text-base font-headline font-extrabold tracking-tight text-on-surface sm:text-lg">
                {t('widgetBuilder.websiteChat')}
              </h1>
            ) : (
              <button
                type="button"
                onClick={startEditing}
                title="Click to rename"
                className="group flex items-center gap-2 rounded-lg px-1 py-0.5 -mx-1 text-left transition-colors hover:bg-surface-container-low"
              >
                <h1 className="truncate text-base font-headline font-extrabold tracking-tight text-on-surface sm:text-lg">
                  {displayName}
                </h1>
                <Pencil className="h-3.5 w-3.5 text-on-surface-variant/40 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            )}

            {/* Status Indicator Pill */}
            <div className="flex items-center gap-1.5 rounded-full border border-outline-variant/20 bg-surface-container-low px-2.5 py-0.5 shadow-2xs">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isDeployed ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-on-surface-variant/40'
                }`}
              />
              <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">
                {isDeployed
                  ? needsRedeploy
                    ? t('widgetBuilder.needsSync')
                    : t('common.live')
                  : t('common.draft')}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Clean Segmented Tab Navigation Bar */}
        <div className="hidden md:flex items-center gap-1 rounded-xl border border-outline-variant/15 bg-surface-container-low/70 p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  isActive
                    ? 'border border-outline-variant/20 bg-background text-on-surface shadow-xs font-bold'
                    : 'text-on-surface-variant/65 hover:bg-background/50 hover:text-on-surface'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-primary' : 'text-on-surface-variant/50'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Studio Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Save Draft */}
          <button
            onClick={() => void persistWidget()}
            disabled={isSaving || isUpdatingDeployment}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-3.5 text-xs font-semibold text-on-surface transition-all hover:bg-surface-container hover:border-outline-variant/35 active:scale-98 disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isSaving ? t('common.saving') : t('agentBuilder.saveDraft')}</span>
          </button>

          {/* Sync Changes */}
          {isDeployed && needsRedeploy && (
            <button
              onClick={() => void updateWidgetDeployment('deployed')}
              disabled={isUpdatingDeployment || isSaving}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 text-xs font-bold text-white shadow-xs transition-all hover:brightness-105 active:scale-98 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isUpdatingDeployment ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>{isUpdatingDeployment ? t('widgetBuilder.syncing') : t('widgetBuilder.syncChanges')}</span>
            </button>
          )}

          {/* Go Live / Take Offline */}
          <button
            onClick={() => void updateWidgetDeployment(isDeployed ? 'draft' : 'deployed')}
            disabled={isUpdatingDeployment || isSaving}
            className={`inline-flex h-9 items-center gap-2 rounded-xl px-4 text-xs font-bold transition-all active:scale-98 disabled:opacity-50 ${
              isDeployed
                ? 'border border-red-500/20 bg-red-500/5 text-red-600 hover:bg-red-500/10'
                : 'bg-primary text-white shadow-xs hover:brightness-105'
            }`}
          >
            {isDeployed ? (
              <Power className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Rocket className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>
              {isUpdatingDeployment && (!isDeployed || !needsRedeploy)
                ? t('widgetBuilder.processing')
                : isDeployed
                  ? t('widgetBuilder.takeOffline')
                  : t('widgetBuilder.goLive')}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Tab Bar (only visible on mobile screens) */}
      <div className="flex md:hidden w-full items-center gap-1 overflow-x-auto border-t border-outline-variant/10 bg-surface-container-low/60 px-4 py-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                isActive
                  ? 'border border-outline-variant/20 bg-background text-on-surface shadow-xs font-bold'
                  : 'text-on-surface-variant/65 hover:bg-background/50'
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-primary' : 'text-on-surface-variant/50'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
