/** A template's three deliverable parts. */
export type RenderedEmail = {
  subject: string;
  html: string;
  /** Plain-text alternative. Sending one measurably improves inbox placement. */
  text: string;
};
