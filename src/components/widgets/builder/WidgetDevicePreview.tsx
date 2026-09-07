'use client';

import { useEffect, useRef } from 'react';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { useWidgetBuilder } from './WidgetBuilderContext';
import { getAppUrl } from '@/lib/env';
import { ExternalLink, MessageSquare } from 'lucide-react';

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

type WidgetLoaderWindow = Window &
  typeof globalThis & {
    __AG_WIDGET_LOADER_INSTANCE__?: {
      destroy?: () => void;
    };
    __AG_WIDGET_PREVIEW_OVERRIDE__?: WidgetPreviewOverrideMessage;
  };

export function WidgetDevicePreview() {
  const { t } = useLanguage();
  const { summary, form, draftPreview, previewStatus } = useWidgetBuilder();
  const draftPreviewRef = useRef(draftPreview);
  const hostedUrl = summary?.hostedUrl ?? null;
  const widgetPublicKey = summary?.widget.widget_public_key ?? null;
  const previewRevision = draftPreview?.previewRevision ?? null;

  useEffect(() => {
    draftPreviewRef.current = draftPreview;
  }, [draftPreview]);

  // Keep the outer launcher and the iframe in sync immediately while editing.
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
    const loaderWindow = window as WidgetLoaderWindow;

    loaderWindow.__AG_WIDGET_PREVIEW_OVERRIDE__ = previewOverride;
    window.postMessage(previewOverride, window.location.origin);
  }, [draftPreview, form]);

  useEffect(() => {
    return () => {
      delete (window as WidgetLoaderWindow).__AG_WIDGET_PREVIEW_OVERRIDE__;
    };
  }, []);

  // Refresh preview credentials without rebuilding the iframe or losing chat state.
  useEffect(() => {
    if (!draftPreview) return;

    window.postMessage(
      {
        type: PREVIEW_AUTH_UPDATE_MESSAGE_TYPE,
        payload: {
          previewToken: draftPreview.previewToken,
          previewRevision: draftPreview.previewRevision,
        },
      },
      window.location.origin,
    );
  }, [draftPreview]);

  // Inject loader.js into the host page so it displays a true floating bubble
  useEffect(() => {
    const currentDraftPreview = draftPreviewRef.current;
    if (!currentDraftPreview || !hostedUrl || !widgetPublicKey) return;

    const widgetOrigin = new URL(hostedUrl).origin;
    
    // Check if script already exists to avoid duplicates
    const scriptId = 'ag-widget-preview-loader';
    const existingScript = document.getElementById(scriptId);
    
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `${widgetOrigin}/loader.js?preview_revision=${encodeURIComponent(
      currentDraftPreview.previewRevision,
    )}`;
    script.crossOrigin = "anonymous";
    script.setAttribute('data-widget', widgetPublicKey);
    script.setAttribute('data-preview', '1');
    script.setAttribute('data-preview-token', currentDraftPreview.previewToken);
    script.setAttribute('data-preview-source', 'widget_preview');
    script.setAttribute('data-preview-revision', currentDraftPreview.previewRevision);
    script.setAttribute('data-parent-origin', window.location.origin);

    const initialOverride = (window as WidgetLoaderWindow).__AG_WIDGET_PREVIEW_OVERRIDE__;
    if (initialOverride) {
      script.setAttribute('data-primary-color', initialOverride.payload.widget.primaryColor);
      script.setAttribute('data-theme-mode', initialOverride.payload.widget.theme);
    }
    
    document.body.appendChild(script);

    return () => {
      // Clean up the script and the instance on unmount
      const s = document.getElementById(scriptId);
      if (s) s.remove();
      
      // Destroy the widget instance
      const loaderWindow = window as WidgetLoaderWindow;
      if (
        loaderWindow.__AG_WIDGET_LOADER_INSTANCE__ &&
        typeof loaderWindow.__AG_WIDGET_LOADER_INSTANCE__.destroy === 'function'
      ) {
        loaderWindow.__AG_WIDGET_LOADER_INSTANCE__.destroy();
      }
    };
  }, [hostedUrl, previewRevision, widgetPublicKey]);

  if (!summary) return null;

  const widgetOrigin = summary.hostedUrl ? new URL(summary.hostedUrl).origin : null;
  const widgetPreviewUrl =
    draftPreview && widgetOrigin
      ? `${widgetOrigin}/?widget=${encodeURIComponent(
          summary.widget.widget_public_key,
        )}&preview=1&preview_source=widget_preview&preview_token=${encodeURIComponent(
          draftPreview.previewToken,
        )}&preview_revision=${encodeURIComponent(
          draftPreview.previewRevision,
        )}&parent_origin=${encodeURIComponent(getAppUrl())}`
      : null;

  return (
    <div className="sticky top-[112px] flex w-full flex-col gap-4 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-sm">
      
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MessageSquare className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-on-surface">{t('widgetBuilder.devicePreviewTitle')}</h3>
          <p className="text-xs text-on-surface-variant/70">
            {t('widgetBuilder.devicePreviewDescription')}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-3.5">
        <p className="text-[13px] leading-relaxed text-on-surface-variant">
          {t('widgetBuilder.devicePreviewBody')}
        </p>
      </div>

      {previewStatus === 'loading' && (
        <div className="flex items-center gap-2 text-xs font-semibold text-primary/70 animate-pulse">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {t('widgetBuilder.devicePreviewSyncing')}
        </div>
      )}

      {widgetPreviewUrl && (
        <div>
          <a
            href={widgetPreviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-outline-variant/20 bg-background px-3.5 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container-low"
            title={t('widgetBuilder.openRawWidget')}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t('widgetBuilder.openFullHostedPreview')}
          </a>
        </div>
      )}
      
    </div>
  );
}
