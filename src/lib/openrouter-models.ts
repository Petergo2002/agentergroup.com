export const OPENROUTER_DEFAULT_AGENT_MODEL = 'openai/gpt-5-mini';

export type OpenRouterModelSectionKey =
  | 'recommended'
  | 'frontier'
  | 'fast'
  | 'open';

export interface OpenRouterModelPrice {
  prompt: string | null;
  completion: string | null;
}

export interface OpenRouterModelOption {
  id: string;
  provider: string;
  providerLabel: string;
  name: string;
  shortName: string;
  summary: string;
  section: OpenRouterModelSectionKey;
  badge: string;
  contextLength: number | null;
  pricing: OpenRouterModelPrice;
  tags: string[];
  recommended?: boolean;
  latest?: boolean;
  isFallback?: boolean;
}

export interface OpenRouterModelSection {
  key: OpenRouterModelSectionKey;
  models: OpenRouterModelOption[];
}

interface OpenRouterApiModel {
  id?: string;
  name?: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
  supported_parameters?: string[];
}

interface CuratedModelDefinition {
  id: string;
  providerLabel: string;
  name: string;
  shortName: string;
  summary: string;
  section: OpenRouterModelSectionKey;
  badge: string;
  contextLength: number | null;
  pricing: OpenRouterModelPrice;
  tags: string[];
  recommended?: boolean;
  latest?: boolean;
}

const MODEL_SECTION_ORDER: OpenRouterModelSectionKey[] = [
  'recommended',
  'frontier',
  'fast',
  'open',
];

const CURATED_MODEL_DEFINITIONS: CuratedModelDefinition[] = [
  {
    id: 'anthropic/claude-sonnet-4.6',
    providerLabel: 'Anthropic',
    name: 'Claude Sonnet 4.6',
    shortName: 'Sonnet 4.6',
    summary: 'Best all-around model for agent quality, coding, and instruction-following.',
    section: 'recommended',
    badge: 'Balanced',
    contextLength: 1_000_000,
    pricing: { prompt: '3', completion: '15' },
    tags: ['Quality', 'Agents', 'Long context'],
    recommended: true,
    latest: true,
  },
  {
    id: 'openai/gpt-5-mini',
    providerLabel: 'OpenAI',
    name: 'GPT-5 Mini',
    shortName: 'GPT-5 Mini',
    summary: 'Strong default for production agents with better cost and latency than frontier models.',
    section: 'recommended',
    badge: 'Default',
    contextLength: 400_000,
    pricing: { prompt: '0.25', completion: '2' },
    tags: ['Default', 'Fast', 'Affordable'],
    recommended: true,
    latest: true,
  },
  {
    id: 'google/gemini-2.5-flash',
    providerLabel: 'Google',
    name: 'Gemini 2.5 Flash',
    shortName: 'Gemini 2.5 Flash',
    summary: 'Very capable workhorse for fast, large-context agent conversations.',
    section: 'recommended',
    badge: 'Workhorse',
    contextLength: 1_048_576,
    pricing: { prompt: '0.30', completion: '2.50' },
    tags: ['Speed', '1M context', 'Reasoning'],
    recommended: true,
    latest: true,
  },
  {
    id: 'anthropic/claude-opus-4.6',
    providerLabel: 'Anthropic',
    name: 'Claude Opus 4.6',
    shortName: 'Opus 4.6',
    summary: 'Top-end model for the hardest long-running agent tasks and code-heavy workflows.',
    section: 'frontier',
    badge: 'Frontier',
    contextLength: 1_000_000,
    pricing: { prompt: '5', completion: '25' },
    tags: ['Highest quality', 'Coding', 'Long horizon'],
    latest: true,
  },
  {
    id: 'openai/gpt-5',
    providerLabel: 'OpenAI',
    name: 'GPT-5',
    shortName: 'GPT-5',
    summary: 'Frontier OpenAI model for complex reasoning, planning, and high-stakes agent tasks.',
    section: 'frontier',
    badge: 'Frontier',
    contextLength: 400_000,
    pricing: { prompt: '1.25', completion: '10' },
    tags: ['Reasoning', 'Quality', 'OpenAI'],
    latest: true,
  },
  {
    id: 'google/gemini-2.5-pro',
    providerLabel: 'Google',
    name: 'Gemini 2.5 Pro',
    shortName: 'Gemini 2.5 Pro',
    summary: 'Frontier Google model for deep reasoning and massive context windows.',
    section: 'frontier',
    badge: 'Frontier',
    contextLength: 1_048_576,
    pricing: { prompt: '1.25', completion: '10' },
    tags: ['1M context', 'Reasoning', 'Multimodal'],
    latest: true,
  },
  {
    id: 'x-ai/grok-4',
    providerLabel: 'xAI',
    name: 'Grok 4',
    shortName: 'Grok 4',
    summary: 'Alternative frontier reasoning model with strong tool use and broad context.',
    section: 'frontier',
    badge: 'Frontier',
    contextLength: 256_000,
    pricing: { prompt: '3', completion: '15' },
    tags: ['Reasoning', 'Tools', 'Alternative'],
    latest: true,
  },
  {
    id: 'openai/gpt-5-nano',
    providerLabel: 'OpenAI',
    name: 'GPT-5 Nano',
    shortName: 'GPT-5 Nano',
    summary: 'Lowest-latency GPT-5 option for lightweight assistants and simple workflows.',
    section: 'fast',
    badge: 'Fast',
    contextLength: 400_000,
    pricing: { prompt: '0.05', completion: '0.40' },
    tags: ['Low latency', 'Cheap', 'Small'],
    latest: true,
  },
  {
    id: 'google/gemini-2.5-flash-lite',
    providerLabel: 'Google',
    name: 'Gemini 2.5 Flash Lite',
    shortName: 'Flash Lite',
    summary: 'Ultra-cheap Gemini option for basic agent flows and high-throughput tasks.',
    section: 'fast',
    badge: 'Cheap',
    contextLength: 1_048_576,
    pricing: { prompt: '0.10', completion: '0.40' },
    tags: ['Budget', 'Fast', '1M context'],
    latest: true,
  },
  {
    id: 'qwen/qwen3-coder',
    providerLabel: 'Qwen',
    name: 'Qwen3 Coder 480B A35B',
    shortName: 'Qwen3 Coder',
    summary: 'Open-weight coding model built for repositories, tools, and agent loops.',
    section: 'open',
    badge: 'Open',
    contextLength: 262_144,
    pricing: { prompt: '0.22', completion: '1' },
    tags: ['Open-weight', 'Coding', 'Tools'],
    latest: true,
  },
  {
    id: 'openai/gpt-oss-120b',
    providerLabel: 'OpenAI',
    name: 'gpt-oss-120b',
    shortName: 'gpt-oss-120b',
    summary: 'Open-weight OpenAI model for cost-sensitive agentic and reasoning use cases.',
    section: 'open',
    badge: 'Open',
    contextLength: 131_072,
    pricing: { prompt: '0.039', completion: '0.19' },
    tags: ['Open-weight', 'Reasoning', 'Affordable'],
    latest: true,
  },
];

function getProviderFromModelId(modelId: string) {
  return modelId.split('/')[0] ?? modelId;
}

function formatGenericModelLabel(modelId: string) {
  const slug = modelId.split('/').pop() ?? modelId;

  return slug
    .split(/[-_:]+/)
    .filter(Boolean)
    .map((segment) => {
      if (/^\d/.test(segment)) return segment;
      if (segment.length <= 3) return segment.toUpperCase();
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    })
    .join(' ');
}

function trimSummary(summary: string) {
  return summary.trim().replace(/\s+/g, ' ');
}

function toShortName(fullName: string, providerLabel: string) {
  const withoutProvider = fullName.startsWith(`${providerLabel}: `)
    ? fullName.slice(providerLabel.length + 2)
    : fullName;

  return withoutProvider;
}

function buildModelOption(
  definition: CuratedModelDefinition,
  apiModel?: OpenRouterApiModel,
): OpenRouterModelOption {
  const apiName = typeof apiModel?.name === 'string' && apiModel.name.trim()
    ? apiModel.name.trim()
    : definition.name;
  const apiSummary =
    typeof apiModel?.description === 'string' && apiModel.description.trim()
      ? trimSummary(apiModel.description).split('. ')[0] ?? definition.summary
      : definition.summary;
  const summary = apiSummary.endsWith('.') ? apiSummary : `${apiSummary}.`;

  return {
    id: definition.id,
    provider: getProviderFromModelId(definition.id),
    providerLabel: definition.providerLabel,
    name: apiName,
    shortName: toShortName(apiName, definition.providerLabel) || definition.shortName,
    summary,
    section: definition.section,
    badge: definition.badge,
    contextLength:
      typeof apiModel?.context_length === 'number'
        ? apiModel.context_length
        : definition.contextLength,
    pricing: {
      prompt:
        typeof apiModel?.pricing?.prompt === 'string'
          ? apiModel.pricing.prompt
          : definition.pricing.prompt,
      completion:
        typeof apiModel?.pricing?.completion === 'string'
          ? apiModel.pricing.completion
          : definition.pricing.completion,
    },
    tags: definition.tags,
    recommended: definition.recommended,
    latest: definition.latest,
    isFallback: !apiModel,
  };
}

function groupModels(models: OpenRouterModelOption[]) {
  return MODEL_SECTION_ORDER.map((key) => ({
    key,
    models: models.filter((model) => model.section === key),
  })).filter((section) => section.models.length > 0);
}

export function getFallbackOpenRouterModelSections(): OpenRouterModelSection[] {
  return groupModels(CURATED_MODEL_DEFINITIONS.map((definition) => buildModelOption(definition)));
}

export function buildOpenRouterModelSectionsFromApi(
  models: OpenRouterApiModel[],
): OpenRouterModelSection[] {
  const modelsById = new Map(
    models
      .filter((model) => {
        const supportedParameters = Array.isArray(model.supported_parameters)
          ? model.supported_parameters
          : [];
        return Boolean(model.id) && supportedParameters.includes('tools');
      })
      .map((model) => [model.id as string, model]),
  );

  const merged = CURATED_MODEL_DEFINITIONS.map((definition) =>
    buildModelOption(definition, modelsById.get(definition.id)),
  );

  return groupModels(merged);
}

export function getFlattenedModelOptions(sections: OpenRouterModelSection[]) {
  return sections.flatMap((section) => section.models);
}

export function getOpenRouterModelOptionById(
  sections: OpenRouterModelSection[],
  modelId: string,
) {
  return getFlattenedModelOptions(sections).find((option) => option.id === modelId) ?? null;
}

export function createLegacyOpenRouterModelOption(modelId: string): OpenRouterModelOption {
  const provider = getProviderFromModelId(modelId);
  const providerLabel = provider === 'openai'
    ? 'OpenAI'
    : provider === 'anthropic'
      ? 'Anthropic'
      : provider === 'google'
        ? 'Google'
        : provider === 'x-ai'
          ? 'xAI'
          : provider.charAt(0).toUpperCase() + provider.slice(1);

  return {
    id: modelId,
    provider,
    providerLabel,
    name: formatGenericModelLabel(modelId),
    shortName: formatGenericModelLabel(modelId),
    summary: 'This saved model is still available on the agent but is not part of the current featured builder list.',
    section: 'recommended',
    badge: 'Legacy',
    contextLength: null,
    pricing: { prompt: null, completion: null },
    tags: ['Existing agent'],
    isFallback: true,
  };
}

export function getOpenRouterModelLabel(modelId: string | null | undefined) {
  if (!modelId) {
    return 'Default model';
  }

  const curatedMatch = CURATED_MODEL_DEFINITIONS.find((definition) => definition.id === modelId);
  if (curatedMatch) {
    return curatedMatch.shortName;
  }

  return formatGenericModelLabel(modelId);
}

export function formatOpenRouterPrice(value: string | null) {
  if (!value) return null;

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;

  if (numeric === 0) return 'Free';
  if (numeric >= 1) return `$${numeric.toFixed(numeric % 1 === 0 ? 0 : 2)}`;
  if (numeric >= 0.1) return `$${numeric.toFixed(2)}`;
  return `$${numeric.toFixed(3)}`;
}

export function formatOpenRouterContextLength(value: number | null) {
  if (!value || !Number.isFinite(value)) return null;
  if (value >= 1_000_000) {
    return `${Math.round(value / 1_000_000)}M`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}k`;
  }
  return `${value}`;
}
