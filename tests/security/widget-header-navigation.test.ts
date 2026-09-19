import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const widget = readFileSync("apps/widget-v2/src/Widget.tsx", "utf8");
const chatView = readFileSync("apps/widget-v2/src/components/ChatView.tsx", "utf8");

/**
 * Header visibility, mirrored from Widget.tsx. Kept as plain predicates so
 * every reachable combination can be enumerated rather than spot-checked.
 */
function header(state: {
  chooserConfig: boolean;
  hasAgent: boolean;
  tab: "home" | "messages" | "contact";
  hasStarted: boolean;
  listOpen: boolean;
  conversations: number;
}) {
  const isChooserMode = state.chooserConfig && !state.hasAgent;
  const isReadingThread =
    state.tab === "messages" && state.hasStarted && !state.listOpen;
  const surfaceNav = state.hasAgent && !isChooserMode && !isReadingThread;
  const historyButton =
    !state.listOpen &&
    !surfaceNav &&
    !isReadingThread &&
    (state.hasStarted || state.conversations > 0);
  return { surfaceNav, historyButton, threadBack: isReadingThread };
}

test("no state can reach the conversation list by two controls at once", () => {
  // The icon existed alongside the Messages tab on every ordinary screen,
  // which is the duplication that prompted removing it.
  for (const tab of ["home", "messages", "contact"] as const)
    for (const chooserConfig of [false, true])
      for (const hasAgent of [false, true])
        for (const hasStarted of [false, true])
          for (const listOpen of [false, true])
            for (const conversations of [0, 2]) {
              if (chooserConfig && hasAgent) continue;
              const h = header({ chooserConfig, hasAgent, tab, hasStarted, listOpen, conversations });
              const routes = [h.surfaceNav, h.historyButton, h.threadBack].filter(Boolean).length;
              assert.ok(
                routes <= 1,
                `two routes at once: tab=${tab} agent=${hasAgent} started=${hasStarted}`,
              );
            }
});

test("and no state is left without one", () => {
  // Removing the icon outright would have stranded a reader inside a thread:
  // the surface nav hides there and ChatView has no exit of its own.
  for (const tab of ["home", "messages", "contact"] as const)
    for (const chooserConfig of [false, true])
      for (const hasAgent of [false, true])
        for (const hasStarted of [false, true])
          for (const conversations of [0, 2]) {
            if (chooserConfig && hasAgent) continue;
            if (!hasStarted && conversations === 0) continue; // nothing to go back to
            const h = header({ chooserConfig, hasAgent, tab, hasStarted, listOpen: false, conversations });
            assert.ok(
              h.surfaceNav || h.historyButton || h.threadBack,
              `stranded: tab=${tab} chooser=${chooserConfig} agent=${hasAgent} started=${hasStarted} convos=${conversations}`,
            );
          }
});

test("the thread's way out is a back arrow, where the other back arrows are", () => {
  assert.match(widget, /key="thread-back-button"/);
  assert.match(widget, /\) : isReadingThread \? \(/);
  // ChatView still owns no navigation, which is why the header must.
  assert.doesNotMatch(chatView, /ChevronLeft|ArrowLeft/);
});

test("the history icon is gated, not merely present", () => {
  assert.match(widget, /const showHistoryButton =/);
  assert.match(widget, /\{showHistoryButton \? \(/);
  // The old condition showed it whenever there was any history at all.
  assert.doesNotMatch(
    widget,
    /\{!showConversationList &&\s*\(hasStarted \|\| conversations\.length > 0\) \? \(/,
  );
});

test("every route to the list refreshes it", () => {
  // A stale list is worse than no list: it hides the conversation the visitor
  // just had. All three entry points call the refresh.
  // Four of them: the thread back arrow, the history icon, the bottom nav,
  // and the standalone desktop shell's own nav.
  const entries = widget.match(/setShowConversationList\(true\);\s*\n\s*setActiveTab\("messages"\);\s*\n\s*void refreshConversationList\(\);/g);
  assert.equal(entries?.length, 4, "an entry point skips refreshConversationList");
});
