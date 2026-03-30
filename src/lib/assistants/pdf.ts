import "server-only";

interface PdfPageSpec {
  contentObjectId: number;
  pageObjectId: number;
  lines: string[];
}

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 72;
const MARGIN_TOP = 72;
const MARGIN_BOTTOM = 72;
const FONT_SIZE = 12;
const LINE_HEIGHT = 16;
const MAX_CHARS_PER_LINE = 88;

function escapePdfText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapLine(line: string, maxChars: number) {
  const normalized = line.trimEnd();

  if (!normalized) {
    return [""];
  }

  const result: string[] = [];
  let remaining = normalized;

  while (remaining.length > maxChars) {
    const slice = remaining.slice(0, maxChars + 1);
    const breakIndex = Math.max(slice.lastIndexOf(" "), slice.lastIndexOf("\t"));
    const safeBreak = breakIndex > Math.floor(maxChars * 0.5) ? breakIndex : maxChars;
    const nextLine = remaining.slice(0, safeBreak).trim();

    result.push(nextLine || remaining.slice(0, maxChars));
    remaining = remaining.slice(safeBreak).trimStart();
  }

  if (remaining.length > 0 || result.length === 0) {
    result.push(remaining);
  }

  return result;
}

function normalizeLines(text: string) {
  const rawLines = text.replace(/\r\n?/g, "\n").split("\n");
  return rawLines.flatMap((line) => wrapLine(line, MAX_CHARS_PER_LINE));
}

function chunkLinesIntoPages(lines: string[]) {
  const usableHeight = PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;
  const linesPerPage = Math.max(1, Math.floor(usableHeight / LINE_HEIGHT));
  const pages: string[][] = [];

  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage));
  }

  return pages.length > 0 ? pages : [[""]];
}

function buildPageContent(lines: string[]) {
  const startY = PAGE_HEIGHT - MARGIN_TOP;
  const commands = [
    "BT",
    `/F1 ${FONT_SIZE} Tf`,
    `${LINE_HEIGHT} TL`,
    `${MARGIN_X} ${startY} Td`,
  ];

  lines.forEach((line, index) => {
    if (index > 0) {
      commands.push("T*");
    }
    commands.push(`(${escapePdfText(line)}) Tj`);
  });

  commands.push("ET");

  return commands.join("\n");
}

function buildPdfSource(pageSpecs: PdfPageSpec[]) {
  const objects: string[] = [];
  const fontObjectId = pageSpecs.length * 2 + 3;
  const pageRefs = pageSpecs.map((page) => `${page.pageObjectId} 0 R`).join(" ");

  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  objects.push(
    `2 0 obj\n<< /Type /Pages /Count ${pageSpecs.length} /Kids [${pageRefs}] >>\nendobj`,
  );

  for (const page of pageSpecs) {
    const stream = buildPageContent(page.lines);
    const length = Buffer.byteLength(stream, "latin1");

    objects.push(
      `${page.contentObjectId} 0 obj\n<< /Length ${length} >>\nstream\n${stream}\nendstream\nendobj`,
    );
    objects.push(
      `${page.pageObjectId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${page.contentObjectId} 0 R >>\nendobj`,
    );
  }

  objects.push(
    `${fontObjectId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`,
  );

  let output = "%PDF-1.4\n";
  const offsets = [0];

  for (const object of objects) {
    offsets.push(Buffer.byteLength(output, "latin1"));
    output += `${object}\n`;
  }

  const xrefStart = Buffer.byteLength(output, "latin1");
  output += `xref\n0 ${objects.length + 1}\n`;
  output += "0000000000 65535 f \n";

  for (let index = 1; index < offsets.length; index += 1) {
    output += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(output, "latin1");
}

export function generatePdfFromText(text: string) {
  const lines = normalizeLines(text);
  const pages = chunkLinesIntoPages(lines);
  const pageSpecs: PdfPageSpec[] = pages.map((pageLines, index) => ({
    contentObjectId: index * 2 + 3,
    pageObjectId: index * 2 + 4,
    lines: pageLines,
  }));

  return buildPdfSource(pageSpecs);
}
