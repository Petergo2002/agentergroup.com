'use client';

import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { useWidgetBuilder } from './WidgetBuilderContext';
import { getAppUrl } from '@/lib/env';
import { MiloLogo } from '@/components/brand/MiloLogo';
import {
  ExternalLink,
  Lock,
  MessageSquare,
  Monitor,
  RotateCw,
  Smartphone,
  X,
} from 'lucide-react';

const PREVIEW_UPDATE_MESSAGE_TYPE = 'ag:widget-preview:update-config';
const PREVIEW_AUTH_UPDATE_MESSAGE_TYPE = 'ag:widget-preview:update-auth';

interface WidgetPreviewOverrideMessage {
  type: typeof PREVIEW_UPDATE_MESSAGE_TYPE;
  payload: {
    widget: {
      primaryColor: string;
      secondaryColor: string;
      theme: 'dark' | 'light';
    };
  };
}

interface WidgetDevicePreviewProps {
  isMobileModal?: boolean;
}

export function WidgetDevicePreview({ isMobileModal = false }: WidgetDevicePreviewProps) {
  const { t } = useLanguage();
  const { summary, form, draftPreview, previewStatus } = useWidgetBuilder();
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop');
  const [isOpen, setIsOpen] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);
  const [isIframeLoading, setIsIframeLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const widgetOrigin = summary?.hostedUrl ? new URL(summary.hostedUrl).origin : null;
  const widgetPublicKey = summary?.widget.widget_public_key ?? null;
  const widgetPreviewUrl =
    draftPreview && widgetOrigin && summary
      ? `${widgetOrigin}/?widget=${encodeURIComponent(
          summary.widget.widget_public_key,
        )}&preview=1&preview_source=widget_preview&preview_token=${encodeURIComponent(
          draftPreview.previewToken,
        )}&preview_revision=${encodeURIComponent(
          draftPreview.previewRevision,
        )}&parent_origin=${encodeURIComponent(getAppUrl())}`
      : null;

  // Sync open/closed state with widget iframe
  const sendWidgetState = (nextOpen: boolean) => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: 'ag:widget:state',
          isOpen: nextOpen,
          at: Date.now(),
        },
        '*',
      );
    } catch {
      // Ignored
    }
  };

  const toggleWidgetOpen = (nextOpen?: boolean) => {
    const updated = typeof nextOpen === 'boolean' ? nextOpen : !isOpen;
    setIsOpen(updated);
    sendWidgetState(updated);
  };

  // Sync color/theme overrides immediately into the preview iframe without reloading
  useEffect(() => {
    if (!form || !draftPreview) return;

    const previewOverride: WidgetPreviewOverrideMessage = {
      type: PREVIEW_UPDATE_MESSAGE_TYPE,
      payload: {
        widget: {
          primaryColor: form.primaryColor,
          secondaryColor: form.secondaryColor,
          theme: form.theme,
        },
      },
    };

    window.postMessage(previewOverride, window.location.origin);
    try {
      iframeRef.current?.contentWindow?.postMessage(previewOverride, '*');
    } catch {
      // Ignored
    }
  }, [draftPreview, form]);

  // Listen for iframe requests (bootstrap, state, close requests)
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Handle close button click from inside the widget header
      if (
        event.data?.type === 'ag:widget:close-request' ||
        event.data?.type === 'ag:widget:close:request'
      ) {
        setIsOpen(false);
        sendWidgetState(false);
        return;
      }

      // Handle bootstrap request from the iframe
      if (event.data?.type === 'ag:widget-bootstrap:request') {
        sendWidgetState(isOpen);

        if (summary && widgetPublicKey) {
          try {
            const endpoint = `/api/public/widgets/${encodeURIComponent(
              widgetPublicKey,
            )}/bootstrap`;
            const headers: Record<string, string> = {};
            if (draftPreview?.previewToken) {
              headers['x-ag-preview-token'] = draftPreview.previewToken;
              headers['x-ag-preview-revision'] = draftPreview.previewRevision;
              headers['x-ag-preview-source'] = 'widget_preview';
            }
            const res = await fetch(endpoint, { headers });
            if (res.ok) {
              const payload = await res.json();
              iframeRef.current?.contentWindow?.postMessage(
                { type: 'ag:widget-bootstrap', payload },
                '*',
              );
            }
          } catch {
            // Ignored
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [draftPreview, isOpen, summary, widgetPublicKey]);

  // Sync auth credentials to iframe on token change
  useEffect(() => {
    if (!draftPreview) return;

    const authMsg = {
      type: PREVIEW_AUTH_UPDATE_MESSAGE_TYPE,
      payload: {
        previewToken: draftPreview.previewToken,
        previewRevision: draftPreview.previewRevision,
      },
    };

    window.postMessage(authMsg, window.location.origin);
    try {
      iframeRef.current?.contentWindow?.postMessage(authMsg, '*');
    } catch {
      // Ignored
    }
  }, [draftPreview]);

  const handleRefresh = () => {
    setIsIframeLoading(true);
    setIframeKey((prev) => prev + 1);
  };

  if (!summary) return null;

  const brandDisplayName = form?.brandName?.trim() || 'Avenro';
  const primaryColor = form?.primaryColor || '#ff5c02';
  const siteDomain = `${brandDisplayName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'avenro'}.se`;

  return (
    <div
      className={`flex flex-col h-full w-full rounded-2xl border border-outline-variant/15 bg-background shadow-sm overflow-hidden ${
        isMobileModal ? 'min-h-[500px]' : ''
      }`}
    >
      {/* Studio Top Control Bar */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-outline-variant/15 bg-surface-container-low/80 px-4">
        {/* Left: macOS dots & simulated URL */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
          </div>

          <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-outline-variant/15 bg-background/80 px-3 py-1 text-[11px] font-medium text-on-surface-variant/75 truncate shadow-2xs">
            <Lock className="h-3 w-3 text-on-surface-variant/40 shrink-0" />
            <span className="text-on-surface-variant/40">https://</span>
            <span className="font-semibold text-on-surface truncate">{siteDomain}</span>
          </div>
        </div>

        {/* Right: Device Switcher & Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* View Mode Switcher */}
          <div className="flex items-center rounded-lg border border-outline-variant/15 bg-background/80 p-0.5">
            <button
              type="button"
              onClick={() => setDeviceMode('desktop')}
              title="Desktop View"
              className={`rounded-md px-2 py-1 text-xs font-semibold flex items-center gap-1.5 transition-all ${
                deviceMode === 'desktop'
                  ? 'bg-surface-container-low text-on-surface shadow-2xs'
                  : 'text-on-surface-variant/50 hover:text-on-surface'
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">Desktop</span>
            </button>
            <button
              type="button"
              onClick={() => setDeviceMode('mobile')}
              title="Mobile View"
              className={`rounded-md px-2 py-1 text-xs font-semibold flex items-center gap-1.5 transition-all ${
                deviceMode === 'mobile'
                  ? 'bg-surface-container-low text-on-surface shadow-2xs'
                  : 'text-on-surface-variant/50 hover:text-on-surface'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">Mobile</span>
            </button>
          </div>

          {/* Reset Preview Session */}
          <button
            type="button"
            onClick={handleRefresh}
            title="Reset session"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant/15 bg-background text-on-surface-variant/60 transition-colors hover:bg-surface-container-low hover:text-on-surface"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isIframeLoading ? 'animate-spin text-primary' : ''}`} />
          </button>

          {/* Open in New Tab */}
          {widgetPreviewUrl && (
            <a
              href={widgetPreviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={t('widgetBuilder.openFullHostedPreview')}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant/15 bg-background text-on-surface-variant/60 transition-colors hover:bg-surface-container-low hover:text-on-surface"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Main Preview Playground Viewport (Clean, Uncluttered Canvas) */}
      <div className="relative flex-1 min-h-0 bg-surface-container-lowest/40 overflow-hidden flex items-center justify-center p-2.5 sm:p-3.5 lg:p-4">
        {deviceMode === 'desktop' ? (
          /* Desktop Clean Stage */
          <div className="relative h-full w-full rounded-2xl border border-outline-variant/15 bg-background shadow-xs overflow-hidden flex flex-col">
            {/* Subtle Studio Grid Canvas (Zero Distractions) */}
            <div
              className="absolute inset-0 pointer-events-none select-none opacity-25"
              style={{
                backgroundImage:
                  'radial-gradient(circle, currentColor 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />

            {/* Clean, Elegant Studio Watermark */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none p-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-outline-variant/20 bg-surface-container-low shadow-2xs">
                {form?.logoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={form.logoUrl}
                    alt={brandDisplayName}
                    className="h-9 w-9 object-contain"
                  />
                ) : (
                  <MiloLogo size={32} color={primaryColor} />
                )}
              </div>
              <h3 className="mt-3 text-sm font-headline font-bold text-on-surface tracking-tight">
                {brandDisplayName}
              </h3>
              <p className="mt-1 max-w-sm text-xs text-on-surface-variant/60 leading-relaxed">
                {isOpen
                  ? 'Click the close button or icon to test minimizing the chat'
                  : 'Click the Milo launcher bubble in the corner to open live chat'}
              </p>
            </div>

            {/* Floating Chat Window (when open) */}
            {widgetPreviewUrl && (
              <div
                className={`absolute bottom-20 right-5 sm:right-6 w-[410px] sm:w-[420px] max-w-[calc(100%-2.5rem)] h-[670px] max-h-[calc(100%-5.5rem)] rounded-[1.4rem] border border-outline-variant/20 bg-background shadow-[0_24px_60px_-12px_rgba(0,0,0,0.3)] overflow-hidden transition-all duration-300 origin-bottom-right z-30 ${
                  isOpen
                    ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                    : 'opacity-0 scale-90 translate-y-6 pointer-events-none'
                }`}
              >
                {isIframeLoading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/90 backdrop-blur-xs">
                    <p className="text-xs font-semibold text-on-surface-variant">
                      {previewStatus === 'loading'
                        ? t('widgetBuilder.devicePreviewSyncing')
                        : 'Starting widget...'}
                    </p>
                  </div>
                )}
                <iframe
                  ref={iframeRef}
                  key={iframeKey}
                  src={widgetPreviewUrl}
                  title={`${summary.widget.name} desktop widget preview`}
                  onLoad={() => {
                    setIsIframeLoading(false);
                    sendWidgetState(isOpen);
                  }}
                  className="h-full w-full border-0 bg-transparent"
                  allow="clipboard-write; microphone"
                />
              </div>
            )}

            {/* The Canonical Milo Floating Chat Launcher */}
            <div className="absolute bottom-5 right-5 sm:right-6 z-40">
              {isOpen ? (
                /* Canonical Open State: 56px circular button with clean X */
                <button
                  type="button"
                  onClick={() => toggleWidgetOpen(false)}
                  title="Close chat"
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-black shadow-[0_10px_28px_rgba(0,0,0,0.25)] border border-black/10 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <X className="h-6 w-6 text-black/80" strokeWidth={2.2} />
                </button>
              ) : (
                /* Canonical Closed State: 56px Milo Pill Launcher from loader.js */
                <button
                  type="button"
                  onClick={() => toggleWidgetOpen(true)}
                  title="Open chat"
                  className="group relative flex h-14 items-center rounded-full pl-2 pr-5 text-white shadow-[0_10px_30px_rgba(0,0,0,0.22)] ring-1 ring-white/20 transition-all duration-200 hover:scale-[1.03] hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer"
                  style={{ backgroundColor: primaryColor }}
                >
                  {/* Canonical 40px White Circular Logo Icon */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-xs overflow-hidden">
                    {form?.logoUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={form.logoUrl}
                        alt={brandDisplayName}
                        className="h-full w-full object-contain p-1"
                      />
                    ) : (
                      <MiloLogo size={26} color={primaryColor} />
                    )}
                  </div>

                  {/* Canonical Divider Line */}
                  <div className="h-6 w-px bg-white/30 ml-3 mr-3" />

                  {/* Canonical Milo Text */}
                  <span className="text-[15px] font-semibold text-white tracking-[-0.01em] pr-1 select-none">
                    Milo
                  </span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Mobile Smartphone Frame */
          <div className="relative mx-auto w-[320px] sm:w-[350px] h-[600px] rounded-[2.8rem] border-[7px] border-slate-900 bg-slate-950 shadow-2xl overflow-hidden flex flex-col">
            {/* Top Speaker & Camera Notch */}
            <div className="flex h-7 items-center justify-center bg-slate-950 shrink-0">
              <div className="h-1.5 w-16 rounded-full bg-slate-800" />
            </div>

            {/* Mobile Viewport */}
            <div className="relative flex-1 bg-background overflow-hidden">
              {widgetPreviewUrl ? (
                <>
                  {isIframeLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/90 backdrop-blur-xs">
                      <p className="text-xs font-semibold text-on-surface-variant">
                        Starting widget...
                      </p>
                    </div>
                  )}
                  <iframe
                    ref={iframeRef}
                    key={iframeKey}
                    src={widgetPreviewUrl}
                    title={`${summary.widget.name} mobile widget preview`}
                    onLoad={() => {
                      setIsIframeLoading(false);
                      sendWidgetState(isOpen);
                    }}
                    className="h-full w-full border-0 bg-transparent"
                    allow="clipboard-write; microphone"
                  />
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                  <MessageSquare className="h-8 w-8 text-primary" />
                  <p className="mt-2 text-xs font-bold text-on-surface">Widget preview</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Status Bar */}
      <div className="flex h-8 shrink-0 items-center justify-between border-t border-outline-variant/10 bg-surface-container-low/80 px-4 text-[11px] text-on-surface-variant/60">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span>Interactive Milo Preview • Click the bubble or close icon to toggle</span>
        </div>
        <span className="font-mono text-[10px]">
          {deviceMode === 'desktop' ? 'Desktop View' : 'Mobile Frame'}
        </span>
      </div>
    </div>
  );
}
