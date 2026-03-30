'use client';

import { useEffect } from 'react';
import { useWidgetBuilder } from './WidgetBuilderContext';
import { getAppUrl } from '@/lib/env';
import { ExternalLink, MessageSquare } from 'lucide-react';

type WidgetLoaderWindow = Window &
  typeof globalThis & {
    __AG_WIDGET_LOADER_INSTANCE__?: {
      destroy?: () => void;
    };
  };

export function WidgetDevicePreview() {
  const { summary, draftPreview, previewStatus } = useWidgetBuilder();

  // Inject loader.js into the host page so it displays a true floating bubble
  useEffect(() => {
    if (!summary || !draftPreview || !summary.hostedUrl) return;

    const widgetOrigin = new URL(summary.hostedUrl).origin;
    
    // Check if script already exists to avoid duplicates
    const scriptId = 'ag-widget-preview-loader';
    const existingScript = document.getElementById(scriptId);
    
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `${widgetOrigin}/loader.js`;
    script.setAttribute('data-widget', summary.widget.widget_public_key);
    script.setAttribute('data-preview', '1');
    script.setAttribute('data-preview-token', draftPreview.previewToken);
    script.setAttribute('data-preview-source', 'widget_preview');
    script.setAttribute('data-preview-revision', draftPreview.previewRevision);
    script.setAttribute('data-parent-origin', getAppUrl());
    
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
  }, [summary, draftPreview]);

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
    <div className="sticky top-[160px] flex w-full flex-col gap-5 rounded-[2rem] border border-outline-variant/10 bg-surface-container-low p-8 shadow-[0_24px_60px_rgba(15,23,42,0.06)]">
      
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MessageSquare className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-on-surface">Live Widget Preview</h3>
          <p className="text-xs text-on-surface-variant/70">
            Check the bottom right corner of your screen
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-surface-container-lowest p-4 border border-outline-variant/5">
        <p className="text-[13px] leading-relaxed text-on-surface-variant">
          Your widget is running natively on this page. Any visual changes made on the left will immediately sync with the floating bubble.
        </p>
      </div>

      {previewStatus === 'loading' && (
        <div className="flex items-center gap-2 text-xs font-semibold text-primary/70 animate-pulse">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Syncing changes...
        </div>
      )}

      {widgetPreviewUrl && (
        <div className="pt-2">
          <a
            href={widgetPreviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-background px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-on-surface hover:bg-surface-container-high transition-colors"
            title="Open raw widget in new tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open Full Hosted Preview
          </a>
        </div>
      )}
      
    </div>
  );
}
