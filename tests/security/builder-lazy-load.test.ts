import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the heavy Agent Builder is isolated behind a client-only dynamic boundary", () => {
  const route = readFileSync(
    "src/app/(app)/agents/[id]/builder/page.tsx",
    "utf8",
  );
  const builder = readFileSync(
    "src/app/(app)/agents/[id]/builder/AgentBuilderClient.tsx",
    "utf8",
  );

  assert.match(route, /dynamic\(\(\) => import\("\.\/AgentBuilderClient"\)/);
  assert.match(route, /ssr: false/);
  assert.match(route, /loading: \(\) =>/);
  assert.doesNotMatch(route, /@xyflow\/react/);
  assert.match(builder, /from '@xyflow\/react'/);
});
