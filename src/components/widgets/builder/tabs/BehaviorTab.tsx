'use client';

import { useWidgetBuilder } from '../WidgetBuilderContext';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { useAppContext } from '@/components/app/AppContext';
import { Globe, ShieldCheck } from 'lucide-react';
import { PROACTIVE_MESSAGE_MAX_LENGTH } from '@/lib/widgets';

const fieldLabelClassName = 'text-xs font-bold text-on-surface';
const inputFieldClassName =
  'w-full rounded-xl border border-outline-variant/20 bg-background px-3.5 py-2.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15 placeholder:text-on-surface-variant/35';

export function BehaviorTab() {
  const { t } = useLanguage();
  const { subscription } = useAppContext();
  const { form, setForm, isPrimaryMiloWidget } = useWidgetBuilder();

  if (!form) return null;

  const canHideBranding = subscription?.plan_tier === 'premium';
  const isBrandingVisible = canHideBranding ? form.showBranding : true;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Interaction Logic Section */}
      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-base font-bold font-headline tracking-tight text-on-surface">
            {t('widgetBuilder.behavior.interactionLogic')}
          </h2>
          <p className="text-xs text-on-surface-variant/70">
            {t('widgetBuilder.behavior.interactionDescription')}
          </p>
        </div>

        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-xs space-y-5">
          {/* Primary Language */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-on-surface-variant/60" />
              <span className={fieldLabelClassName}>{t('widgetBuilder.behavior.primaryLanguage')}</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setForm((c) => (c ? { ...c, language: 'en' } : c))}
                className={`flex items-center justify-between rounded-xl border p-3.5 text-left transition-all ${
                  form.language === 'en'
                    ? 'border-primary bg-primary/[0.04] ring-1 ring-primary/20'
                    : 'border-outline-variant/15 bg-surface-container-low hover:border-outline-variant/30 hover:bg-surface-container'
                }`}
              >
                <div>
                  <p className="text-xs font-bold text-on-surface">English</p>
                  <p className="text-[11px] text-on-surface-variant/60">{t('common.defaultLabel')}</p>
                </div>
                <span className="text-sm">🇬🇧</span>
              </button>

              <button
                type="button"
                onClick={() => setForm((c) => (c ? { ...c, language: 'sv' } : c))}
                className={`flex items-center justify-between rounded-xl border p-3.5 text-left transition-all ${
                  form.language === 'sv'
                    ? 'border-primary bg-primary/[0.04] ring-1 ring-primary/20'
                    : 'border-outline-variant/15 bg-surface-container-low hover:border-outline-variant/30 hover:bg-surface-container'
                }`}
              >
                <div>
                  <p className="text-xs font-bold text-on-surface">Svenska</p>
                  <p className="text-[11px] text-on-surface-variant/60">Swedish</p>
                </div>
                <span className="text-sm">🇸🇪</span>
              </button>
            </div>
          </div>

          <div className="h-px bg-outline-variant/10" />

          {/* Show Branding Toggle */}
          <div className="flex flex-col gap-4 rounded-xl border border-outline-variant/15 bg-surface-container-low/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-on-surface">
                  {t('widgetBuilder.behavior.showBranding')}
                </span>
                {canHideBranding && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-600">
                    <ShieldCheck className="h-3 w-3" />
                    Pro Plan
                  </span>
                )}
              </div>
              <p className="text-[11px] leading-relaxed text-on-surface-variant/65">
                {canHideBranding
                  ? t('widgetBuilder.behavior.brandingDescription')
                  : t('widgetBuilder.behavior.brandingPremiumDescription')}
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={isBrandingVisible}
              disabled={!canHideBranding}
              onClick={() =>
                setForm((current) =>
                  current ? { ...current, showBranding: !current.showBranding } : current,
                )
              }
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50 ${
                isBrandingVisible ? 'bg-primary' : 'bg-outline-variant/40'
              }`}
            >
              <span
                className={`pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                  isBrandingVisible ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Proactive attention message */}
      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-base font-bold font-headline tracking-tight text-on-surface">
            {t('widgetBuilder.behavior.proactiveTitle')}
          </h2>
          <p className="text-xs text-on-surface-variant/70">
            {t('widgetBuilder.behavior.proactiveDescription')}
          </p>
        </div>

        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-on-surface">
                {t('widgetBuilder.behavior.proactiveEnabled')}
              </span>
              <p className="text-[11px] leading-relaxed text-on-surface-variant/65">
                {t('widgetBuilder.behavior.proactiveEnabledDescription')}
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={form.proactiveEnabled}
              onClick={() =>
                setForm((current) =>
                  current
                    ? { ...current, proactiveEnabled: !current.proactiveEnabled }
                    : current,
                )
              }
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                form.proactiveEnabled ? 'bg-primary' : 'bg-outline-variant/40'
              }`}
            >
              <span
                className={`pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                  form.proactiveEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {form.proactiveEnabled && (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className={fieldLabelClassName}>
                  {t('widgetBuilder.behavior.proactiveMessage')}
                </span>
                <span className="text-[10px] tabular-nums text-on-surface-variant/60">
                  {form.proactiveMessage.length}/{PROACTIVE_MESSAGE_MAX_LENGTH}
                </span>
              </div>
              <textarea
                value={form.proactiveMessage}
                maxLength={PROACTIVE_MESSAGE_MAX_LENGTH}
                onChange={(e) =>
                  setForm((c) => (c ? { ...c, proactiveMessage: e.target.value } : c))
                }
                placeholder={t('widgetBuilder.behavior.proactiveMessagePlaceholder')}
                className={`${inputFieldClassName} h-20 resize-none`}
                rows={3}
              />
            </div>
          )}
        </div>
      </section>

      {/* Copywriting Section for Multi-agent Widgets */}
      {!isPrimaryMiloWidget && (
        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-base font-bold font-headline tracking-tight text-on-surface">
              {t('widgetBuilder.behavior.homeCopywriting')}
            </h2>
            <p className="text-xs text-on-surface-variant/70">
              {t('widgetBuilder.behavior.homeCopywritingDescription')}
            </p>
          </div>

          <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-xs space-y-4">
            <div className="space-y-2">
              <span className={fieldLabelClassName}>{t('widgetBuilder.behavior.homeTitle')}</span>
              <input
                type="text"
                value={form.homeTitle}
                onChange={(e) => setForm((c) => (c ? { ...c, homeTitle: e.target.value } : c))}
                placeholder={t('widgetBuilder.behavior.homeTitlePlaceholder')}
                className={inputFieldClassName}
              />
            </div>

            <div className="space-y-2">
              <span className={fieldLabelClassName}>{t('widgetBuilder.behavior.homeSubtitle')}</span>
              <textarea
                value={form.homeSubtitle}
                onChange={(e) => setForm((c) => (c ? { ...c, homeSubtitle: e.target.value } : c))}
                className={`${inputFieldClassName} h-20 resize-none`}
                placeholder={t('widgetBuilder.behavior.homeSubtitlePlaceholder')}
                rows={3}
              />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
