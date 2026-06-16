import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  inspectWidgetAttachment,
  MAX_WIDGET_ATTACHMENT_SIZE_BYTES,
} from "../../src/lib/widget-attachments.ts";
import { validateWidgetChatBody } from "../../src/lib/validation/widget-schemas.ts";

const uploadRoute = readFileSync(
  "src/app/api/public/widgets/[widgetPublicKey]/upload/route.ts",
  "utf8",
);
const chatRoute = readFileSync(
  "src/app/api/public/widgets/[widgetPublicKey]/chat/route.ts",
  "utf8",
);
const privacySource = readFileSync("src/lib/privacy.ts", "utf8");
const analyticsSource = readFileSync("src/lib/dashboard/analytics.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260611203129_secure_widget_attachments.sql",
  "utf8",
);

test("widget attachment inspection accepts matching safe image bytes", () => {
  const png = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  assert.deepEqual(inspectWidgetAttachment(png, "image.png", "image/png"), {
    mimeType: "image/png",
    extension: "png",
  });
});

test("widget attachment inspection rejects fake MIME, SVG, and oversized files", () => {
  assert.throws(
    () =>
      inspectWidgetAttachment(
        new TextEncoder().encode("plain text"),
        "fake.png",
        "image/png",
      ),
    /does not match/,
  );
  assert.throws(
    () =>
      inspectWidgetAttachment(
        new TextEncoder().encode("<svg><script>alert(1)</script></svg>"),
        "image.svg",
        "image/svg+xml",
      ),
    /SVG uploads are not supported/,
  );
  assert.throws(
    () =>
      inspectWidgetAttachment(
        new Uint8Array(MAX_WIDGET_ATTACHMENT_SIZE_BYTES + 1),
        "large.pdf",
        "application/pdf",
      ),
    /5MB limit/,
  );
});

test("widget messages require server-issued unique attachment ids", () => {
  const base = {
    sessionId: "session-1",
    message: "Review this",
  };
  const attachment = {
    id: "d9428888-122b-4b5f-9f1e-1f03b2339a88",
    url: "https://attacker.example/file",
    name: "file.pdf",
    type: "application/pdf",
    size: 12,
  };

  assert.equal(
    validateWidgetChatBody({
      ...base,
      attachments: [{ ...attachment, id: "" }],
    }).valid,
    false,
  );
  assert.equal(
    validateWidgetChatBody({
      ...base,
      attachments: [attachment, attachment],
    }).valid,
    false,
  );
});

test("widget attachment storage is private, quota-bound, and deleted with sessions", () => {
  assert.match(migration, /'widget-attachments',\s*'widget-attachments',\s*false/s);
  assert.doesNotMatch(migration, /'image\/svg\+xml'/);
  assert.match(migration, /WIDGET_ATTACHMENT_COUNT_LIMIT_EXCEEDED/);
  assert.match(migration, /WIDGET_ATTACHMENT_BYTES_LIMIT_EXCEEDED/);
  assert.match(migration, /widgets\.workspace_id = new\.workspace_id/);
  assert.match(migration, /split_part\(name, '\/', 1\) ~\*/);
  assert.doesNotMatch(migration, /nullif\(split_part\(name, '\/', 1\), ''\)::uuid/);
  assert.match(uploadRoute, /getPublicWidgetRateLimitRules\(\s*"uploads"/s);
  assert.match(uploadRoute, /inspectWidgetAttachment/);
  assert.match(uploadRoute, /id: attachmentId/);
  assert.match(chatRoute, /\.in\("id", attachmentIds\)/);
  assert.match(chatRoute, /refreshWidgetHistoryAttachments/);
  assert.match(analyticsSource, /refreshTranscriptAttachmentUrls/);
  assert.match(analyticsSource, /createSignedUrl/);
  assert.match(privacySource, /deleteWidgetAttachmentObjects/);
  assert.match(privacySource, /\.storage\.from\(bucket\)\.remove\(pathChunk\)/);
});
