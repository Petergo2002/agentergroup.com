import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEscapedIlikeContainsPattern,
  matchesExactNormalizedEmail,
  sanitizeContentDispositionToken,
} from "../../src/lib/privacy-security.ts";

test('email query "test%" stays exact instead of becoming a wildcard match', () => {
  const emails = ["test%", "test@example.com", "test123", "Test%"];
  const matches = emails.filter((email) =>
    matchesExactNormalizedEmail(email, " test% "),
  );

  assert.deepEqual(matches, ["test%", "Test%"]);
});

test("transcript search escapes wildcard characters before ilike matching", () => {
  assert.equal(buildEscapedIlikeContainsPattern("test%_value"), "%test\\%\\_value%");
});

test("sanitizes session ids before using them in Content-Disposition", () => {
  assert.equal(
    sanitizeContentDispositionToken("../../etc/passwd"),
    "etcpasswd",
  );
});
