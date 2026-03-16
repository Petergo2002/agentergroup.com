import React from "react";
import ReactDOM from "react-dom/client";
import Widget from "./Widget";
import "./index.css";

const urlParams = new URLSearchParams(window.location.search);
const widgetFromUrl = urlParams.get("widget");
const legacyWidgetId =
  urlParams.get("id") ||
  urlParams.get("publicId") ||
  urlParams.get("public_id");
const widgetPublicKey = widgetFromUrl || legacyWidgetId || "";

if (!widgetFromUrl && legacyWidgetId) {
  console.warn(
    "[AgenterGroup Widget] '?id=' is deprecated. Use '?widget=' instead.",
  );
}

const previewMode = urlParams.get("preview") === "1";
const previewSource = urlParams.get("preview_source") || "widget_preview";
const parentOrigin = urlParams.get("parent_origin") || undefined;
const previewToken = urlParams.get("preview_token") || undefined;
const previewRevision = urlParams.get("preview_revision") || undefined;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Widget
      widgetPublicKey={widgetPublicKey}
      previewMode={previewMode}
      previewSource={previewSource}
      parentOrigin={parentOrigin}
      previewToken={previewToken}
      previewRevision={previewRevision}
    />
  </React.StrictMode>,
);
