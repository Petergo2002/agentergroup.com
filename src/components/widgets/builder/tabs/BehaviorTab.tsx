'use client';

import { useWidgetBuilder } from '../WidgetBuilderContext';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { useAppContext } from '@/components/app/AppContext';

const fieldLabelClassName = 'text-xs font-semibold text-on-surface-variant';
const sectionDescClassName = 'max-w-2xl text-sm leading-relaxed text-on-surface-variant/70';
const inputFieldClassName = 'relative z-10 w-full rounded-xl border border-outline-variant/20 bg-background px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15 placeholder:text-on-surface-variant/35';

export function BehaviorTab() {
  const { t } = useLanguage();
  const { subscription } = useAppContext();
  const { form, setForm, isPrimaryMiloWidget } = useWidgetBuilder();

  if (!form) return null;

  const canHideBranding = subscription?.plan_tier === 'premium';
  const isBrandingVisible = canHideBranding ? form.showBranding : true;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Interaction Logic Section */}
      <section className="space-y-4">
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold font-headline tracking-tight">{t('widgetBuilder.behavior.interactionLogic')}</h2>
          <p className={sectionDescClassName}>
             {t('widgetBuilder.behavior.interactionDescription')}
          </p>
        </div>

        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
          <div className="grid gap-6">
            <label className="block space-y-3">
              <span className={fieldLabelClassName}>{t('widgetBuilder.behavior.primaryLanguage')}</span>
              <select
                 value={form.language}
                 onChange={(e) => setForm(c => c ? { ...c, language: e.target.value as 'en' | 'sv' } : c)}
                 className={inputFieldClassName}
              >
                <option value="en">{`${t('common.english')} (${t('common.defaultLabel')})`}</option>
                <option value="sv">Svenska</option>
              </select>
            </label>

            <div className="flex flex-col gap-4 rounded-[1.5rem] border border-outline-variant/10 bg-surface-container-low p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-bold text-on-surface">
                  {t('widgetBuilder.behavior.showBranding')}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-on-surface-variant/60">
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
                    current
                      ? { ...current, showBranding: !current.showBranding }
                      : current,
                  )
                }
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 ${
                  isBrandingVisible ? 'bg-primary' : 'bg-outline-variant/30'
                }`}
              >
                <span
                  className={`pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-background shadow-sm transition-transform ${
                    isBrandingVisible ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* The chooser copy is only relevant when a widget offers multiple specialists. */}
      {!isPrimaryMiloWidget ? <section className="space-y-4">
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold font-headline tracking-tight">{t('widgetBuilder.behavior.homeCopywriting')}</h2>
          <p className={sectionDescClassName}>
             {t('widgetBuilder.behavior.homeCopywritingDescription')}
          </p>
        </div>

        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
          <div className="grid gap-6">
            <label className="block space-y-3">
              <span className={fieldLabelClassName}>{t('widgetBuilder.behavior.homeTitle')}</span>
              <input
                 type="text"
                 value={form.homeTitle}
                 onChange={(e) => setForm(c => c ? { ...c, homeTitle: e.target.value } : c)}
                 placeholder={t('widgetBuilder.behavior.homeTitlePlaceholder')}
                 className={inputFieldClassName}
              />
            </label>
            <label className="block space-y-3">
              <span className={fieldLabelClassName}>{t('widgetBuilder.behavior.homeSubtitle')}</span>
              <textarea
                 value={form.homeSubtitle}
                 onChange={(e) => setForm(c => c ? { ...c, homeSubtitle: e.target.value } : c)}
                 className={`${inputFieldClassName} h-24 resize-none`}
                 placeholder={t('widgetBuilder.behavior.homeSubtitlePlaceholder')}
                 rows={4}
              />
            </label>
          </div>
        </div>
      </section> : null}
    </div>
  );
}
