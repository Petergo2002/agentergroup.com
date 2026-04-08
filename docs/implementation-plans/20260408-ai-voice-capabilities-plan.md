# AI Voice Capabilities Plan

Status note:

- This is a reminder and planning placeholder for upcoming work.
- Voice is not implemented yet in the current product surfaces.
- This document should be refined before engineering starts.

## Goal

Prepare the platform to support AI voice interactions soon, most likely starting with the widget runtime and then expanding into preview and internal agent surfaces.

## Why This Exists

The current platform already has:

- agent chat runtime
- widget deployment and hosted/embed runtime
- transcript persistence
- session lifecycle handling
- public runtime auth and locking

That makes voice a natural next-step feature, but it needs an explicit plan so it does not get bolted on as an unstructured add-on.

## Intended Outcome

When this work is implemented, the product should support a voice-enabled conversation flow that still respects the existing runtime model:

- clear session ownership
- safe public runtime access
- persisted transcripts where appropriate
- deployable widget behavior
- analytics visibility
- privacy and consent controls

## Likely First Scope

Start with the public widget runtime.

Initial target:

- microphone input in the widget
- speech-to-text for user turns
- normal agent processing through the existing chat/runtime model where possible
- text and/or spoken assistant responses
- transcript persistence aligned with current widget session records

Follow-up surfaces after that:

- widget preview
- authenticated agent preview chat
- optional internal operator tooling for debugging voice sessions

## Likely Technical Areas

### 1. Voice input and output in the widget runtime

- add microphone capture controls to `apps/widget-v2`
- define push-to-talk vs live streaming behavior
- define interruption/cancel behavior while the assistant is responding
- decide whether first release is input-only, output-only, or full duplex

### 2. Runtime transport model

- evaluate whether voice should run through the existing request/response chat endpoints
- or whether a dedicated realtime transport is needed for low-latency voice interaction
- keep session locking and session identity rules explicit

### 3. Transcript and storage behavior

- persist the final transcript in a form compatible with current analytics and privacy operations
- decide whether raw audio should be stored, discarded immediately, or stored only temporarily
- define what counts as the canonical transcript when speech recognition changes wording

### 4. Privacy, consent, and retention

- require explicit user consent before microphone use
- update public privacy copy if voice/audio data is introduced
- define retention rules for transcript and any temporary audio artifacts
- keep hosted and embedded widget behavior aligned with the existing public runtime security model

### 5. Deployment and configuration

- add widget-level settings for voice availability
- allow voice to be enabled per widget or per attached agent
- make redeploy requirements clear when runtime-facing voice config changes

### 6. Observability and analytics

- capture voice session failures separately from normal text chat failures
- expose enough metadata to debug microphone, transport, transcription, and playback issues
- extend analytics carefully without polluting the clean customer transcript view

## Non-Goals For The First Pass

- full contact-center telephony
- outbound calling
- SIP or PSTN integrations
- broad multi-channel voice orchestration
- storing large raw audio archives by default
- solving every realtime avatar or multimodal use case in the same phase

## Open Questions

- Should the first release support voice input only, or both input and spoken output?
- Should voice be widget-only first, or should preview chat ship at the same time?
- Do we want a strict transcript-only storage model for v1?
- Does the current runtime contract stay good enough, or do we need a dedicated realtime voice path?
- How should analytics distinguish text sessions from voice-assisted sessions?

## Candidate Touchpoints

Likely implementation areas when work begins:

- `apps/widget-v2/src/Widget.tsx`
- `apps/widget-v2/src/lib/api.ts`
- `src/app/api/public/widgets/[widgetPublicKey]/bootstrap/route.ts`
- `src/app/api/public/widgets/[widgetPublicKey]/chat/route.ts`
- `src/app/api/public/widgets/[widgetPublicKey]/events/route.ts`
- `src/app/api/public/widgets/[widgetPublicKey]/complete/route.ts`
- `src/lib/widgets/server.ts`
- `src/lib/dashboard/analytics.ts`
- `src/components/analytics/AnalyticsWorkspaceView.tsx`
- `docs/architecture.md`

## Suggested Execution Order

1. Confirm product shape for v1 voice support.
2. Choose the transport model and session semantics.
3. Implement widget UI and runtime contract changes.
4. Add transcript/privacy/retention handling.
5. Add analytics and operational debugging support.
6. Expand to preview/internal surfaces only after widget voice is stable.

## Reminder

This should be treated as an upcoming implementation track, not as committed finished architecture.

Before work starts, convert this placeholder into a sharper implementation plan with:

- chosen transport approach
- exact API changes
- data model changes
- privacy decisions
- rollout and verification steps
