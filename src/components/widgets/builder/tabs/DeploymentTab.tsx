'use client';

import { useState } from 'react';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { StatusToggle } from '@/components/ui/StatusToggle';
import { ExternalLink, Copy, CheckCircle2, Globe, Shield, X, Code2 } from 'lucide-react';
import { useWidgetBuilder } from '../WidgetBuilderContext';
import { useToast } from '@/components/ui/ToastProvider';

const fieldLabelClassName = 'text-xs font-bold text-on-surface';
const inputFieldClassName =
  'h-10 w-full rounded-xl border border-outline-variant/20 bg-background px-3.5 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15 placeholder:text-on-surface-variant/35';

export function DeploymentTab() {
  const { t } = useLanguage();
  const { summary, form, addOrigin, removeOrigin, setForm, isSaving, isUpdatingDeployment } =
    useWidgetBuilder();
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Embed Code Section */}
      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-base font-bold font-headline tracking-tight text-on-surface">
            {t('widgetBuilder.deployment.accessConnectivity')}
          </h2>
          <p className="text-xs text-on-surface-variant/70">
            {t('widgetBuilder.deployment.accessConnectivityDescription')}
          </p>
        </div>

        <div className="space-y-4">
          {/* Embed Snippet Code Window */}
          <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-primary" />
                <span className={fieldLabelClassName}>{t('widgetBuilder.deployment.embedSnippet')}</span>
              </div>
              <span className="rounded-md border border-outline-variant/15 bg-surface-container-low px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70">
                HTML &lt;script&gt;
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/90 px-3.5 py-2 text-[11px] font-mono text-slate-400">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-orange-500" />
                  Website Integration Code
                </span>
                <button
                  type="button"
                  onClick={() => void handleCopy(summary.embedSnippet, t('widgetBuilder.deployment.embedSnippet'))}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition-colors hover:bg-slate-700 active:scale-95"
                >
                  {isSnippetCopied ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 animate-in zoom-in-75" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-slate-400" />
                      <span>Copy Snippet</span>
                    </>
                  )}
                </button>
              </div>
              <div className="p-4 overflow-x-auto">
                <pre className="text-[11.5px] leading-relaxed text-slate-300 font-mono">
                  {summary.embedSnippet}
                </pre>
              </div>
            </div>

            <p className="text-[11px] leading-relaxed text-on-surface-variant/60">
              {t('widgetBuilder.deployment.embedDescription')}
            </p>
          </div>

          {/* Hosted Standalone Endpoint */}
          <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-xs space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <StatusToggle
                  checked={form.hostedEnabled}
                  onClick={() =>
                    setForm((current) =>
                      current ? { ...current, hostedEnabled: !current.hostedEnabled } : current,
                    )
                  }
                  disabled={isSaving || isUpdatingDeployment}
                  label={t('widgetBuilder.deployment.hostedAccess')}
                />
                <div className="min-w-0">
                  <span className={fieldLabelClassName}>{t('widgetBuilder.deployment.hostedEndpoint')}</span>
                  <p className="text-xs font-semibold text-on-surface">
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
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 border ${
                    form.hostedEnabled
                      ? 'border-outline-variant/20 bg-surface-container-low text-on-surface hover:bg-surface-container'
                      : 'pointer-events-none opacity-40 border-outline-variant/10'
                  }`}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>{t('common.open')}</span>
                </a>
                <button
                  type="button"
                  onClick={() => handleCopy(summary.hostedUrl, t('widgetBuilder.deployment.hostedEndpoint'))}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant/20 bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface transition-all hover:bg-surface-container active:scale-95"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>{t('widgetBuilder.deployment.copyLink')}</span>
                </button>
              </div>
            </div>

            <div className={`rounded-xl border px-3.5 py-2.5 transition-all ${
              form.hostedEnabled
                ? 'border-outline-variant/15 bg-background shadow-2xs'
                : 'border-outline-variant/10 bg-background/50 opacity-50'
            }`}>
              <code className="truncate text-xs font-medium text-on-surface-variant font-mono block">
                {summary.hostedUrl}
              </code>
            </div>

            <p className="text-[11px] leading-relaxed text-on-surface-variant/60">
              {t('widgetBuilder.deployment.hostedDescription')}
            </p>
          </div>
        </div>
      </section>

      {/* Allowed Domains (CORS Security) */}
      <section className="space-y-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-on-surface-variant/60" />
            <h2 className="text-base font-bold font-headline tracking-tight text-on-surface">
              {t('widgetBuilder.deployment.securityDomainAccess')}
            </h2>
          </div>
          <p className="text-xs text-on-surface-variant/70">
            {t('widgetBuilder.deployment.securityDomainAccessDescription')}
          </p>
        </div>

        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-xs space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
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
              type="button"
              onClick={() => {
                addOrigin(localOriginInput);
                setLocalOriginInput('');
              }}
              className="h-10 shrink-0 rounded-xl bg-primary px-5 text-xs font-bold text-white shadow-2xs transition-transform hover:scale-102 active:scale-98"
            >
              {t('widgetBuilder.deployment.addDomain')}
            </button>
          </div>

          {form.originError && (
            <p className="text-xs font-bold text-error animate-pulse">{form.originError}</p>
          )}

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className={fieldLabelClassName}>
                {t('widgetBuilder.deployment.authorizedDomainRegistry')}
              </span>
              {form.allowedOrigins.length > 0 && (
                <span className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-wider">
                  {form.allowedOrigins.length} {t('common.active')}
                </span>
              )}
            </div>

            {form.allowedOrigins.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {form.allowedOrigins.map((origin, idx) => (
                  <div
                    key={idx}
                    className="group flex items-center gap-2 rounded-xl border border-outline-variant/15 bg-surface-container-low px-3 py-1.5 text-xs font-medium text-on-surface transition-all hover:border-outline-variant/30"
                  >
                    <Globe className="h-3.5 w-3.5 text-on-surface-variant/50" />
                    <span className="truncate max-w-[240px]">{origin}</span>
                    <button
                      type="button"
                      onClick={() => removeOrigin(idx)}
                      aria-label={t('widgetBuilder.deployment.removeDomain', { domain: origin })}
                      className="rounded-md p-0.5 text-on-surface-variant/40 transition-colors hover:bg-error/10 hover:text-error"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-outline-variant/20 bg-surface-container-low/40 py-6 text-center">
                <Globe className="mx-auto h-6 w-6 text-on-surface-variant/30" />
                <p className="mt-2 text-xs font-bold text-on-surface-variant/70">
                  {t('widgetBuilder.deployment.noDomainRestrictions')}
                </p>
                <p className="mt-0.5 text-[11px] text-on-surface-variant/50 max-w-sm mx-auto">
                  {t('widgetBuilder.deployment.noDomainRestrictionsDescription')}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
