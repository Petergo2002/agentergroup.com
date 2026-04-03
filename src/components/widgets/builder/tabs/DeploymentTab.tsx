'use client';

import { useState } from 'react';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { useWidgetBuilder } from '../WidgetBuilderContext';
import { useToast } from '@/components/ui/ToastProvider';

const fieldLabelClassName = 'text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50 ml-1';
const sectionDescClassName = 'text-sm text-on-surface-variant/60 leading-relaxed max-w-2xl';
const inputFieldClassName = 'w-full rounded-[14px] border border-outline-variant/10 bg-background px-5 py-3.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/20 placeholder:text-on-surface-variant/30';

export function DeploymentTab() {
  const { t } = useLanguage();
  const { summary, form, addOrigin, removeOrigin } = useWidgetBuilder();
  const { showToast } = useToast();
  const [localOriginInput, setLocalOriginInput] = useState('');

  if (!summary || !form) return null;

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(t('widgetBuilder.copySuccess', { label }), 'success');
    } catch {
      showToast(t('widgetBuilder.copyError', { label: label.toLowerCase() }), 'error');
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Embed Code Section */}
      <section className="space-y-6">
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold font-headline tracking-tight">{t('widgetBuilder.deployment.accessConnectivity')}</h2>
          <p className={sectionDescClassName}>
             {t('widgetBuilder.deployment.accessConnectivityDescription')}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
           {/* Embed Snippet */}
           <div className="rounded-[2.5rem] border border-outline-variant/10 bg-surface-container-lowest p-8 shadow-sm space-y-6">
             <div className="flex items-center justify-between">
                <span className={fieldLabelClassName}>{t('widgetBuilder.deployment.embedSnippet')}</span>
                <button 
                  onClick={() => handleCopy(summary.embedSnippet, t('widgetBuilder.deployment.embedSnippet'))}
                  className="rounded-full bg-on-surface px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-background transition-opacity hover:opacity-90"
                >
                   {t('common.copy')}
                </button>
             </div>
             <div className="relative overflow-hidden rounded-[1.6rem] border border-outline-variant/15 bg-slate-900 p-6">
               <pre className="overflow-x-auto text-[11px] leading-relaxed text-slate-300 font-mono">
                 {summary.embedSnippet}
               </pre>
               <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-slate-900 to-transparent" />
             </div>
             <p className="text-[10px] text-on-surface-variant/40 italic leading-relaxed">
                {t('widgetBuilder.deployment.embedDescription')}
             </p>
           </div>

           {/* Hosted Endpoint */}
           <div className="rounded-[2.5rem] border border-outline-variant/10 bg-surface-container-low p-8 space-y-6">
             <div className="flex items-center justify-between">
                <span className={fieldLabelClassName}>{t('widgetBuilder.deployment.hostedEndpoint')}</span>
                <button 
                   onClick={() => handleCopy(summary.hostedUrl, t('widgetBuilder.deployment.hostedEndpoint'))}
                   className="rounded-full bg-background/50 border border-outline-variant/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors hover:bg-on-surface hover:text-background"
                >
                   {t('widgetBuilder.deployment.copyLink')}
                </button>
             </div>
             <div className="rounded-[1.4rem] border border-outline-variant/10 bg-background px-6 py-4 truncate text-sm font-medium text-on-surface-variant/60">
                 {summary.hostedUrl}
             </div>
             <p className="text-[10px] text-on-surface-variant/40 italic leading-relaxed">
                {t('widgetBuilder.deployment.hostedDescription')}
             </p>
           </div>
        </div>
      </section>

      {/* Allowed Domains Section */}
      <section className="space-y-6 pt-6 border-t border-outline-variant/10">
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold font-headline tracking-tight">{t('widgetBuilder.deployment.securityDomainAccess')}</h2>
          <p className={sectionDescClassName}>
             {t('widgetBuilder.deployment.securityDomainAccessDescription')}
          </p>
        </div>

        <div className="rounded-[2.5rem] border border-outline-variant/10 bg-surface-container-lowest p-8 shadow-sm">
          <div className="space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row">
              <input
                 value={localOriginInput}
                 onChange={(e) => setLocalOriginInput(e.target.value)}
                 onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                       addOrigin(localOriginInput);
                       setLocalOriginInput('');
                    }
                 }}
                 placeholder={t('widgetBuilder.deployment.allowedOriginsPlaceholder')}
                 className={`${inputFieldClassName} flex-1`}
              />
              <button
                onClick={() => {
                   addOrigin(localOriginInput);
                   setLocalOriginInput('');
                }}
                className="shrink-0 rounded-full bg-on-surface px-8 py-3.5 text-xs font-bold uppercase tracking-[0.2em] text-background hover:scale-[1.02] transition-transform active:scale-95"
              >
                + {t('widgetBuilder.deployment.addDomain')}
              </button>
            </div>

            {form.originError && (
               <p className="text-xs font-bold text-error uppercase tracking-[0.1em] px-2">{form.originError}</p>
            )}

            <div className="space-y-3">
               <span className={fieldLabelClassName}>{t('widgetBuilder.deployment.authorizedDomainRegistry')}</span>
               {form.allowedOrigins.length > 0 ? (
                 <div className="grid gap-3 sm:grid-cols-2">
                   {form.allowedOrigins.map((origin, idx) => (
                     <div 
                        key={idx}
                        className="flex items-center justify-between rounded-full border border-outline-variant/10 bg-surface-container-low px-5 py-2.5 transition-all hover:border-primary/20"
                     >
                       <span className="truncate text-xs font-medium text-on-surface-variant/60">{origin}</span>
                       <button
                         onClick={() => removeOrigin(idx)}
                         className="h-6 w-6 rounded-full flex items-center justify-center text-on-surface-variant/30 hover:bg-error/10 hover:text-error transition-colors"
                       >
                          ×
                       </button>
                     </div>
                   ))}
                 </div>
               ) : (
                 <div className="py-12 flex flex-col items-center justify-center border border-dashed border-outline-variant/10 rounded-[2.5rem] bg-surface-container-low opacity-40">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em]">{t('widgetBuilder.deployment.noDomainRestrictions')}</p>
                    <p className="text-[9px] mt-1 text-center max-w-[200px]">{t('widgetBuilder.deployment.noDomainRestrictionsDescription')}</p>
                 </div>
               )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
