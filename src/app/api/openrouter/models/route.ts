import { NextResponse } from 'next/server';
import {
  buildOpenRouterModelSectionsFromApi,
  getFallbackOpenRouterModelSections,
  OPENROUTER_DEFAULT_AGENT_MODEL,
} from '@/lib/openrouter-models';

export const revalidate = 3600;

interface OpenRouterModelsResponse {
  data?: Array<Record<string, unknown>>;
}

export async function GET() {
  try {
    // Deliberately unfiltered. `?supported_parameters=tools` returns batch
    // pricing for OpenAI models — about half the standard rate — which showed
    // GPT-5 Mini at 0.12/1.00 instead of 0.25/2.00. The full listing carries
    // correct pricing and `supported_parameters`, and
    // buildOpenRouterModelSectionsFromApi already applies the tools filter.
    const response = await fetch(
      'https://openrouter.ai/api/v1/models',
      {
        headers: {
          Accept: 'application/json',
        },
        next: { revalidate },
      },
    );

    if (!response.ok) {
      throw new Error(`OpenRouter returned ${response.status}.`);
    }

    const payload = (await response.json()) as OpenRouterModelsResponse;
    const sections = buildOpenRouterModelSectionsFromApi(payload.data ?? []);

    return NextResponse.json({
      defaultModel: OPENROUTER_DEFAULT_AGENT_MODEL,
      sections,
      source: 'openrouter',
    });
  } catch {
    return NextResponse.json({
      defaultModel: OPENROUTER_DEFAULT_AGENT_MODEL,
      sections: getFallbackOpenRouterModelSections(),
      source: 'fallback',
    });
  }
}
