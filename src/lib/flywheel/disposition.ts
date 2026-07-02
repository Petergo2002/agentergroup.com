export type QuestionDispositionAction = "dismiss" | "reopen" | "mark_duplicate";
export type QuestionDispositionStatus = "open" | "answered" | "dismissed" | "duplicate";

export class InvalidQuestionDispositionError extends Error {
  status: number;

  constructor(message: string, status = 409) {
    super(message);
    this.name = "InvalidQuestionDispositionError";
    this.status = status;
  }
}

export function buildUnansweredQueryDispositionPatch(input: {
  action: QuestionDispositionAction;
  currentStatus: QuestionDispositionStatus;
  hasVerifiedFact: boolean;
  questionId: string;
  duplicateOf?: string | null;
  resolvedAt: string;
}) {
  if (input.hasVerifiedFact || input.currentStatus === "answered") {
    throw new InvalidQuestionDispositionError(
      "Questions with a verified answer cannot be dismissed, reopened, or marked duplicate.",
    );
  }

  if (input.action === "reopen") {
    if (input.currentStatus === "open") {
      return {
        status: "open" as const,
        duplicate_of: null,
        resolved_at: null,
      };
    }

    return {
      status: "open" as const,
      duplicate_of: null,
      resolved_at: null,
    };
  }

  if (input.currentStatus !== "open") {
    throw new InvalidQuestionDispositionError(
      "Only open questions can be dismissed or marked duplicate.",
    );
  }

  if (input.action === "dismiss") {
    return {
      status: "dismissed" as const,
      duplicate_of: null,
      resolved_at: input.resolvedAt,
    };
  }

  const duplicateOf = input.duplicateOf?.trim();

  if (!duplicateOf || duplicateOf === input.questionId) {
    throw new InvalidQuestionDispositionError(
      "A different original question is required.",
      400,
    );
  }

  return {
    status: "duplicate" as const,
    duplicate_of: duplicateOf,
    resolved_at: input.resolvedAt,
  };
}

export function validateDuplicateTarget(input: {
  original: {
    id: string;
    agentId: string;
    status: QuestionDispositionStatus;
  } | null;
  currentAgentId: string;
}) {
  if (!input.original || input.original.agentId !== input.currentAgentId) {
    throw new InvalidQuestionDispositionError(
      "Original question not found for this agent.",
      404,
    );
  }

  if (!["open", "answered"].includes(input.original.status)) {
    throw new InvalidQuestionDispositionError(
      "Original question must be open or answered.",
    );
  }
}
