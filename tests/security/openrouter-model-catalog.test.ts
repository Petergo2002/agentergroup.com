import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  OPENROUTER_DEFAULT_AGENT_MODEL,
  buildOpenRouterModelSectionsFromApi,
  getFallbackOpenRouterModelSections,
  getFlattenedModelOptions,
  getOpenRouterModelOptionById,
} from "../../src/lib/openrouter-models.ts";

const modelsRoute = readFileSync(
  "src/app/api/openrouter/models/route.ts",
  "utf8",
);

test("GPT-5.6 Luna is offered and correctly described", () => {
  const sections = getFallbackOpenRouterModelSections();
  const luna = getOpenRouterModelOptionById(sections, "openai/gpt-5.6-luna");

  assert.ok(luna, "GPT-5.6 Luna should be in the curated catalog");
  assert.equal(luna.section, "recommended");
  assert.equal(luna.pricing.prompt, "0.20");
  assert.equal(luna.pricing.completion, "1.20");

  // Cheaper than the current default on both sides of the meter.
  const mini = getOpenRouterModelOptionById(sections, OPENROUTER_DEFAULT_AGENT_MODEL);
  assert.ok(mini);
  assert.ok(Number(luna.pricing.prompt) < Number(mini.pricing.prompt));
  assert.ok(Number(luna.pricing.completion) < Number(mini.pricing.completion));

  // Luna Pro is the same model with reasoning.mode=pro: more reasoning tokens
  // and higher latency, which is the wrong trade for a website chat.
  assert.equal(
    getOpenRouterModelOptionById(sections, "openai/gpt-5.6-luna-pro"),
    null,
  );
});

test("the catalog never offers a model id OpenRouter no longer serves", () => {
  // `x-ai/grok-4` was retired upstream; a stale id saves fine and then fails at
  // chat time, so the catalog must not carry ids that cannot resolve.
  const sections = getFallbackOpenRouterModelSections();
  assert.equal(getOpenRouterModelOptionById(sections, "x-ai/grok-4"), null);
  assert.ok(getOpenRouterModelOptionById(sections, "x-ai/grok-4.6"));
});

test("models absent from the live listing are marked as fallback", () => {
  // Only Luna advertises tools in this stub, so every other curated entry must
  // be flagged rather than silently presented as available.
  const sections = buildOpenRouterModelSectionsFromApi([
    {
      id: "openai/gpt-5.6-luna",
      name: "OpenAI: GPT-5.6 Luna",
      context_length: 1_050_000,
      supported_parameters: ["tools"],
    },
  ]);
  const options = getFlattenedModelOptions(sections);
  const luna = options.find((option) => option.id === "openai/gpt-5.6-luna");

  assert.equal(luna?.isFallback, false);
  assert.ok(
    options
      .filter((option) => option.id !== "openai/gpt-5.6-luna")
      .every((option) => option.isFallback === true),
  );
});

test("the catalog is sourced from the unfiltered OpenRouter listing", () => {
  // `?supported_parameters=tools` returns batch pricing for OpenAI models —
  // about half the standard rate. The full listing carries correct pricing and
  // supported_parameters, and the tools filter is applied in code.
  const fetchedUrl = modelsRoute.match(
    /'(https:\/\/openrouter\.ai\/api\/v1\/models[^']*)'/,
  )?.[1];
  assert.equal(fetchedUrl, "https://openrouter.ai/api/v1/models");
});

test("only tool-capable models reach the picker", () => {
  // Everything in the product depends on tool calls: flag_missing_knowledge,
  // suggest_end_chat, calendar booking, and every Composio action.
  const sections = buildOpenRouterModelSectionsFromApi([
    {
      id: "openai/gpt-5.6-luna",
      supported_parameters: ["tools"],
    },
    {
      id: "openai/gpt-5-mini",
      supported_parameters: ["temperature"],
    },
  ]);
  const options = getFlattenedModelOptions(sections);

  assert.equal(
    options.find((option) => option.id === "openai/gpt-5.6-luna")?.isFallback,
    false,
  );
  // A model that does not advertise tools must not be treated as live.
  assert.equal(
    options.find((option) => option.id === "openai/gpt-5-mini")?.isFallback,
    true,
  );
});
