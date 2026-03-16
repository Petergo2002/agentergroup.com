declare module "npm:pdfjs-dist@4.10.38/legacy/build/pdf.mjs" {
  export function getDocument(options: Record<string, unknown>): {
    promise: Promise<{
      numPages: number;
      getPage(pageNumber: number): Promise<{
        getTextContent(): Promise<{
          items: unknown[];
        }>;
      }>;
    }>;
  };
}
