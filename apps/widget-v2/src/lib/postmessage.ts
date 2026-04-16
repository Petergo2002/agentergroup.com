import type {
  WidgetPreviewOverride,
  WidgetConfig,
  WidgetBootstrapResponse,
} from "../types";

export const PREVIEW_MESSAGE_TYPE = "ag:widget-preview:update-config";
export const PREVIEW_RESET_MESSAGE_TYPE = "ag:widget-preview:reset-chat";
export const PREVIEW_REQUEST_MESSAGE_TYPE = "ag:widget-preview:request-config";
export const BOOTSTRAP_MESSAGE_TYPE = "ag:widget-bootstrap";
export const BOOTSTRAP_REQUEST_MESSAGE_TYPE = "ag:widget-bootstrap:request";
export const BOOTSTRAP_REFRESH_MESSAGE_TYPE = "ag:widget-bootstrap:refresh";
export const BOOTSTRAP_ERROR_MESSAGE_TYPE = "ag:widget-bootstrap:error";
export const WIDGET_CLOSE_REQUEST_MESSAGE_TYPE = "ag:widget:close-request";
export const WIDGET_STATE_MESSAGE_TYPE = "ag:widget:state";

export type SessionPresenceEvent =
  | "widget_open"
  | "widget_close"
  | "page_hidden"
  | "page_visible"
  | "page_unload"
  | "heartbeat";

export interface WidgetStateMessagePayload {
  type: typeof WIDGET_STATE_MESSAGE_TYPE;
  isOpen: boolean;
  at?: number;
}

export interface WidgetBootstrapMessagePayload {
  type: typeof BOOTSTRAP_MESSAGE_TYPE;
  payload: WidgetBootstrapResponse;
}

export interface WidgetPreviewResetPayload {
  type: typeof PREVIEW_RESET_MESSAGE_TYPE;
  payload?: {
    previewRevision?: string | number;
    reason?: string;
  };
}

export interface WidgetBootstrapErrorMessagePayload {
  type: typeof BOOTSTRAP_ERROR_MESSAGE_TYPE;
  error: string;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function parsePreviewOverrideMessage(
  data: unknown,
): WidgetPreviewOverride | null {
  if (!isObjectRecord(data)) return null;
  if (data.type !== PREVIEW_MESSAGE_TYPE) return null;
  const payload = data.payload;
  if (!isObjectRecord(payload)) return null;

  const next: WidgetPreviewOverride = {};

  if (isObjectRecord(payload.brand)) {
    next.brand = payload.brand as Partial<WidgetConfig["brand"]>;
  }

  if (isObjectRecord(payload.widget)) {
    next.widget = payload.widget as Partial<WidgetConfig["widget"]>;
  }

  if (isObjectRecord(payload.home)) {
    next.home = payload.home as Partial<WidgetConfig["home"]>;
  }

  if (isObjectRecord(payload.agent)) {
    next.agent = payload.agent as WidgetPreviewOverride["agent"];
  }

  if (typeof payload.orgName === "string") {
    next.brand = {
      ...(next.brand ?? {}),
      name: payload.orgName,
    };
  }

  if (isObjectRecord(payload.agentSettings)) {
    next.agent = {
      ...(next.agent ?? {}),
      ...(payload.agentSettings as WidgetPreviewOverride["agent"]),
    };
  }

  if (isObjectRecord(payload.widgetSettings)) {
    next.widget = {
      ...(next.widget ?? {}),
      ...(payload.widgetSettings as Partial<WidgetConfig["widget"]>),
    };
  }

  return next;
}

export function parseWidgetStateMessage(
  data: unknown,
): WidgetStateMessagePayload | null {
  if (!isObjectRecord(data)) return null;
  if (data.type !== WIDGET_STATE_MESSAGE_TYPE) return null;
  if (typeof data.isOpen !== "boolean") return null;

  return {
    type: WIDGET_STATE_MESSAGE_TYPE,
    isOpen: data.isOpen,
    at: typeof data.at === "number" ? data.at : undefined,
  };
}

export function parsePreviewResetMessage(
  data: unknown,
): WidgetPreviewResetPayload | null {
  if (!isObjectRecord(data)) return null;
  if (data.type !== PREVIEW_RESET_MESSAGE_TYPE) return null;
  const payload = isObjectRecord(data.payload) ? data.payload : undefined;

  return {
    type: PREVIEW_RESET_MESSAGE_TYPE,
    payload: payload
      ? {
          previewRevision:
            typeof payload.previewRevision === "string" ||
            typeof payload.previewRevision === "number"
              ? payload.previewRevision
              : undefined,
          reason:
            typeof payload.reason === "string" ? payload.reason : undefined,
        }
      : undefined,
  };
}

export function parseWidgetBootstrapMessage(
  data: unknown,
): WidgetBootstrapMessagePayload | null {
  if (!isObjectRecord(data)) return null;
  if (data.type !== BOOTSTRAP_MESSAGE_TYPE) return null;
  if (!isObjectRecord(data.payload)) return null;
  if (!isObjectRecord(data.payload.config)) return null;

  return {
    type: BOOTSTRAP_MESSAGE_TYPE,
    payload: data.payload as unknown as WidgetBootstrapResponse,
  };
}

export function parseWidgetBootstrapErrorMessage(
  data: unknown,
): WidgetBootstrapErrorMessagePayload | null {
  if (!isObjectRecord(data)) return null;
  if (data.type !== BOOTSTRAP_ERROR_MESSAGE_TYPE) return null;
  if (typeof data.error !== "string") return null;

  return {
    type: BOOTSTRAP_ERROR_MESSAGE_TYPE,
    error: data.error,
  };
}