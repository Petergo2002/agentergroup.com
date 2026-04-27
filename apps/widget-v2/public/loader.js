/**
 * AgenterGroup Widget Loader
 *
 * This script is loaded by customers on their websites.
 * It creates an iframe containing the widget and handles open/close state.
 *
 * Usage:
 * <script src="https://widget.agentergroup.com/loader.js" data-widget="YOUR_WIDGET_PUBLIC_KEY"></script>
 *
 * Preview usage (dashboard/internal):
 * <script
 *   src="https://widget.agentergroup.com/loader.js"
 *   data-widget="YOUR_WIDGET_PUBLIC_KEY"
 *   data-preview="1"
 *   data-preview-token="SIGNED_TOKEN"
 *   data-preview-source="builder_widget_tab"
 *   data-preview-revision="1732112000000"
 *   data-parent-origin="https://dashboard.agentergroup.com"
 * ></script>
 */

(() => {
  const GLOBAL_INSTANCE_KEY = "__AG_WIDGET_LOADER_INSTANCE__";
  const MOBILE_WIDGET_BREAKPOINT = 640;
  const PREVIEW_OVERRIDE_WINDOW_KEY = "__AG_WIDGET_PREVIEW_OVERRIDE__";
  const PREVIEW_UPDATE_MESSAGE_TYPE = "ag:widget-preview:update-config";
  const PREVIEW_RESET_MESSAGE_TYPE = "ag:widget-preview:reset-chat";
  const PREVIEW_REQUEST_MESSAGE_TYPE = "ag:widget-preview:request-config";
  const BOOTSTRAP_MESSAGE_TYPE = "ag:widget-bootstrap";
  const BOOTSTRAP_REQUEST_MESSAGE_TYPE = "ag:widget-bootstrap:request";
  const BOOTSTRAP_REFRESH_MESSAGE_TYPE = "ag:widget-bootstrap:refresh";
  const BOOTSTRAP_ERROR_MESSAGE_TYPE = "ag:widget-bootstrap:error";
  const WIDGET_CLOSE_REQUEST_MESSAGE_TYPE = "ag:widget:close-request";
  const previousInstance = window[GLOBAL_INSTANCE_KEY];
  if (previousInstance && typeof previousInstance.destroy === "function") {
    previousInstance.destroy();
  }

  // Get configuration from script tag
  const currentScript = document.currentScript;
  const debugEnabled =
    currentScript?.getAttribute("data-debug") === "1" ||
    currentScript?.getAttribute("data-debug") === "true" ||
    window.AG_WIDGET_DEBUG === true;
  const debugLogger = {
    warn(message, detail) {
      if (!debugEnabled) return;
      if (detail === undefined) {
        console.warn(message);
        return;
      }
      console.warn(message, detail);
    },
    error(message, detail) {
      if (!debugEnabled) return;
      if (detail === undefined) {
        console.error(message);
        return;
      }
      console.error(message, detail);
    },
  };
  const widgetPublicKey =
    currentScript?.getAttribute("data-widget") ||
    currentScript?.getAttribute("data-id") ||
    "";
  if (
    !currentScript?.getAttribute("data-widget") &&
    currentScript?.getAttribute("data-id")
  ) {
    debugLogger.warn(
      "[AgenterGroup Widget] 'data-id' is deprecated. Use 'data-widget' instead.",
    );
  }
  const previewFlagRaw = currentScript?.getAttribute("data-preview") || "";
  const previewEnabled = ["1", "true", "yes"].includes(
    previewFlagRaw.toLowerCase(),
  );
  const previewToken = currentScript?.getAttribute("data-preview-token") || "";
  const previewSource =
    currentScript?.getAttribute("data-preview-source") || "builder_widget_tab";
  const previewRevision =
    currentScript?.getAttribute("data-preview-revision") || "";
  const apiBaseUrlInput =
    currentScript?.getAttribute("data-api-url") ||
    currentScript?.getAttribute("data-api-base-url") ||
    "";
  const parentOrigin =
    currentScript?.getAttribute("data-parent-origin") || window.location.origin;
  const initialPrimaryColorInput =
    currentScript?.getAttribute("data-primary-color") || "";
  const initialThemeModeInput =
    currentScript?.getAttribute("data-theme-mode") || "dark";
  const scriptUrl = currentScript?.src
    ? new URL(currentScript.src, window.location.href)
    : new URL("https://widget.agentergroup.com/loader.js");
  const widgetBaseUrl = scriptUrl.origin;

  // API base URL - always use the main app (where API routes are), not widget-v2
  // In production: https://dashboard.agentergroup.com
  // For local development: http://localhost:3000
  let apiBaseUrl = "https://dashboard.agentergroup.com";
  const scriptApiBaseUrl = normalizeHttpBaseUrl(apiBaseUrlInput);
  if (typeof window !== "undefined") {
    // Per-script override is preferred when embedding the loader in other local repos.
    if (scriptApiBaseUrl) {
      apiBaseUrl = scriptApiBaseUrl;
    } else if (window.AG_WIDGET_API_URL) {
      apiBaseUrl =
        normalizeHttpBaseUrl(window.AG_WIDGET_API_URL) || apiBaseUrl;
    } else if (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.port === "3001"
    ) {
      apiBaseUrl = "http://localhost:3000";
    }
  }

  if (!widgetPublicKey) {
    debugLogger.error("[AgenterGroup Widget] Missing data-widget attribute");
    return;
  }

  const initialPrimaryColor = normalizeHexColor(
    initialPrimaryColorInput,
    "#ff5c00",
  );
  const initialThemeMode = initialThemeModeInput === "light" ? "light" : "dark";

  const initialBubbleTextColor = pickReadableTextColor(
    initialPrimaryColor,
    initialThemeMode === "dark" ? "#f5f5f5" : "#171717",
  );

  // State
  let isOpen = false;
  let container = null;
  let bubble = null;
  let closeButton = null;
  let iframeContainer = null;
  let iframe = null;
  let styleSheet = null;
  let runtimeReadyPromise = null;
  let messageListener = null;
  let domReadyListener = null;
  let keydownListener = null;
  let viewportListener = null;
  let focusListener = null;
  let previewOverrideMessage = null;
  let bootstrapPayload = null;

  let previousFocusedElement = null;
  const scrollLockState = {
    active: false,
    scrollY: 0,
    htmlOverflow: "",
    htmlOverscrollBehavior: "",
    bodyOverflow: "",
    bodyPosition: "",
    bodyTop: "",
    bodyLeft: "",
    bodyRight: "",
    bodyWidth: "",
    bodyOverscrollBehavior: "",
  };

  function normalizeHexColor(value, fallback) {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    const withoutHash = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;

    if (/^[\da-fA-F]{3}$/.test(withoutHash)) {
      return `#${withoutHash
        .split("")
        .map((char) => `${char}${char}`)
        .join("")
        .toLowerCase()}`;
    }

    if (/^[\da-fA-F]{6}$/.test(withoutHash)) {
      return `#${withoutHash.toLowerCase()}`;
    }

    return fallback;
  }

  function hexToRgb(hex) {
    const safeHex = normalizeHexColor(hex, "#000000").slice(1);
    return {
      r: Number.parseInt(safeHex.slice(0, 2), 16),
      g: Number.parseInt(safeHex.slice(2, 4), 16),
      b: Number.parseInt(safeHex.slice(4, 6), 16),
    };
  }

  function relativeLuminance(hex) {
    const rgb = hexToRgb(hex);
    const toLinear = (channel) => {
      const normalized = channel / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    };

    return (
      0.2126 * toLinear(rgb.r) +
      0.7152 * toLinear(rgb.g) +
      0.0722 * toLinear(rgb.b)
    );
  }

  function contrastRatio(a, b) {
    const lumA = relativeLuminance(a);
    const lumB = relativeLuminance(b);
    const lighter = Math.max(lumA, lumB);
    const darker = Math.min(lumA, lumB);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function pickReadableTextColor(bg, preferred) {
    const normalizedPreferred = normalizeHexColor(preferred, "#ffffff");
    if (contrastRatio(normalizedPreferred, bg) >= 4.5) {
      return normalizedPreferred;
    }

    const white = "#ffffff";
    const dark = "#111111";
    return contrastRatio(white, bg) >= contrastRatio(dark, bg) ? white : dark;
  }

  function normalizeOriginValue(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return null;
      }
      return parsed.origin;
    } catch {
      return null;
    }
  }

  function normalizeHttpBaseUrl(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return null;
      }
      return parsed.origin;
    } catch {
      return null;
    }
  }

  function isObjectRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function isTrustedParentMessage(event) {
    const trustedParentOrigin = normalizeOriginValue(parentOrigin);
    if (!trustedParentOrigin) return false;
    return event.source === window && event.origin === trustedParentOrigin;
  }

  function isTrustedIframeMessage(event) {
    return (
      !!iframe &&
      event.source === iframe.contentWindow &&
      event.origin === widgetBaseUrl
    );
  }

  function parsePreviewResetMessage(data) {
    if (!isObjectRecord(data)) return null;
    if (data.type !== PREVIEW_RESET_MESSAGE_TYPE) return null;
    if (!isObjectRecord(data.payload)) {
      return { type: PREVIEW_RESET_MESSAGE_TYPE, payload: undefined };
    }

    return {
      type: PREVIEW_RESET_MESSAGE_TYPE,
      payload: {
        previewRevision:
          typeof data.payload.previewRevision === "string" ||
          typeof data.payload.previewRevision === "number"
            ? data.payload.previewRevision
            : undefined,
        reason:
          typeof data.payload.reason === "string"
            ? data.payload.reason
            : undefined,
      },
    };
  }

  function parsePreviewUpdateMessage(data) {
    if (!isObjectRecord(data)) return null;
    if (data.type !== PREVIEW_UPDATE_MESSAGE_TYPE) return null;
    if (!isObjectRecord(data.payload)) return null;

    const payload = {};
    if (isObjectRecord(data.payload.brand)) {
      payload.brand = data.payload.brand;
    }
    if (isObjectRecord(data.payload.widget)) {
      payload.widget = data.payload.widget;
    }
    if (isObjectRecord(data.payload.agent)) {
      payload.agent = data.payload.agent;
    }
    if (typeof data.payload.orgName === "string") {
      payload.brand = {
        ...(payload.brand || {}),
        name: data.payload.orgName,
      };
    }
    if (isObjectRecord(data.payload.widgetSettings)) {
      payload.widget = {
        ...(payload.widget || {}),
        ...data.payload.widgetSettings,
      };
    }
    if (isObjectRecord(data.payload.agentSettings)) {
      payload.agent = {
        ...(payload.agent || {}),
        ...data.payload.agentSettings,
      };
    }

    return {
      type: PREVIEW_UPDATE_MESSAGE_TYPE,
      payload,
    };
  }

  function parsePreviewRequestMessage(data) {
    if (!isObjectRecord(data)) return null;
    if (data.type !== PREVIEW_REQUEST_MESSAGE_TYPE) return null;
    return { type: PREVIEW_REQUEST_MESSAGE_TYPE };
  }

  function parseCloseRequestMessage(data) {
    if (!isObjectRecord(data)) return null;
    if (data.type !== WIDGET_CLOSE_REQUEST_MESSAGE_TYPE) return null;
    return { type: WIDGET_CLOSE_REQUEST_MESSAGE_TYPE };
  }

  function parseBootstrapRequestMessage(data) {
    if (!isObjectRecord(data)) return null;
    if (data.type !== BOOTSTRAP_REQUEST_MESSAGE_TYPE) return null;
    return { type: BOOTSTRAP_REQUEST_MESSAGE_TYPE };
  }

  function parseBootstrapRefreshMessage(data) {
    if (!isObjectRecord(data)) return null;
    if (data.type !== BOOTSTRAP_REFRESH_MESSAGE_TYPE) return null;
    return { type: BOOTSTRAP_REFRESH_MESSAGE_TYPE };
  }

  function postWidgetStateToIframe() {
    if (!iframe || !iframe.contentWindow) return;

    iframe.contentWindow.postMessage(
      {
        type: "ag:widget:state",
        isOpen,
        at: Date.now(),
      },
      widgetBaseUrl,
    );
  }

  function postBootstrapToIframe() {
    if (!iframe || !iframe.contentWindow || !bootstrapPayload) return;

    iframe.contentWindow.postMessage(
      {
        type: BOOTSTRAP_MESSAGE_TYPE,
        payload: bootstrapPayload,
      },
      widgetBaseUrl,
    );
  }

  function postBootstrapErrorToIframe(message) {
    if (!iframe || !iframe.contentWindow) return;

    iframe.contentWindow.postMessage(
      {
        type: BOOTSTRAP_ERROR_MESSAGE_TYPE,
        error: message || "Failed to refresh widget bootstrap.",
      },
      widgetBaseUrl,
    );
  }

  function escapeHtml(unsafe) {
    return (unsafe || "")
      .toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function applyPreviewBubbleTheme(message) {
    if (!container || !message || typeof message !== "object") return;

    const payload =
      message.payload && typeof message.payload === "object"
        ? message.payload
        : null;
    const widgetSettings =
      payload?.widget && typeof payload.widget === "object"
        ? payload.widget
        : null;

    if (widgetSettings) {
      const nextPrimaryColor = normalizeHexColor(
        widgetSettings.primaryColor,
        initialPrimaryColor,
      );
      const themeMode = widgetSettings.theme === "light" ? "light" : "dark";
      const preferredTextColor = themeMode === "light" ? "#171717" : "#f5f5f5";
      const nextBubbleTextColor = pickReadableTextColor(
        nextPrimaryColor,
        preferredTextColor,
      );

      container.style.setProperty("--ag-widget-primary", nextPrimaryColor);
      container.style.setProperty(
        "--ag-widget-primary-fg",
        nextBubbleTextColor,
      );
    }

    const brandSettings =
      payload?.brand && typeof payload.brand === "object"
        ? payload.brand
        : null;
    if (brandSettings) {
      if (typeof brandSettings.name === "string") {
        const textEl = container.querySelector(".ag-widget-bubble-text");
        if (textEl) textEl.textContent = brandSettings.name || "Agent";
      }
      if (typeof brandSettings.logoUrl !== "undefined") {
        const logoIconEl = container.querySelector(
          ".ag-widget-bubble-logo-icon",
        );
        if (logoIconEl) {
          if (brandSettings.logoUrl) {
            logoIconEl.innerHTML =
              '<img src="' +
              escapeHtml(brandSettings.logoUrl) +
              '" alt="" loading="lazy" decoding="async" />';
          } else {
            logoIconEl.innerHTML = chatIconSvg;
          }
        }
      }
    }
  }

  function forwardMessageToIframe(message) {
    if (!iframe || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage(message, widgetBaseUrl);
  }

  async function fetchBootstrap() {
    const bootstrapUrl = `${apiBaseUrl}/api/public/widgets/${encodeURIComponent(
      widgetPublicKey,
    )}/bootstrap${previewEnabled ? `?_ts=${Date.now()}` : ""}`;
    const headers = {};

    if (previewEnabled && previewToken) {
      headers["x-ag-preview-token"] = previewToken;
      headers["x-ag-preview-source"] = previewSource;
      if (previewRevision) {
        headers["x-ag-preview-revision"] = previewRevision;
      }
    }

    const response = await fetch(bootstrapUrl, {
      headers,
      cache: previewEnabled ? "no-store" : "default",
    });

    if (!response.ok) {
      const payload = await response
        .json()
        .catch(async () => {
          const text = await response.text().catch(() => "");
          return text ? { error: text.slice(0, 240) } : null;
        });
      throw new Error(
        `[${response.status}] ${
          typeof payload?.error === "string"
            ? payload.error
            : "Failed to bootstrap widget."
        } (${bootstrapUrl})`,
      );
    }

    bootstrapPayload = await response.json();
    return bootstrapPayload;
  }

  async function refreshBootstrapForIframe() {
    try {
      await fetchBootstrap();
      updateBubbleContent();
      applyWidgetTheme();
      postBootstrapToIframe();
    } catch (error) {
      debugLogger.error("[AgenterGroup Widget] Bootstrap refresh failed", error);
      postBootstrapErrorToIframe(
        error instanceof Error
          ? error.message
          : "Failed to refresh widget bootstrap.",
      );
    }
  }

  function shouldLockBackgroundScroll() {
    if (typeof window === "undefined") return false;
    return window.innerWidth < MOBILE_WIDGET_BREAKPOINT;
  }

  function focusWidgetSurface() {
    if (!isOpen) return;

    window.requestAnimationFrame(() => {
      if (iframe && typeof iframe.focus === "function") {
        iframe.focus();
        if (document.activeElement === iframe) {
          return;
        }
      }

      const iframeContainer = container?.querySelector(
        ".ag-widget-iframe-container",
      );
      if (iframeContainer && typeof iframeContainer.focus === "function") {
        iframeContainer.focus();
      }
    });
  }

  function lockBackgroundScroll() {
    if (scrollLockState.active || !shouldLockBackgroundScroll()) return;

    const html = document.documentElement;
    const body = document.body;
    scrollLockState.scrollY = window.scrollY || window.pageYOffset || 0;

    scrollLockState.htmlOverflow = html.style.overflow;
    scrollLockState.htmlOverscrollBehavior = html.style.overscrollBehavior;
    scrollLockState.bodyOverflow = body.style.overflow;
    scrollLockState.bodyPosition = body.style.position;
    scrollLockState.bodyTop = body.style.top;
    scrollLockState.bodyLeft = body.style.left;
    scrollLockState.bodyRight = body.style.right;
    scrollLockState.bodyWidth = body.style.width;
    scrollLockState.bodyOverscrollBehavior = body.style.overscrollBehavior;

    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollLockState.scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overscrollBehavior = "none";

    scrollLockState.active = true;
  }

  function unlockBackgroundScroll() {
    if (!scrollLockState.active) return;

    const html = document.documentElement;
    const body = document.body;

    html.style.overflow = scrollLockState.htmlOverflow;
    html.style.overscrollBehavior = scrollLockState.htmlOverscrollBehavior;
    body.style.overflow = scrollLockState.bodyOverflow;
    body.style.position = scrollLockState.bodyPosition;
    body.style.top = scrollLockState.bodyTop;
    body.style.left = scrollLockState.bodyLeft;
    body.style.right = scrollLockState.bodyRight;
    body.style.width = scrollLockState.bodyWidth;
    body.style.overscrollBehavior = scrollLockState.bodyOverscrollBehavior;

    window.scrollTo(0, scrollLockState.scrollY);
    scrollLockState.active = false;
  }

  // Styles for the widget container
  const styles = `
    .ag-widget-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: max-content;
      height: auto;
      min-height: 56px;
      max-width: calc(100vw - 40px);
      display: flex;
      justify-content: flex-end;
      align-items: flex-end;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --ag-widget-primary: #ff5c00;
      --ag-widget-primary-fg: #ffffff;
      opacity: 0;
      transition: opacity 0.15s ease;
      overflow: visible;
      isolation: isolate;
      pointer-events: none;
    }

    .ag-widget-container.ag-widget-ready {
      opacity: 1;
    }

    .ag-widget-container.ag-is-open {
      pointer-events: auto;
    }

    .ag-widget-bubble {
      position: relative;
      z-index: 2;
      pointer-events: auto;
      touch-action: manipulation;
      visibility: hidden;
      opacity: 0;
      transition: visibility 0s, opacity 0.3s ease;
    }

    .ag-widget-bubble.ag-is-ready {
      visibility: visible;
      opacity: 1;
    }

    .ag-widget-bubble {
      height: 56px;
      min-width: 56px;
      max-width: 360px;
      border-radius: 28px;
      background: var(--ag-widget-primary);
      color: var(--ag-widget-primary-fg);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
      cursor: pointer;
      display: flex;
      align-items: center;
      padding: 0 20px 0 8px;
      transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
      border: none;
      outline: none;
      overflow: hidden;
      font-family: inherit;
      white-space: nowrap;
    }

    .ag-widget-bubble:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.2);
    }

    .ag-widget-close-button {
      position: absolute;
      top: 18px;
      right: 18px;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.94);
      color: rgba(17, 17, 17, 0.92);
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.14);
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s ease;
      transform: scale(0.92);
      z-index: 3;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }

    .ag-widget-close-button.open {
      transform: scale(1);
    }

    .ag-widget-close-button svg {
      width: 22px;
      height: 22px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.9;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .ag-widget-bubble.open {
      padding: 0;
      width: 56px;
      max-width: 56px;
      border-radius: 50%;
      justify-content: center;
    }

    .ag-widget-bubble-content {
      display: flex;
      align-items: center;
      gap: 12px;
      transition: opacity 0.2s ease, transform 0.3s ease;
      pointer-events: none;
    }

    .ag-widget-bubble.open .ag-widget-bubble-content {
      opacity: 0;
      transform: scale(0.8);
      position: absolute;
      pointer-events: none;
    }

    .ag-widget-bubble-close {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      visibility: hidden;
      transform: scale(0.8) rotate(-45deg);
      transition: all 0.3s ease;
      pointer-events: none;
    }

    .ag-widget-bubble.open .ag-widget-bubble-close {
      opacity: 1;
      visibility: visible;
      transform: scale(1) rotate(0);
      pointer-events: auto;
    }

    .ag-widget-bubble-logo-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
    }

    .ag-widget-bubble-logo-icon img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .ag-widget-bubble-logo-icon svg {
      width: 24px;
      height: 24px;
      fill: none;
      stroke: var(--ag-widget-primary-fg);
      stroke-width: 1.5;
    }

    .ag-widget-bubble-close svg {
      width: 26px;
      height: 26px;
      fill: none;
      stroke: var(--ag-widget-primary-fg);
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .ag-widget-bubble-divider {
      width: 1px;
      height: 24px;
      background: var(--ag-widget-primary-fg);
      opacity: 0.3;
    }

    .ag-widget-bubble-text {
      font-size: 15px;
      font-weight: 600;
      letter-spacing: -0.01em;
      padding-right: 4px;
    }

    .ag-widget-iframe-container {
      position: absolute;
      bottom: 76px;
      right: 0;
      width: 420px;
      height: 700px;
      max-height: 85vh;
      max-width: calc(100vw - 48px);
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      opacity: 0;
      visibility: hidden;
      transform: scale(0.8) translateY(20px);
      transform-origin: bottom right;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      pointer-events: none;
      z-index: 1;
    }

    .ag-widget-iframe-container.open {
      opacity: 1;
      visibility: visible;
      transform: scale(1) translateY(0);
      pointer-events: auto;
    }

    .ag-widget-iframe-container iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: #0a0e1a;
      pointer-events: auto;
      touch-action: auto;
    }

    @media (max-width: 900px) {
      .ag-widget-iframe-container {
        width: 360px;
        height: 580px;
        max-height: calc(100vh - 100px);
      }
    }

    @media (max-width: 680px) {
      .ag-widget-iframe-container {
        width: 320px;
        height: 520px;
        max-height: calc(100vh - 96px);
      }
    }

    @media (max-width: 639px) {
      .ag-widget-container {
        bottom: 8px;
        right: 8px;
        max-width: calc(100vw - 16px);
      }

      .ag-widget-container.ag-is-open {
        inset: 0;
        width: auto;
        height: auto;
        min-height: 0;
        max-width: none;
      }

      .ag-widget-iframe-container {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100dvh;
        bottom: auto;
        right: auto;
        max-width: none;
        max-height: none;
        border-radius: 0;
        transform: none;
        transform-origin: initial;
        transition: opacity 0.18s ease, visibility 0.18s ease;
        will-change: opacity;
      }

      .ag-widget-iframe-container.open {
        transform: none;
      }

      .ag-widget-bubble {
        width: 56px;
        height: 56px;
        min-width: 56px;
        max-width: 56px;
        padding: 0;
        border-radius: 50%;
        justify-content: center;
      }

      .ag-widget-bubble-divider,
      .ag-widget-bubble-text {
        display: none;
      }

      .ag-widget-bubble-content {
        gap: 0;
      }

      .ag-widget-container.ag-is-open .ag-widget-bubble {
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transform: scale(0.92);
      }

      .ag-widget-container.ag-is-open .ag-widget-close-button {
        position: fixed;
        top: calc(env(safe-area-inset-top, 0px) + 18px);
        right: 14px;
        width: 40px;
        height: 40px;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
        color: rgba(17, 17, 17, 0.92);
      }

      .ag-widget-close-button.open {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
      }

      .ag-widget-bubble:hover {
        transform: none;
      }
    }
  `;

  // Widget brand icon - matches the in-widget mark
  const chatIconSvg = `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none">
      <path d="M5.636 5.636a9 9 0 1 0 12.728 12.728a9 9 0 0 0 -12.728 -12.728"/>
      <path d="M16.243 7.757a6 6 0 0 0 -8.486 0"/>
    </svg>
  `;

  // Close icon SVG — uses stroke-based lines for proper visibility with fill:none CSS
  const closeIconSvg = `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  `;

  function buildRuntimeParams() {
    const params = new URLSearchParams();
    params.set("embedded_by", "loader");
    if (parentOrigin) {
      params.set("parent_origin", parentOrigin);
    }
    if (previewEnabled) {
      params.set("preview", "1");
      params.set("preview_source", previewSource);
      if (previewToken) {
        params.set("preview_token", previewToken);
      }
      if (previewRevision) {
        params.set("preview_revision", previewRevision);
      }
      params.set("_ts", String(Date.now()));
    }
    return params.toString();
  }

  function getBubbleMarkup() {
    const brandName = bootstrapPayload?.config?.brand?.name || "Chat";
    const logoUrl = bootstrapPayload?.config?.brand?.logoUrl;

    return `
      <div class="ag-widget-bubble-content">
        <div class="ag-widget-bubble-logo-icon">
          ${
            logoUrl
              ? `<img src="${escapeHtml(
                  logoUrl,
                )}" alt="" loading="lazy" decoding="async" />`
              : chatIconSvg
          }
        </div>
        <div class="ag-widget-bubble-divider"></div>
        <span class="ag-widget-bubble-text">${escapeHtml(brandName)}</span>
      </div>
      <div class="ag-widget-bubble-close">
        ${closeIconSvg}
      </div>
    `;
  }

  function getLoaderLanguage() {
    const configuredLanguage = bootstrapPayload?.config?.widget?.language;
    if (configuredLanguage === "sv" || configuredLanguage === "en") {
      return configuredLanguage;
    }

    const documentLanguage =
      document.documentElement.getAttribute("lang") || navigator.language || "";
    return documentLanguage.toLowerCase().startsWith("sv") ? "sv" : "en";
  }

  function getLoaderLabel(key) {
    const labels = {
      en: {
        openChat: "Open chat",
        closeChat: "Close chat",
        close: "Close",
        chatDialog: "chat",
      },
      sv: {
        openChat: "Öppna chatt",
        closeChat: "Stäng chatt",
        close: "Stäng",
        chatDialog: "chatt",
      },
    };
    const language = getLoaderLanguage();
    return labels[language][key] || labels.en[key];
  }

  function updateBubbleContent() {
    if (!bubble) return;

    bubble.innerHTML = getBubbleMarkup();
    bubble.setAttribute(
      "aria-label",
      isOpen ? getLoaderLabel("closeChat") : getLoaderLabel("openChat"),
    );

    if (iframeContainer) {
      const brandName = bootstrapPayload?.config?.brand?.name || "Agent";
      iframeContainer.setAttribute(
        "aria-label",
        `${brandName} ${getLoaderLabel("chatDialog")}`,
      );
    }
  }

  function ensureIframeContainer() {
    if (iframeContainer || !container) {
      return iframeContainer;
    }

    iframeContainer = document.createElement("div");
    iframeContainer.className = "ag-widget-iframe-container";
    iframeContainer.setAttribute("aria-hidden", "true");
    iframeContainer.setAttribute("role", "dialog");
    iframeContainer.setAttribute("aria-modal", "true");
    iframeContainer.setAttribute("tabindex", "-1");
    container.insertBefore(iframeContainer, bubble);
    return iframeContainer;
  }

  function createIframe() {
    if (iframe) {
      return Promise.resolve();
    }

    const nextIframeContainer = ensureIframeContainer();
    if (!nextIframeContainer) {
      return Promise.reject(
        new Error("Failed to initialize widget container."),
      );
    }

    iframe = document.createElement("iframe");
    iframe.loading = "lazy";
    const runtimeParams = buildRuntimeParams();
    iframe.src = `${widgetBaseUrl}/?widget=${encodeURIComponent(widgetPublicKey)}${
      runtimeParams ? `&${runtimeParams}` : ""
    }`;
    iframe.title = "Chat Widget";
    iframe.allow = "microphone; clipboard-write; clipboard-read";

    const iframeReady = new Promise((resolve, reject) => {
      iframe.addEventListener(
        "load",
        () => {
          postWidgetStateToIframe();
          postBootstrapToIframe();
          if (previewOverrideMessage) {
            forwardMessageToIframe(previewOverrideMessage);
          }
          resolve();
        },
        { once: true },
      );

      iframe.addEventListener(
        "error",
        () => {
          reject(new Error("Failed to load the widget iframe."));
        },
        { once: true },
      );
    });

    nextIframeContainer.appendChild(iframe);
    return iframeReady;
  }

  async function ensureRuntimeReady() {
    if (iframe && bootstrapPayload) {
      return;
    }

    if (runtimeReadyPromise) {
      return runtimeReadyPromise;
    }

    runtimeReadyPromise = (async () => {
      await fetchBootstrap();
      updateBubbleContent();
      applyWidgetTheme();
      await createIframe();
    })().finally(() => {
      runtimeReadyPromise = null;
    });

    return runtimeReadyPromise;
  }

  function syncWidgetOpenState() {
    if (container) {
      container.classList.toggle("ag-is-open", isOpen);
    }

    if (iframeContainer) {
      iframeContainer.classList.toggle("open", isOpen);
      iframeContainer.setAttribute("aria-hidden", isOpen ? "false" : "true");
    }

    if (bubble) {
      bubble.classList.toggle("open", isOpen);
      bubble.setAttribute(
        "aria-label",
        isOpen ? getLoaderLabel("closeChat") : getLoaderLabel("openChat"),
      );
      bubble.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }

    if (closeButton) {
      closeButton.classList.toggle("open", isOpen);
      closeButton.setAttribute("aria-hidden", isOpen ? "false" : "true");
      closeButton.tabIndex = isOpen ? 0 : -1;
    }
  }

  function applyWidgetTheme() {
    try {
      const config = bootstrapPayload?.config;
      if (!config?.widget) return;
      const primaryColor = normalizeHexColor(
        config.widget.primaryColor,
        "#ff5c00",
      );
      const themeMode = config.widget.theme || "dark";
      const textColor = themeMode === "light" ? "#171717" : "#f5f5f5";
      const bubbleTextColor = pickReadableTextColor(primaryColor, textColor);
      if (container && primaryColor) {
        container.style.setProperty("--ag-widget-primary", primaryColor);
      }
      if (container) {
        container.style.setProperty("--ag-widget-primary-fg", bubbleTextColor);
      }
    } catch (error) {
      debugLogger.warn("[AgenterGroup Widget] Failed to load theme", error);
    } finally {
      if (container) {
        container.classList.add("ag-widget-ready");
      }
    }
  }

  // Initialize the widget
  async function init() {
    // Remove stale artifacts from older/duplicate loader instances
    document.querySelectorAll(".ag-widget-container").forEach((node) => {
      node.remove();
    });
    document
      .querySelectorAll('style[data-ag-widget-style="true"]')
      .forEach((node) => {
        node.remove();
      });

    // Inject styles
    styleSheet = document.createElement("style");
    styleSheet.setAttribute("data-ag-widget-style", "true");
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);

    // Create container
    container = document.createElement("div");
    container.className = "ag-widget-container";
    container.style.setProperty("--ag-widget-primary", initialPrimaryColor);
    container.style.setProperty(
      "--ag-widget-primary-fg",
      initialBubbleTextColor,
    );

    // Create bubble button
    bubble = document.createElement("button");
    bubble.className = "ag-widget-bubble";
    bubble.type = "button";
    bubble.innerHTML = getBubbleMarkup();
    bubble.setAttribute("aria-label", getLoaderLabel("openChat"));
    bubble.setAttribute("aria-expanded", "false");
    bubble.onclick = () => {
      void toggleWidget();
    };

    closeButton = document.createElement("button");
    closeButton.className = "ag-widget-close-button";
    closeButton.type = "button";
    closeButton.innerHTML = closeIconSvg;
    closeButton.setAttribute("aria-label", getLoaderLabel("close"));
    closeButton.setAttribute("aria-hidden", "true");
    closeButton.tabIndex = -1;
    closeButton.onclick = closeWidget;

    // Append elements
    container.appendChild(bubble);
    container.appendChild(closeButton);
    document.body.appendChild(container);

    // Pre-fetch bootstrap config immediately so logo loads on page load
    if (!bootstrapPayload) {
      fetchBootstrap()
        .then(() => {
          updateBubbleContent();
          applyWidgetTheme();
          bubble?.classList?.add("ag-is-ready");
        })
        .catch(() => {
          bubble?.classList?.add("ag-is-ready");
        });
    } else {
      bubble?.classList?.add("ag-is-ready");
    }

    if (
      previewEnabled &&
      window[PREVIEW_OVERRIDE_WINDOW_KEY] &&
      typeof window[PREVIEW_OVERRIDE_WINDOW_KEY] === "object"
    ) {
      previewOverrideMessage = window[PREVIEW_OVERRIDE_WINDOW_KEY];
      applyPreviewBubbleTheme(previewOverrideMessage);
    }

    syncWidgetOpenState();
    applyWidgetTheme();
  }

  async function openWidget() {
    if (isOpen) return;

    if (!bubble) return;

    bubble.disabled = true;
    bubble.setAttribute("aria-busy", "true");

    try {
      await ensureRuntimeReady();
    } catch (error) {
      debugLogger.error("[AgenterGroup Widget] Bootstrap failed", error);
      bubble.disabled = false;
      bubble.removeAttribute("aria-busy");
      return;
    }

    bubble.disabled = false;
    bubble.removeAttribute("aria-busy");

    if (!iframeContainer) {
      return;
    }

    isOpen = true;
    previousFocusedElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    syncWidgetOpenState();
    lockBackgroundScroll();
    focusWidgetSurface();
    postWidgetStateToIframe();
  }

  function closeWidget() {
    if (!isOpen) return;

    isOpen = false;
    syncWidgetOpenState();
    unlockBackgroundScroll();
    if (
      previousFocusedElement &&
      document.contains(previousFocusedElement) &&
      typeof previousFocusedElement.focus === "function"
    ) {
      previousFocusedElement.focus();
    } else if (bubble && typeof bubble.focus === "function") {
      bubble.focus();
    }
    previousFocusedElement = null;
    postWidgetStateToIframe();
  }

  async function toggleWidget() {
    if (isOpen) {
      closeWidget();
    } else {
      await openWidget();
    }
  }

  function destroy() {
    if (domReadyListener) {
      document.removeEventListener("DOMContentLoaded", domReadyListener);
      domReadyListener = null;
    }
    if (messageListener) {
      window.removeEventListener("message", messageListener);
      messageListener = null;
    }
    if (keydownListener) {
      window.removeEventListener("keydown", keydownListener);
      keydownListener = null;
    }
    if (viewportListener) {
      window.removeEventListener("resize", viewportListener);
      viewportListener = null;
    }
    if (focusListener) {
      document.removeEventListener("focusin", focusListener, true);
      focusListener = null;
    }

    if (container) {
      container.remove();
      container = null;
    }
    bubble = null;
    closeButton = null;
    iframeContainer = null;
    iframe = null;
    runtimeReadyPromise = null;
    isOpen = false;
    unlockBackgroundScroll();

    if (styleSheet) {
      styleSheet.remove();
      styleSheet = null;
    }
  }

  // Wait for DOM to be ready
  if (document.readyState === "loading") {
    domReadyListener = () => {
      void init();
      domReadyListener = null;
    };
    document.addEventListener("DOMContentLoaded", domReadyListener);
  } else {
    void init();
  }

  // Listen for messages from iframe
  messageListener = (event) => {
    if (isTrustedIframeMessage(event) && parseCloseRequestMessage(event.data)) {
      if (isOpen) closeWidget();
      return;
    }

    if (
      isTrustedIframeMessage(event) &&
      parseBootstrapRequestMessage(event.data)
    ) {
      postBootstrapToIframe();
      return;
    }

    if (
      isTrustedIframeMessage(event) &&
      parseBootstrapRefreshMessage(event.data)
    ) {
      void refreshBootstrapForIframe();
      return;
    }

    if (
      previewEnabled &&
      isTrustedIframeMessage(event) &&
      parsePreviewRequestMessage(event.data)
    ) {
      if (previewOverrideMessage) {
        forwardMessageToIframe(previewOverrideMessage);
      }
      return;
    }

    const previewUpdate =
      previewEnabled && isTrustedParentMessage(event)
        ? parsePreviewUpdateMessage(event.data)
        : null;
    if (previewUpdate) {
      previewOverrideMessage = previewUpdate;
      applyPreviewBubbleTheme(previewOverrideMessage);
      forwardMessageToIframe(previewOverrideMessage);
      return;
    }

    const previewReset =
      previewEnabled && isTrustedParentMessage(event)
        ? parsePreviewResetMessage(event.data)
        : null;
    if (previewReset) {
      forwardMessageToIframe(previewReset);
    }
  };
  window.addEventListener("message", messageListener);

  keydownListener = (event) => {
    if (event.key === "Escape" && isOpen) {
      closeWidget();
    }
  };
  window.addEventListener("keydown", keydownListener);

  focusListener = (event) => {
    if (!isOpen || !container) return;
    const target = event.target;
    if (target && container.contains(target)) {
      return;
    }
    focusWidgetSurface();
  };
  document.addEventListener("focusin", focusListener, true);

  viewportListener = () => {
    if (!isOpen) {
      unlockBackgroundScroll();
      return;
    }
    if (shouldLockBackgroundScroll()) {
      lockBackgroundScroll();
    } else {
      unlockBackgroundScroll();
    }
  };
  window.addEventListener("resize", viewportListener);

  // Expose API for advanced usage
  window.AgenterWidget = {
    open: openWidget,
    close: closeWidget,
    toggle: toggleWidget,
    destroy,
  };
  window[GLOBAL_INSTANCE_KEY] = { destroy };
})();
