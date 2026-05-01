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
    const response = await fetch(
      'https://openrouter.ai/api/v1/models?supported_parameters=tools',
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
