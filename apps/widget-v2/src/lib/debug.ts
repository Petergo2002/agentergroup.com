const debugEnabled =
  import.meta.env.DEV || import.meta.env.VITE_WIDGET_DEBUG === "true";

export const widgetDebug = {
  warn(message: string, detail?: unknown) {
    if (!debugEnabled) return;
    if (detail === undefined) {
      console.warn(message);
      return;
    }
    console.warn(message, detail);
  },
  error(message: string, detail?: unknown) {
    if (!debugEnabled) return;
    if (detail === undefined) {
      console.error(message);
      return;
    }
    console.error(message, detail);
  },
};
