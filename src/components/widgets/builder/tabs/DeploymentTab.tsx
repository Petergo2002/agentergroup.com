'use client';

import { useState } from 'react';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { StatusToggle } from '@/components/ui/StatusToggle';
import { ExternalLink, Copy, CheckCircle2 } from 'lucide-react';
import { useWidgetBuilder } from '../WidgetBuilderContext';
import { useToast } from '@/components/ui/ToastProvider';

const fieldLabelClassName = 'text-xs font-semibold text-on-surface-variant';
const sectionDescClassName = 'max-w-2xl text-sm leading-relaxed text-on-surface-variant/70';
const inputFieldClassName = 'h-11 w-full rounded-xl border border-outline-variant/20 bg-background px-4 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15 placeholder:text-on-surface-variant/35';

export function DeploymentTab() {
  const { t } = useLanguage();
  const { summary, form, addOrigin, removeOrigin, setForm, isSaving, isUpdatingDeployment } = useWidgetBuilder();
  const { showToast } = useToast();
  const [localOriginInput, setLocalOriginInput] = useState('');
  const [isSnippetCopied, setIsSnippetCopied] = useState(false);

  if (!summary || !form) return null;

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setIsSnippetCopied(true);
      showToast(t('widgetBuilder.copySuccess', { label }), 'success');
      setTimeout(() => setIsSnippetCopied(false), 2000);
    } catch {
      showToast(t('widgetBuilder.copyError', { label: label.toLowerCase() }), 'error');
    }
  };

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Embed Code Section */}
      <section className="space-y-4">
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold font-headline tracking-tight">{t('widgetBuilder.deployment.accessConnectivity')}</h2>
          <p className={sectionDescClassName}>
             {t('widgetBuilder.deployment.accessConnectivityDescription')}
          </p>
        </div>

        <div className="flex flex-col gap-6">
           {/* Embed Snippet */}
           <div className="space-y-4 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
             <div className="flex items-center justify-between">
                <span className={fieldLabelClassName}>{t('widgetBuilder.deployment.embedSnippet')}</span>
                <span className="rounded-md bg-surface-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/60">
                  Script Tag
                </span>
             </div>

             <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-md">
               <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/90 px-4 py-2 text-[11px] font-mono text-slate-400">
                 <span className="flex items-center gap-2">
                   <span className="h-2 w-2 rounded-full bg-orange-500" />
                   HTML / JavaScript Embed
                 </span>
                 <button
                   onClick={() => void handleCopy(summary.embedSnippet, t('widgetBuilder.deployment.embedSnippet'))}
                   className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1 text-[11px] font-semibold text-slate-200 transition-colors hover:bg-slate-700 active:scale-95"
                 >
                   {isSnippetCopied ? (
                     <>
                       <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 animate-in zoom-in-75" />
                       Copied!
                     </>
                   ) : (
                     <>
                       <Copy className="h-3.5 w-3.5 text-slate-400" />
                       Copy Snippet
                     </>
                   )}
                 </button>
               </div>
               <div className="p-5 overflow-x-auto">
                 <pre className="text-[11.5px] leading-relaxed text-slate-300 font-mono">
                   {summary.embedSnippet}
                 </pre>
               </div>
             </div>
             <p className="text-[10px] text-on-surface-variant/40 italic leading-relaxed">
                {t('widgetBuilder.deployment.embedDescription')}
             </p>
           </div>

           {/* Hosted Endpoint */}
           <div className="space-y-6 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
             <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <StatusToggle
                    checked={form.hostedEnabled}
                    onClick={() =>
                      setForm((current) =>
                        current
                          ? { ...current, hostedEnabled: !current.hostedEnabled }
                          : current,
                      )
                    }
                    disabled={isSaving || isUpdatingDeployment}
                    label={t('widgetBuilder.deployment.hostedAccess')}
                  />
                  <div className="min-w-0">
                    <span className={fieldLabelClassName}>{t('widgetBuilder.deployment.hostedEndpoint')}</span>
                    <p className="text-sm font-semibold text-on-surface">
                      {form.hostedEnabled
                        ? t('widgetBuilder.deployment.hostedEnabledTitle')
                        : t('widgetBuilder.deployment.hostedDisabledTitle')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={form.hostedEnabled ? summary.hostedUrl : undefined}
                    target="_blank"
                    rel="noreferrer"
                    aria-disabled={!form.hostedEnabled}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all active:scale-95 ring-1 ${
                      form.hostedEnabled
                        ? 'bg-on-surface/5 text-on-surface hover:bg-on-surface/10 ring-on-surface/10'
                        : 'pointer-events-none bg-on-surface/2 text-on-surface-variant/30 ring-on-surface/5'
                    }`}
                  >
                    <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.5} />
                    {t('common.open')}
                  </a>
                  <button
                     onClick={() => handleCopy(summary.hostedUrl, t('widgetBuilder.deployment.hostedEndpoint'))}
                     className="inline-flex items-center gap-2 rounded-xl bg-on-surface/5 px-4 py-2 text-xs font-semibold text-on-surface transition-all hover:bg-on-surface/10 active:scale-95 ring-1 ring-on-surface/10"
                  >
                     <Copy className="h-3.5 w-3.5" strokeWidth={2.5} />
                     {t('widgetBuilder.deployment.copyLink')}
                  </button>
                </div>
             </div>

             <div className="space-y-4">
               <div className={`flex items-center justify-between gap-4 rounded-xl border px-5 py-3.5 transition-all ${
                 form.hostedEnabled
                   ? 'border-outline-variant/15 bg-background shadow-inner'
                   : 'border-outline-variant/5 bg-background/40 opacity-50'
               }`}>
                 <code className="truncate text-xs font-medium text-on-surface-variant font-mono">
                   {summary.hostedUrl}
                 </code>
               </div>

               <div className="max-w-xl">
                 <p className="text-[11px] text-on-surface-variant/50 leading-relaxed italic">
                    {t('widgetBuilder.deployment.hostedDescription')}
                 </p>
                 <p className="text-[10px] mt-1 font-bold uppercase tracking-[0.12em] text-primary/50">
                    {t('widgetBuilder.deployment.hostedSaveHint')}
                 </p>
               </div>
             </div>
           </div>
        </div>
      </section>

      {/* Allowed Domains Section */}
      <section className="space-y-4 border-t border-outline-variant/10 pt-6">
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold font-headline tracking-tight">{t('widgetBuilder.deployment.securityDomainAccess')}</h2>
          <p className={sectionDescClassName}>
             {t('widgetBuilder.deployment.securityDomainAccessDescription')}
          </p>
        </div>

        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
          <div className="space-y-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <label className={fieldLabelClassName}>{t('widgetBuilder.deployment.addDomain')}</label>
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
                   className={inputFieldClassName}
                />
              </div>
              <button
                onClick={() => {
                   addOrigin(localOriginInput);
                   setLocalOriginInput('');
                }}
                className="app-primary-button h-[52px] shrink-0 rounded-[14px] px-8"
              >
                {t('widgetBuilder.deployment.addDomain')}
              </button>
            </div>

            {form.originError && (
               <p className="text-[10px] font-bold text-error uppercase tracking-[0.1em] px-2 -mt-6 animate-pulse">{form.originError}</p>
            )}

            <div className="space-y-4">
               <div className="flex items-center justify-between px-2">
                 <span className={fieldLabelClassName}>{t('widgetBuilder.deployment.authorizedDomainRegistry')}</span>
                 {form.allowedOrigins.length > 0 && (
                   <span className="text-[10px] font-bold text-on-surface-variant/30 uppercase tracking-widest">
                     {form.allowedOrigins.length} {t('common.active')}
                   </span>
                 )}
               </div>

               {form.allowedOrigins.length > 0 ? (
                 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                   {form.allowedOrigins.map((origin, idx) => (
                     <div
                        key={idx}
                        className="flex items-center justify-between rounded-xl border border-outline-variant/10 bg-surface-container-low/50 px-4 py-3 group hover:border-primary/30 transition-all hover:bg-surface-container-low"
                     >
                       <span className="truncate text-xs font-medium text-on-surface-variant/80">{origin}</span>
                       <button
                         onClick={() => removeOrigin(idx)}
                         aria-label={t('widgetBuilder.deployment.removeDomain', { domain: origin })}
                         className="h-7 w-7 rounded-lg flex items-center justify-center text-on-surface-variant/20 group-hover:text-error/60 hover:bg-error/10 hover:text-error transition-all"
                       >
                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                       </button>
                     </div>
                   ))}
                 </div>
               ) : (
                 <div className="py-10 flex flex-col items-center justify-center border border-dashed border-outline-variant/15 rounded-[1.6rem] bg-surface-container-low/30">
                    <div className="w-10 h-10 rounded-full bg-on-surface-variant/5 flex items-center justify-center mb-3">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-on-surface-variant/20"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40">{t('widgetBuilder.deployment.noDomainRestrictions')}</p>
                    <p className="text-[9px] mt-1 text-center max-w-[240px] text-on-surface-variant/30">{t('widgetBuilder.deployment.noDomainRestrictionsDescription')}</p>
                 </div>
               )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
