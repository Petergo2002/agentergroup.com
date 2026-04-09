import type { ConversationEndReason } from '@/lib/types';

export type ChatStreamEvent =
  | {
      type: 'meta';
      threadId: string;
      runId: string | null;
    }
  | {
      type: 'delta';
      delta: string;
    }
  | {
      type: 'complete';
      threadId: string;
      runId: string | null;
      sessionCompleted: boolean;
      endReason: ConversationEndReason | null;
    }
  | {
      type: 'error';
      error: string;
      code?: string;
    };

export const CHAT_STREAM_RESPONSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
} as const;

export function encodeChatStreamChunk(payload: ChatStreamEvent) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function createChatRequestError(
  response: Response,
  fallbackMessage: string,
) {
  const payload = await response.json().catch(() => null);
  const message =
    typeof payload?.error === 'string' ? payload.error : fallbackMessage;
  const error = new Error(message) as Error & { code?: string };

  if (typeof payload?.code === 'string') {
    error.code = payload.code;
  }

  return error;
}

export async function consumeChatStream(
  response: Response,
  onEvent: (event: ChatStreamEvent) => void,
) {
  if (!response.body) {
    throw new Error('No response stream from server.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let streamError: Error | null = null;
  let streamDone = false;

  const processEventData = (data: string) => {
    if (data === '[DONE]') {
      streamDone = true;
      return;
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }

    if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) {
      return;
    }

    const event = parsed as ChatStreamEvent;

    if (event.type === 'error') {
      const error = new Error(event.error) as Error & { code?: string };
      if (event.code) {
        error.code = event.code;
      }
      streamError = error;
      streamDone = true;
      return;
    }

    onEvent(event);
  };

  while (!streamDone) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    let separatorIndex = buffer.indexOf('\n\n');

    while (separatorIndex !== -1) {
      const eventBlock = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);

      for (const line of eventBlock.split('\n')) {
        if (line.startsWith('data: ')) {
          processEventData(line.slice(6).trim());
        }
      }

      if (streamError) {
        throw streamError;
      }

      if (streamDone) {
        break;
      }

      separatorIndex = buffer.indexOf('\n\n');
    }
  }

  buffer += decoder.decode(new Uint8Array(), { stream: false });

  if (buffer.trim()) {
    for (const line of buffer.split('\n')) {
      if (line.startsWith('data: ')) {
        processEventData(line.slice(6).trim());
      }
    }
  }

  if (streamError) {
    throw streamError;
  }
}
