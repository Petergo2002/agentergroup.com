import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveRequestLanguage, resolveStoredLanguage } from "../../src/lib/language-preference.ts";
import { demoReducer, INITIAL_DEMO, shouldAdvanceDemo } from "../../src/components/marketing/demo-state.ts";

test("first landing visit uses Swedish; other routes retain platform default", () => {
  assert.equal(resolveRequestLanguage(undefined, undefined, "https://avenro.se/?utm_source=demo"), "sv");
  assert.equal(resolveRequestLanguage(undefined, undefined, "https://avenro.se/login"), "en");
  assert.equal(resolveRequestLanguage(undefined, undefined, null), "en");
  assert.equal(resolveRequestLanguage(undefined, undefined, "invalid"), "en");
});

test("saved language takes precedence, including legacy preferences", () => {
  assert.equal(resolveRequestLanguage("en", "sv", "https://avenro.se/"), "en");
  assert.equal(resolveRequestLanguage("sv", "en", "https://avenro.se/"), "sv");
  assert.equal(resolveRequestLanguage(undefined, "en", "https://avenro.se/"), "en");
  assert.equal(resolveRequestLanguage("invalid", "en", "https://avenro.se/"), "en");
  assert.equal(resolveRequestLanguage("invalid", "invalid", "https://avenro.se/"), "sv");
});

test("missing or corrupt browser storage never replaces the server default", () => {
  assert.equal(resolveStoredLanguage(null, null, "sv"), "sv");
  assert.equal(resolveStoredLanguage("invalid", null, "sv"), "sv");
  assert.equal(resolveStoredLanguage(null, "en", "sv"), "en");
  assert.equal(resolveStoredLanguage("invalid", "en", "sv"), "en");
  assert.equal(resolveStoredLanguage("sv", "en", "en"), "sv");
});

test("autoplay visits all five steps, shows availability before confirmation and stops", () => {
  let state = demoReducer(INITIAL_DEMO, { type: "play" });
  const visited = [state.step];
  for (let i = 0; i < 4; i++) {
    state = demoReducer(state, { type: "tick" });
    visited.push(state.step);
  }
  assert.deepEqual(visited, [0, 1, 2, 3, 4]);
  assert.equal(state.playing, false);
  assert.deepEqual(demoReducer(state, { type: "tick" }), state);
});

test("pause and manual steps stop the timer until explicitly resumed", () => {
  const playing = demoReducer(INITIAL_DEMO, { type: "play" });
  const paused = demoReducer(playing, { type: "pause" });
  assert.deepEqual(demoReducer(paused, { type: "tick" }), paused);
  const selected = demoReducer(playing, { type: "step", step: 3 });
  assert.equal(selected.playing, false);
  assert.deepEqual(demoReducer(selected, { type: "tick" }), selected);
  assert.equal(demoReducer(demoReducer(selected, { type: "play" }), { type: "tick" }).step, 4);
});

test("time selection becomes the result and replay resets the whole example", () => {
  const result = demoReducer({ ...INITIAL_DEMO, step: 3, playing: true }, { type: "slot", slot: 1 });
  assert.deepEqual(result, { step: 4, slot: 1, playing: false });
  assert.deepEqual(demoReducer(result, { type: "slot", slot: 99 }), result);
  assert.deepEqual(demoReducer(result, { type: "replay" }), { ...INITIAL_DEMO, playing: true });
  assert.deepEqual(demoReducer(result, { type: "play" }), { ...INITIAL_DEMO, playing: true });
});

test("playback waits offscreen, in a hidden tab, and with reduced motion", () => {
  const state = demoReducer(INITIAL_DEMO, { type: "play" });
  const environment = { visible: true, pageVisible: true, reducedMotion: false };
  assert.equal(shouldAdvanceDemo(state, environment), true);
  assert.equal(shouldAdvanceDemo(state, { ...environment, visible: false }), false);
  assert.equal(shouldAdvanceDemo(state, { ...environment, pageVisible: false }), false);
  assert.equal(shouldAdvanceDemo(state, { ...environment, reducedMotion: true }), false);
  assert.equal(shouldAdvanceDemo({ ...state, step: 4 }, environment), false);
  assert.equal(shouldAdvanceDemo({ ...state, playing: false }, environment), false);
});
