import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const soundModule = readFileSync(
  "apps/widget-v2/src/lib/notification-sound.ts",
  "utf8",
);
const widgetRuntime = readFileSync("apps/widget-v2/src/Widget.tsx", "utf8");

test("the chime is synthesized, not fetched", () => {
  // No asset means no network request, no CORS surface, and no bytes added
  // beyond the code itself.
  assert.match(soundModule, /createOscillator\(\)/);
  assert.match(soundModule, /createGain\(\)/);
  assert.doesNotMatch(soundModule, /new Audio\(/);
  assert.doesNotMatch(soundModule, /fetch\(/);
  assert.doesNotMatch(soundModule, /data:audio/);
});

test("it only plays when the visitor cannot already see the reply", () => {
  // Widget closed, a different browser tab, or a different tab inside the
  // widget all count as "not watching".
  assert.match(
    widgetRuntime,
    /isWatchingConversationRef\.current =\s*isWidgetOpen &&\s*activeTab === "messages" &&\s*!showConversationList &&/,
  );
  assert.match(widgetRuntime, /document\.visibilityState === "visible"/);
  assert.match(
    widgetRuntime,
    /if \(!isSoundMutedRef\.current && !isWatchingConversationRef\.current\) \{\s*playNotificationSound\(\);/,
  );
});

test("the watching check is read from refs, not captured state", () => {
  // The reply completes inside an async stream handler; captured state would be
  // stale by then, so both inputs are refs kept in sync by effects.
  assert.match(widgetRuntime, /const isWatchingConversationRef = useRef\(false\)/);
  assert.match(
    widgetRuntime,
    /const isSoundMutedRef = useRef\(isSoundMuted\)/,
  );
  assert.match(widgetRuntime, /isSoundMutedRef\.current = isSoundMuted;/);
  // visibilitychange must be unsubscribed, or every re-render leaks a listener.
  assert.match(
    widgetRuntime,
    /document\.removeEventListener\("visibilitychange", syncWatchingState\)/,
  );
});

test("the audio context is primed on a real user gesture", () => {
  // Browsers keep an AudioContext suspended until a gesture, so priming on send
  // is what stops the first chime of a conversation being dropped.
  assert.match(soundModule, /export function primeNotificationSound/);
  assert.match(soundModule, /context\.state !== "suspended"/);
  assert.equal(
    widgetRuntime.match(/primeNotificationSound\(\)/g)?.length,
    3,
    "prime on send, on starting from home, and on unmuting",
  );
});

test("the visitor can mute it and the choice survives a reload", () => {
  assert.match(soundModule, /ag_widget_sound_muted_v1/);
  assert.match(soundModule, /localStorage\.setItem/);
  // Storage is unavailable in privacy-restricted browsers, so both the read and
  // the write must be individually guarded rather than throwing into the UI.
  const readFn = soundModule.slice(
    soundModule.indexOf("export function isNotificationSoundMuted"),
    soundModule.indexOf("export function setNotificationSoundMuted"),
  );
  const writeFn = soundModule.slice(
    soundModule.indexOf("export function setNotificationSoundMuted"),
    soundModule.indexOf("export function primeNotificationSound"),
  );
  assert.match(readFn, /try \{[\s\S]*\} catch \{/);
  assert.match(writeFn, /try \{[\s\S]*\} catch \{/);
  assert.match(widgetRuntime, /setNotificationSoundMuted\(widgetPublicKey, nextMuted\)/);
  assert.match(widgetRuntime, /aria-pressed=\{!isSoundMuted\}/);
});

test("the mute preference is scoped per widget", () => {
  // One widget's preference must not silence another embedded on the same site.
  assert.match(
    soundModule,
    /return `\$\{MUTED_KEY_PREFIX\}_\$\{widgetPublicKey\}`/,
  );
  assert.match(soundModule, /isNotificationSoundMuted\(widgetPublicKey: string\)/);
});

test("audio failure never interrupts the conversation", () => {
  // Every entry point is guarded; a browser without Web Audio just stays silent.
  assert.match(soundModule, /let audioUnavailable = false/);
  assert.match(soundModule, /if \(!context\) return;/);
  assert.match(soundModule, /typeof window === "undefined"/);
});
