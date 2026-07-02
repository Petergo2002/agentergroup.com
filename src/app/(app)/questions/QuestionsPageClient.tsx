"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock3,
  Copy,
  ExternalLink,
  Filter,
  Loader2,
  MessageSquareText,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { formatLocaleDateTime } from "@/lib/i18n";
import { jsonFetcher } from "@/lib/json-fetcher";
import type {
  FlywheelQuestionDetail,
  FlywheelQuestionListItem,
  UnansweredQueryStatus,
  VerifiedFactVisibility,
} from "@/lib/types";
import { formatRelativeDate } from "@/lib/utils";

interface QuestionAgentOption {
  id: string;
  name: string;
}

interface QuestionWidgetOption {
  id: string;
  name: string;
}

interface QuestionsPageClientProps {
  initialQuestions: FlywheelQuestionListItem[];
  agents: QuestionAgentOption[];
  widgets: QuestionWidgetOption[];
  workspaceName: string;
}

const copy = {
  en: {
    badge: "Learning queue",
    title: "Questions",
    description: "Review visitor questions the agent could not answer confidently.",
    search: "Search questions, pages, agents",
    status: "Status",
    agent: "Agent",
    widget: "Widget",
    sort: "Sort",
    allStatuses: "All statuses",
    allAgents: "All agents",
    allWidgets: "All widgets",
    newest: "Newest",
    oldest: "Oldest",
    highestConfidence: "Highest confidence",
    lowestConfidence: "Lowest confidence",
    emptyTitle: "No open questions",
    emptyBody: "New unanswered visitor questions will appear here after the agent needs help.",
    noResultsTitle: "No questions match these filters",
    noResultsBody: "Clear search or filters to return to the full queue.",
    clearFilters: "Clear filters",
    loadErrorTitle: "Questions could not be loaded",
    retry: "Retry",
    selectedEmpty: "Select a question",
    selectedEmptyBody: "Choose a row to review context and publish a verified answer.",
    previousAnswer: "Assistant answer",
    context: "Conversation context",
    verifiedAnswer: "Verified answer",
    answerPlaceholder: "Write the reusable, customer-approved answer...",
    publish: "Publish to agent",
    updateAnswer: "Update answer",
    publishing: "Publishing",
    dismiss: "Dismiss",
    reopen: "Reopen",
    duplicate: "Mark duplicate",
    duplicateOf: "Original question",
    chooseOriginal: "Choose original",
    retryProcessing: "Retry processing",
    openConversation: "Open conversation",
    source: "Source",
    reason: "Reason",
    confidence: "Confidence",
    visibility: "Visibility",
    agentOnly: "Agent only",
    publicReady: "Public ready",
    addedToKnowledge: "Added to agent knowledge",
    draftKept: "Your draft stayed in the editor.",
    saved: "Saved",
    published: "Published",
    updated: "Updated",
    processingRetried: "Processing queued again",
    readOnly: "You do not have edit access for this question.",
  },
  sv: {
    badge: "Lärande kö",
    title: "Frågor",
    description: "Granska besökarfrågor som agenten inte kunde svara säkert på.",
    search: "Sök frågor, sidor, agenter",
    status: "Status",
    agent: "Agent",
    widget: "Widget",
    sort: "Sortera",
    allStatuses: "Alla statusar",
    allAgents: "Alla agenter",
    allWidgets: "Alla widgets",
    newest: "Nyast",
    oldest: "Äldst",
    highestConfidence: "Högst confidence",
    lowestConfidence: "Lägst confidence",
    emptyTitle: "Inga öppna frågor",
    emptyBody: "Nya obesvarade besökarfrågor visas här när agenten behöver hjälp.",
    noResultsTitle: "Inga frågor matchar filtren",
    noResultsBody: "Rensa sökningen eller filtren för att se hela kön.",
    clearFilters: "Rensa filter",
    loadErrorTitle: "Frågorna kunde inte laddas",
    retry: "Försök igen",
    selectedEmpty: "Välj en fråga",
    selectedEmptyBody: "Välj en rad för att granska kontext och publicera ett verifierat svar.",
    previousAnswer: "Agentens svar",
    context: "Konversation",
    verifiedAnswer: "Verifierat svar",
    answerPlaceholder: "Skriv det återanvändbara, kundgodkända svaret...",
    publish: "Publicera till agent",
    updateAnswer: "Uppdatera svar",
    publishing: "Publicerar",
    dismiss: "Avfärda",
    reopen: "Öppna igen",
    duplicate: "Markera dubblett",
    duplicateOf: "Originalfråga",
    chooseOriginal: "Välj original",
    retryProcessing: "Kör processing igen",
    openConversation: "Öppna konversation",
    source: "Källa",
    reason: "Orsak",
    confidence: "Confidence",
    visibility: "Synlighet",
    agentOnly: "Endast agent",
    publicReady: "Publik redo",
    addedToKnowledge: "Tillagd i agentens kunskap",
    draftKept: "Utkastet ligger kvar i editorn.",
    saved: "Sparat",
    published: "Publicerat",
    updated: "Uppdaterat",
    processingRetried: "Processing köad igen",
    readOnly: "Du saknar redigeringsrätt för den här frågan.",
  },
};

type SortMode = "newest" | "oldest" | "confidence_desc" | "confidence_asc";

const statusLabels: Record<UnansweredQueryStatus, string> = {
  open: "Open",
  answered: "Answered",
  dismissed: "Dismissed",
  duplicate: "Duplicate",
};

function buildQuestionsUrl(agentId: string, widgetId: string) {
  const params = new URLSearchParams({ status: "all", limit: "200" });

  if (agentId) {
    params.set("agentId", agentId);
  }

  if (widgetId) {
    params.set("widgetId", widgetId);
  }

  return `/api/flywheel/unanswered?${params.toString()}`;
}

function statusTone(status: UnansweredQueryStatus) {
  switch (status) {
    case "open":
      return "border-slate-300/30 bg-slate-500/10 text-slate-700 dark:text-slate-200";
    case "answered":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "duplicate":
      return "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300";
    case "dismissed":
      return "border-outline-variant/20 bg-surface-container text-on-surface-variant";
  }
}

function knowledgeTone(status: FlywheelQuestionListItem["knowledge_source_status"]) {
  switch (status) {
    case "ready":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "processing":
      return "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300";
    case "failed":
      return "border-error/20 bg-error/10 text-error";
    case "pending":
      return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    default:
      return "border-outline-variant/20 bg-surface-container text-on-surface-variant";
  }
}

function formatConfidence(value: number) {
  return `${Math.round(value * 100)}%`;
}

function getConversationMessages(
  question: FlywheelQuestionDetail | FlywheelQuestionListItem | null,
): FlywheelQuestionDetail["conversation_messages"] {
  if (
    question &&
    "conversation_messages" in question &&
    Array.isArray(question.conversation_messages)
  ) {
    return question.conversation_messages;
  }

  return [];
}

function QuestionSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="h-[92px] rounded-xl border border-outline-variant/10 bg-surface-container-lowest skeleton"
        />
      ))}
    </div>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-dashed border-outline-variant/25 bg-surface-container-lowest px-6 py-14 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant ring-1 ring-outline-variant/15">
        <MessageSquareText className="h-5 w-5" />
      </div>
      <h2 className="text-base font-semibold text-on-surface">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-on-surface-variant/70">
        {body}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}

export default function QuestionsPageClient({
  initialQuestions,
  agents,
  widgets,
  workspaceName,
}: QuestionsPageClientProps) {
  const { language } = useLanguage();
  const text = language === "sv" ? copy.sv : copy.en;
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<UnansweredQueryStatus | "all">("open");
  const [agentFilter, setAgentFilter] = useState("");
  const [widgetFilter, setWidgetFilter] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    initialQuestions[0]?.id ?? null,
  );
  const [answerDraft, setAnswerDraft] = useState("");
  const [visibility, setVisibility] = useState<VerifiedFactVisibility>("agent_only");
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [duplicateTargetId, setDuplicateTargetId] = useState("");

  const questionsUrl = useMemo(
    () => buildQuestionsUrl(agentFilter, widgetFilter),
    [agentFilter, widgetFilter],
  );
  const {
    data: response,
    error,
    isLoading,
    isValidating,
    mutate,
  } = useSWR<{ questions: FlywheelQuestionListItem[] }>(questionsUrl, jsonFetcher, {
    fallbackData: { questions: initialQuestions },
    keepPreviousData: true,
    refreshInterval: 45_000,
  });
  const questions = useMemo(() => response?.questions ?? [], [response?.questions]);
  const selectedFromList = useMemo(
    () =>
      questions.find((question) => question.id === selectedQuestionId) ??
      questions[0] ??
      null,
    [questions, selectedQuestionId],
  );
  const detailUrl = selectedFromList
    ? `/api/flywheel/unanswered/${selectedFromList.id}`
    : null;
  const {
    data: detailResponse,
    isLoading: isDetailLoading,
    mutate: mutateDetail,
  } = useSWR<{ question: FlywheelQuestionDetail }>(detailUrl, jsonFetcher, {
    keepPreviousData: true,
  });
  const selectedQuestion = detailResponse?.question ?? selectedFromList;
  const selectedQuestionIdForDraft = selectedQuestion?.id ?? null;
  const selectedVerifiedFactId = selectedQuestion?.verified_fact?.id ?? null;
  const selectedVerifiedFactAnswer = selectedQuestion?.verified_fact?.answer ?? "";
  const selectedVerifiedFactVisibility =
    selectedQuestion?.verified_fact?.visibility ?? "agent_only";
  const selectedAgentId = selectedQuestion?.agent_id ?? null;
  const conversationMessages = getConversationMessages(selectedQuestion);

  useEffect(() => {
    if (!selectedQuestionId && questions[0]) {
      setSelectedQuestionId(questions[0].id);
    }
  }, [questions, selectedQuestionId]);

  useEffect(() => {
    if (!selectedQuestionIdForDraft) {
      setAnswerDraft("");
      setVisibility("agent_only");
      setDuplicateTargetId("");
      return;
    }

    setAnswerDraft(selectedVerifiedFactAnswer);
    setVisibility(selectedVerifiedFactVisibility);
    setDuplicateTargetId("");
  }, [
    selectedQuestionIdForDraft,
    selectedVerifiedFactAnswer,
    selectedVerifiedFactId,
    selectedVerifiedFactVisibility,
  ]);

  const filteredQuestions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const next = questions.filter((question) => {
      if (statusFilter !== "all" && question.status !== statusFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        question.question,
        question.agent_name,
        question.widget_name,
        question.page_url,
        question.referrer,
        question.detection_reason,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    });

    return [...next].sort((left, right) => {
      if (sortMode === "oldest") {
        return left.created_at.localeCompare(right.created_at);
      }

      if (sortMode === "confidence_desc") {
        return right.confidence - left.confidence;
      }

      if (sortMode === "confidence_asc") {
        return left.confidence - right.confidence;
      }

      return right.created_at.localeCompare(left.created_at);
    });
  }, [questions, search, sortMode, statusFilter]);

  const counts = useMemo(() => {
    return questions.reduce(
      (acc, question) => {
        acc.total += 1;
        acc[question.status] += 1;
        return acc;
      },
      { total: 0, open: 0, answered: 0, dismissed: 0, duplicate: 0 },
    );
  }, [questions]);

  const duplicateOptions = useMemo(() => {
    if (!selectedQuestionIdForDraft || !selectedAgentId) {
      return [];
    }

    return questions.filter(
      (question) =>
        question.id !== selectedQuestionIdForDraft &&
        question.agent_id === selectedAgentId &&
        ["open", "answered"].includes(question.status),
    );
  }, [questions, selectedAgentId, selectedQuestionIdForDraft]);
  const hasVerifiedAnswer = Boolean(selectedQuestion?.verified_fact);
  const canChangeDisposition =
    Boolean(selectedQuestion) &&
    !hasVerifiedAnswer &&
    selectedQuestion?.status !== "answered";
  const canMarkDuplicate =
    canChangeDisposition && selectedQuestion?.status === "open";
  const canDismissQuestion = canMarkDuplicate;
  const canReopenQuestion =
    canChangeDisposition &&
    Boolean(selectedQuestion) &&
    selectedQuestion?.status !== "open";

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("open");
    setAgentFilter("");
    setWidgetFilter("");
    setSortMode("newest");
  };

  const refreshAll = async () => {
    await mutate();
    await mutateDetail();
  };

  const submitAnswer = async () => {
    if (!selectedQuestion || !answerDraft.trim()) {
      return;
    }

    setIsSaving(true);

    try {
      const existingFact = selectedQuestion.verified_fact;
      const response = await fetch(
        existingFact
          ? `/api/flywheel/verified-facts/${existingFact.id}`
          : `/api/flywheel/unanswered/${selectedQuestion.id}/answer`,
        {
          method: existingFact ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answer: answerDraft,
            visibility,
          }),
        },
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? text.draftKept);
      }

      showToast(existingFact ? text.updated : text.published, "success");
      await refreshAll();
    } catch (saveError) {
      showToast(
        saveError instanceof Error ? saveError.message : text.draftKept,
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const updateQuestionStatus = async (
    action: "dismiss" | "reopen" | "mark_duplicate",
  ) => {
    if (!selectedQuestion) {
      return;
    }

    setIsUpdatingStatus(true);

    try {
      const response = await fetch(`/api/flywheel/unanswered/${selectedQuestion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          duplicateOf: action === "mark_duplicate" ? duplicateTargetId : undefined,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update question.");
      }

      showToast(text.saved, "success");
      await refreshAll();
    } catch (statusError) {
      showToast(
        statusError instanceof Error ? statusError.message : "Failed to update question.",
        "error",
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const retryProcessing = async () => {
    const fact = selectedQuestion?.verified_fact;

    if (!fact) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/flywheel/verified-facts/${fact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry_processing" }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to retry processing.");
      }

      showToast(text.processingRetried, "success");
      await refreshAll();
    } catch (retryError) {
      showToast(
        retryError instanceof Error ? retryError.message : "Failed to retry processing.",
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <header className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest px-5 py-5 shadow-sm sm:px-6 lg:px-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-lg border border-primary/10 bg-primary/8 px-2.5 py-1 text-primary">
              <MessageSquareText className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">{text.badge}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold leading-tight tracking-normal text-on-surface sm:text-3xl">
                {text.title}
              </h1>
              <span className="rounded-full border border-primary/15 bg-primary/[0.08] px-2.5 py-1 text-xs font-semibold text-primary">
                {counts.open} open
              </span>
            </div>
            <p className="mt-2 max-w-xl text-sm leading-6 text-on-surface-variant/75">
              {text.description}
            </p>
            <p className="mt-2 truncate text-xs font-medium text-on-surface-variant/60">
              {workspaceName}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(["open", "answered", "dismissed", "duplicate"] as UnansweredQueryStatus[]).map(
              (status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                    statusFilter === status
                      ? "border-primary/25 bg-primary/[0.08]"
                      : "border-outline-variant/15 bg-surface-container-low hover:bg-surface-container"
                  }`}
                >
                  <span className="block text-lg font-bold text-on-surface">
                    {counts[status]}
                  </span>
                  <span className="text-xs font-medium text-on-surface-variant">
                    {statusLabels[status]}
                  </span>
                </button>
              ),
            )}
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-3 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_160px_180px_180px_180px_auto]">
          <label className="relative min-w-0">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/45" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              type="search"
              placeholder={text.search}
              className="h-11 w-full rounded-xl border border-transparent bg-surface-container-low pl-11 pr-4 text-sm font-medium text-on-surface outline-none transition-all placeholder:text-on-surface-variant/40 focus:border-primary/20 focus:bg-background focus:ring-2 focus:ring-primary/15"
            />
          </label>

          <label className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/45" />
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as UnansweredQueryStatus | "all")
              }
              className="h-11 w-full rounded-xl border border-outline-variant/15 bg-surface-container-low pl-9 pr-8 text-sm font-semibold text-on-surface outline-none focus:border-primary/25 focus:ring-2 focus:ring-primary/15"
            >
              <option value="all">{text.allStatuses}</option>
              <option value="open">Open</option>
              <option value="answered">Answered</option>
              <option value="dismissed">Dismissed</option>
              <option value="duplicate">Duplicate</option>
            </select>
          </label>

          <select
            value={agentFilter}
            onChange={(event) => setAgentFilter(event.target.value)}
            className="h-11 rounded-xl border border-outline-variant/15 bg-surface-container-low px-3 text-sm font-semibold text-on-surface outline-none focus:border-primary/25 focus:ring-2 focus:ring-primary/15"
            aria-label={text.agent}
          >
            <option value="">{text.allAgents}</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>

          <select
            value={widgetFilter}
            onChange={(event) => setWidgetFilter(event.target.value)}
            className="h-11 rounded-xl border border-outline-variant/15 bg-surface-container-low px-3 text-sm font-semibold text-on-surface outline-none focus:border-primary/25 focus:ring-2 focus:ring-primary/15"
            aria-label={text.widget}
          >
            <option value="">{text.allWidgets}</option>
            {widgets.map((widget) => (
              <option key={widget.id} value={widget.id}>
                {widget.name}
              </option>
            ))}
          </select>

          <label className="relative">
            <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/45" />
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="h-11 w-full rounded-xl border border-outline-variant/15 bg-surface-container-low pl-9 pr-8 text-sm font-semibold text-on-surface outline-none focus:border-primary/25 focus:ring-2 focus:ring-primary/15"
            >
              <option value="newest">{text.newest}</option>
              <option value="oldest">{text.oldest}</option>
              <option value="confidence_desc">{text.highestConfidence}</option>
              <option value="confidence_asc">{text.lowestConfidence}</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => void refreshAll()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-outline-variant/15 px-3 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <RefreshCw className={`h-4 w-4 ${isValidating ? "animate-spin" : ""}`} />
            {text.retry}
          </button>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
        <section className="min-w-0 space-y-3">
          {isLoading && !response ? (
            <QuestionSkeleton />
          ) : error ? (
            <EmptyState
              title={text.loadErrorTitle}
              body={error instanceof Error ? error.message : "Unexpected error."}
              action={
                <button
                  type="button"
                  onClick={() => void mutate()}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-on-surface px-4 text-sm font-semibold text-background"
                >
                  <RefreshCw className="h-4 w-4" />
                  {text.retry}
                </button>
              }
            />
          ) : filteredQuestions.length === 0 ? (
            <EmptyState
              title={search || statusFilter !== "open" || agentFilter || widgetFilter ? text.noResultsTitle : text.emptyTitle}
              body={search || statusFilter !== "open" || agentFilter || widgetFilter ? text.noResultsBody : text.emptyBody}
              action={
                search || statusFilter !== "open" || agentFilter || widgetFilter ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex h-10 items-center rounded-xl bg-on-surface px-4 text-sm font-semibold text-background"
                  >
                    {text.clearFilters}
                  </button>
                ) : null
              }
            />
          ) : (
            filteredQuestions.map((question) => {
              const isSelected = selectedQuestion?.id === question.id;

              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => setSelectedQuestionId(question.id)}
                  className={`group grid w-full gap-4 rounded-xl border bg-surface-container-lowest px-4 py-4 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 md:grid-cols-[minmax(0,1fr)_180px_120px] md:items-center ${
                    isSelected
                      ? "border-primary/30 bg-primary/[0.04]"
                      : "border-outline-variant/12 hover:border-primary/20 hover:bg-surface-container-low/45"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      {question.status === "answered" ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      ) : question.status === "dismissed" ? (
                        <XCircle className="h-4 w-4 shrink-0 text-on-surface-variant/50" />
                      ) : question.status === "duplicate" ? (
                        <Copy className="h-4 w-4 shrink-0 text-violet-500" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-primary" />
                      )}
                      <h3 className="truncate text-sm font-semibold text-on-surface group-hover:text-primary">
                        {question.question}
                      </h3>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant/70">
                      <span className="truncate">{question.agent_name ?? "Unknown agent"}</span>
                      <span className="h-1 w-1 rounded-full bg-on-surface-variant/30" />
                      <span className="truncate">{question.widget_name ?? "Unknown widget"}</span>
                      {question.page_url ? (
                        <>
                          <span className="h-1 w-1 rounded-full bg-on-surface-variant/30" />
                          <span className="max-w-[280px] truncate">{question.page_url}</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <span className={`inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-semibold ${statusTone(question.status)}`}>
                      {statusLabels[question.status]}
                    </span>
                    <span className="inline-flex h-7 items-center rounded-full border border-outline-variant/15 bg-surface-container px-2.5 text-xs font-semibold text-on-surface-variant">
                      {formatConfidence(question.confidence)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 md:justify-end">
                    <span
                      title={formatLocaleDateTime(question.created_at, language)}
                      className="text-xs font-medium text-on-surface-variant/65"
                    >
                      {formatRelativeDate(question.created_at, language)}
                    </span>
                    <MoreHorizontal className="h-4 w-4 text-on-surface-variant/45" />
                  </div>
                </button>
              );
            })
          )}
        </section>

        <aside className="min-w-0 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest shadow-sm xl:sticky xl:top-6 xl:max-h-[calc(100vh-48px)] xl:overflow-hidden">
          {!selectedQuestion ? (
            <div className="p-6">
              <EmptyState title={text.selectedEmpty} body={text.selectedEmptyBody} />
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <div className="border-b border-outline-variant/10 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-semibold ${statusTone(selectedQuestion.status)}`}>
                        {statusLabels[selectedQuestion.status]}
                      </span>
                      <span className="inline-flex h-7 items-center rounded-full border border-outline-variant/15 bg-surface-container px-2.5 text-xs font-semibold text-on-surface-variant">
                        {formatConfidence(selectedQuestion.confidence)}
                      </span>
                    </div>
                    <h2 className="mt-3 text-lg font-semibold leading-snug text-on-surface">
                      {selectedQuestion.question}
                    </h2>
                  </div>
                  {isDetailLoading ? (
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
                  ) : null}
                </div>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto p-5">
                <section className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-outline-variant/12 bg-surface-container-low p-3">
                    <p className="text-xs font-medium text-on-surface-variant/65">
                      {text.agent}
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-on-surface">
                      {selectedQuestion.agent_name ?? "Unknown"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-outline-variant/12 bg-surface-container-low p-3">
                    <p className="text-xs font-medium text-on-surface-variant/65">
                      {text.widget}
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-on-surface">
                      {selectedQuestion.widget_name ?? "Unknown"}
                    </p>
                  </div>
                </section>

                {selectedQuestion.page_url || selectedQuestion.referrer ? (
                  <section className="rounded-xl border border-outline-variant/12 bg-surface-container-low p-4">
                    <h3 className="text-xs font-semibold text-on-surface-variant">
                      {text.source}
                    </h3>
                    {selectedQuestion.page_url ? (
                      <a
                        href={selectedQuestion.page_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 flex min-w-0 items-center gap-2 text-sm font-medium text-primary"
                      >
                        <ExternalLink className="h-4 w-4 shrink-0" />
                        <span className="truncate">{selectedQuestion.page_url}</span>
                      </a>
                    ) : null}
                    {selectedQuestion.referrer ? (
                      <p className="mt-2 truncate text-xs text-on-surface-variant/65">
                        {selectedQuestion.referrer}
                      </p>
                    ) : null}
                  </section>
                ) : null}

                <section className="rounded-xl border border-outline-variant/12 bg-surface-container-low p-4">
                  <h3 className="text-xs font-semibold text-on-surface-variant">
                    {text.reason}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-on-surface">
                    {selectedQuestion.detection_reason}
                  </p>
                </section>

                {selectedQuestion.assistant_answer ? (
                  <section className="rounded-xl border border-outline-variant/12 bg-surface-container-low p-4">
                    <h3 className="text-xs font-semibold text-on-surface-variant">
                      {text.previousAnswer}
                    </h3>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-on-surface-variant">
                      {selectedQuestion.assistant_answer}
                    </p>
                  </section>
                ) : null}

                <section className="rounded-xl border border-outline-variant/12 bg-surface-container-low p-4">
                  <h3 className="text-xs font-semibold text-on-surface-variant">
                    {text.context}
                  </h3>
                  {conversationMessages.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {conversationMessages.slice(-8).map((message) => (
                        <div
                          key={message.id}
                          className="rounded-lg bg-surface-container-lowest px-3 py-2"
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant/60">
                              {message.role}
                            </span>
                            <span className="text-[11px] text-on-surface-variant/45">
                              {formatRelativeDate(message.created_at, language)}
                            </span>
                          </div>
                          <p className="line-clamp-4 whitespace-pre-wrap text-xs leading-5 text-on-surface-variant">
                            {message.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-on-surface-variant">
                      {selectedQuestion.context_excerpt || selectedQuestion.question}
                    </p>
                  )}
                </section>

                <section className="rounded-xl border border-outline-variant/12 bg-surface-container-low p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-xs font-semibold text-on-surface-variant">
                      {text.verifiedAnswer}
                    </h3>
                    {selectedQuestion.verified_fact ? (
                      <span className={`inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-semibold ${knowledgeTone(selectedQuestion.knowledge_source_status)}`}>
                        {selectedQuestion.knowledge_source_status ?? "pending"}
                      </span>
                    ) : null}
                  </div>
                  <textarea
                    value={answerDraft}
                    onChange={(event) => setAnswerDraft(event.target.value)}
                    placeholder={text.answerPlaceholder}
                    rows={7}
                    className="min-h-[180px] w-full resize-y rounded-xl border border-outline-variant/15 bg-surface-container-lowest px-4 py-3 text-sm leading-6 text-on-surface outline-none transition-all placeholder:text-on-surface-variant/40 focus:border-primary/30 focus:ring-2 focus:ring-primary/15"
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-1">
                      {(["agent_only", "public_ready"] as VerifiedFactVisibility[]).map(
                        (option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setVisibility(option)}
                            className={`h-9 rounded-lg px-3 text-xs font-semibold transition-colors ${
                              visibility === option
                                ? "bg-on-surface text-background"
                                : "text-on-surface-variant hover:bg-surface-container"
                            }`}
                          >
                            {option === "agent_only" ? text.agentOnly : text.publicReady}
                          </button>
                        ),
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => void submitAnswer()}
                      disabled={isSaving || !answerDraft.trim() || selectedQuestion.status === "duplicate"}
                      className="inline-flex h-11 items-center gap-2 rounded-xl bg-on-surface px-4 text-sm font-semibold text-background transition-colors hover:bg-on-surface/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      {isSaving
                        ? text.publishing
                        : selectedQuestion.verified_fact
                          ? text.updateAnswer
                          : text.publish}
                    </button>
                  </div>
                  {selectedQuestion.knowledge_source_error ? (
                    <div className="mt-3 rounded-xl border border-error/15 bg-error/[0.04] p-3 text-sm text-error">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <p className="min-w-0">{selectedQuestion.knowledge_source_error}</p>
                      </div>
                      {selectedQuestion.verified_fact ? (
                        <button
                          type="button"
                          onClick={() => void retryProcessing()}
                          className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-error px-3 text-xs font-semibold text-white"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          {text.retryProcessing}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {selectedQuestion.verified_fact ? (
                    <p className="mt-3 flex items-center gap-2 text-xs font-medium text-on-surface-variant/70">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      {text.addedToKnowledge}
                    </p>
                  ) : null}
                </section>

                {canMarkDuplicate ? (
                  <section className="rounded-xl border border-outline-variant/12 bg-surface-container-low p-4">
                    <h3 className="text-xs font-semibold text-on-surface-variant">
                      {text.duplicate}
                    </h3>
                    <div className="mt-3 flex gap-2">
                      <select
                        value={duplicateTargetId}
                        onChange={(event) => setDuplicateTargetId(event.target.value)}
                        className="h-10 min-w-0 flex-1 rounded-xl border border-outline-variant/15 bg-surface-container-lowest px-3 text-sm text-on-surface outline-none focus:border-primary/25 focus:ring-2 focus:ring-primary/15"
                      >
                        <option value="">{text.chooseOriginal}</option>
                        {duplicateOptions.map((question) => (
                          <option key={question.id} value={question.id}>
                            {question.question}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!duplicateTargetId || isUpdatingStatus}
                        onClick={() => void updateQuestionStatus("mark_duplicate")}
                        className="inline-flex h-10 items-center rounded-xl border border-outline-variant/15 px-3 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:opacity-50"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </section>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/10 p-5">
                {selectedQuestion.widget_session_id ? (
                  <Link
                    href={`/analytics?session=${encodeURIComponent(selectedQuestion.widget_session_id)}`}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-outline-variant/15 px-3 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {text.openConversation}
                  </Link>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  {canReopenQuestion ? (
                    <button
                      type="button"
                      disabled={isUpdatingStatus}
                      onClick={() => void updateQuestionStatus("reopen")}
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-outline-variant/15 px-3 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:opacity-50"
                    >
                      <RotateCcw className="h-4 w-4" />
                      {text.reopen}
                    </button>
                  ) : null}
                  {canDismissQuestion ? (
                    <button
                      type="button"
                      disabled={isUpdatingStatus}
                      onClick={() => void updateQuestionStatus("dismiss")}
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-outline-variant/15 px-3 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:opacity-50"
                    >
                      <Clock3 className="h-4 w-4" />
                      {text.dismiss}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
