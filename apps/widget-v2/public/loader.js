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
  const PREVIEW_OVERRIDE_WINDOW_KEY = "__AG_WIDGET_PREVIEW_OVERRIDE__";
  const PREVIEW_UPDATE_MESSAGE_TYPE = "ag:widget-preview:update-config";
  const PREVIEW_RESET_MESSAGE_TYPE = "ag:widget-preview:reset-chat";
  const PREVIEW_REQUEST_MESSAGE_TYPE = "ag:widget-preview:request-config";
  const WIDGET_CLOSE_REQUEST_MESSAGE_TYPE = "ag:widget:close-request";
  const previousInstance = window[GLOBAL_INSTANCE_KEY];
  if (previousInstance && typeof previousInstance.destroy === "function") {
    previousInstance.destroy();
  }

  // Get configuration from script tag
  const currentScript = document.currentScript;
  const widgetPublicKey =
    currentScript?.getAttribute("data-widget") ||
    currentScript?.getAttribute("data-id") ||
    "";
  if (
    !currentScript?.getAttribute("data-widget") &&
    currentScript?.getAttribute("data-id")
  ) {
    console.warn(
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
  if (typeof window !== "undefined") {
    // Check for dev API override (for local testing)
    if (window.AG_WIDGET_API_URL) {
      apiBaseUrl = window.AG_WIDGET_API_URL;
    } else if (
      window.location.hostname === "localhost" ||
      window.location.port === "3001"
    ) {
      apiBaseUrl = "http://localhost:3000";
    }
  }

  if (!widgetPublicKey) {
    console.error("[AgenterGroup Widget] Missing data-widget attribute");
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
  let iframe = null;
  let styleSheet = null;
  let messageListener = null;
  let domReadyListener = null;
  let keydownListener = null;
  let viewportListener = null;
  let touchBlockListener = null;
  let previewOverrideMessage = null;
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
    bodyTouchAction: "",
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

    if (!widgetSettings) return;

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
    container.style.setProperty("--ag-widget-primary-fg", nextBubbleTextColor);
  }

  function forwardMessageToIframe(message) {
    if (!iframe || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage(message, widgetBaseUrl);
  }

  function shouldLockBackgroundScroll() {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 768px)").matches;
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
    scrollLockState.bodyTouchAction = body.style.touchAction;

    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollLockState.scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overscrollBehavior = "none";
    body.style.touchAction = "none";

    touchBlockListener = (event) => {
      if (!isOpen) return;
      if (!shouldLockBackgroundScroll()) return;

      const target = event.target;
      if (target && container && container.contains(target)) {
        return;
      }
      event.preventDefault();
    };
    document.addEventListener("touchmove", touchBlockListener, {
      passive: false,
    });

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
    body.style.touchAction = scrollLockState.bodyTouchAction;

    if (touchBlockListener) {
      document.removeEventListener("touchmove", touchBlockListener);
      touchBlockListener = null;
    }

    window.scrollTo(0, scrollLockState.scrollY);
    scrollLockState.active = false;
  }

  // Styles for the widget container
  const styles = `
    .ag-widget-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 56px;
      height: 56px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --ag-widget-primary: #ff5c00;
      --ag-widget-primary-fg: #ffffff;
      opacity: 0;
      transition: opacity 0.15s ease;
      pointer-events: none;
    }

    .ag-widget-container.ag-widget-ready {
      opacity: 1;
    }

    .ag-widget-bubble {
      pointer-events: auto;
    }

    .ag-widget-bubble {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--ag-widget-primary);
      box-shadow:
        0 12px 30px rgba(0, 0, 0, 0.25),
        0 2px 8px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.25);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      border: none;
      outline: none;
    }

    .ag-widget-bubble:hover {
      transform: scale(1.1);
      box-shadow:
        0 16px 40px rgba(0, 0, 0, 0.3),
        0 3px 10px rgba(0, 0, 0, 0.25),
        inset 0 1px 0 rgba(255, 255, 255, 0.35);
    }

    .ag-widget-bubble svg {
      width: 26px;
      height: 26px;
      fill: none;
      stroke: var(--ag-widget-primary-fg);
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .ag-widget-bubble.open svg:first-child {
      display: none;
    }

    .ag-widget-bubble.open svg:last-child {
      display: block;
    }

    .ag-widget-bubble:not(.open) svg:last-child {
      display: none;
    }

    .ag-widget-iframe-container {
      position: absolute;
      bottom: 76px;
      right: 0;
      width: 380px;
      height: 680px;
      max-height: 85vh;
      max-width: calc(100vw - 40px);
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      opacity: 0;
      visibility: hidden;
      transform: scale(0.8) translateY(20px);
      transform-origin: bottom right;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      pointer-events: none;
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
    }

    @media (max-width: 900px) {
      .ag-widget-iframe-container {
        width: 320px;
        height: 560px;
        max-height: calc(100vh - 100px);
      }
    }

    @media (max-width: 680px) {
      .ag-widget-iframe-container {
        width: 300px;
        height: 520px;
        max-height: calc(100vh - 96px);
      }
    }

    @media (max-width: 480px) {
      .ag-widget-container {
        bottom: 8px;
        right: 8px;
      }

      .ag-widget-iframe-container {
        position: fixed;
        width: 100vw;
        height: 100dvh;
        bottom: 0;
        right: 0;
        left: 0;
        top: 0;
        max-width: none;
        max-height: none;
        border-radius: 0;
        padding-bottom: env(safe-area-inset-bottom);
        padding-top: env(safe-area-inset-top);
      }

      .ag-widget-bubble {
        width: 52px;
        height: 52px;
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

  // Close icon SVG
  const closeIconSvg = `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </svg>
  `;

  function buildRuntimeParams() {
    const params = new URLSearchParams();
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

  async function applyWidgetTheme() {
    try {
      const runtimeParams = buildRuntimeParams();
      const cacheBustParam = `_ts=${Date.now()}`;
      const configUrl = `${apiBaseUrl}/api/public/widgets/${encodeURIComponent(
        widgetPublicKey,
      )}/config?${runtimeParams ? `${runtimeParams}&` : ""}${cacheBustParam}`;
      const headers = {
        "x-ag-widget-context": "embedded",
      };
      if (parentOrigin) {
        headers["x-ag-parent-origin"] = parentOrigin;
      }
      if (previewEnabled && previewToken) {
        headers["x-ag-preview-token"] = previewToken;
        headers["x-ag-preview-source"] = previewSource;
        if (previewRevision) {
          headers["x-ag-preview-revision"] = previewRevision;
        }
      }
      const response = await fetch(configUrl, {
        headers,
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = await response.json();
      const primaryColor = normalizeHexColor(data?.widget?.primaryColor, "#ff5c00");
      const themeMode = data?.widget?.theme || "dark";
      const textColor = themeMode === "light" ? "#171717" : "#f5f5f5";
      const bubbleTextColor = pickReadableTextColor(primaryColor, textColor);
      if (container && primaryColor) {
        container.style.setProperty("--ag-widget-primary", primaryColor);
      }
      if (container) {
        container.style.setProperty("--ag-widget-primary-fg", bubbleTextColor);
      }
    } catch (error) {
      console.warn("[AgenterGroup Widget] Failed to load theme", error);
    } finally {
      if (container) {
        container.classList.add("ag-widget-ready");
      }
    }
  }

  // Initialize the widget
  function init() {
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

    if (
      previewEnabled &&
      window[PREVIEW_OVERRIDE_WINDOW_KEY] &&
      typeof window[PREVIEW_OVERRIDE_WINDOW_KEY] === "object"
    ) {
      previewOverrideMessage = window[PREVIEW_OVERRIDE_WINDOW_KEY];
      applyPreviewBubbleTheme(previewOverrideMessage);
    }

    // Create iframe container
    const iframeContainer = document.createElement("div");
    iframeContainer.className = "ag-widget-iframe-container";
    iframeContainer.setAttribute("aria-hidden", "true");

    // Create iframe
    iframe = document.createElement("iframe");
    const runtimeParams = buildRuntimeParams();
    iframe.src = `${widgetBaseUrl}/?widget=${encodeURIComponent(widgetPublicKey)}${
      runtimeParams ? `&${runtimeParams}` : ""
    }`;
    iframe.title = "Chat Widget";
    iframe.allow = "microphone; clipboard-write; clipboard-read";
    iframe.addEventListener("load", () => {
      postWidgetStateToIframe();
      if (previewOverrideMessage) {
        forwardMessageToIframe(previewOverrideMessage);
      }
    });
    iframeContainer.appendChild(iframe);

    // Create bubble button
    bubble = document.createElement("button");
    bubble.className = "ag-widget-bubble";
    bubble.innerHTML = chatIconSvg + closeIconSvg;
    bubble.setAttribute("aria-label", "Öppna chatt");
    bubble.onclick = toggleWidget;

    // Append elements
    container.appendChild(iframeContainer);
    container.appendChild(bubble);
    document.body.appendChild(container);

    void applyWidgetTheme();
  }

  // Toggle widget open/close
  function toggleWidget() {
    isOpen = !isOpen;
    const iframeContainer = container?.querySelector(
      ".ag-widget-iframe-container",
    );
    if (!iframeContainer || !bubble) {
      if (!isOpen) {
        unlockBackgroundScroll();
      }
      return;
    }

    if (isOpen) {
      iframeContainer.classList.add("open");
      iframeContainer.setAttribute("aria-hidden", "false");
      bubble.classList.add("open");
      bubble.setAttribute("aria-label", "Stäng chatt");
      lockBackgroundScroll();
    } else {
      iframeContainer.classList.remove("open");
      iframeContainer.setAttribute("aria-hidden", "true");
      bubble.classList.remove("open");
      bubble.setAttribute("aria-label", "Öppna chatt");
      unlockBackgroundScroll();
    }

    postWidgetStateToIframe();
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

    if (container) {
      container.remove();
      container = null;
    }
    bubble = null;
    iframe = null;
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
      init();
      domReadyListener = null;
    };
    document.addEventListener("DOMContentLoaded", domReadyListener);
  } else {
    init();
  }

  // Listen for messages from iframe
  messageListener = (event) => {
    if (isTrustedIframeMessage(event) && parseCloseRequestMessage(event.data)) {
      if (isOpen) toggleWidget();
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
      toggleWidget();
    }
  };
  window.addEventListener("keydown", keydownListener);

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
    open: () => {
      if (!isOpen) toggleWidget();
    },
    close: () => {
      if (isOpen) toggleWidget();
    },
    toggle: toggleWidget,
    destroy,
  };
  window[GLOBAL_INSTANCE_KEY] = { destroy };
})();
