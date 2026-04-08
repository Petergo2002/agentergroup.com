'use client';

import { useWidgetBuilder } from '../WidgetBuilderContext';
import { useLanguage } from '@/components/i18n/LanguageProvider';

const fieldLabelClassName = 'text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50 ml-1';
const sectionDescClassName = 'text-sm text-on-surface-variant/60 leading-relaxed max-w-2xl';
const inputFieldClassName = 'relative z-10 w-full rounded-[14px] border border-outline-variant/10 bg-background px-5 py-3.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/20 placeholder:text-on-surface-variant/30';

export function BehaviorTab() {
  const { t } = useLanguage();
  const { form, setForm } = useWidgetBuilder();

  if (!form) return null;

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Interaction Logic Section */}
      <section className="space-y-6">
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold font-headline tracking-tight">{t('widgetBuilder.behavior.interactionLogic')}</h2>
          <p className={sectionDescClassName}>
             {t('widgetBuilder.behavior.interactionDescription')}
          </p>
        </div>

        <div className="rounded-[2.5rem] border border-outline-variant/10 bg-surface-container-lowest p-8 shadow-sm">
          <div className="grid gap-8 md:grid-cols-2">
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

            <div className="flex items-center justify-between p-6 bg-surface-container-low rounded-[1.8rem] border border-outline-variant/10">
              <div className="space-y-1">
                <span className={fieldLabelClassName}>{t('widgetBuilder.behavior.showBranding')}</span>
                <p className="text-[10px] text-on-surface-variant/40 uppercase tracking-[0.05em] font-medium">{t('widgetBuilder.behavior.brandingDescription')}</p>
              </div>
              <button
                onClick={() => setForm(c => c ? { ...c, showBranding: !form.showBranding } : c)}
                className={`relative h-6 w-11 rounded-full p-1 transition-colors ${form.showBranding ? 'bg-primary' : 'bg-on-surface-variant/20'}`}
              >
                <div className={`h-4 w-4 rounded-full bg-background transition-transform ${form.showBranding ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Copywriting Section */}
      <section className="space-y-6">
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold font-headline tracking-tight">{t('widgetBuilder.behavior.homeCopywriting')}</h2>
          <p className={sectionDescClassName}>
             {t('widgetBuilder.behavior.homeCopywritingDescription')}
          </p>
        </div>

        <div className="rounded-[2.5rem] border border-outline-variant/10 bg-surface-container-lowest p-8 shadow-sm">
          <div className="grid gap-8">
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
      </section>
    </div>
  );
}
