export const KNOWLEDGE_CHUNK_TARGET = 1200;
export const KNOWLEDGE_CHUNK_OVERLAP = 200;
export const KNOWLEDGE_CHUNK_MINIMUM = 150;

function normalizeWhitespace(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function splitLargeBlock(block: string) {
  const sentences = block
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= 1) {
    const pieces: string[] = [];

    for (let index = 0; index < block.length; index += KNOWLEDGE_CHUNK_TARGET) {
      pieces.push(block.slice(index, index + KNOWLEDGE_CHUNK_TARGET).trim());
    }

    return pieces.filter(Boolean);
  }

  const pieces: string[] = [];
  let current = "";

  const pushCurrent = () => {
    const trimmed = current.trim();

    if (trimmed.length > 0) {
      pieces.push(trimmed);
    }

    current = "";
  };

  for (const sentence of sentences) {
    if (!current) {
      current = sentence;
      continue;
    }

    if (`${current} ${sentence}`.length <= KNOWLEDGE_CHUNK_TARGET) {
      current = `${current} ${sentence}`;
      continue;
    }

    pushCurrent();
    current = sentence;
  }

  pushCurrent();
  return pieces;
}

function getOverlapSlice(value: string) {
  if (value.length <= KNOWLEDGE_CHUNK_OVERLAP) {
    return value;
  }

  return value.slice(-KNOWLEDGE_CHUNK_OVERLAP);
}

export function normalizeKnowledgeText(value: string) {
  return normalizeWhitespace(value);
}

export function chunkKnowledgeText(value: string) {
  const normalized = normalizeKnowledgeText(value);

  if (!normalized) {
    return [];
  }

  if (normalized.length <= KNOWLEDGE_CHUNK_TARGET) {
    return [
      {
        content: normalized,
        chunkIndex: 0,
        contentLength: normalized.length,
      },
    ];
  }

  const blocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .flatMap((block) =>
      block.length > KNOWLEDGE_CHUNK_TARGET ? splitLargeBlock(block) : [block],
    );

  const chunks: Array<{ content: string; chunkIndex: number; contentLength: number }> = [];
  let current = "";

  const pushCurrent = () => {
    const trimmed = current.trim();

    if (trimmed.length > 0) {
      chunks.push({
        content: trimmed,
        chunkIndex: chunks.length,
        contentLength: trimmed.length,
      });
    }
  };

  for (const block of blocks) {
    if (!current) {
      current = block;
      continue;
    }

    const candidate = `${current}\n\n${block}`;

    if (candidate.length <= KNOWLEDGE_CHUNK_TARGET) {
      current = candidate;
      continue;
    }

    pushCurrent();
    current = `${getOverlapSlice(current)}\n\n${block}`.trim();
  }

  pushCurrent();

  // Very long sentences and paragraph overlap must never exceed worker input limits.
  // Keep short tails: dropping them loses facts at the end of a page.
  const boundedContent = chunks.flatMap((chunk) => {
    const pieces: string[] = [];
    for (let start = 0; start < chunk.content.length;) {
      const end = Math.min(start + KNOWLEDGE_CHUNK_TARGET, chunk.content.length);
      const piece = chunk.content.slice(start, end).trim();
      if (piece) pieces.push(piece);
      if (end === chunk.content.length) break;
      start = end - KNOWLEDGE_CHUNK_OVERLAP;
    }
    return pieces;
  });
  const normalizedChunks = boundedContent.map((content, chunkIndex) => ({
    content, chunkIndex, contentLength: content.length,
  }));

  if (normalizedChunks.length === 0) {
    return [
      {
        content: normalized,
        chunkIndex: 0,
        contentLength: normalized.length,
      },
    ];
  }

  return normalizedChunks;
}

export async function extractTextFromFile(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "text/plain" || mimeType === "text/markdown") {
    return new TextDecoder().decode(bytes);
  }

  if (mimeType === "application/pdf") {
    const pdfjs = await import("npm:pdfjs-dist@4.10.38/legacy/build/pdf.mjs");
    const document = await pdfjs.getDocument({
      data: bytes,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item: unknown) =>
          typeof item === "object" && item !== null && "str" in item
            ? String((item as { str: string }).str)
            : "",
        )
        .join(" ")
        .trim();

      if (text) {
        pages.push(text);
      }
    }

    return pages.join("\n\n");
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}
