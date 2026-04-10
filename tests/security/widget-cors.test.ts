import assert from "node:assert/strict";
import test from "node:test";
import { buildWidgetCorsHeaders } from "../../src/lib/widgets/http.ts";

function buildRequest(headers: Record<string, string>) {
  return {
    headers: new Headers(headers),
  };
}

test("widget bootstrap CORS does not emit wildcard origins with credentials", () => {
  const headers = buildWidgetCorsHeaders(buildRequest({}));

  assert.equal("Access-Control-Allow-Origin" in headers, false);
  assert.equal("Access-Control-Allow-Credentials" in headers, false);
});

test("widget bootstrap CORS reflects a normalized request origin when present", () => {
  const headers = buildWidgetCorsHeaders(
    buildRequest({ origin: "https://example.com" }),
  );

  assert.equal(headers["Access-Control-Allow-Origin"], "https://example.com");
  assert.equal(headers["Access-Control-Allow-Credentials"], "true");
});
