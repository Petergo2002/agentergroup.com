"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __AG_WIDGET_LOADER_INSTANCE__?: {
      destroy?: () => void;
    };
  }
}

interface WidgetBubblePreviewProps {
  widgetOrigin: string;
  widgetPublicKey: string;
  previewToken: string;
  previewRevision: string;
  previewSource?: string;
}

export function WidgetBubblePreview({
  widgetOrigin,
  widgetPublicKey,
  previewToken,
  previewRevision,
  previewSource = "widget_preview",
}: WidgetBubblePreviewProps) {
  useEffect(() => {
    if (!widgetOrigin || !widgetPublicKey || !previewToken || !previewRevision) {
      return;
    }

    const script = document.createElement("script");
    script.src = `${widgetOrigin}/loader.js`;
    script.async = true;
    script.setAttribute("data-widget", widgetPublicKey);
    script.setAttribute("data-preview", "1");
    script.setAttribute("data-preview-token", previewToken);
    script.setAttribute("data-preview-revision", previewRevision);
    script.setAttribute("data-preview-source", previewSource);
    script.setAttribute("data-parent-origin", window.location.origin);

    document.body.appendChild(script);

    return () => {
      script.remove();
      window.__AG_WIDGET_LOADER_INSTANCE__?.destroy?.();
    };
  }, [
    previewRevision,
    previewSource,
    previewToken,
    widgetOrigin,
    widgetPublicKey,
  ]);

  return null;
}
