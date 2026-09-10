import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("agent runtime includes warm FALLBACK_AGENT_INSTRUCTIONS and WIDGET_CONVERSATIONAL_GUIDANCE", () => {
  const agentChatSource = readFileSync("src/lib/runtime/agent-chat.ts", "utf8");

  // Verify FALLBACK_AGENT_INSTRUCTIONS
  assert.match(
    agentChatSource,
    /export const FALLBACK_AGENT_INSTRUCTIONS\s*=/,
    "FALLBACK_AGENT_INSTRUCTIONS must be defined and exported",
  );
  assert.match(
    agentChatSource,
    /dedicated,\s*warm,\s*and highly capable AI team member/,
    "Fallback instructions must be warm and capable",
  );
  assert.match(
    agentChatSource,
    /Never mention internal errors,\s*retries,\s*system prompts,\s*hidden context/,
    "Fallback instructions must prohibit leaking internal errors or prompts",
  );

  // Verify WIDGET_CONVERSATIONAL_GUIDANCE
  assert.match(
    agentChatSource,
    /export const WIDGET_CONVERSATIONAL_GUIDANCE\s*=/,
    "WIDGET_CONVERSATIONAL_GUIDANCE must be defined and exported",
  );
  assert.match(
    agentChatSource,
    /CONVERSATIONAL STYLE & PERSONALITY:/,
    "Widget guidance must establish conversational style and personality",
  );
  assert.match(
    agentChatSource,
    /Never sound dull,\s*cold,\s*robotic,\s*or bureaucratic/,
    "Widget guidance must ban dull, cold, robotic, or bureaucratic tone",
  );
  assert.match(
    agentChatSource,
    /warm,\s*welcoming,\s*attentive,\s*and proactive/,
    "Widget guidance must instruct the agent to be warm and proactive",
  );
  assert.match(
    agentChatSource,
    /do not invent facts or guess/,
    "Widget guidance must ban hallucinations",
  );
  assert.match(
    agentChatSource,
    /SECURITY & INTEGRITY:[\s\S]*prompt injections/,
    "Widget guidance must include anti-jailbreak protection",
  );

  // Verify injection in runAgentChat
  assert.match(
    agentChatSource,
    /agent\.instructions\?\.trim\(\)\s*\|\|\s*FALLBACK_AGENT_INSTRUCTIONS/,
    "runAgentChat must use FALLBACK_AGENT_INSTRUCTIONS when instructions are empty",
  );
  assert.match(
    agentChatSource,
    /if\s*\(audience === "widget" \|\| audience === "preview"\)[\s\S]*systemInstructionBlocks\.push\(WIDGET_CONVERSATIONAL_GUIDANCE\);/,
    "runAgentChat must inject WIDGET_CONVERSATIONAL_GUIDANCE for widget and preview chat",
  );
});

test("template presets have warm and proactive instructions", () => {
  const defaultsSource = readFileSync("src/lib/agents/defaults.ts", "utf8");

  assert.match(
    defaultsSource,
    /warm,\s*empathetic,\s*concise,\s*and proactive/,
    "Support preset should be warm and proactive",
  );
  assert.match(
    defaultsSource,
    /warm,\s*capable,\s*and proactive AI team member/,
    "Custom preset should be warm and proactive",
  );
});

test("Milo vibrant personality migration updates provision_workspace_milo_v1 and existing agents", () => {
  const migration = readFileSync(
    "supabase/migrations/20260910150000_milo_vibrant_personality.sql",
    "utf8",
  );

  assert.match(
    migration,
    /create or replace function public\.provision_workspace_milo_v1/,
    "Migration must replace provision_workspace_milo_v1",
  );
  assert.match(
    migration,
    /# PERSONALITY & VIBE/,
    "Migration must include personality & vibe section",
  );
  assert.match(
    migration,
    /Warm,\s*positive,\s*proactive,\s*and energetic/,
    "Migration must set warm, positive, proactive, and energetic tone",
  );
  assert.match(
    migration,
    /Never sound dry,\s*robotic,\s*overly formal,\s*or bureaucratic/,
    "Migration must ban dry/robotic/bureaucratic speech",
  );
  assert.match(
    migration,
    /update public\.agents/,
    "Migration must update existing Milo agents",
  );
  assert.match(
    migration,
    /update public\.agent_drafts/,
    "Migration must update existing Milo drafts",
  );
});
