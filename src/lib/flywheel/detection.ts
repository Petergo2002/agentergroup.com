import { createHash } from "node:crypto";

export interface UnansweredQueryDetectionInput {
  question: string;
  assistantAnswer: string;
  knowledgeMatchCount: number;
  runtimeHadError?: boolean;
  /**
   * Set when the model called the flag_missing_knowledge tool during the same
   * completion. A first-party report beats inferring the same thing from the
   * wording of the reply, so it takes precedence over every pattern below.
   */
  modelFlaggedGap?: { question?: string | null; reason?: string | null } | null;
}

/**
 * Which signal decided the outcome. Recorded on every capture so the model tool
 * and the legacy patterns can be compared on real traffic.
 */
export type UnansweredQueryDetectionSource =
  | "model_tool"
  | "runtime_error"
  | "empty_answer"
  | "fallback_pattern"
  | "no_knowledge_match"
  | "none";

export interface UnansweredQueryDetectionResult {
  shouldCreate: boolean;
  question: string;
  reason: string;
  confidence: number;
  source: UnansweredQueryDetectionSource;
  /**
   * True when the legacy pattern matching would have fired on its own, so the
   * two detectors can be compared without running them as separate code paths.
   */
  patternWouldCreate: boolean;
}

const FALLBACK_PATTERNS = [
  /sorry[, ]+i (?:had trouble|can't|cannot|couldn't|could not)/i,
  /\bi (?:do not|don't) (?:know|have enough information|have that information)/i,
  /\bi (?:do not|don't) have (?:the )?(?:exact|specific) (?:number|count|figure|figures|data|details|information)\b/i,
  /\bi (?:do not|don't) have (?:any )?information (?:about|on|regarding|for)\b/i,
  /\bi (?:do not|don't) have access to (?:the )?(?:exact|specific|that|this|those)? ?(?:number|count|figure|figures|data|details|information|records)?\b/i,
  /\bi (?:do not|don't) have .* in (?:my|the) knowledge base\b/i,
  /\b(?:my|the) knowledge base (?:does not|doesn't|did not|didn't) (?:include|contain|cover|have)\b/i,
  /\b(?:not|isn't|is not|aren't|are not) (?:in|available in|included in|covered by) (?:my|the) knowledge base\b/i,
  /\bno (?:information|details|data) (?:about|on|regarding|for)\b/i,
  /\bi (?:do not|don't|cannot|can't) (?:confirm|verify|provide|share) (?:the )?(?:exact|specific)? ?(?:number|count|figure|figures|data|details|information|name)?\b/i,
  /\bi(?:'m| am) not sure\b/i,
  /\bi(?:'m| am) afraid i (?:do not|don't|cannot|can't)/i,
  /\bi can't find\b/i,
  /\bi cannot find\b/i,
  /\bi (?:do not|don't) see\b/i,
  /\bi (?:couldn't|could not|can't|cannot) locate\b/i,
  /\b(?:not|isn't|is not|aren't|are not) (?:provided|mentioned|listed|specified|available)\b/i,
  /\b(?:does not|doesn't|do not|don't) mention\b/i,
  /\b(?:the )?(?:provided|available) (?:information|context|source|sources|details|material) (?:does not|doesn't|do not|don't) (?:mention|include|cover|provide|state|list)\b/i,
  /\bnot enough (?:context|information)\b/i,
  /\bunable to answer\b/i,
  /\bplease try again\b/i,
  /\bcontact (?:support|us|the team)\b/i,
  /\bjag (?:vet inte|har inte (?:tillräckligt med )?(?:information|uppgifter|underlag)|hittar inte)\b/i,
  /\bjag har inte (?:någon )?(?:information|uppgifter|data) (?:om|kring|gällande)\b/i,
  /\bjag (?:ser|hittar) (?:inte|ingen|inget)\b/i,
  /\bjag (?:är|ar) inte säker\b/i,
  /\bjag (?:kan inte|kunde inte) (?:hitta|svara)\b/i,
  /\bjag (?:kan inte|kunde inte) (?:bekräfta|verifiera|dela|ange)\b/i,
  /\b(?:nämns inte|framgår inte|anges inte|står inte)\b/i,
  /\b(?:inte tillräckligt med|saknar) (?:information|kontext|underlag)\b/i,
  /\b(?:informationen|underlaget|källorna) (?:nämner|anger|täcker|innehåller) inte\b/i,
  /\b(?:finns inte|saknas|är inte tillgänglig(?:t)?) i (?:min|kunskapsbasen|vår) kunskapsbas\b/i,
  /\bkan tyvärr inte\b/i,
  /\bförsök igen\b/i,
  /\bkontakta (?:oss|support|teamet)\b/i,
];

const FACTUAL_QUESTION_PATTERNS = [
  /\?$/,
  /^(?:what|which|when|where|who|why|how|how much|how many)\b/i,
  /^(?:can|could|would|will|do|does|did|is|are|am|should|may)\s+(?:i|we|you|your|the|this|that|it|there)\b/i,
  /\b(?:what|which|when|where|who|how much|how many|price|pricing|cost|opening hours|hours|policy|address|phone|email|book|booking|ship|shipping|return|refund|warranty|available|availability|owner|founder|ceo|users|customers|employees|revenue|invoice|payment|pay|integrate|integration|compatible|compliant|gdpr|support|supports|shopify|slack|hubspot|feature|features|plan|trial|subscription)\b/i,
  /^(?:vad|vilken|vilket|vilka|när|var|vem|varför|hur|hur mycket|hur många)\b/i,
  /^(?:kan|kunde|skulle|vill|får|bör|går|är|har|finns|stödjer|erbjuder)\s+(?:jag|vi|ni|du|er|det|den|man|kunden|kunder)\b/i,
  /\b(?:vad|vilken|vilket|vilka|när|var|vem|hur mycket|hur många|pris|kostar|öppettider|policy|adress|telefon|mejl|mail|boka|bokning|frakt|retur|återbetalning|garanti|tillgänglig|ägare|grundare|vd|användare|kunder|anställda|omsättning|faktura|betalning|betala|integrerar|integration|kompatibel|gdpr|stödjer|support|shopify|slack|hubspot|funktion|funktioner|abonnemang|testperiod)\b/i,
];

const QUESTION_NOISE_PATTERNS = [
  /^(?:hi|hello|hey|hej|hallå|ok|okay|thanks|thank you|thankyou|tack)[!.?]*$/i,
  /^(?:can|could|would)\s+you\s+(?:help|assist)(?:\s+me)?[?.!]*$/i,
  /^(?:are|is)\s+(?:you|anyone|someone|somebody)\s+(?:there|available|online)[?.!]*$/i,
  /^(?:what can you do|who are you|how are you)[?.!]*$/i,
  /^(?:kan|kunde|skulle)\s+du\s+(?:hjälpa|assistera)(?:\s+mig)?[?.!]*$/i,
  /^(?:är|finns)\s+(?:du|någon)\s+(?:där|tillgänglig)[?.!]*$/i,
];

const LEADING_FILLER_PATTERNS = [
  /^(?:hi|hello|hey|hej|hallå|ok|okay|please|pls|thanks|thank you|thankyou|tack|excuse me|ursäkta)[,!.?\s]+/i,
  /^(?:quick|snabb)\s+(?:question|fråga)[,!.?\s]+/i,
  /^(?:i have|jag har)\s+(?:a\s+)?(?:question|fråga)[,!.?\s]+/i,
];

const TRAILING_FILLER_PATTERNS = [
  /[,!.?\s]+(?:please|pls|thanks|thank you|thankyou|thank u|tack)$/i,
  /[,!.?\s]+(?:do you know|vet du)$/i,
];

const DEDUPE_STOP_WORDS = new Set([
  "a",
  "about",
  "an",
  "and",
  "are",
  "company",
  "do",
  "does",
  "for",
  "guys",
  "have",
  "hello",
  "hey",
  "hi",
  "i",
  "is",
  "it",
  "know",
  "me",
  "of",
  "ok",
  "okay",
  "on",
  "please",
  "question",
  "questin",
  "saas",
  "so",
  "tell",
  "that",
  "the",
  "this",
  "to",
  "what",
  "whats",
  "when",
  "where",
  "which",
  "who",
  "with",
  "you",
  "your",
  "är",
  "det",
  "du",
  "en",
  "ett",
  "fråga",
  "har",
  "hej",
  "i",
  "jag",
  "kan",
  "ni",
  "och",
  "ok",
  "om",
  "på",
  "som",
  "tack",
  "var",
  "vad",
  "vet",
  "vem",
  "vilka",
  "vilken",
  "vilket",
]);

const DEDUPE_TOKEN_ALIASES = new Map([
  ["customers", "customer"],
  ["employees", "employee"],
  ["founders", "founder"],
  ["owners", "owner"],
  ["users", "user"],
  ["anställda", "anställd"],
  ["användare", "användare"],
  ["grundare", "grundare"],
  ["kunder", "kund"],
  ["ägare", "ägare"],
]);

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

function trimQuestionFiller(value: string) {
  let normalized = normalizeWhitespace(value);
  let previous = "";

  while (normalized && normalized !== previous) {
    previous = normalized;

    for (const pattern of LEADING_FILLER_PATTERNS) {
      normalized = normalizeWhitespace(normalized.replace(pattern, ""));
    }

    for (const pattern of TRAILING_FILLER_PATTERNS) {
      normalized = normalizeWhitespace(normalized.replace(pattern, ""));
    }
  }

  return normalized.replace(/[.!,;:]+$/u, "").trim();
}

function isQuestionNoise(question: string) {
  const normalized = trimQuestionFiller(question);

  if (!normalized) {
    return true;
  }

  return QUESTION_NOISE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function looksLikeConcreteQuestion(question: string) {
  const normalized = trimQuestionFiller(question);

  return (
    normalized.length >= 8 &&
    normalized.length <= 600 &&
    !isQuestionNoise(normalized) &&
    FACTUAL_QUESTION_PATTERNS.some((pattern) => pattern.test(normalized))
  );
}

export function extractQuestionText(value: string) {
  const normalized = normalizeWhitespace(value);
  const segments =
    normalized.match(/[^.!?\n]+[.!?]?/gu)?.map((segment) => trimQuestionFiller(segment)) ??
    [];
  const questionSegment = segments.find((segment) => looksLikeConcreteQuestion(segment));

  return trimQuestionFiller(questionSegment ?? normalized);
}

export function getQuestionDedupeTokens(question: string) {
  return Array.from(
    new Set(
      normalizeWhitespace(question)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .map((token) => DEDUPE_TOKEN_ALIASES.get(token) ?? token)
        .filter((token) => token.length > 1 && !DEDUPE_STOP_WORDS.has(token)),
    ),
  ).sort();
}

export function areSimilarQuestionsForDedupe(left: string, right: string) {
  const leftTokens = getQuestionDedupeTokens(left);
  const rightTokens = getQuestionDedupeTokens(right);

  if (leftTokens.length < 2 || rightTokens.length < 2) {
    return false;
  }

  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  const overlap = leftTokens.filter((token) => rightSet.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  const similarity = union > 0 ? overlap / union : 0;
  const smallerSetSize = Math.min(leftSet.size, rightSet.size);
  const containment = overlap / smallerSetSize;
  const sameSmallQuestion =
    leftSet.size === rightSet.size && overlap === smallerSetSize;

  return sameSmallQuestion || similarity >= 0.78 || (smallerSetSize >= 3 && containment >= 0.9);
}

/**
 * The legacy prose-matching heuristics, kept as a fallback for models that do
 * not call the tool and retained so its verdict can be compared against the
 * model's own report.
 */
function detectByPatterns(input: {
  normalizedQuestion: string;
  normalizedAnswer: string;
  knowledgeMatchCount: number;
}): { shouldCreate: boolean; reason: string; confidence: number; source: UnansweredQueryDetectionSource } {
  if (!input.normalizedAnswer) {
    return {
      shouldCreate: true,
      reason: "The assistant returned an empty answer.",
      confidence: 0.95,
      source: "empty_answer",
    };
  }

  if (FALLBACK_PATTERNS.some((pattern) => pattern.test(input.normalizedAnswer))) {
    return {
      shouldCreate: true,
      reason:
        "The assistant answer stated that the requested fact was missing or uncertain.",
      confidence: input.knowledgeMatchCount === 0 ? 0.9 : 0.82,
      source: "fallback_pattern",
    };
  }

  if (input.knowledgeMatchCount === 0 && input.normalizedQuestion.length >= 16) {
    return {
      shouldCreate: true,
      reason: "No knowledge matched a concrete visitor question.",
      confidence: 0.66,
      source: "no_knowledge_match",
    };
  }

  return {
    shouldCreate: false,
    reason: "The answer did not look like a missed knowledge question.",
    confidence: 0.35,
    source: "none",
  };
}

export function detectUnansweredQueryCandidate({
  question,
  assistantAnswer,
  knowledgeMatchCount,
  runtimeHadError = false,
  modelFlaggedGap = null,
}: UnansweredQueryDetectionInput): UnansweredQueryDetectionResult {
  const normalizedAnswer = normalizeWhitespace(assistantAnswer);
  const flaggedQuestion = modelFlaggedGap?.question
    ? normalizeWhitespace(modelFlaggedGap.question)
    : "";

  // The model resolves pronouns and follow-ups ("what year?") into a standalone
  // question, so prefer its wording when it gave one.
  const extractedQuestion = extractQuestionText(question);
  const normalizedQuestion = flaggedQuestion || extractedQuestion;

  const patternVerdict = detectByPatterns({
    normalizedQuestion: extractedQuestion,
    normalizedAnswer,
    knowledgeMatchCount,
  });
  const isConcreteQuestion = looksLikeConcreteQuestion(extractedQuestion);
  const patternWouldCreate = isConcreteQuestion && patternVerdict.shouldCreate;

  // A first-party report from the model outranks every heuristic, and is not
  // gated on the question looking "concrete" — the model already judged that.
  // But a flag with no usable question must not fall back to raw visitor text,
  // or a bare "Hello" would be captured as a knowledge gap.
  const hasUsableFlaggedQuestion =
    Boolean(flaggedQuestion) || (Boolean(normalizedQuestion) && isConcreteQuestion);

  if (modelFlaggedGap && hasUsableFlaggedQuestion) {
    return {
      shouldCreate: true,
      question: normalizedQuestion,
      reason:
        modelFlaggedGap.reason?.trim() ||
        "The assistant reported it could not answer from verified knowledge.",
      confidence: 0.95,
      source: "model_tool",
      patternWouldCreate,
    };
  }

  if (!isConcreteQuestion) {
    return {
      shouldCreate: false,
      question: normalizedQuestion,
      reason: "Question is not concrete enough for the knowledge queue.",
      confidence: 0.2,
      source: "none",
      patternWouldCreate,
    };
  }

  if (runtimeHadError) {
    return {
      shouldCreate: true,
      question: normalizedQuestion,
      reason: "The runtime reported an error while answering.",
      confidence: 0.9,
      source: "runtime_error",
      patternWouldCreate,
    };
  }

  return {
    shouldCreate: patternVerdict.shouldCreate,
    question: normalizedQuestion,
    reason: patternVerdict.reason,
    confidence: patternVerdict.confidence,
    source: patternVerdict.source,
    patternWouldCreate,
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
