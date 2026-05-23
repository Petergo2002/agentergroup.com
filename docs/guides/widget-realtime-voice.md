# Widget Realtime Voice

Status: planned, not implemented

Last updated: 2026-05-15

## Purpose

This document records the current product and technical direction for realtime voice in the public chat widget so the decision is preserved in the repo before implementation work starts.

## Decision

Agentergroup should pursue realtime voice for the public widget using:

- Gemini Live API native audio
- The `gemini-live-2.5-flash-native-audio` model
- Agentergroup backend as the runtime source of truth
- The existing widget agent runtime, knowledge, and connections stack

This is the chosen default path unless a later product or infrastructure decision explicitly replaces it.

## Product Goal

The public widget should eventually support a true voice mode where:

- A visitor can speak directly to the widget agent in realtime
- The agent responds with streamed voice in realtime
- The user can switch between text and voice inside the same widget session
- Knowledge base access, tool calls, and agent behavior remain consistent with the current widget chat experience

The target experience is closer to ChatGPT or Gemini voice mode than to a simple "speech to text input" add-on.

## Architecture Direction

The voice implementation should not bypass Agentergroup backend logic.

Preferred architecture:

- The browser widget captures microphone input
- The widget sends audio to an Agentergroup backend voice session proxy
- The backend proxy manages the Live API session with Gemini
- The backend continues to own agent instructions, knowledge retrieval, tool execution, guardrails, and persistence
- Voice transcripts are persisted into the same widget session model as normal text messages where appropriate

This means voice should share the same backend foundations as the current widget runtime rather than becoming a separate frontend-only stack.

## Why This Path

- Reuses the existing widget agent runtime instead of splitting product behavior across two systems
- Keeps knowledge base behavior aligned with current widget chat
- Keeps Composio connections and tool execution aligned with current widget chat
- Preserves workspace-level controls, logging, and session ownership on the backend
- Makes it easier to support mixed text and voice conversations in one session

## Explicit Non-Goals For V1

- No custom voice cloning in the first version
- No separate non-Google TTS or STT stack in the first version
- No direct browser-to-Google production architecture where Agentergroup backend is skipped
- No attempt to replace the current text widget flow during initial rollout

## Constraints To Remember

- Gemini Live native audio is the preferred realtime path
- The implementation should remain backend-mediated
- Voice mode should reuse the same widget session identity where possible
- Voice mode should remain compatible with current knowledge and connections behavior
- The system should be designed so a future hybrid voice architecture remains possible if brand voice or custom voice becomes important later

## Known Tradeoff

If Agentergroup stays on Gemini Live native audio, voice quality improvements are partly under Google's control. We can tune voice choice, prompting, session behavior, interruption handling, and UX, but the core native voice engine remains Google's.

If stronger custom voice requirements emerge later, a future hybrid architecture may be needed. That is not the chosen path for the first implementation.

## Recommended Future Implementation Order

1. Add a backend realtime voice proxy for widget sessions
2. Add widget client voice state management and microphone capture
3. Stream model audio responses back to the widget
4. Persist transcripts and session events into the existing widget conversation model
5. Reconcile voice mode with tool calls, knowledge responses, and interruption handling
6. Polish UX, browser compatibility, and observability

## Implementation Notes

- Treat this document as the product decision record for widget realtime voice
- Do not treat this file as an implementation-complete specification
- If implementation starts later, create a dedicated execution plan that references this document
