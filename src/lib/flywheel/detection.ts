import { createHash } from "node:crypto";

export interface UnansweredQueryDetectionInput {
  question: string;
  assistantAnswer: string;
  knowledgeMatchCount: number;
  runtimeHadError?: boolean;
}

export interface UnansweredQueryDetectionResult {
  shouldCreate: boolean;
  reason: string;
  confidence: number;
}

const FALLBACK_PATTERNS = [
  /sorry[, ]+i (?:had trouble|can't|cannot|couldn't|could not)/i,
  /\bi (?:do not|don't) (?:know|have enough information|have that information)/i,
  /\bi(?:'m| am) not sure\b/i,
  /\bi can't find\b/i,
  /\bi cannot find\b/i,
  /\bnot enough (?:context|information)\b/i,
  /\bunable to answer\b/i,
  /\bplease try again\b/i,
  /\bcontact (?:support|us|the team)\b/i,
  /\bjag (?:vet inte|har inte (?:tillräckligt med )?(?:information|uppgifter|underlag)|hittar inte)\b/i,
  /\bjag (?:är|ar) inte säker\b/i,
  /\bjag (?:kan inte|kunde inte) (?:hitta|svara)\b/i,
  /\b(?:inte tillräckligt med|saknar) (?:information|kontext|underlag)\b/i,
  /\bkan tyvärr inte\b/i,
  /\bförsök igen\b/i,
  /\bkontakta (?:oss|support|teamet)\b/i,
];

const FACTUAL_QUESTION_PATTERNS = [
  /\?$/,
  /\b(?:what|which|when|where|who|how much|how many|price|pricing|cost|opening hours|hours|policy|address|phone|email|book|booking|ship|shipping|return|refund|warranty|available|availability)\b/i,
  /\b(?:vad|vilken|vilket|vilka|när|var|vem|hur mycket|hur många|pris|kostar|öppettider|policy|adress|telefon|mejl|mail|boka|bokning|frakt|retur|återbetalning|garanti|tillgänglig)\b/i,
];

export function clampConfidence(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function truncate(value: string, maxLength: number) {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

export function buildDedupeHash(agentId: string, question: string) {
  const normalizedQuestion = normalizeWhitespace(question)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  return createHash("sha256")
    .update(`${agentId}:${normalizedQuestion}`)
    .digest("hex");
}

export function detectUnansweredQueryCandidate({
  question,
  assistantAnswer,
  knowledgeMatchCount,
  runtimeHadError = false,
}: UnansweredQueryDetectionInput): UnansweredQueryDetectionResult {
  const normalizedQuestion = normalizeWhitespace(question);
  const normalizedAnswer = normalizeWhitespace(assistantAnswer);
  const isConcreteQuestion =
    normalizedQuestion.length >= 8 &&
    normalizedQuestion.length <= 600 &&
    FACTUAL_QUESTION_PATTERNS.some((pattern) => pattern.test(normalizedQuestion));

  if (!isConcreteQuestion) {
    return {
      shouldCreate: false,
      reason: "Question is not concrete enough for the knowledge queue.",
      confidence: 0.2,
    };
  }

  if (runtimeHadError) {
    return {
      shouldCreate: true,
      reason: "The runtime reported an error while answering.",
      confidence: 0.9,
    };
  }

  if (!normalizedAnswer) {
    return {
      shouldCreate: true,
      reason: "The assistant returned an empty answer.",
      confidence: 0.95,
    };
  }

  if (FALLBACK_PATTERNS.some((pattern) => pattern.test(normalizedAnswer))) {
    return {
      shouldCreate: true,
      reason: "The assistant answer looked uncertain or fallback-like.",
      confidence: knowledgeMatchCount === 0 ? 0.86 : 0.72,
    };
  }

  if (knowledgeMatchCount === 0 && normalizedQuestion.length >= 16) {
    return {
      shouldCreate: true,
      reason: "No knowledge matched a concrete visitor question.",
      confidence: 0.66,
    };
  }

  return {
    shouldCreate: false,
    reason: "The answer did not look like a missed knowledge question.",
    confidence: 0.35,
  };
}

export function buildConversationExcerpt(
  messages: Array<{ role: string; content: string }>,
  latestQuestion: string,
) {
  const transcript = [
    ...messages.slice(-4).map((message) => `${message.role}: ${message.content}`),
    `user: ${latestQuestion}`,
  ].join("\n");

  return truncate(transcript, 1600);
}
